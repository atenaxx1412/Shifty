'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { Users, Calendar, Clock, TrendingUp, FileText, UserCheck, ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatsService, ManagerStats } from '@/lib/statsService';

export default function ManagerPage() {
  const { currentUser } = useAuth();
  const [managerStats, setManagerStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time stats subscription
  useEffect(() => {
    if (!currentUser?.uid || currentUser?.role !== 'manager') return;

    console.log('📊 Setting up manager dashboard stats subscription');
    
    const unsubscribe = StatsService.subscribeToManagerStats(
      currentUser.uid, // Use managerId
      (stats: ManagerStats) => {
        setManagerStats(stats);
        setLoading(false);
        console.log('📊 Manager stats updated:', stats);
      }
    );

    // Cleanup subscription
    return () => {
      console.log('🔌 Cleaning up manager dashboard stats subscription');
      unsubscribe();
    };
  }, [currentUser?.uid, currentUser?.role]);

  // Generate display stats from real data
  const displayStats = managerStats ? [
    { 
      label: '管理スタッフ数', 
      value: managerStats.totalStaff.current.toString(), 
      unit: '名', 
      icon: UserCheck, 
      color: 'bg-blue-500', 
      trend: managerStats.totalStaff.trend 
    },
    { 
      label: '今週のシフト', 
      value: managerStats.weeklyShifts.current.toString(), 
      unit: 'コマ', 
      icon: Calendar, 
      color: 'bg-green-500', 
      trend: managerStats.weeklyShifts.trend 
    },
    { 
      label: '承認待ち', 
      value: managerStats.pendingApprovals.current.toString(), 
      unit: '件', 
      icon: Clock, 
      color: 'bg-yellow-500', 
      trend: managerStats.pendingApprovals.trend 
    },
    { 
      label: '今月の人件費', 
      value: managerStats.monthlyBudget.current.toString(), 
      unit: 'k円', 
      icon: TrendingUp, 
      color: 'bg-purple-500', 
      trend: managerStats.monthlyBudget.trend 
    },
  ] : [];

  // Loading state display stats
  const loadingStats = [
    { label: '管理スタッフ数', value: '--', unit: '名', icon: UserCheck, color: 'bg-blue-500', trend: null },
    { label: '今週のシフト', value: '--', unit: 'コマ', icon: Calendar, color: 'bg-green-500', trend: null },
    { label: '承認待ち', value: '--', unit: '件', icon: Clock, color: 'bg-yellow-500', trend: null },
    { label: '今月の人件費', value: '--', unit: 'k円', icon: TrendingUp, color: 'bg-purple-500', trend: null },
  ];

  const managerActions = [
    { icon: Calendar, label: 'シフト管理', href: '/manager/shifts', description: 'シフト作成・編集・予算計算', color: 'bg-blue-500' },
    { icon: Plus, label: 'シフトカレンダー', href: '/manager/calendar', description: 'カレンダービューでシフト管理', color: 'bg-green-500' },
    { icon: Users, label: 'スタッフ管理', href: '/manager/staff', description: 'スタッフの情報管理と権限設定', color: 'bg-purple-500' },
    { icon: FileText, label: 'スケジュール確認', href: '/manager/schedules', description: 'スタッフスケジュールの確認と管理', color: 'bg-yellow-500' },
    { icon: UserCheck, label: '承認管理', href: '/manager/approvals', description: 'シフト希望・交換の承認管理', color: 'bg-red-500' },
    { icon: TrendingUp, label: '予算管理', href: '/manager/budget', description: '人件費と予算の分析・管理', color: 'bg-indigo-500' },
  ];

  const pendingApprovals = [
    { staff: '山田太郎', type: 'シフト希望', date: '2025/09/05', time: '09:00-15:00', status: 'pending' },
    { staff: '佐藤花子', type: 'シフト交換', date: '2025/09/06', time: '15:00-21:00', status: 'pending' },
    { staff: '田中次郎', type: '休暇申請', date: '2025/09/10', time: '全日', status: 'pending' },
  ];

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50 animate-page-enter">
        <AppHeader title="店長ダッシュボード" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Welcome Banner */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">{currentUser?.name}</h1>
                    <p className="text-sm text-gray-500">店長 • スタッフ管理とシフト作成権限</p>
                  </div>
                </div>
              </div>
            </div>

          {/* Manager Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(loading ? loadingStats : displayStats).map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6 relative">
                {loading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">
                      {stat.value}
                      <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-full`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                {stat.trend && (
                  <div className="mt-2">
                    {stat.trend === 'new' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded-full">
                        NEW
                      </span>
                    ) : stat.trend === 'increased' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-orange-600 bg-orange-100 rounded-full">
                        増加
                      </span>
                    ) : stat.trend === 'decreased' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                        減少
                      </span>
                    ) : stat.trend === 'same' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">
                        変わらず
                      </span>
                    ) : (
                      <span className={`text-sm font-medium ${stat.trend.toString().startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.trend}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Management Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-6">店長機能</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {managerActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className="group flex items-start p-4 rounded-lg border-2 border-blue-200 hover:border-blue-300 transition-colors"
                >
                  <div className={`${action.color} p-3 rounded-full text-white mr-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">{action.label}</h3>
                    <p className="text-xs text-blue-500 mt-1">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Approvals */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-blue-900">承認待ち</h2>
                  <Link href="/manager/approvals" className="text-sm text-blue-600 hover:text-blue-700 flex items-center">
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {pendingApprovals.map((approval, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="bg-yellow-100 p-2 rounded">
                          <Clock className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-900">{approval.staff}</p>
                          <p className="text-xs text-blue-500">
                            {approval.type} • {approval.date} {approval.time}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 rounded-full">
                        保留中
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Insights */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-4">店舗インサイト</h2>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">売上トレンド</p>
                        <p className="text-xs text-blue-700">今週は前週比 +12% の売上向上</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">スタッフ効率</p>
                        <p className="text-xs text-green-700">今月の労働効率は95%、高水準を維持</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">シフト充足率</p>
                        <p className="text-xs text-purple-700">来週のシフトカバー率 98%</p>
                      </div>
                    </div>
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