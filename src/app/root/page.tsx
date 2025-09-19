'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import Link from 'next/link';
import {
  Shield,
  Users,
  Database,
  Settings,
  BarChart3,
  FileText,
  UserCheck,
  AlertTriangle,
  TrendingUp,
  Activity,
  Server,
  Zap,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDataCache, debugCacheStatus } from '@/hooks/useDataCache';
import {
  fetchOptimizedStatsData,
  fetchOptimizedSystemStatus,
  fetchOptimizedActivityLogs,
  getCacheEfficiencyReport,
  StatsData,
  SystemStatusData
} from '@/services/rootDataService';

interface ActivityLog {
  id: string;
  action: string;
  user: string;
  time: string;
  type: 'user' | 'login' | 'security' | 'system';
  detail?: string;
  timestamp: Date;
}

export default function RootPage() {
  const { currentUser } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  // キャッシュ化されたデータフック
  const {
    data: statsData,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
    lastUpdated: statsLastUpdated
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

  const {
    data: systemStatus,
    loading: systemLoading,
    error: systemError,
    refresh: refreshSystemStatus,
    lastUpdated: systemLastUpdated
  } = useDataCache<SystemStatusData>({
    key: 'systemStatus',
    fetchFunction: fetchOptimizedSystemStatus,
    initialData: {
      serverLatency: '測定中...',
      databaseConnections: '0コレクション接続',
      collectionCount: 0,
      maintenanceDate: '未定'
    }
  });

  const {
    data: recentActivities,
    loading: activitiesLoading,
    error: activitiesError,
    refresh: refreshActivities,
    lastUpdated: activitiesLastUpdated
  } = useDataCache<any[]>({
    key: 'activityLogs',
    fetchFunction: () => fetchOptimizedActivityLogs(5),
    ttl: 30 * 60 * 1000, // 30分間キャッシュ（アクティビティは短めに）
    initialData: []
  });

  // 手動更新機能
  const handleRefreshAll = async () => {
    console.log('🔄 Manual refresh triggered');
    await Promise.all([
      refreshStats(),
      refreshSystemStatus(),
      refreshActivities()
    ]);
  };

  // デバッグ用ログ出力
  console.log('🔍 Recent Activities Debug:', {
    count: recentActivities.length,
    loading: activitiesLoading,
    error: activitiesError,
    activities: recentActivities,
    cacheStatus: { statsLastUpdated, systemLastUpdated, activitiesLastUpdated }
  });

  // キャッシュ効率レポートを表示（開発時のみ）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const report = getCacheEfficiencyReport();
      console.log('📊 Cache Efficiency Report:', report);
      debugCacheStatus();
    }
  }, []);

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
      icon: FileText, 
      label: 'ログ管理', 
      href: '/root/logs', 
      description: 'システムログとエラー監視', 
      gradient: 'from-gray-500 to-gray-600',
      stats: '今日: 0エラー'
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


  // リアルタイム時計の設定 (クライアントサイドのみ)
  useEffect(() => {
    setIsMounted(true);
    
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    // 初期時刻を設定
    updateTime();
    
    // 1分ごとに更新
    const interval = setInterval(updateTime, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // 相対時間を計算する関数
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${diffDays}日前`;
  };

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

            {/* Mobile-first responsive layout */}
            <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              {/* Left Column - System Management and System Status */}
              <div className="space-y-4">
                {/* System Administration Actions - Responsive */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 lg:p-3">
                  <h2 className="text-base lg:text-base font-semibold text-gray-900 mb-3 lg:mb-3">システム管理</h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-2">
                    {systemActions.map((action, index) => (
                      <Link
                        key={index}
                        href={action.href}
                        className="group p-3 lg:p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-2.5 lg:space-x-2">
                          <div className="p-1.5 lg:p-1.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                            <action.icon className="h-4 w-4 lg:h-3.5 lg:w-3.5 text-gray-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm lg:text-sm font-medium text-gray-900">{action.label}</h3>
                            <p className="text-xs lg:text-xs text-gray-500 mt-0.5 lg:mt-0 lg:hidden">{action.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5 lg:mt-0">{action.stats}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* System Status - Responsive */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 lg:p-3">
                  <h2 className="text-base lg:text-base font-semibold text-gray-900 mb-3 lg:mb-3">システム状態</h2>

                  <div className="space-y-2.5 lg:space-y-2">
                    <div className="flex items-center justify-between p-2.5 lg:p-2.5 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2.5 lg:space-x-2.5">
                        <div className={`w-2.5 h-2.5 lg:w-2 lg:h-2 rounded-full ${systemStatus.serverLatency.includes('エラー') ? 'bg-red-500' : parseInt(systemStatus.serverLatency) > 1000 ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                        <div>
                          <span className="text-sm lg:text-sm font-medium text-gray-900">サーバー</span>
                          <p className="text-xs lg:text-xs text-gray-500">{systemStatus.serverLatency}</p>
                        </div>
                      </div>
                      <span className={`text-xs lg:text-xs font-medium ${systemStatus.serverLatency.includes('エラー') ? 'text-red-600' : parseInt(systemStatus.serverLatency) > 1000 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {systemStatus.serverLatency.includes('エラー') ? 'エラー' : parseInt(systemStatus.serverLatency) > 1000 ? '注意' : '正常'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 lg:p-2.5 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2.5 lg:space-x-2.5">
                        <div className={`w-2.5 h-2.5 lg:w-2 lg:h-2 rounded-full ${systemStatus.collectionCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div>
                          <span className="text-sm lg:text-sm font-medium text-gray-900">データベース</span>
                          <p className="text-xs lg:text-xs text-gray-500">{systemStatus.databaseConnections}</p>
                        </div>
                      </div>
                      <span className={`text-xs lg:text-xs font-medium ${systemStatus.collectionCount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {systemStatus.collectionCount > 0 ? '正常' : 'エラー'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 lg:p-2.5 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2.5 lg:space-x-2.5">
                        <div className="w-2.5 h-2.5 lg:w-2 lg:h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <span className="text-sm lg:text-sm font-medium text-gray-900">メンテナンス</span>
                          <p className="text-xs lg:text-xs text-gray-500">{systemStatus.maintenanceDate}</p>
                        </div>
                      </div>
                      <span className="text-xs lg:text-xs font-medium text-green-600">予定なし</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Recent Activities - Responsive */}
              <div>
                {/* Recent Activities - Optimized with Cache */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-4">
                  <div className="flex items-center justify-between mb-4 lg:mb-4">
                    <h2 className="text-lg lg:text-base font-semibold text-gray-900">最近のアクティビティ</h2>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleRefreshAll}
                        disabled={statsLoading || systemLoading || activitiesLoading}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="全データを更新"
                      >
                        <RefreshCw className={`h-4 w-4 text-gray-600 ${(statsLoading || systemLoading || activitiesLoading) ? 'animate-spin' : ''}`} />
                      </button>
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${activitiesLastUpdated ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span className="text-sm lg:text-xs text-gray-500">
                          {activitiesLastUpdated ?
                            `${Math.round((Date.now() - activitiesLastUpdated.getTime()) / 1000 / 60)}分前更新` :
                            'キャッシュ'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {activitiesLoading ? (
                    <LoadingSpinner text="アクティビティを読み込み中..." size="sm" />
                  ) : activitiesError ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="mx-auto h-8 w-8 text-red-400 mb-2" />
                      <p className="text-base lg:text-sm text-red-500">データ読み込みエラー</p>
                      <p className="text-sm lg:text-xs text-red-400 mt-1">{activitiesError.message}</p>
                      <button
                        onClick={refreshActivities}
                        className="mt-2 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs hover:bg-red-200 transition-colors"
                      >
                        再試行
                      </button>
                    </div>
                  ) : recentActivities.length > 0 ? (
                    <div className="space-y-4 lg:space-y-3">
                      {recentActivities.map((activity) => {
                        const activityData = activity as any;
                        const timestamp = activityData.timestamp?.toDate ? activityData.timestamp.toDate() : new Date(activityData.timestamp);
                        const timeAgo = getRelativeTime(timestamp);

                        return (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 lg:p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className={`p-2 lg:p-1.5 rounded-lg ${
                            activityData.type === 'user' ? 'bg-blue-100 text-blue-600' :
                            activityData.type === 'login' ? 'bg-green-100 text-green-600' :
                            activityData.type === 'security' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {activityData.type === 'user' ? <UserCheck className="h-4 w-4 lg:h-3 lg:w-3" /> :
                             activityData.type === 'login' ? <CheckCircle className="h-4 w-4 lg:h-3 lg:w-3" /> :
                             activityData.type === 'security' ? <AlertTriangle className="h-4 w-4 lg:h-3 lg:w-3" /> :
                             <Activity className="h-4 w-4 lg:h-3 lg:w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-base lg:text-sm font-medium text-gray-900">{activityData.action || 'アクション'}</p>
                              <span className="text-sm lg:text-xs text-gray-400">{timeAgo}</span>
                            </div>
                            <p className="text-sm lg:text-xs text-gray-500 mt-1">{activityData.user || 'ユーザー'}</p>
                            {activityData.detail && (
                              <p className="text-sm lg:text-xs text-gray-400 mt-1 lg:mt-0.5">{activityData.detail}</p>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-base lg:text-sm text-gray-500">アクティビティがありません</p>
                      <p className="text-sm lg:text-xs text-gray-400 mt-1">ユーザーの活動が表示されます</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}