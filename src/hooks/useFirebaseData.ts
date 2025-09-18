import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QueryConstraint,
  Unsubscribe,
  FirestoreError
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UseFirebaseDataOptions {
  enabled?: boolean;
  realtime?: boolean;
  dependencies?: any[];
}

interface UseFirebaseDataResult<T> {
  data: T[];
  loading: boolean;
  error: FirestoreError | null;
  refresh: () => Promise<void>;
}

export function useFirebaseData<T = any>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options: UseFirebaseDataOptions = {}
): UseFirebaseDataResult<T> {
  const { enabled = true, realtime = false, dependencies = [] } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const q = query(collection(db, collectionName), ...constraints);
      const snapshot = await getDocs(q);

      const result = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      setData(result);
    } catch (err) {
      console.error(`Error fetching ${collectionName}:`, err);
      setError(err as FirestoreError);
    } finally {
      setLoading(false);
    }
  }, [collectionName, enabled, ...constraints, ...dependencies]);

  useEffect(() => {
    if (!enabled) return;

    if (realtime) {
      // Realtime listener
      const q = query(collection(db, collectionName), ...constraints);

      const unsubscribe = onSnapshot(q,
        (snapshot) => {
          const result = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];

          setData(result);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error(`Error in realtime listener for ${collectionName}:`, err);
          setError(err);
          setLoading(false);
        }
      );

      return unsubscribe;
    } else {
      // One-time fetch
      fetchData();
    }
  }, [fetchData, realtime, enabled]);

  return { data, loading, error, refresh: fetchData };
}

// Batch fetch multiple collections
export function useBatchFirebaseData<T = any>(
  collections: Array<{
    name: string;
    constraints?: QueryConstraint[];
  }>,
  options: UseFirebaseDataOptions = {}
): { [key: string]: UseFirebaseDataResult<T> } {
  const { enabled = true, dependencies = [] } = options;

  const [results, setResults] = useState<{ [key: string]: UseFirebaseDataResult<T> }>({});

  const fetchBatchData = useCallback(async () => {
    if (!enabled) return;

    const batchResults: { [key: string]: UseFirebaseDataResult<T> } = {};

    // Initialize loading states
    collections.forEach(({ name }) => {
      batchResults[name] = {
        data: [],
        loading: true,
        error: null,
        refresh: async () => {}
      };
    });
    setResults({ ...batchResults });

    // Fetch all collections in parallel
    const promises = collections.map(async ({ name, constraints = [] }) => {
      try {
        const q = query(collection(db, name), ...constraints);
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];

        return { name, data, error: null };
      } catch (error) {
        console.error(`Error fetching ${name}:`, error);
        return { name, data: [], error: error as FirestoreError };
      }
    });

    const settled = await Promise.allSettled(promises);

    settled.forEach((result, index) => {
      const collectionName = collections[index].name;

      if (result.status === 'fulfilled') {
        batchResults[collectionName] = {
          data: result.value.data,
          loading: false,
          error: result.value.error,
          refresh: fetchBatchData
        };
      } else {
        batchResults[collectionName] = {
          data: [],
          loading: false,
          error: result.reason,
          refresh: fetchBatchData
        };
      }
    });

    setResults(batchResults);
  }, [enabled, collections, ...dependencies]);

  useEffect(() => {
    fetchBatchData();
  }, [fetchBatchData]);

  return results;
}

// Hook for user statistics
export function useUserStats() {
  return useFirebaseData('users', [], {
    realtime: true
  });
}

// Hook for activity logs with pagination
export function useActivityLogs(limitCount: number = 50) {
  return useFirebaseData('activityLogs', [
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ], {
    realtime: true
  });
}

// Hook for system logs with filtering
export function useSystemLogs(level?: string, category?: string, limitCount: number = 100) {
  const constraints: QueryConstraint[] = [
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ];

  if (level && level !== 'all') {
    constraints.unshift(where('level', '==', level));
  }
  if (category && category !== 'all') {
    constraints.unshift(where('category', '==', category));
  }

  return useFirebaseData('system_logs', constraints);
}