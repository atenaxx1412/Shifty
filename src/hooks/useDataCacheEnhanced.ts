import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number; // キャッシュバージョン管理
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
  /** データ更新後の自動キャッシュクリア */
  autoInvalidateOnUpdate?: boolean;
}

/**
 * 改良版 localStorageベースのデータキャッシュフック
 *
 * 新機能:
 * - データ更新後の自動キャッシュ無効化
 * - 複数タブ間でのキャッシュ同期
 * - キャッシュバージョン管理
 * - より強力な上書き保護
 */
export function useDataCacheEnhanced<T>(options: CacheOptions) {
  const {
    ttl = 24 * 60 * 60 * 1000, // 24時間
    key,
    fetchFunction,
    initialData,
    autoInvalidateOnUpdate = true
  } = options;

  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cacheVersion, setCacheVersion] = useState(1);

  // キャッシュ更新検知用
  const storageEventRef = useRef<((e: StorageEvent) => void) | null>(null);

  // キャッシュからデータを読み込む（バージョン管理付き）
  const loadFromCache = useCallback((): CacheData<T> | null => {
    try {
      const cached = localStorage.getItem(`cache_${key}`);
      if (!cached) return null;

      const parsedCache: CacheData<T> = JSON.parse(cached);
      const now = Date.now();

      // 有効期限をチェック
      if (now > parsedCache.expiresAt) {
        console.log(`⏰ Cache expired for ${key}, removing...`);
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      // バージョンチェック（オプション）
      if (parsedCache.version && parsedCache.version < cacheVersion) {
        console.log(`🔄 Cache version outdated for ${key}, refreshing...`);
        localStorage.removeItem(`cache_${key}`);
        return null;
      }

      return parsedCache;
    } catch (error) {
      console.error(`❌ Cache read error for key ${key}:`, error);
      localStorage.removeItem(`cache_${key}`);
      return null;
    }
  }, [key, cacheVersion]);

  // キャッシュにデータを保存（バージョン管理付き）
  const saveToCache = useCallback((newData: T, version?: number) => {
    try {
      const now = Date.now();
      const cacheData: CacheData<T> = {
        data: newData,
        timestamp: now,
        expiresAt: now + ttl,
        version: version || cacheVersion
      };

      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
      setLastUpdated(new Date(now));

      // 他のタブに変更を通知
      window.dispatchEvent(new CustomEvent(`cache-updated-${key}`, {
        detail: { version: cacheData.version, timestamp: now }
      }));

      console.log(`💾 Cache saved for ${key} (version: ${cacheData.version})`);
    } catch (error) {
      console.error(`❌ Cache save error for key ${key}:`, error);
    }
  }, [key, ttl, cacheVersion]);

  // Firebaseからデータを取得（改良版）
  const fetchData = useCallback(async (forceRefresh = false, incrementVersion = false) => {
    try {
      setLoading(true);
      setError(null);

      // バージョンを増加（データ更新後の場合）
      if (incrementVersion) {
        setCacheVersion(prev => prev + 1);
      }

      // 強制更新でない場合はキャッシュをチェック
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (cached) {
          setData(cached.data);
          setLastUpdated(new Date(cached.timestamp));
          setLoading(false);
          console.log(`✅ Cache hit for ${key} (version: ${cached.version})`, {
            age: Math.round((Date.now() - cached.timestamp) / 1000 / 60) + ' minutes'
          });
          return cached.data;
        }
      }

      // Firebaseからデータを取得
      console.log(`🔄 Fetching fresh data for ${key}${forceRefresh ? ' (forced)' : ''}...`);
      const freshData = await fetchFunction();

      setData(freshData);
      saveToCache(freshData, incrementVersion ? cacheVersion + 1 : cacheVersion);
      setLoading(false);

      console.log(`✅ Fresh data loaded for ${key}`, {
        dataPreview: Array.isArray(freshData) ? `Array(${freshData.length})` : typeof freshData
      });
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
  }, [key, fetchFunction, loadFromCache, saveToCache, cacheVersion]);

  // 手動更新関数（強力な上書き）
  const refresh = useCallback(() => {
    console.log(`🔄 Manual refresh requested for ${key}`);
    return fetchData(true, false);
  }, [fetchData, key]);

  // データ更新後のキャッシュ無効化
  const invalidateAfterUpdate = useCallback(() => {
    console.log(`🗑️ Invalidating cache after data update for ${key}`);
    localStorage.removeItem(`cache_${key}`);
    setLastUpdated(null);
    setCacheVersion(prev => prev + 1);
    return fetchData(true, true);
  }, [key, fetchData]);

  // キャッシュをクリア
  const clearCache = useCallback(() => {
    localStorage.removeItem(`cache_${key}`);
    setLastUpdated(null);
    setCacheVersion(prev => prev + 1);
    console.log(`🗑️ Cache cleared for ${key}`);
  }, [key]);

  // 複数タブ間での同期（StorageEvent + CustomEvent）
  useEffect(() => {
    // localStorage変更の監視
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `cache_${key}` && e.newValue) {
        try {
          const newCache: CacheData<T> = JSON.parse(e.newValue);
          if (newCache.version > cacheVersion) {
            console.log(`🔄 Cross-tab sync detected for ${key}, updating...`);
            setData(newCache.data);
            setLastUpdated(new Date(newCache.timestamp));
            setCacheVersion(newCache.version);
          }
        } catch (error) {
          console.error(`❌ Cross-tab sync error for ${key}:`, error);
        }
      }
    };

    // CustomEvent監視（より確実な同期）
    const handleCacheUpdate = (e: CustomEvent) => {
      const { version, timestamp } = e.detail;
      if (version > cacheVersion) {
        console.log(`🔄 Cache update event received for ${key}`);
        fetchData(false, false);
      }
    };

    storageEventRef.current = handleStorageChange;
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(`cache-updated-${key}`, handleCacheUpdate as EventListener);

    return () => {
      if (storageEventRef.current) {
        window.removeEventListener('storage', storageEventRef.current);
      }
      window.removeEventListener(`cache-updated-${key}`, handleCacheUpdate as EventListener);
    };
  }, [key, cacheVersion, fetchData]);

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
      fetchData(true, false);

      // 翌日からは24時間間隔で更新
      const intervalId = setInterval(() => {
        console.log(`🕛 Daily auto-refresh for ${key}`);
        fetchData(true, false);
      }, 24 * 60 * 60 * 1000);

      return () => clearInterval(intervalId);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, [key, fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    clearCache,
    invalidateAfterUpdate, // 新機能: データ更新後の自動無効化
    cacheVersion, // デバッグ用
    isFromCache: !loading && !error && lastUpdated !== null
  };
}

// キャッシュ状態をグローバル監視する関数
export function getCacheStatus(key: string) {
  try {
    const cached = localStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const parsedCache = JSON.parse(cached);
    const now = Date.now();
    const age = Math.round((now - parsedCache.timestamp) / 1000 / 60);
    const expires = Math.round((parsedCache.expiresAt - now) / 1000 / 60);

    return {
      key,
      age: `${age}分前`,
      expires: expires > 0 ? `${expires}分後に期限切れ` : '期限切れ',
      version: parsedCache.version || 1,
      size: JSON.stringify(parsedCache.data).length + ' bytes',
      isValid: expires > 0
    };
  } catch (error) {
    return { key, error: '破損データ' };
  }
}

// 全キャッシュの強制クリア（デバッグ用）
export function clearAllCaches() {
  const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
  cacheKeys.forEach(key => localStorage.removeItem(key));
  console.log(`🗑️ Cleared ${cacheKeys.length} cache entries`);
  return cacheKeys.length;
}