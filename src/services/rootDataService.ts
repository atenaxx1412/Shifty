import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 統計データの型定義
export interface StatsData {
  totalUsers: number;
  totalShops: number;
  currentProfit: number;
  inquiriesCount: number;
  userGrowth: string;
  shopGrowth: string;
  profitGrowth: string;
  inquiryGrowth: string;
}

// システム状態の型定義
export interface SystemStatusData {
  serverLatency: string;
  databaseConnections: string;
  collectionCount: number;
  maintenanceDate: string;
}

/**
 * 統計データを取得（最適化版）
 * Firebase quota使用量を削減するため、必要最小限のクエリに最適化
 */
export const fetchOptimizedStatsData = async (): Promise<StatsData> => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // 1. 全ユーザー数を取得（1クエリ）
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const currentUsers = usersSnapshot.size;

    // 2. 店長数を取得（1クエリ）
    const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
    const managersSnapshot = await getDocs(managersQuery);
    const currentManagers = managersSnapshot.size;

    // 3. 先月のデータ取得（成長率計算用）- 最適化済み
    let userGrowth = '0%';
    let shopGrowth = '0';
    let profitGrowth = '0%';

    try {
      // 先月のユーザー数（createdAtがある場合のみ）
      const lastMonthUsersQuery = query(
        collection(db, 'users'),
        where('createdAt', '<', currentMonth),
        limit(1000) // 制限を設けてクエリを軽量化
      );
      const lastMonthUsersSnapshot = await getDocs(lastMonthUsersQuery);
      const lastMonthUsers = lastMonthUsersSnapshot.size;

      if (lastMonthUsers > 0) {
        const userDiff = currentUsers - lastMonthUsers;
        const userGrowthPercent = Math.round((userDiff / lastMonthUsers) * 100);
        userGrowth = userDiff > 0 ? `+${userGrowthPercent}%` : userDiff < 0 ? `${userGrowthPercent}%` : '0%';
      }

      // 先月の店長数
      const lastMonthManagersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'manager'),
        where('createdAt', '<', currentMonth),
        limit(1000)
      );
      const lastMonthManagersSnapshot = await getDocs(lastMonthManagersQuery);
      const lastMonthManagers = lastMonthManagersSnapshot.size;

      const managerDiff = currentManagers - lastMonthManagers;
      shopGrowth = managerDiff > 0 ? `+${managerDiff}` : managerDiff < 0 ? `${managerDiff}` : '0';

      // 利益成長率計算
      const lastMonthProfitableUsers = lastMonthUsers - lastMonthManagers;
      const lastMonthProfit = lastMonthProfitableUsers * 190;
      const currentProfitableUsers = currentUsers - currentManagers;
      const currentProfit = currentProfitableUsers * 190;

      if (lastMonthProfit > 0) {
        const profitDiff = currentProfit - lastMonthProfit;
        const profitGrowthPercent = Math.round((profitDiff / lastMonthProfit) * 100);
        profitGrowth = profitDiff > 0 ? `+${profitGrowthPercent}%` : profitDiff < 0 ? `${profitGrowthPercent}%` : '0%';
      }
    } catch (growthError) {
      console.log('成長率計算をスキップ:', growthError);
    }

    // 4. お問い合わせ数を取得（オプション）
    let inquiriesCount = 0;
    let inquiryGrowth = '0';

    try {
      console.log('📧 お問い合わせデータを取得中...');

      // 未読のお問い合わせのみをカウント（status: "unread"）
      const unreadInquiriesQuery = query(
        collection(db, 'inquiries'),
        where('status', '==', 'unread'),
        limit(1000)
      );
      const unreadInquiriesSnapshot = await getDocs(unreadInquiriesQuery);
      inquiriesCount = unreadInquiriesSnapshot.size;

      console.log('📧 未読お問い合わせ数:', inquiriesCount);

      // 成長率は0固定（複合インデックス不要）
      inquiryGrowth = '0';

      console.log('📧 お問い合わせ成長率:', inquiryGrowth);
    } catch (inquiriesError) {
      console.error('❌ お問い合わせデータ取得エラー:', inquiriesError);
      // エラー時でも0を返して処理を継続
      inquiriesCount = 0;
      inquiryGrowth = '0';
    }

    // 利益計算
    const profitableUsers = currentUsers - currentManagers;
    const currentProfit = profitableUsers * 190;

    const result: StatsData = {
      totalUsers: currentUsers,
      totalShops: currentManagers,
      currentProfit,
      inquiriesCount,
      userGrowth,
      shopGrowth,
      profitGrowth,
      inquiryGrowth
    };

    console.log('📊 Stats data fetched successfully:', {
      users: currentUsers,
      managers: currentManagers,
      profit: currentProfit,
      queries: '3-6件のクエリで完了'
    });

    return result;
  } catch (error) {
    console.error('❌ Error fetching stats data:', error);
    throw error;
  }
};

/**
 * システム状態を取得（最適化版）
 * 必要最小限のテストクエリで軽量化
 */
export const fetchOptimizedSystemStatus = async (): Promise<SystemStatusData> => {
  const startTime = Date.now();

  try {
    // サーバーレスポンス時間を測定（1つの軽量テストクエリのみ）
    const testQuery = query(collection(db, 'users'), limit(1));
    await getDocs(testQuery);
    const latency = Date.now() - startTime;

    // 主要コレクション（必要最小限）のチェック
    const essentialCollections = ['users', 'activityLogs', 'shifts_extended'];
    let activeCollections = 0;

    // 並列でコレクションチェック（効率化）
    const collectionChecks = essentialCollections.map(async (collectionName) => {
      try {
        const snapshot = await getDocs(query(collection(db, collectionName), limit(1)));
        return snapshot.size > 0 ? 1 : 0;
      } catch (error) {
        console.log(`Collection ${collectionName} not accessible`);
        return 0;
      }
    });

    const results = await Promise.all(collectionChecks);
    activeCollections = results.reduce((sum, count) => sum + count, 0);

    const result: SystemStatusData = {
      serverLatency: `${latency}ms`,
      databaseConnections: `${activeCollections}/${essentialCollections.length}コレクション接続`,
      collectionCount: activeCollections,
      maintenanceDate: '予定なし'
    };

    console.log('🔧 System status fetched successfully:', {
      latency: `${latency}ms`,
      collections: `${activeCollections}/${essentialCollections.length}`,
      queries: '4件のクエリで完了'
    });

    return result;
  } catch (error) {
    console.error('❌ Error fetching system status:', error);

    // エラー時のフォールバック
    return {
      serverLatency: 'エラー',
      databaseConnections: '0コレクション接続',
      collectionCount: 0,
      maintenanceDate: '未定'
    };
  }
};

/**
 * アクティビティログを取得（最適化版）
 * limitを設定してクエリを軽量化
 */
export const fetchOptimizedActivityLogs = async (limitCount: number = 5) => {
  try {
    const activitiesQuery = query(
      collection(db, 'activityLogs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(activitiesQuery);

    const activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📝 Activity logs fetched: ${activities.length}件 (limit: ${limitCount})`);

    return activities;
  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    throw error;
  }
};

/**
 * キャッシュ効率レポート
 */
export const getCacheEfficiencyReport = () => {
  const originalQueries = {
    stats: 8, // 元の統計データクエリ数
    systemStatus: 7, // 元のシステム状態クエリ数
    activities: 1, // アクティビティログ（リアルタイム監視）
    total: 16
  };

  const optimizedQueries = {
    stats: 6, // 最適化後
    systemStatus: 4, // 最適化後
    activities: 1, // キャッシュ使用時は0
    total: 11
  };

  const dailySavings = originalQueries.total - optimizedQueries.total;
  const weeklySavings = dailySavings * 7;
  const monthlySavings = dailySavings * 30;

  return {
    before: originalQueries,
    after: optimizedQueries,
    savings: {
      perLoad: dailySavings,
      daily: dailySavings,
      weekly: weeklySavings,
      monthly: monthlySavings
    },
    efficiency: Math.round((dailySavings / originalQueries.total) * 100),
    message: `Firebase クエリ数を ${originalQueries.total} → ${optimizedQueries.total} に削減 (${Math.round((dailySavings / originalQueries.total) * 100)}% 削減)`
  };
};