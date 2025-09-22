'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ManagerDataService, ManagerStatsData } from '@/lib/managerDataService';
import { userService } from '@/lib/userService';
import { ShiftManagementService } from '@/lib/shiftService';
import { SimpleChatService } from '@/lib/simpleChatService';
import { User, ShiftExtended } from '@/types';

/**
 * 店長機能統合データストア
 * Firebase最適化の核となる共有データ管理
 */

// ステート型定義
interface ManagerDataState {
  // 認証情報
  managerId: string | null;

  // コアデータ
  staff: User[];
  shifts: ShiftExtended[];
  statistics: ManagerStatsData;

  // メタデータ
  lastUpdated: {
    staff: Date | null;
    shifts: Date | null;
    statistics: Date | null;
  };

  // 状態管理
  loading: {
    staff: boolean;
    shifts: boolean;
    statistics: boolean;
  };

  errors: {
    staff: string | null;
    shifts: string | null;
    statistics: string | null;
  };

  // 設定
  preferences: {
    cacheEnabled: boolean;
    backgroundSync: boolean;
    realtimeUpdates: boolean;
  };
}

// アクション型定義
type ManagerDataAction =
  | { type: 'SET_MANAGER_ID'; payload: string }
  | { type: 'SET_STAFF_LOADING'; payload: boolean }
  | { type: 'SET_STAFF_DATA'; payload: User[] }
  | { type: 'SET_STAFF_ERROR'; payload: string | null }
  | { type: 'SET_SHIFTS_LOADING'; payload: boolean }
  | { type: 'SET_SHIFTS_DATA'; payload: ShiftExtended[] }
  | { type: 'SET_SHIFTS_ERROR'; payload: string | null }
  | { type: 'SET_STATISTICS_LOADING'; payload: boolean }
  | { type: 'SET_STATISTICS_DATA'; payload: ManagerStatsData }
  | { type: 'SET_STATISTICS_ERROR'; payload: string | null }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<ManagerDataState['preferences']> }
  | { type: 'CLEAR_ALL_DATA' }
  | { type: 'INVALIDATE_CACHE'; payload: 'staff' | 'shifts' | 'statistics' | 'all' };

// 初期状態
const initialState: ManagerDataState = {
  managerId: null,
  staff: [],
  shifts: [],
  statistics: {
    totalStaff: 0,
    weeklyShifts: 0,
    pendingApprovals: 0,
    monthlyBudget: 0,
    staffGrowth: '±0',
    shiftsGrowth: '±0',
    approvalsGrowth: 'same',
    budgetGrowth: '±0%'
  },
  lastUpdated: {
    staff: null,
    shifts: null,
    statistics: null
  },
  loading: {
    staff: false,
    shifts: false,
    statistics: false
  },
  errors: {
    staff: null,
    shifts: null,
    statistics: null
  },
  preferences: {
    cacheEnabled: true,
    backgroundSync: true,
    realtimeUpdates: true
  }
};

// Reducer関数
function managerDataReducer(state: ManagerDataState, action: ManagerDataAction): ManagerDataState {
  switch (action.type) {
    case 'SET_MANAGER_ID':
      return { ...state, managerId: action.payload };

    case 'SET_STAFF_LOADING':
      return {
        ...state,
        loading: { ...state.loading, staff: action.payload }
      };

    case 'SET_STAFF_DATA':
      return {
        ...state,
        staff: action.payload,
        lastUpdated: { ...state.lastUpdated, staff: new Date() },
        loading: { ...state.loading, staff: false },
        errors: { ...state.errors, staff: null }
      };

    case 'SET_STAFF_ERROR':
      return {
        ...state,
        errors: { ...state.errors, staff: action.payload },
        loading: { ...state.loading, staff: false }
      };

    case 'SET_SHIFTS_LOADING':
      return {
        ...state,
        loading: { ...state.loading, shifts: action.payload }
      };

    case 'SET_SHIFTS_DATA':
      return {
        ...state,
        shifts: action.payload,
        lastUpdated: { ...state.lastUpdated, shifts: new Date() },
        loading: { ...state.loading, shifts: false },
        errors: { ...state.errors, shifts: null }
      };

    case 'SET_SHIFTS_ERROR':
      return {
        ...state,
        errors: { ...state.errors, shifts: action.payload },
        loading: { ...state.loading, shifts: false }
      };

    case 'SET_STATISTICS_LOADING':
      return {
        ...state,
        loading: { ...state.loading, statistics: action.payload }
      };

    case 'SET_STATISTICS_DATA':
      return {
        ...state,
        statistics: action.payload,
        lastUpdated: { ...state.lastUpdated, statistics: new Date() },
        loading: { ...state.loading, statistics: false },
        errors: { ...state.errors, statistics: null }
      };

    case 'SET_STATISTICS_ERROR':
      return {
        ...state,
        errors: { ...state.errors, statistics: action.payload },
        loading: { ...state.loading, statistics: false }
      };

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      };

    case 'CLEAR_ALL_DATA':
      return {
        ...initialState,
        managerId: state.managerId,
        preferences: state.preferences
      };

    case 'INVALIDATE_CACHE':
      if (action.payload === 'all') {
        return {
          ...state,
          lastUpdated: { staff: null, shifts: null, statistics: null }
        };
      } else {
        return {
          ...state,
          lastUpdated: { ...state.lastUpdated, [action.payload]: null }
        };
      }

    default:
      return state;
  }
}

// コンテキスト作成
const ManagerDataContext = createContext<{
  state: ManagerDataState;
  actions: {
    setManagerId: (id: string) => void;
    loadStaffData: () => Promise<void>;
    loadShiftsData: (startDate?: Date, endDate?: Date) => Promise<void>;
    loadStatistics: () => Promise<void>;
    refreshAllData: () => Promise<void>;
    invalidateCache: (type: 'staff' | 'shifts' | 'statistics' | 'all') => void;
    updatePreferences: (prefs: Partial<ManagerDataState['preferences']>) => void;
  };
} | null>(null);

// Provider Props
interface ManagerDataProviderProps {
  children: ReactNode;
  managerId?: string;
  autoLoad?: boolean;
}

// Provider コンポーネント
export function ManagerDataProvider({
  children,
  managerId: initialManagerId,
  autoLoad = true
}: ManagerDataProviderProps) {
  const [state, dispatch] = useReducer(managerDataReducer, initialState);

  // アクション関数群
  const actions = {
    setManagerId: (id: string) => {
      console.log('🔄 Setting manager ID:', id);
      dispatch({ type: 'SET_MANAGER_ID', payload: id });
    },

    loadStaffData: async () => {
      if (!state.managerId) return;

      dispatch({ type: 'SET_STAFF_LOADING', payload: true });
      try {
        console.log('📊 Loading staff data...');
        const staffData = await ManagerDataService.getOptimizedStaffData(state.managerId);
        dispatch({ type: 'SET_STAFF_DATA', payload: staffData });
        console.log(`✅ Staff data loaded: ${staffData.length} members`);
      } catch (error) {
        console.error('❌ Failed to load staff data:', error);
        dispatch({ type: 'SET_STAFF_ERROR', payload: 'スタッフデータの取得に失敗しました' });
      }
    },

    loadShiftsData: async (startDate?: Date, endDate?: Date) => {
      if (!state.managerId) return;

      dispatch({ type: 'SET_SHIFTS_LOADING', payload: true });
      try {
        console.log('📅 Loading shifts data...');
        const shiftService = ShiftManagementService.getInstance();

        // デフォルトは今月のデータ
        const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        const shiftsData = await shiftService.getShiftsByShop(state.managerId, start, end);
        dispatch({ type: 'SET_SHIFTS_DATA', payload: shiftsData });
        console.log(`✅ Shifts data loaded: ${shiftsData.length} shifts`);
      } catch (error) {
        console.error('❌ Failed to load shifts data:', error);
        dispatch({ type: 'SET_SHIFTS_ERROR', payload: 'シフトデータの取得に失敗しました' });
      }
    },

    loadStatistics: async () => {
      if (!state.managerId) return;

      dispatch({ type: 'SET_STATISTICS_LOADING', payload: true });
      try {
        console.log('📈 Loading statistics...');
        const stats = await ManagerDataService.getOptimizedDashboardData(state.managerId);
        dispatch({ type: 'SET_STATISTICS_DATA', payload: stats });
        console.log('✅ Statistics loaded:', stats);
      } catch (error) {
        console.error('❌ Failed to load statistics:', error);
        dispatch({ type: 'SET_STATISTICS_ERROR', payload: '統計データの取得に失敗しました' });
      }
    },

    refreshAllData: async () => {
      console.log('🔄 Refreshing all data...');
      if (!state.managerId) return;

      // キャッシュを無効化
      ManagerDataService.invalidateCache('staff', state.managerId);
      ManagerDataService.invalidateCache('dashboard', state.managerId);

      // 並行でデータを再取得
      await Promise.all([
        actions.loadStaffData(),
        actions.loadShiftsData(),
        actions.loadStatistics()
      ]);

      console.log('✅ All data refreshed');
    },

    invalidateCache: (type: 'staff' | 'shifts' | 'statistics' | 'all') => {
      dispatch({ type: 'INVALIDATE_CACHE', payload: type });

      if (state.managerId && type !== 'shifts') {
        ManagerDataService.invalidateCache(type, state.managerId);
      }
    },

    updatePreferences: (prefs: Partial<ManagerDataState['preferences']>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: prefs });
      console.log('⚙️ Preferences updated:', prefs);
    }
  };

  // 初期化とManager ID変更時の処理
  useEffect(() => {
    if (initialManagerId && initialManagerId !== state.managerId) {
      actions.setManagerId(initialManagerId);
    }
  }, [initialManagerId]);

  // Manager ID変更時の自動データ読み込み
  useEffect(() => {
    if (state.managerId && autoLoad) {
      console.log('🚀 Auto-loading data for manager:', state.managerId);

      // 段階的にデータを読み込み（依存関係を考慮）
      const loadSequentially = async () => {
        await actions.loadStaffData(); // 基本データ
        await Promise.all([          // 並行処理可能なデータ
          actions.loadShiftsData(),
          actions.loadStatistics()
        ]);
      };

      loadSequentially();
    }
  }, [state.managerId, autoLoad]);

  // バックグラウンド同期（設定が有効な場合）
  useEffect(() => {
    if (!state.preferences.backgroundSync || !state.managerId) return;

    const interval = setInterval(() => {
      // スタッフデータは24時間に1回更新
      const staffAge = state.lastUpdated.staff ?
        Date.now() - state.lastUpdated.staff.getTime() : Infinity;

      if (staffAge > 24 * 60 * 60 * 1000) {
        console.log('🔄 Background sync: staff data');
        actions.loadStaffData();
      }

      // 統計データは5分に1回更新
      const statsAge = state.lastUpdated.statistics ?
        Date.now() - state.lastUpdated.statistics.getTime() : Infinity;

      if (statsAge > 5 * 60 * 1000) {
        console.log('🔄 Background sync: statistics');
        actions.loadStatistics();
      }
    }, 60 * 1000); // 1分間隔でチェック

    return () => clearInterval(interval);
  }, [state.preferences.backgroundSync, state.managerId, state.lastUpdated]);

  return (
    <ManagerDataContext.Provider value={{ state, actions }}>
      {children}
    </ManagerDataContext.Provider>
  );
}

// カスタムフック
export function useManagerData() {
  const context = useContext(ManagerDataContext);
  if (!context) {
    throw new Error('useManagerData must be used within a ManagerDataProvider');
  }
  return context;
}

// 個別データアクセス用のカスタムフック群
export function useManagerStaff() {
  const { state, actions } = useManagerData();
  return {
    staff: state.staff,
    loading: state.loading.staff,
    error: state.errors.staff,
    lastUpdated: state.lastUpdated.staff,
    refresh: actions.loadStaffData
  };
}

export function useManagerShifts() {
  const { state, actions } = useManagerData();
  return {
    shifts: state.shifts,
    loading: state.loading.shifts,
    error: state.errors.shifts,
    lastUpdated: state.lastUpdated.shifts,
    refresh: actions.loadShiftsData
  };
}

export function useManagerStatistics() {
  const { state, actions } = useManagerData();
  return {
    statistics: state.statistics,
    loading: state.loading.statistics,
    error: state.errors.statistics,
    lastUpdated: state.lastUpdated.statistics,
    refresh: actions.loadStatistics
  };
}

// デバッグ用
export function useManagerDataDebug() {
  const { state } = useManagerData();

  const debugInfo = {
    managerId: state.managerId,
    dataAges: {
      staff: state.lastUpdated.staff ?
        Math.round((Date.now() - state.lastUpdated.staff.getTime()) / 1000 / 60) : null,
      shifts: state.lastUpdated.shifts ?
        Math.round((Date.now() - state.lastUpdated.shifts.getTime()) / 1000 / 60) : null,
      statistics: state.lastUpdated.statistics ?
        Math.round((Date.now() - state.lastUpdated.statistics.getTime()) / 1000 / 60) : null,
    },
    dataCounts: {
      staff: state.staff.length,
      shifts: state.shifts.length
    },
    loadingStates: state.loading,
    errors: state.errors,
    preferences: state.preferences
  };

  console.log('🔍 Manager Data Debug Info:', debugInfo);
  return debugInfo;
}