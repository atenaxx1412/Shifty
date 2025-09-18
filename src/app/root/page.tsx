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
  Clock
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFirebaseData, useActivityLogs } from '@/hooks/useFirebaseData';

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
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalShops, setTotalShops] = useState(0);
  const [activeShifts, setActiveShifts] = useState(0);
  const [systemAlerts, setSystemAlerts] = useState(0);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  // Use the custom hook for activity logs
  const { data: recentActivities, loading } = useActivityLogs(4);

  const adminStats = [
    {
      label: '総ユーザー数',
      value: totalUsers,
      unit: '名',
      icon: UserCheck,
      gradient: 'from-blue-500 to-blue-600',
      change: '+12%',
      trend: 'up' as const
    },
    {
      label: '店長数',
      value: totalShops,
      unit: '名',
      icon: Users,
      gradient: 'from-emerald-500 to-emerald-600',
      change: '+1',
      trend: 'up' as const
    },
    {
      label: 'アクティブシフト',
      value: activeShifts,
      unit: 'シフト',
      icon: Activity,
      gradient: 'from-purple-500 to-purple-600',
      change: '+8%',
      trend: 'up' as const
    },
    {
      label: 'システムアラート',
      value: systemAlerts,
      unit: '件',
      icon: AlertTriangle,
      gradient: 'from-red-500 to-red-600',
      change: systemAlerts > 0 ? `+${systemAlerts}` : '0',
      trend: (systemAlerts > 0 ? 'up' : 'down') as const
    },
  ];

  const systemActions = [
    { 
      icon: Users, 
      label: '店長管理', 
      href: '/root/shops', 
      description: '店長の追加・編集・削除・分析', 
      gradient: 'from-blue-500 to-blue-600',
      stats: `${totalShops}名`
    },
    { 
      icon: UserCheck, 
      label: 'ユーザー管理', 
      href: '/root/users', 
      description: '全ユーザーの管理・権限設定', 
      gradient: 'from-emerald-500 to-emerald-600',
      stats: `${totalUsers}ユーザー`
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

  // 統計データを取得する関数
  const fetchStatsData = async () => {
    try {
      // ユーザー数を取得
      const usersSnapshot = await getDocs(collection(db, 'users'));
      setTotalUsers(usersSnapshot.size);

      // 店長数を取得（managerロールのユーザー）
      const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
      const managersSnapshot = await getDocs(managersQuery);
      setTotalShops(managersSnapshot.size);

      // アクティブシフト数を取得（まだコレクションが存在しない可能性があるため0に設定）
      try {
        const shiftsSnapshot = await getDocs(collection(db, 'shifts'));
        setActiveShifts(shiftsSnapshot.size);
      } catch (shiftsError) {
        console.log('Shifts collection not found, setting to 0');
        setActiveShifts(0);
      }

      // システムアラート数を取得（エラーレベルのログをカウント）
      try {
        const alertQuery = query(
          collection(db, 'activityLogs'),
          // where('type', '==', 'security') // セキュリティ関連のアラート
        );
        const alertSnapshot = await getDocs(alertQuery);
        const errorLogs = alertSnapshot.docs.filter(doc => 
          doc.data().type === 'security' || doc.data().level === 'error'
        );
        setSystemAlerts(errorLogs.length);
      } catch (alertError) {
        console.log('Setting system alerts to 0');
        setSystemAlerts(0);
      }
    } catch (error) {
      console.error('Error fetching stats data:', error);
    }
  };

  // 統計データを取得
  useEffect(() => {
    fetchStatsData();
  }, []);

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
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="システム管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Welcome Banner - Simplified */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Shield className="h-6 w-6 text-gray-700" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">{currentUser?.name}</h1>
                    <p className="text-sm text-gray-500">システム管理者</p>
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">稼働中</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>{isMounted ? currentTime : '--:--'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid - Using StatCard Component */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  size="md"
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* System Administration Actions - Simplified */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">システム管理</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {systemActions.map((action, index) => (
                    <Link
                      key={index}
                      href={action.href}
                      className="group p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                          <action.icon className="h-4 w-4 text-gray-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                          <p className="text-xs text-gray-500">{action.stats}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Activities & System Status */}
              <div className="space-y-4">
                {/* Recent Activities - Real-time from Firestore */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">最近のアクティビティ</h2>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-gray-500">リアルタイム</span>
                    </div>
                  </div>
                  
                  {loading ? (
                    <LoadingSpinner text="アクティビティを読み込み中..." size="sm" />
                  ) : recentActivities.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivities.map((activity) => {
                        const activityData = activity as any;
                        const timestamp = activityData.timestamp?.toDate ? activityData.timestamp.toDate() : new Date(activityData.timestamp);
                        const timeAgo = getRelativeTime(timestamp);

                        return (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className={`p-1.5 rounded-lg ${
                            activityData.type === 'user' ? 'bg-blue-100 text-blue-600' :
                            activityData.type === 'login' ? 'bg-green-100 text-green-600' :
                            activityData.type === 'security' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {activityData.type === 'user' ? <UserCheck className="h-3 w-3" /> :
                             activityData.type === 'login' ? <CheckCircle className="h-3 w-3" /> :
                             activityData.type === 'security' ? <AlertTriangle className="h-3 w-3" /> :
                             <Activity className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900">{activityData.action || 'アクション'}</p>
                              <span className="text-xs text-gray-400">{timeAgo}</span>
                            </div>
                            <p className="text-xs text-gray-500">{activityData.user || 'ユーザー'}</p>
                            {activityData.detail && (
                              <p className="text-xs text-gray-400 mt-0.5">{activityData.detail}</p>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Activity className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">アクティビティがありません</p>
                      <p className="text-xs text-gray-400 mt-1">ユーザーの活動が表示されます</p>
                    </div>
                  )}
                </div>

                {/* System Status - Simplified */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">システム状態</h2>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">サーバー</span>
                          <p className="text-xs text-gray-500">45ms</p>
                        </div>
                      </div>
                      <span className="text-xs text-green-600">正常</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">データベース</span>
                          <p className="text-xs text-gray-500">12/100接続</p>
                        </div>
                      </div>
                      <span className="text-xs text-green-600">正常</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">メンテナンス</span>
                          <p className="text-xs text-gray-500">予定</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600">09/15</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}