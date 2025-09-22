import { userService } from './userService';
import { ShiftManagementService } from './shiftService';
import { StaffingTemplateService } from './staffingTemplateService';
import { SimpleChatService } from './simpleChatService';
import { LocalStorageManager } from './localStorageManager';
import { User } from '@/types';

/**
 * Manager機能統一データアクセスサービス
 * Firebase使用量削減とパフォーマンス最適化を提供
 */
export class ManagerDataService {
  private static readonly CACHE_KEYS = {
    staff: (managerId: string) => `staff_${managerId}`,
    template: (managerId: string, month: string) => `template_${managerId}_${month}`,
    shifts: (managerId: string, month: string) => `shifts_${managerId}_${month}`,
    shiftOverview: (managerId: string, month: string) => `shift_overview_${managerId}_${month}`,
    dashboard: (managerId: string) => `dashboard_${managerId}`,
    chat: (roomId: string) => `chat_${roomId}`
  };

  /**
   * 最適化されたスタッフデータ取得（ローカルキャッシュ優先）
   */
  static async getOptimizedStaffData(managerId: string): Promise<User[]> {
    const cacheKey = this.CACHE_KEYS.staff(managerId);

    // ローカルキャッシュをチェック
    const cached = LocalStorageManager.getWithExpiry<User[]>(cacheKey);
    if (cached) {
      console.log('📖 Staff data from cache');

      // バックグラウンドで最新データを取得してキャッシュ更新
      this.updateStaffCacheInBackground(managerId);

      return cached;
    }

    // キャッシュがない場合はFirebaseから取得
    console.log('🔄 Fetching fresh staff data from Firebase');
    const freshData = await userService.getStaffByManager(managerId);

    // キャッシュに保存（24時間）
    LocalStorageManager.setWithExpiry(
      cacheKey,
      freshData,
      24 * 60 * 60 * 1000
    );

    return freshData;
  }

  /**
   * バックグラウンドでスタッフキャッシュを更新
   */
  private static async updateStaffCacheInBackground(managerId: string): Promise<void> {
    try {
      const freshData = await userService.getStaffByManager(managerId);
      const cacheKey = this.CACHE_KEYS.staff(managerId);

      LocalStorageManager.setWithExpiry(
        cacheKey,
        freshData,
        24 * 60 * 60 * 1000
      );

      console.log('🔄 Staff cache updated in background');
    } catch (error) {
      console.warn('⚠️ Background staff cache update failed:', error);
    }
  }

  /**
   * 新しい承認待ち計算ロジック（スタッフ数 - 来月シフト未提出数）
   */
  static async calculatePendingApprovals(managerId: string): Promise<number> {
    try {
      // スタッフデータを取得（キャッシュ優先）
      const staff = await this.getOptimizedStaffData(managerId);
      const totalStaff = staff.length;

      if (totalStaff === 0) return 0;

      // 来月の開始日と終了日を計算
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const startOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
      const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

      // 来月のシフトデータを取得
      const shiftService = ShiftManagementService.getInstance();
      const allShifts = await shiftService.getShiftsByShop(managerId, startOfNextMonth, endOfNextMonth);

      // 提出済みスタッフのIDセットを作成
      const submittedStaffIds = new Set<string>();

      allShifts.forEach(shift => {
        if (shift.slots && Array.isArray(shift.slots)) {
          shift.slots.forEach((slot: any) => {
            if (slot.userId) {
              submittedStaffIds.add(slot.userId);
            }
          });
        }
      });

      // 未提出スタッフ数を計算
      const pendingCount = totalStaff - submittedStaffIds.size;

      console.log(`📊 Pending approvals: ${pendingCount} (${totalStaff} total staff - ${submittedStaffIds.size} submitted)`);

      return Math.max(0, pendingCount);
    } catch (error) {
      console.error('❌ Error calculating pending approvals:', error);
      return 0;
    }
  }

  /**
   * 来月の年月文字列を取得
   */
  private static getNextMonthString(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * 最適化されたダッシュボードデータ取得
   */
  static async getOptimizedDashboardData(managerId: string): Promise<{
    totalStaff: number;
    weeklyShifts: number;
    pendingApprovals: number;
    monthlyBudget: number;
    staffGrowth: string;
    shiftsGrowth: string;
    approvalsGrowth: string;
    budgetGrowth: string;
  }> {
    const cacheKey = this.CACHE_KEYS.dashboard(managerId);

    // 短時間キャッシュをチェック（5分）
    const cached = LocalStorageManager.getWithExpiry<any>(cacheKey);
    if (cached) {
      console.log('📖 Dashboard data from cache');
      return cached;
    }

    console.log('🔄 Calculating fresh dashboard data');

    try {
      // 並行でデータ取得
      const [staff, pendingApprovals] = await Promise.all([
        this.getOptimizedStaffData(managerId),
        this.calculatePendingApprovals(managerId)
      ]);

      // 基本統計
      const totalStaff = staff.length;

      // 今週のシフト数を取得
      const weeklyShifts = await this.getWeeklyShiftCount(managerId);

      // 今月の人件費を計算
      const monthlyBudget = await this.calculateMonthlyBudget(managerId, staff);

      // 成長率の計算（簡易版 - 実際の前月比較は別途実装）
      const dashboardData = {
        totalStaff,
        weeklyShifts,
        pendingApprovals,
        monthlyBudget,
        staffGrowth: '+0', // TODO: 前月比較実装
        shiftsGrowth: '+0', // TODO: 前週比較実装
        approvalsGrowth: pendingApprovals > 0 ? 'increased' : 'same',
        budgetGrowth: '+0%' // TODO: 前月比較実装
      };

      // 5分間キャッシュ
      LocalStorageManager.setWithExpiry(
        cacheKey,
        dashboardData,
        5 * 60 * 1000
      );

      return dashboardData;
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);

      // エラー時のフォールバック
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
   * 今週のシフト数を取得
   */
  private static async getWeeklyShiftCount(managerId: string): Promise<number> {
    try {
      // 今週の開始日と終了日を計算
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // 今週のシフトを取得
      const shiftService = ShiftManagementService.getInstance();
      const shifts = await shiftService.getShiftsByShop(managerId, startOfWeek, endOfWeek);

      return shifts.length;
    } catch (error) {
      console.error('❌ Error getting weekly shift count:', error);
      return 0;
    }
  }

  /**
   * 今月の人件費を計算
   */
  private static async calculateMonthlyBudget(managerId: string, staff: User[]): Promise<number> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // 今月のシフトを取得
      const shiftService = ShiftManagementService.getInstance();
      const monthlyShifts = await shiftService.getShiftsByShop(managerId, startOfMonth, endOfMonth);

      let totalBudget = 0;

      monthlyShifts.forEach(shift => {
        if (shift.slots && Array.isArray(shift.slots)) {
          shift.slots.forEach((slot: any) => {
            // スタッフの時給を取得
            const staffMember = staff.find(s => s.uid === slot.userId);
            const hourlyRate = staffMember?.hourlyRate || 1000; // デフォルト時給

            // 労働時間を計算（簡易版 - 4時間固定）
            const workHours = 4;

            totalBudget += hourlyRate * workHours;
          });
        }
      });

      return totalBudget;
    } catch (error) {
      console.error('❌ Error calculating monthly budget:', error);
      return 0;
    }
  }

  /**
   * 最適化されたテンプレートデータ取得
   */
  static async getOptimizedTemplate(managerId: string, month: string) {
    const cacheKey = this.CACHE_KEYS.template(managerId, month);

    // 7日間キャッシュをチェック
    const cached = LocalStorageManager.getWithExpiry<any>(cacheKey);
    if (cached) {
      console.log('📖 Template data from cache');
      return cached;
    }

    console.log('🔄 Fetching fresh template data from Firebase');
    const template = await StaffingTemplateService.getTemplateByMonth(managerId, month);

    // 7日間キャッシュ
    LocalStorageManager.setWithExpiry(
      cacheKey,
      template,
      7 * 24 * 60 * 60 * 1000
    );

    return template;
  }

  /**
   * チャット履歴の最適化取得（1.5ヶ月制限）
   * TODO: SimpleChatServiceに1.5ヶ月制限機能を追加後に実装
   */
  static async getOptimizedChatHistory(roomId: string) {
    const cacheKey = this.CACHE_KEYS.chat(roomId);

    // ローカルキャッシュをチェック
    const cached = LocalStorageManager.getWithExpiry<any>(cacheKey);
    if (cached) {
      console.log('📖 Chat history from cache');
      return cached;
    }

    console.log('🔄 Chat history optimization pending - using standard method');

    // TODO: 1.5ヶ月制限の実装が必要
    // 現在は標準的な取得方法を使用
    return [];
  }

  /**
   * 最適化されたシフト概観データ取得
   */
  static async getOptimizedShiftOverview(managerId: string, month: string): Promise<ShiftOverviewData> {
    const cacheKey = this.CACHE_KEYS.shiftOverview(managerId, month);

    // 15分間キャッシュをチェック
    const cached = LocalStorageManager.getWithExpiry<ShiftOverviewData>(cacheKey);
    if (cached) {
      console.log('📖 Shift overview data from cache');
      return cached;
    }

    console.log('🔄 Calculating fresh shift overview data');

    try {
      // 月の開始日と終了日を計算
      const startOfMonth = new Date(`${month}-01`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

      // シフトデータとテンプレートデータを並行取得
      const shiftService = ShiftManagementService.getInstance();
      const [shifts, template] = await Promise.all([
        shiftService.getShiftsByShop(managerId, startOfMonth, endOfMonth),
        this.getOptimizedTemplate(managerId, month)
      ]);

      // 週別データの計算
      const weeklyBreakdown = this.calculateWeeklyBreakdown(shifts, startOfMonth, endOfMonth);

      // 統計の計算
      const totalShifts = this.calculateTotalShifts(shifts);
      const filledShifts = this.calculateFilledShifts(shifts);
      const emptyShifts = totalShifts - filledShifts;
      const fillRate = totalShifts > 0 ? (filledShifts / totalShifts) * 100 : 0;

      // 問題箇所の特定
      const problemAreas = this.identifyProblemAreas(shifts, template, startOfMonth, endOfMonth);

      const overviewData: ShiftOverviewData = {
        month,
        totalShifts,
        filledShifts,
        emptyShifts,
        fillRate,
        weeklyBreakdown,
        problemAreas
      };

      // 15分間キャッシュ
      LocalStorageManager.setWithExpiry(
        cacheKey,
        overviewData,
        15 * 60 * 1000
      );

      return overviewData;
    } catch (error) {
      console.error('❌ Error calculating shift overview:', error);

      // エラー時のフォールバック
      return {
        month,
        totalShifts: 0,
        filledShifts: 0,
        emptyShifts: 0,
        fillRate: 0,
        weeklyBreakdown: [],
        problemAreas: []
      };
    }
  }

  /**
   * 総シフト数を計算
   */
  private static calculateTotalShifts(shifts: any[]): number {
    return shifts.reduce((total, shift) => {
      return total + (shift.slots ? shift.slots.length : 0);
    }, 0);
  }

  /**
   * 割り当て済みシフト数を計算
   */
  private static calculateFilledShifts(shifts: any[]): number {
    return shifts.reduce((total, shift) => {
      if (shift.slots && Array.isArray(shift.slots)) {
        const filledSlots = shift.slots.filter((slot: any) => slot.userId && slot.userId.trim() !== '');
        return total + filledSlots.length;
      }
      return total;
    }, 0);
  }

  /**
   * 週別データの計算
   */
  private static calculateWeeklyBreakdown(shifts: any[], startOfMonth: Date, endOfMonth: Date): WeeklyShiftData[] {
    const weeks: WeeklyShiftData[] = [];
    let currentWeekStart = new Date(startOfMonth);
    let weekNumber = 1;

    while (currentWeekStart <= endOfMonth) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > endOfMonth) weekEnd.setTime(endOfMonth.getTime());

      // この週のシフトを抽出
      const weekShifts = shifts.filter(shift => {
        const shiftDate = shift.date?.toDate ? shift.date.toDate() : new Date(shift.date);
        return shiftDate >= currentWeekStart && shiftDate <= weekEnd;
      });

      const totalSlots = this.calculateTotalShifts(weekShifts);
      const filledSlots = this.calculateFilledShifts(weekShifts);
      const fillRate = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;

      weeks.push({
        weekNumber,
        startDate: currentWeekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        totalSlots,
        filledSlots,
        fillRate
      });

      // 次の週へ
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekNumber++;
    }

    return weeks;
  }

  /**
   * 問題箇所の特定
   */
  private static identifyProblemAreas(shifts: any[], template: any, startOfMonth: Date, endOfMonth: Date): ProblemArea[] {
    const problems: ProblemArea[] = [];

    shifts.forEach(shift => {
      const shiftDate = shift.date?.toDate ? shift.date.toDate() : new Date(shift.date);
      const dayOfWeek = shiftDate.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      if (shift.slots && Array.isArray(shift.slots)) {
        // 各時間帯をチェック
        const timeSlots = ['morning', 'afternoon', 'evening'];
        const timeSlotLabels = ['朝', '昼', '夜'];

        timeSlots.forEach((timeSlot, index) => {
          const slotsInTimeSlot = shift.slots.filter((slot: any) => slot.timeSlot === timeSlot);
          const filledSlots = slotsInTimeSlot.filter((slot: any) => slot.userId && slot.userId.trim() !== '');

          // テンプレートから必要人数を取得
          const requiredStaff = template?.weeklyRequirements?.[dayName]?.[timeSlot] || 2;
          const currentStaff = filledSlots.length;

          // 問題の判定
          if (currentStaff === 0 && requiredStaff > 0) {
            problems.push({
              date: shiftDate.toISOString().split('T')[0],
              timeSlot: timeSlotLabels[index],
              issue: 'empty',
              severity: 'high',
              requiredStaff,
              currentStaff
            });
          } else if (currentStaff < requiredStaff * 0.7) {
            problems.push({
              date: shiftDate.toISOString().split('T')[0],
              timeSlot: timeSlotLabels[index],
              issue: 'understaffed',
              severity: currentStaff < requiredStaff * 0.5 ? 'high' : 'medium',
              requiredStaff,
              currentStaff
            });
          } else if (currentStaff > requiredStaff * 1.3) {
            problems.push({
              date: shiftDate.toISOString().split('T')[0],
              timeSlot: timeSlotLabels[index],
              issue: 'overstaffed',
              severity: 'low',
              requiredStaff,
              currentStaff
            });
          }
        });
      }
    });

    // 重要度順にソート
    return problems.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * キャッシュ無効化（データ更新時に使用）
   */
  static invalidateCache(type: 'staff' | 'template' | 'dashboard' | 'chat' | 'shiftOverview', managerId: string, additionalKey?: string): void {
    switch (type) {
      case 'staff':
        LocalStorageManager.remove(this.CACHE_KEYS.staff(managerId));
        LocalStorageManager.remove(this.CACHE_KEYS.dashboard(managerId));
        break;
      case 'template':
        if (additionalKey) {
          LocalStorageManager.remove(this.CACHE_KEYS.template(managerId, additionalKey));
        }
        break;
      case 'dashboard':
        LocalStorageManager.remove(this.CACHE_KEYS.dashboard(managerId));
        break;
      case 'chat':
        if (additionalKey) {
          LocalStorageManager.remove(this.CACHE_KEYS.chat(additionalKey));
        }
        break;
      case 'shiftOverview':
        if (additionalKey) {
          LocalStorageManager.remove(this.CACHE_KEYS.shiftOverview(managerId, additionalKey));
        }
        break;
    }

    console.log(`🗑️ Cache invalidated: ${type} for manager ${managerId}`);
  }

  /**
   * 全キャッシュクリア（緊急時用）
   */
  static clearAllCache(): void {
    LocalStorageManager.clearByPrefix('staff_');
    LocalStorageManager.clearByPrefix('template_');
    LocalStorageManager.clearByPrefix('shift_overview_');
    LocalStorageManager.clearByPrefix('dashboard_');
    LocalStorageManager.clearByPrefix('chat_');

    console.log('🧹 All manager data cache cleared');
  }

  /**
   * Firebase使用量レポート取得
   */
  static getUsageReport(): {
    cacheHitRate: number;
    totalCacheEntries: number;
    estimatedFirebaseSavings: string;
  } {
    const stats = LocalStorageManager.getCacheStats();

    return {
      cacheHitRate: 0, // TODO: 実際のヒット率計算実装
      totalCacheEntries: stats.totalEntries,
      estimatedFirebaseSavings: '60-70%' // 推定値
    };
  }
}

// 型定義
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

export interface ShiftOverviewData {
  month: string;
  totalShifts: number;
  filledShifts: number;
  emptyShifts: number;
  fillRate: number;
  weeklyBreakdown: WeeklyShiftData[];
  problemAreas: ProblemArea[];
}

export interface WeeklyShiftData {
  weekNumber: number;
  startDate: string;
  endDate: string;
  totalSlots: number;
  filledSlots: number;
  fillRate: number;
}

export interface ProblemArea {
  date: string;
  timeSlot: string;
  issue: 'understaffed' | 'overstaffed' | 'empty';
  severity: 'low' | 'medium' | 'high';
  requiredStaff: number;
  currentStaff: number;
}

/**
 * 最適化されたマネージャー統計取得（外部関数 - 既存コードとの互換性）
 */
export async function fetchOptimizedManagerStats(managerId: string): Promise<ManagerStatsData> {
  return await ManagerDataService.getOptimizedDashboardData(managerId);
}