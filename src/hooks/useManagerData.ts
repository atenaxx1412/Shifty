import { useDataCache } from './useDataCache';
import { ManagerDataService, ManagerStatsData, fetchOptimizedManagerStats } from '@/lib/managerDataService';
import { User } from '@/types';

/**
 * マネージャー関連の統合データ型
 */
export interface ManagerData {
  /** スタッフ一覧 */
  staff: User[];
  /** ダッシュボード統計 */
  stats: ManagerStatsData;
  /** データ取得日時 */
  lastUpdated: string;
}

/**
 * マネージャー関連データを統合的にキャッシュ管理するフック
 *
 * 特徴:
 * - スタッフデータと統計データを一括取得・キャッシュ
 * - 全ての /manager/ 配下のページで共有
 * - Firebase読み込み回数を大幅削減
 * - 24時間キャッシュでクォータ最適化
 */
export function useManagerData(managerId: string | undefined) {
  // 初期データ定義
  const initialManagerData: ManagerData = {
    staff: [],
    stats: {
      totalStaff: 0,
      weeklyShifts: 0,
      pendingApprovals: 0,
      monthlyBudget: 0,
      staffGrowth: '±0',
      shiftsGrowth: '±0',
      approvalsGrowth: 'same',
      budgetGrowth: '±0%'
    },
    lastUpdated: new Date().toISOString()
  };

  const {
    data: managerData,
    loading,
    error,
    refresh,
    clearCache,
    lastUpdated,
    isFromCache
  } = useDataCache<ManagerData>({
    key: `managerData_${managerId}`,
    fetchFunction: async () => {
      if (!managerId) {
        // managerIdがない場合は初期データを返す
        return initialManagerData;
      }

      console.log('🔄 Fetching integrated manager data...');

      // 並列でスタッフデータと統計データを取得
      const [staff, stats] = await Promise.all([
        ManagerDataService.getOptimizedStaffData(managerId),
        fetchOptimizedManagerStats(managerId) // 正しい関数名に修正
      ]);

      const integratedData: ManagerData = {
        staff,
        stats,
        lastUpdated: new Date().toISOString()
      };

      console.log('✅ Integrated manager data loaded:', {
        staffCount: staff.length,
        statsLoaded: !!stats,
        cacheKey: `managerData_${managerId}`
      });

      return integratedData;
    },
    ttl: 24 * 60 * 60 * 1000, // 24時間キャッシュ
    initialData: initialManagerData
  });

  return {
    // 個別データアクセサ
    staff: managerData?.staff || [],
    stats: managerData?.stats || {
      totalStaff: 0,
      weeklyShifts: 0,
      pendingApprovals: 0,
      monthlyBudget: 0,
      staffGrowth: '±0',
      shiftsGrowth: '±0',
      approvalsGrowth: 'same',
      budgetGrowth: '±0%'
    },

    // 統合データ
    managerData,

    // 状態管理（managerIdがない場合はローディング状態を保持）
    loading: !managerId ? true : loading,
    error,
    lastUpdated,
    isFromCache,

    // アクション
    refresh,
    clearCache,

    // デバッグ情報
    debugInfo: {
      staffCount: managerData?.staff?.length || 0,
      hasStats: !!managerData?.stats,
      cacheAge: lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 1000 / 60) : 0,
      managerId
    }
  };
}

/**
 * スタッフデータのみを取得する軽量版フック
 * チャットページなど、統計データが不要な場合に使用
 */
export function useManagerStaff(managerId: string | undefined) {
  const { staff, loading, error, refresh } = useManagerData(managerId);

  // managerId が未定義の場合の適切な処理
  const isValidManagerId = !!managerId;
  const actualLoading = isValidManagerId ? loading : false;
  const actualError = isValidManagerId ? error : null;

  return {
    staff,
    loading: actualLoading,
    error: actualError,
    refresh,
    // チャット用の形式に変換
    staffList: staff.map(s => ({
      id: s.uid,
      name: s.name || 'スタッフ',
      skills: s.skills || [],
      hourlyRate: s.hourlyRate,
      maxHoursPerWeek: s.maxHoursPerWeek
    }))
  };
}

/**
 * 統計データのみを取得する軽量版フック
 * ダッシュボードなど、スタッフ詳細が不要な場合に使用
 */
export function useManagerStats(managerId: string | undefined) {
  const { stats, loading, error, refresh } = useManagerData(managerId);

  return {
    stats,
    loading,
    error,
    refresh
  };
}

/**
 * デバッグ用: マネージャーデータキャッシュの状況を表示
 */
export function debugManagerDataCache() {
  const cacheKeys = Object.keys(localStorage)
    .filter(key => key.startsWith('cache_managerData_'));

  console.group('📊 Manager Data Cache Status');
  cacheKeys.forEach(key => {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Math.round((Date.now() - cached.timestamp) / 1000 / 60);
      const expires = Math.round((cached.expiresAt - Date.now()) / 1000 / 60);

      console.log(`${key}:`, {
        staffCount: cached.data?.staff?.length || 0,
        hasStats: !!cached.data?.stats,
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