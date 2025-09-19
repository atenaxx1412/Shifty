'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import Link from 'next/link';
import {
  Users,
  Database,
  Settings,
  BarChart3,
  MessageCircle,
  UserCheck,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { useDataCache } from '@/hooks/useDataCache';
import {
  fetchOptimizedStatsData,
  StatsData
} from '@/services/rootDataService';
import {
  fetchOptimizedUsersData,
  fetchOptimizedUsersStats
} from '@/services/usersDataService';
import { useDataSharing } from '@/contexts/DataSharingContext';

export default function RootPage() {
  const { currentUser } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const { setSharedData } = useDataSharing();

  // キャッシュ化されたデータフック
  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats
  } = useDataCache<StatsData>({
    key: 'rootStats',
    fetchFunction: fetchOptimizedStatsData,
    initialData: {
      totalUsers: 0,
      totalShops: 0,
      currentProfit: 0,
      inquiriesCount: 0,
      userGrowth: '0%',
      shopGrowth: '0',
      profitGrowth: '0%',
      inquiryGrowth: '0'
    }
  });

  // ユーザーデータのキャッシュ
  const {
    data: usersData,
    loading: usersLoading,
    refresh: refreshUsers
  } = useDataCache({
    key: 'usersData',
    fetchFunction: fetchOptimizedUsersData,
    initialData: []
  });

  // ユーザー統計データのキャッシュ
  const {
    data: usersStats,
    loading: usersStatsLoading,
    refresh: refreshUsersStats
  } = useDataCache({
    key: 'usersStats',
    fetchFunction: fetchOptimizedUsersStats,
    initialData: {
      totalUsers: 0,
      rootUsers: 0,
      managerUsers: 0,
      staffUsers: 0,
      activeUsers: 0,
      recentlyCreated: 0
    }
  });

  // データが更新されたら共有データにも保存
  useEffect(() => {
    if (statsData && usersData && usersStats && !statsLoading && !usersLoading && !usersStatsLoading) {
      console.log('📤 Sharing root data with other pages');
      setSharedData({
        managersData: [], // shopsページで詳細データが必要な場合は後で追加
        usersData: usersData,
        statsData: statsData,
        shopsStats: {
          totalManagers: statsData.totalShops,
          totalStaff: statsData.totalUsers - statsData.totalShops,
          totalUsers: statsData.totalUsers,
          averageStaffPerManager: statsData.totalShops > 0 ? Math.round(((statsData.totalUsers - statsData.totalShops) / statsData.totalShops) * 10) / 10 : 0,
          managersWithStaff: 0, // 詳細計算が必要な場合のみ
          managersWithoutStaff: 0
        },
        usersStats: usersStats,
        lastUpdated: new Date()
      });
    }
  }, [statsData, usersData, usersStats, statsLoading, usersLoading, usersStatsLoading, setSharedData]);

  const adminStats = [
    {
      label: '総ユーザー数',
      value: statsData.totalUsers,
      unit: '名',
      icon: UserCheck,
      gradient: 'from-blue-500 to-blue-600',
      change: statsData.userGrowth,
      trend: (statsData.userGrowth.includes('+') ? 'up' : statsData.userGrowth.includes('-') ? 'down' : 'neutral') as const
    },
    {
      label: '店長数',
      value: statsData.totalShops,
      unit: '名',
      icon: Users,
      gradient: 'from-emerald-500 to-emerald-600',
      change: statsData.shopGrowth,
      trend: (parseInt(statsData.shopGrowth) > 0 ? 'up' : parseInt(statsData.shopGrowth) < 0 ? 'down' : 'neutral') as const
    },
    {
      label: '現在の利益',
      value: statsData.currentProfit.toLocaleString(),
      unit: '円',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
      change: statsData.profitGrowth,
      trend: (statsData.profitGrowth.includes('+') ? 'up' : statsData.profitGrowth.includes('-') ? 'down' : 'neutral') as const
    },
    {
      label: 'お問い合わせ数',
      value: statsData.inquiriesCount,
      unit: '件',
      icon: AlertTriangle,
      gradient: 'from-orange-500 to-orange-600',
      change: statsData.inquiryGrowth,
      trend: (parseInt(statsData.inquiryGrowth) > 0 ? 'up' : parseInt(statsData.inquiryGrowth) < 0 ? 'down' : 'neutral') as const
    },
  ];

  const systemActions = [
    {
      icon: Users,
      label: '店長管理',
      href: '/root/shops',
      description: '店長の追加・編集・削除・分析',
      gradient: 'from-blue-500 to-blue-600',
      stats: `${statsData.totalShops}名`
    },
    {
      icon: UserCheck,
      label: 'ユーザー管理',
      href: '/root/users',
      description: '全ユーザーの管理・権限設定',
      gradient: 'from-emerald-500 to-emerald-600',
      stats: `${statsData.totalUsers}ユーザー`
    },
    { 
      icon: Database, 
      label: 'データベース', 
      href: '/root/database', 
      description: 'データのバックアップ・復元', 
      gradient: 'from-purple-500 to-purple-600',
      stats: '正常稼働'
    },
    { 
      icon: Settings, 
      label: 'システム設定', 
      href: '/root/settings', 
      description: 'システム全体の設定管理', 
      gradient: 'from-yellow-500 to-yellow-600',
      stats: '12設定項目'
    },
    {
      icon: MessageCircle,
      label: 'お問い合わせ確認',
      href: '/root/logs',
      description: 'マネージャー・スタッフからのお問い合わせ管理',
      gradient: 'from-blue-500 to-blue-600',
      stats: '未読: 0件'
    },
    { 
      icon: BarChart3, 
      label: '全体レポート', 
      href: '/root/reports', 
      description: '全店長の統合レポート・分析', 
      gradient: 'from-indigo-500 to-indigo-600',
      stats: '月次レポート'
    },
  ];


  // コンポーネントマウント設定とリアルタイム時計
  useEffect(() => {
    setIsMounted(true);

    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const date = now.getDate().toString().padStart(2, '0');
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${year}/${month}/${date} ${hours}:${minutes}:${seconds}`);
    };

    // 初期時刻設定
    updateTime();

    // 1秒ごとに更新
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="システム管理" />

        <main className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Stats Grid - Using StatCard Component */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {adminStats.map((stat, index) => (
                <StatCard
                  key={index}
                  label={stat.label}
                  value={stat.value}
                  unit={stat.unit}
                  icon={stat.icon}
                  gradient={stat.gradient}
                  change={stat.change}
                  trend={stat.trend}
                  size="sm"
                />
              ))}
            </div>

            {/* System Management Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">システム管理</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemActions.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className="group p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                        <action.icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{action.stats}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* PC画面右下のリアルタイム時計 */}
        {isMounted && (
          <div className="hidden lg:block fixed bottom-6 right-6 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 px-4 py-2">
            <div className="text-sm font-mono text-gray-700">
              {currentTime}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}