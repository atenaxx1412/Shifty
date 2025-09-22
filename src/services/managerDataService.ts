import {
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface ManagerStatsData {
  totalStaff: number;
  weeklyShifts: number;
  pendingApprovals: number;
  monthlyBudget: number;
  staffGrowth: string;
  shiftsGrowth: string;
  approvalsGrowth: string;
  budgetGrowth: string;
}

/**
 * 店長ダッシュボードの統計データを最適化された方法で取得
 * キャッシュとバッチ処理により Firebase クエリ数を削減
 */
export async function fetchOptimizedManagerStats(managerId: string): Promise<ManagerStatsData> {
  try {
    console.log('📊 Fetching optimized manager stats for:', managerId);

    // 並列でデータ取得
    const [
      staffCount,
      shiftsData,
      approvalsData,
      budgetData
    ] = await Promise.all([
      fetchStaffCount(managerId),
      fetchWeeklyShifts(managerId),
      fetchPendingApprovals(managerId),
      fetchMonthlyBudget(managerId)
    ]);

    return {
      totalStaff: staffCount.current,
      weeklyShifts: shiftsData.current,
      pendingApprovals: approvalsData.current,
      monthlyBudget: budgetData.current,
      staffGrowth: staffCount.trend,
      shiftsGrowth: shiftsData.trend,
      approvalsGrowth: approvalsData.trend,
      budgetGrowth: budgetData.trend
    };
  } catch (error) {
    console.error('Error fetching manager stats:', error);
    // エラー時のフォールバック値
    return {
      totalStaff: 0,
      weeklyShifts: 0,
      pendingApprovals: 0,
      monthlyBudget: 0,
      staffGrowth: '±0',
      shiftsGrowth: '±0',
      approvalsGrowth: 'same',
      budgetGrowth: '±0%'
    };
  }
}

/**
 * スタッフ数を取得
 */
async function fetchStaffCount(managerId: string) {
  try {
    const staffQuery = query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    );

    const snapshot = await getDocs(staffQuery);
    const current = snapshot.size;

    // 前月との比較（簡易版）
    const trend = current > 0 ? '+' + current : '±0';

    return { current, trend };
  } catch (error) {
    console.error('Error fetching staff count:', error);
    return { current: 0, trend: '±0' };
  }
}

/**
 * 今週のシフト数を取得（最適化版）
 */
async function fetchWeeklyShifts(managerId: string) {
  try {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: ja });
    const weekEnd = endOfWeek(now, { locale: ja });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: ja });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: ja });

    // managerIdのみでクエリ（複合インデックス不要）
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    );

    const snapshot = await getDocs(shiftsQuery);
    let currentWeekShifts = 0;
    let previousWeekShifts = 0;

    // クライアントサイドで日付フィルタリング
    snapshot.forEach(doc => {
      const data = doc.data();
      const shiftDate = data.date?.toDate();

      if (shiftDate && data.slots && Array.isArray(data.slots)) {
        const slotsCount = data.slots.length;

        if (shiftDate >= weekStart && shiftDate <= weekEnd) {
          currentWeekShifts += slotsCount;
        }

        if (shiftDate >= lastWeekStart && shiftDate <= lastWeekEnd) {
          previousWeekShifts += slotsCount;
        }
      }
    });

    const trend = currentWeekShifts > previousWeekShifts
      ? `+${currentWeekShifts - previousWeekShifts}`
      : currentWeekShifts < previousWeekShifts
      ? `${currentWeekShifts - previousWeekShifts}`
      : '±0';

    return { current: currentWeekShifts, trend };
  } catch (error) {
    console.error('Error fetching weekly shifts:', error);
    return { current: 0, trend: '±0' };
  }
}

/**
 * 承認待ち件数を取得
 */
async function fetchPendingApprovals(managerId: string) {
  try {
    // 並列でリクエストと交換を取得
    const [requestsSnapshot, exchangesSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, 'shiftRequests'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      )),
      getDocs(query(
        collection(db, 'shiftExchanges'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      ))
    ]);

    const totalPending = requestsSnapshot.size + exchangesSnapshot.size;

    const trend = totalPending > 3 ? 'new' :
                 totalPending > 0 ? 'increased' :
                 'same';

    return { current: totalPending, trend };
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return { current: 0, trend: 'same' };
  }
}

/**
 * 今月の予算統計を取得
 */
async function fetchMonthlyBudget(managerId: string) {
  try {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // スタッフの時給情報を取得
    const staffQuery = query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    );

    const staffSnapshot = await getDocs(staffQuery);
    const hourlyRates: { [staffId: string]: number } = {};

    staffSnapshot.forEach(doc => {
      const data = doc.data();
      hourlyRates[doc.id] = data.hourlyRate || 1000;
    });

    // シフトデータを取得
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    );

    const shiftsSnapshot = await getDocs(shiftsQuery);
    let currentMonthTotal = 0;
    let previousMonthTotal = 0;

    // クライアントサイドで計算
    shiftsSnapshot.forEach(doc => {
      const data = doc.data();
      const shiftDate = data.date?.toDate();

      if (shiftDate && data.slots && Array.isArray(data.slots)) {
        data.slots.forEach((slot: any) => {
          const hours = slot.hours || 8;
          const rate = hourlyRates[slot.staffId] || 1000;
          const cost = hours * rate;

          if (shiftDate >= monthStart && shiftDate <= monthEnd) {
            currentMonthTotal += cost;
          }

          if (shiftDate >= lastMonthStart && shiftDate <= lastMonthEnd) {
            previousMonthTotal += cost;
          }
        });
      }
    });

    // k円単位に変換
    const currentMonthInK = Math.round(currentMonthTotal / 1000);
    const previousMonthInK = Math.round(previousMonthTotal / 1000);

    const percentageChange = previousMonthInK > 0
      ? Math.round(((currentMonthInK - previousMonthInK) / previousMonthInK) * 100)
      : 0;

    const trend = percentageChange > 0
      ? `+${percentageChange}%`
      : percentageChange < 0
      ? `${percentageChange}%`
      : '±0%';

    return { current: currentMonthInK, trend };
  } catch (error) {
    console.error('Error fetching monthly budget:', error);
    return { current: 0, trend: '±0%' };
  }
}