/**
 * キャッシュ上書き問題の検証とテスト用ユーティリティ
 */

import { getCacheStatus, clearAllCaches } from '@/hooks/useDataCacheEnhanced';

export interface CacheTestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: Date;
}

export class CacheOverwriteTestSuite {
  private results: CacheTestResult[] = [];

  /**
   * テスト1: 基本的なキャッシュ機能テスト
   */
  async testBasicCaching(): Promise<CacheTestResult> {
    const testName = 'Basic Caching Test';

    try {
      // テストデータをローカルストレージに保存
      const testKey = 'test-basic-cache';
      const testData = { id: 1, name: 'Test Data', timestamp: Date.now() };
      const cacheData = {
        data: testData,
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        version: 1
      };

      localStorage.setItem(`cache_${testKey}`, JSON.stringify(cacheData));

      // キャッシュ状態を確認
      const status = getCacheStatus(testKey);
      const passed = status !== null && status.isValid;

      // クリーンアップ
      localStorage.removeItem(`cache_${testKey}`);

      const result: CacheTestResult = {
        testName,
        passed,
        details: passed
          ? `✅ Cache stored and retrieved successfully. Age: ${status?.age}, Size: ${status?.size}`
          : `❌ Cache test failed. Status: ${JSON.stringify(status)}`,
        timestamp: new Date()
      };

      this.results.push(result);
      return result;
    } catch (error) {
      const result: CacheTestResult = {
        testName,
        passed: false,
        details: `❌ Exception during test: ${error}`,
        timestamp: new Date()
      };
      this.results.push(result);
      return result;
    }
  }

  /**
   * テスト2: キャッシュ有効期限テスト
   */
  async testCacheExpiration(): Promise<CacheTestResult> {
    const testName = 'Cache Expiration Test';

    try {
      const testKey = 'test-expiration-cache';
      const testData = { id: 2, name: 'Expiring Data' };

      // 既に期限切れのキャッシュを作成
      const expiredCacheData = {
        data: testData,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25時間前
        expiresAt: Date.now() - 1 * 60 * 60 * 1000,  // 1時間前に期限切れ
        version: 1
      };

      localStorage.setItem(`cache_${testKey}`, JSON.stringify(expiredCacheData));

      // キャッシュ状態を確認（期限切れのため null が返されるはず）
      const status = getCacheStatus(testKey);
      const passed = status === null || !status.isValid;

      const result: CacheTestResult = {
        testName,
        passed,
        details: passed
          ? '✅ Expired cache correctly identified and handled'
          : `❌ Expired cache not handled properly. Status: ${JSON.stringify(status)}`,
        timestamp: new Date()
      };

      // クリーンアップ
      localStorage.removeItem(`cache_${testKey}`);
      this.results.push(result);
      return result;
    } catch (error) {
      const result: CacheTestResult = {
        testName,
        passed: false,
        details: `❌ Exception during test: ${error}`,
        timestamp: new Date()
      };
      this.results.push(result);
      return result;
    }
  }

  /**
   * テスト3: キャッシュバージョン管理テスト
   */
  async testCacheVersioning(): Promise<CacheTestResult> {
    const testName = 'Cache Versioning Test';

    try {
      const testKey = 'test-version-cache';

      // 古いバージョンのキャッシュを作成
      const oldVersionCache = {
        data: { id: 3, name: 'Old Version' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        version: 1
      };

      localStorage.setItem(`cache_${testKey}`, JSON.stringify(oldVersionCache));

      // 新しいバージョンのキャッシュで上書き
      const newVersionCache = {
        data: { id: 3, name: 'New Version' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        version: 2
      };

      localStorage.setItem(`cache_${testKey}`, JSON.stringify(newVersionCache));

      // 状態確認
      const status = getCacheStatus(testKey);
      const passed = status !== null && status.version === 2;

      const result: CacheTestResult = {
        testName,
        passed,
        details: passed
          ? `✅ Cache version correctly updated to version ${status?.version}`
          : `❌ Cache version not updated correctly. Status: ${JSON.stringify(status)}`,
        timestamp: new Date()
      };

      // クリーンアップ
      localStorage.removeItem(`cache_${testKey}`);
      this.results.push(result);
      return result;
    } catch (error) {
      const result: CacheTestResult = {
        testName,
        passed: false,
        details: `❌ Exception during test: ${error}`,
        timestamp: new Date()
      };
      this.results.push(result);
      return result;
    }
  }

  /**
   * テスト4: 複数キャッシュエントリのテスト
   */
  async testMultipleCacheEntries(): Promise<CacheTestResult> {
    const testName = 'Multiple Cache Entries Test';

    try {
      const testKeys = ['test-multi-1', 'test-multi-2', 'test-multi-3'];
      const testDataArray = testKeys.map((key, index) => ({
        key,
        data: { id: index + 1, name: `Multi Test ${index + 1}` }
      }));

      // 複数のキャッシュエントリを作成
      testDataArray.forEach(({ key, data }) => {
        const cacheData = {
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          version: 1
        };
        localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData));
      });

      // 全てのキャッシュエントリが存在することを確認
      const statuses = testKeys.map(key => getCacheStatus(key));
      const allValid = statuses.every(status => status !== null && status.isValid);

      const result: CacheTestResult = {
        testName,
        passed: allValid,
        details: allValid
          ? `✅ All ${testKeys.length} cache entries created and retrieved successfully`
          : `❌ Some cache entries failed. Valid: ${statuses.filter(s => s && s.isValid).length}/${testKeys.length}`,
        timestamp: new Date()
      };

      // クリーンアップ
      testKeys.forEach(key => localStorage.removeItem(`cache_${key}`));
      this.results.push(result);
      return result;
    } catch (error) {
      const result: CacheTestResult = {
        testName,
        passed: false,
        details: `❌ Exception during test: ${error}`,
        timestamp: new Date()
      };
      this.results.push(result);
      return result;
    }
  }

  /**
   * 全テストを実行
   */
  async runAllTests(): Promise<CacheTestResult[]> {
    console.log('🧪 Starting Cache Overwrite Test Suite...');

    const tests = [
      this.testBasicCaching(),
      this.testCacheExpiration(),
      this.testCacheVersioning(),
      this.testMultipleCacheEntries()
    ];

    const results = await Promise.all(tests);

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    console.log(`🧪 Cache Test Suite Complete: ${passed}/${total} tests passed`);

    results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}: ${result.details}`);
    });

    return results;
  }

  /**
   * テスト結果の取得
   */
  getResults(): CacheTestResult[] {
    return this.results;
  }

  /**
   * 現在のキャッシュ状態のスナップショット
   */
  getCurrentCacheSnapshot(): { [key: string]: any } {
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
    const snapshot: { [key: string]: any } = {};

    allKeys.forEach(fullKey => {
      const key = fullKey.replace('cache_', '');
      snapshot[key] = getCacheStatus(key);
    });

    return snapshot;
  }

  /**
   * キャッシュクリーンアップ
   */
  cleanup(): number {
    return clearAllCaches();
  }
}

// 実用的なキャッシュ診断関数
export function diagnoseCacheIssues(): {
  totalCaches: number;
  expiredCaches: number;
  validCaches: number;
  totalSize: number;
  recommendations: string[];
} {
  const allKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
  const statuses = allKeys.map(fullKey => {
    const key = fullKey.replace('cache_', '');
    return getCacheStatus(key);
  }).filter(status => status !== null);

  const expiredCaches = statuses.filter(s => !s.isValid).length;
  const validCaches = statuses.filter(s => s.isValid).length;
  const totalSize = statuses.reduce((sum, s) => {
    const sizeStr = s.size?.toString() || '0';
    const sizeNum = parseInt(sizeStr.replace(/[^0-9]/g, '')) || 0;
    return sum + sizeNum;
  }, 0);

  const recommendations: string[] = [];

  if (expiredCaches > 0) {
    recommendations.push(`${expiredCaches}個の期限切れキャッシュをクリアしてください`);
  }

  if (totalSize > 5 * 1024 * 1024) { // 5MB以上
    recommendations.push('キャッシュサイズが大きいです。不要なキャッシュを削除を検討してください');
  }

  if (validCaches === 0) {
    recommendations.push('有効なキャッシュがありません。アプリケーションのパフォーマンスが低下している可能性があります');
  }

  return {
    totalCaches: allKeys.length,
    expiredCaches,
    validCaches,
    totalSize,
    recommendations
  };
}

// ブラウザコンソールで実行可能なグローバル関数として公開
if (typeof window !== 'undefined') {
  (window as any).cacheTestSuite = new CacheOverwriteTestSuite();
  (window as any).diagnoseCacheIssues = diagnoseCacheIssues;
  (window as any).clearAllCaches = clearAllCaches;
}