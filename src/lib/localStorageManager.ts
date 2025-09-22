/**
 * ローカルストレージ統一管理クラス
 * TTL付きキャッシュ機能とチャット履歴制限機能を提供
 */
export class LocalStorageManager {
  private static readonly PREFIX = 'shifty_';
  private static readonly CACHE_DURATIONS = {
    staff: 24 * 60 * 60 * 1000, // 24時間
    templates: 7 * 24 * 60 * 60 * 1000, // 7日間
    shifts: 60 * 60 * 1000, // 1時間
    chat: 45 * 24 * 60 * 60 * 1000 // 1.5ヶ月
  };

  /**
   * TTL付きでデータを保存
   */
  static setWithExpiry(key: string, data: any, ttl?: number): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.CACHE_DURATIONS.staff
      };
      localStorage.setItem(this.PREFIX + key, JSON.stringify(item));
      console.log(`💾 Cached: ${key} (TTL: ${ttl || this.CACHE_DURATIONS.staff}ms)`);
    } catch (error) {
      console.warn('⚠️ LocalStorage write failed:', error);
    }
  }

  /**
   * TTLチェック付きでデータを取得
   */
  static getWithExpiry<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();

      // TTL期限切れチェック
      if (now - parsed.timestamp > parsed.ttl) {
        this.remove(key);
        console.log(`🗑️ Expired cache removed: ${key}`);
        return null;
      }

      console.log(`📖 Cache hit: ${key}`);
      return parsed.data as T;
    } catch (error) {
      console.warn('⚠️ LocalStorage read failed:', error);
      this.remove(key);
      return null;
    }
  }

  /**
   * キャッシュエントリを削除
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
      console.log(`🗑️ Cache removed: ${key}`);
    } catch (error) {
      console.warn('⚠️ LocalStorage remove failed:', error);
    }
  }

  /**
   * 特定プレフィックスのキャッシュをクリア
   */
  static clearByPrefix(prefix: string): void {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PREFIX + prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`🧹 Cleared ${keysToRemove.length} cache entries with prefix: ${prefix}`);
    } catch (error) {
      console.warn('⚠️ LocalStorage clear failed:', error);
    }
  }

  /**
   * チャット履歴の1.5ヶ月制限クリーンアップ
   */
  static cleanupChatHistory(): void {
    try {
      const cutoffDate = Date.now() - this.CACHE_DURATIONS.chat;
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PREFIX + 'chat_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (item.timestamp && item.timestamp < cutoffDate) {
              keysToRemove.push(key);
            }
          } catch (parseError) {
            // 無効なデータも削除対象
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`🧹 Cleaned up ${keysToRemove.length} old chat history entries`);
    } catch (error) {
      console.warn('⚠️ Chat history cleanup failed:', error);
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  static getCacheStats(): {
    totalEntries: number;
    totalSize: number;
    byCategory: Record<string, number>;
  } {
    const stats = {
      totalEntries: 0,
      totalSize: 0,
      byCategory: {} as Record<string, number>
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            stats.totalEntries++;
            stats.totalSize += value.length;

            // カテゴリ別集計
            const category = key.replace(this.PREFIX, '').split('_')[0];
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Cache stats calculation failed:', error);
    }

    return stats;
  }

  /**
   * ストレージ使用量が上限に近い場合の自動クリーンアップ
   */
  static autoCleanupIfNeeded(): void {
    try {
      const stats = this.getCacheStats();
      const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB制限

      if (stats.totalSize > STORAGE_LIMIT * 0.8) { // 80%を超えた場合
        console.warn('⚠️ Storage usage high, performing cleanup...');

        // 古いエントリから削除
        const entries: { key: string; timestamp: number }[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.PREFIX)) {
            try {
              const item = JSON.parse(localStorage.getItem(key) || '{}');
              if (item.timestamp) {
                entries.push({ key, timestamp: item.timestamp });
              }
            } catch (parseError) {
              // 無効なエントリも削除対象
              entries.push({ key, timestamp: 0 });
            }
          }
        }

        // 古い順でソート
        entries.sort((a, b) => a.timestamp - b.timestamp);

        // 古いエントリの1/3を削除
        const deleteCount = Math.floor(entries.length / 3);
        for (let i = 0; i < deleteCount; i++) {
          localStorage.removeItem(entries[i].key);
        }

        console.log(`🧹 Auto-cleanup removed ${deleteCount} old cache entries`);
      }
    } catch (error) {
      console.warn('⚠️ Auto cleanup failed:', error);
    }
  }

  /**
   * 初期化時に古いデータのクリーンアップを実行
   */
  static initialize(): void {
    console.log('📦 LocalStorageManager initializing...');

    // チャット履歴のクリーンアップ
    this.cleanupChatHistory();

    // 必要に応じて自動クリーンアップ
    this.autoCleanupIfNeeded();

    const stats = this.getCacheStats();
    console.log('📊 Cache stats:', stats);

    console.log('✅ LocalStorageManager initialized');
  }
}

// アプリ起動時の初期化
if (typeof window !== 'undefined') {
  LocalStorageManager.initialize();
}