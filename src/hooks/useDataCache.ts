import { useState, useEffect, useCallback } from 'react';

interface CacheData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheOptions {
  /** キャッシュの有効期限（ミリ秒）。デフォルト: 24時間 */
  ttl?: number;
  /** キャッシュキー */
  key: string;
  /** データ取得関数 */
  fetchFunction: () => Promise<any>;
  /** 初期データ */
  initialData?: any;
}

/**
 * localStorageベースのデータキャッシュフック
 *
 * 機能:
 * - 1日1回の自動更新（午前0時または初回アクセス時）
 * - 手動更新機能
 * - エラーハンドリングとフォールバック
 * - Firebase quota使用量削減
 */
export function useDataCache<T>({
  ttl = 24 * 60 * 60 * 1000, // 24時間
  key,
  fetchFunction,
  initialData
}: CacheOptions) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // キャッシュからデータを読み込む
  const loadFromCache = useCallback((): CacheData<T> | null => {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) return null;

      const parsedCache: CacheData<T> = JSON.parse(cached);
      const now = Date.now();

      // 有効期限をチェック
      if (now > parsedCache.expiresAt) {
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      return parsedCache;
    } catch (error) {
      console.error(`Cache read error for key ${key}:`, error);
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
  }, [key]);

  // キャッシュにデータを保存
  const saveToCache = useCallback((newData: T) => {
    try {
      const now = Date.now();
      const cacheData: CacheData<T> = {
        data: newData,
        timestamp: now,
        expiresAt: now + ttl
      };

      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
      setLastUpdated(new Date(now));
    } catch (error) {
      console.error(`Cache save error for key ${key}:`, error);
    }
  }, [key, ttl]);

  // Firebaseからデータを取得
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // 強制更新でない場合はキャッシュをチェック
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (cached) {
          setData(cached.data);
          setLastUpdated(new Date(cached.timestamp));
          setLoading(false);
          console.log(`✅ Cache hit for ${key}`, {
            data: cached.data,
            age: Math.round((Date.now() - cached.timestamp) / 1000 / 60) + ' minutes'
          });
          return cached.data;
        }
      }

      // Firebaseからデータを取得
      console.log(`🔄 Fetching fresh data for ${key}...`);
      const freshData = await fetchFunction();

      setData(freshData);
      saveToCache(freshData);
      setLoading(false);

      console.log(`✅ Fresh data loaded for ${key}`, freshData);
      return freshData;
    } catch (err) {
      console.error(`❌ Error fetching data for ${key}:`, err);
      setError(err as Error);
      setLoading(false);

      // エラー時はキャッシュデータを使用（フォールバック）
      const cached = loadFromCache();
      if (cached) {
        console.log(`🔄 Using cached data as fallback for ${key}`);
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        return cached.data;
      }

      throw err;
    }
  }, [key, fetchFunction, ttl]); // loadFromCache、saveToCacheの依存関係を削除

  // 手動更新関数
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // キャッシュをクリア
  const clearCache = useCallback(() => {
    localStorage.removeItem(`cache_${key}`);
    setLastUpdated(null);
    console.log(`🗑️ Cache cleared for ${key}`);
  }, [key]);

  // 初回マウント時にデータを読み込み
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 午前0時に自動更新（1日1回）
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      console.log(`🕛 Midnight auto-refresh for ${key}`);
      fetchData(true);

      // 翌日からは24時間間隔で更新
      const intervalId = setInterval(() => {
        console.log(`🕛 Daily auto-refresh for ${key}`);
        fetchData(true);
      }, 24 * 60 * 60 * 1000);

      return () => clearInterval(intervalId);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    clearCache,
    isFromCache: !loading && !error && lastUpdated !== null
  };
}

// デバッグ用: 全キャッシュデータを表示
export function debugCacheStatus() {
  const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));

  console.group('📊 Cache Status');
  cacheKeys.forEach(key => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Math.round((Date.now() - cached.timestamp) / 1000 / 60);
      const expires = Math.round((cached.expiresAt - Date.now()) / 1000 / 60);

      console.log(`${key}:`, {
        age: `${age}分前`,
        expires: expires > 0 ? `${expires}分後に期限切れ` : '期限切れ',
        size: JSON.stringify(cached.data).length + ' bytes'
      });
    } catch (error) {
      console.log(`${key}: 破損データ`);
    }
  });
  console.groupEnd();
}

// クォータ節約用: キャッシュ効率の測定
export function getCacheEfficiency() {
  const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
  let totalHits = 0;
  let totalMisses = 0;

  // 簡易的な効率測定（実際のプロダクションでは別途追跡が必要）
  return {
    cacheCount: cacheKeys.length,
    estimatedSavings: cacheKeys.length * 24, // 1日分のクエリ削減数
    message: `キャッシュにより約${cacheKeys.length * 24}件/日のFirebaseクエリを削減`
  };
}