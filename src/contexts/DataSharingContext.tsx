'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { ManagerWithStaff, ShopsStatsData } from '@/services/shopsDataService';
import { UserWithId, UsersStatsData } from '@/services/usersDataService';
import { DatabaseStats } from '@/services/databaseDataService';

interface SharedDataType {
  managersData: ManagerWithStaff[];
  usersData: UserWithId[];
  statsData: {
    totalUsers: number;
    totalShops: number;
    currentProfit: number;
    inquiriesCount: number;
    userGrowth: string;
    shopGrowth: string;
    profitGrowth: string;
    inquiryGrowth: string;
  };
  shopsStats: ShopsStatsData;
  usersStats: UsersStatsData;
  databaseStats: DatabaseStats;
  lastUpdated: Date | null;
}

interface DataSharingContextType {
  sharedData: SharedDataType | null;
  setSharedData: (data: SharedDataType) => void;
  updateSharedData: (updates: Partial<SharedDataType>) => void;
  isDataFresh: (maxAgeMinutes?: number) => boolean;
  clearSharedData: () => void;
}

const DataSharingContext = createContext<DataSharingContextType | undefined>(undefined);

export function useDataSharing() {
  const context = useContext(DataSharingContext);
  if (!context) {
    throw new Error('useDataSharing must be used within a DataSharingProvider');
  }
  return context;
}

export function DataSharingProvider({ children }: { children: React.ReactNode }) {
  const [sharedData, setSharedDataState] = useState<SharedDataType | null>(null);

  const setSharedData = useCallback((data: SharedDataType) => {
    const dataWithTimestamp = {
      ...data,
      lastUpdated: new Date()
    };
    setSharedDataState(dataWithTimestamp);

    // ローカルストレージにも保存（セッション間でデータ共有）
    try {
      localStorage.setItem('sharedAppData', JSON.stringify(dataWithTimestamp));
    } catch (error) {
      console.warn('Failed to save shared data to localStorage:', error);
    }
  }, []);

  const updateSharedData = useCallback((updates: Partial<SharedDataType>) => {
    setSharedDataState(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        ...updates,
        lastUpdated: new Date()
      };

      // ローカルストレージも更新
      try {
        localStorage.setItem('sharedAppData', JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to update shared data in localStorage:', error);
      }

      return updated;
    });
  }, []);

  const isDataFresh = useCallback((maxAgeMinutes: number = 5) => {
    if (!sharedData?.lastUpdated) return false;

    const now = new Date();
    const diffMinutes = (now.getTime() - sharedData.lastUpdated.getTime()) / (1000 * 60);
    return diffMinutes <= maxAgeMinutes;
  }, [sharedData]);

  const clearSharedData = useCallback(() => {
    setSharedDataState(null);
    try {
      localStorage.removeItem('sharedAppData');
    } catch (error) {
      console.warn('Failed to clear shared data from localStorage:', error);
    }
  }, []);

  // 初期化時にローカルストレージからデータを復元
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('sharedAppData');
      if (saved) {
        const parsed = JSON.parse(saved);

        // データの有効期限をチェック（30分）
        if (parsed.lastUpdated) {
          const lastUpdate = new Date(parsed.lastUpdated);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

          if (diffMinutes <= 30) {
            setSharedDataState(parsed);
            console.log('✅ Shared data restored from localStorage');
            return;
          }
        }

        // 期限切れの場合はクリア
        localStorage.removeItem('sharedAppData');
        console.log('🗑️ Expired shared data cleared');
      }
    } catch (error) {
      console.warn('Failed to restore shared data from localStorage:', error);
      localStorage.removeItem('sharedAppData');
    }
  }, []);

  const value = {
    sharedData,
    setSharedData,
    updateSharedData,
    isDataFresh,
    clearSharedData
  };

  return (
    <DataSharingContext.Provider value={value}>
      {children}
    </DataSharingContext.Provider>
  );
}

/**
 * デバッグ用: 共有データの状態を表示
 */
export function debugSharedDataStatus() {
  console.group('🔄 Shared Data Status');

  try {
    const saved = localStorage.getItem('sharedAppData');
    if (saved) {
      const parsed = JSON.parse(saved);
      const lastUpdate = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null;
      const now = new Date();
      const ageMinutes = lastUpdate ? Math.round((now.getTime() - lastUpdate.getTime()) / (1000 * 60)) : null;

      console.log('📊 Data available:', {
        managersCount: parsed.managersData?.length || 0,
        totalUsers: parsed.statsData?.totalUsers || 0,
        lastUpdated: lastUpdate?.toLocaleString() || 'Unknown',
        ageMinutes: ageMinutes + ' minutes ago',
        isFresh: ageMinutes !== null && ageMinutes <= 5
      });
    } else {
      console.log('📭 No shared data available');
    }
  } catch (error) {
    console.log('❌ Error reading shared data:', error);
  }

  console.groupEnd();
}