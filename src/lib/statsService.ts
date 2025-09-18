import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface ManagerStats {
  totalStaff: {
    current: number;
    previous: number;
    trend: string;
  };
  weeklyShifts: {
    current: number;
    previous: number;
    trend: string;
  };
  pendingApprovals: {
    current: number;
    trend: 'new' | 'increased' | 'decreased' | 'same';
  };
  monthlyBudget: {
    current: number;
    previous: number;
    trend: string;
    percentage: number;
  };
}

export class StatsService {
  
  /**
   * 店舗の統計情報をリアルタイムで取得（高速化：即座にフォールバック値を返す）
   */
  static subscribeToManagerStats(
    managerId: string,
    callback: (stats: ManagerStats) => void
  ): () => void {
    console.log('⚡ Using fast loading stats (no real-time subscription)');

    // 即座にフォールバック値を返す
    setTimeout(async () => {
      const [totalStaff, weeklyShifts, pendingApprovals, monthlyBudget] = await Promise.all([
        StatsService.getStaffCount(managerId),
        StatsService.getWeeklyShiftsStats(managerId),
        StatsService.getPendingApprovalsStats(managerId),
        StatsService.getMonthlyBudgetStats(managerId)
      ]);

      const stats: ManagerStats = {
        totalStaff,
        weeklyShifts,
        pendingApprovals,
        monthlyBudget
      };

      callback(stats);
    }, 100); // 100ms後に即座にコールバック実行

    // 何もクリーンアップしない空関数を返す
    return () => {
      console.log('⚡ Fast stats - no cleanup needed');
    };
  }

  /**
   * 今週のシフト統計を取得（Firestoreインデックス不要版）
   */
  private static async getWeeklyShiftsStats(managerId: string) {
    console.log('📅 Fetching actual weekly shifts for manager:', managerId);
    
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { locale: ja });
      const weekEnd = endOfWeek(now, { locale: ja });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: ja });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: ja });
      
      // managerIdのみでシフトを取得（複合インデックス不要）
      const shiftsQuery = query(
        collection(db, 'shifts'),
        where('managerId', '==', managerId)
      );
      
      const allShiftsSnapshot = await getDocs(shiftsQuery);
      let currentWeekShifts = 0;
      let previousWeekShifts = 0;
      
      // JavaScript側で日付フィルタリング
      allShiftsSnapshot.forEach(doc => {
        const shiftData = doc.data();
        const shiftDate = shiftData.date?.toDate();
        
        if (shiftDate && shiftData.slots && Array.isArray(shiftData.slots)) {
          const slotsCount = shiftData.slots.length;
          
          // 今週のシフトチェック
          if (shiftDate >= weekStart && shiftDate <= weekEnd) {
            currentWeekShifts += slotsCount;
          }
          
          // 先週のシフトチェック
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

      return {
        current: currentWeekShifts,
        previous: previousWeekShifts,
        trend
      };
    } catch (error) {
      console.error('Error fetching weekly shifts:', error);
      // エラー時はフォールバック値を返す
      return {
        current: 0,
        previous: 0,
        trend: '±0'
      };
    }
  }

  /**
   * 承認待ち件数を取得（実際のFirestoreデータから）
   */
  private static async getPendingApprovalsStats(managerId: string) {
    console.log('⏳ Fetching actual pending approvals for manager:', managerId);
    
    try {
      // シフトリクエストの承認待ち件数を取得
      const shiftRequestsQuery = query(
        collection(db, 'shiftRequests'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      );
      
      const shiftRequestsSnapshot = await getDocs(shiftRequestsQuery);
      const shiftRequestsCount = shiftRequestsSnapshot.size;
      
      // シフト交換の承認待ち件数を取得
      const shiftExchangesQuery = query(
        collection(db, 'shiftExchanges'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      );
      
      const shiftExchangesSnapshot = await getDocs(shiftExchangesQuery);
      const shiftExchangesCount = shiftExchangesSnapshot.size;
      
      const totalPending = shiftRequestsCount + shiftExchangesCount;
      
      // トレンドを判定（3件以上で「new」）
      const trend = totalPending > 3 ? 'new' as const : 
                   totalPending > 0 ? 'increased' as const : 
                   'same' as const;
      
      return {
        current: totalPending,
        trend
      };
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      // エラー時はフォールバック値を返す
      return {
        current: 0,
        trend: 'same' as const
      };
    }
  }

  /**
   * 今月の予算統計を取得（Firestoreインデックス不要版）
   */
  private static async getMonthlyBudgetStats(managerId: string) {
    console.log('💰 Fetching actual budget stats for manager:', managerId);
    
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
      const staffRates = new Map<string, number>();
      
      staffSnapshot.forEach(doc => {
        const staffData = doc.data();
        if (staffData.hourlyRate) {
          staffRates.set(doc.id, staffData.hourlyRate);
        }
      });
      
      // managerIdのみでシフトを取得（複合インデックス不要）
      const shiftsQuery = query(
        collection(db, 'shifts'),
        where('managerId', '==', managerId)
      );
      
      const allShiftsSnapshot = await getDocs(shiftsQuery);
      let currentMonthBudget = 0;
      let previousMonthBudget = 0;
      
      // JavaScript側で日付フィルタリングして人件費を計算
      allShiftsSnapshot.forEach(doc => {
        const shiftData = doc.data();
        const shiftDate = shiftData.date?.toDate();
        
        if (shiftDate && shiftData.slots && Array.isArray(shiftData.slots)) {
          let shiftBudget = 0;
          
          shiftData.slots.forEach((slot: any) => {
            if (slot.assignedStaff && Array.isArray(slot.assignedStaff)) {
              slot.assignedStaff.forEach((staffId: string) => {
                const hourlyRate = staffRates.get(staffId) || 1000; // デフォルト時給1000円
                const startTime = new Date(`2000/01/01 ${slot.startTime}`);
                const endTime = new Date(`2000/01/01 ${slot.endTime}`);
                const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                shiftBudget += hourlyRate * hours;
              });
            }
          });
          
          // 今月のシフトチェック
          if (shiftDate >= monthStart && shiftDate <= monthEnd) {
            currentMonthBudget += shiftBudget;
          }
          
          // 先月のシフトチェック
          if (shiftDate >= lastMonthStart && shiftDate <= lastMonthEnd) {
            previousMonthBudget += shiftBudget;
          }
        }
      });
      
      // k円単位に変換
      const current = Math.round(currentMonthBudget / 1000);
      const previous = Math.round(previousMonthBudget / 1000);
      const percentage = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
      
      return {
        current,
        previous,
        trend: percentage >= 0 ? `+${percentage}%` : `${percentage}%`,
        percentage
      };
    } catch (error) {
      console.error('Error fetching budget stats:', error);
      // エラー時はフォールバック値を返す
      return {
        current: 0,
        previous: 0,
        trend: '±0%',
        percentage: 0
      };
    }
  }

  /**
   * 週次統計情報をワンショットで取得
   */
  static async getWeeklyStatsSnapshot(managerId: string) {
    console.log('📈 Fetching weekly stats snapshot for shop:', managerId);
    
    try {
      const [staffStats, shiftStats, approvalStats, budgetStats] = await Promise.all([
        this.getStaffCount(managerId),
        this.getWeeklyShiftsStats(managerId),
        this.getPendingApprovalsStats(managerId),
        this.getMonthlyBudgetStats(managerId)
      ]);

      return {
        totalStaff: staffStats,
        weeklyShifts: shiftStats,
        pendingApprovals: approvalStats,
        monthlyBudget: budgetStats
      };
    } catch (error) {
      console.error('❌ Error fetching weekly stats snapshot:', error);
      throw error;
    }
  }

  /**
   * スタッフ数を取得（実際のFirestoreデータから）
   */
  private static async getStaffCount(managerId: string) {
    console.log('👥 Fetching actual staff count for manager:', managerId);
    
    try {
      // 現在のスタッフ数を取得
      const staffQuery = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'staff')
      );
      
      const snapshot = await getDocs(staffQuery);
      const current = snapshot.size;
      
      // 前月のスタッフ数（現在は同じ値を使用）
      const previous = current;
      const trend = current > previous ? `+${current - previous}` : current < previous ? `${current - previous}` : '±0';

      return {
        current,
        previous,
        trend
      };
    } catch (error) {
      console.error('Error fetching staff count:', error);
      // エラー時はフォールバック値を返す
      return {
        current: 0,
        previous: 0,
        trend: '±0'
      };
    }
  }
}