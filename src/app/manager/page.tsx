'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import StatCard from '@/components/ui/StatCard';
import { Users, Calendar, Clock, TrendingUp, FileText, UserCheck, Plus, MessageCircle, ClipboardList, MessageSquare, Eye } from 'lucide-react';
import Link from 'next/link';
import { useManagerStatistics } from '@/contexts/ManagerDataContext';

export default function ManagerPage() {
  // 新しい統合データストアから統計データを取得
  const {
    statistics: managerStats,
    loading,
    error,
    refresh: refreshStats
  } = useManagerStatistics();

  // 表示用統計データ（ローディング中でなく、エラーがない場合のみ表示）
  const displayStats = !loading && !error && managerStats ? [
    {
      label: '管理スタッフ数',
      value: managerStats.totalStaff.toString(),
      unit: '名',
      icon: UserCheck,
      gradient: 'from-blue-500 to-blue-600',
      change: managerStats.staffGrowth,
      trend: (managerStats.staffGrowth.includes('+') ? 'up' : managerStats.staffGrowth.includes('-') ? 'down' : 'neutral') as const
    },
    {
      label: '今週のシフト',
      value: managerStats.weeklyShifts.toString(),
      unit: 'コマ',
      icon: Calendar,
      gradient: 'from-green-500 to-green-600',
      change: managerStats.shiftsGrowth,
      trend: (managerStats.shiftsGrowth.includes('+') ? 'up' : managerStats.shiftsGrowth.includes('-') ? 'down' : 'neutral') as const
    },
    {
      label: '承認待ち',
      value: managerStats.pendingApprovals.toString(),
      unit: '件',
      icon: Clock,
      gradient: 'from-yellow-500 to-yellow-600',
      change: managerStats.approvalsGrowth === 'new' ? 'NEW' : undefined,
      trend: managerStats.approvalsGrowth === 'increased' ? 'up' : 'neutral'
    },
    {
      label: '今月の人件費',
      value: managerStats.monthlyBudget.toLocaleString(),
      unit: '円',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-purple-600',
      change: managerStats.budgetGrowth,
      trend: (managerStats.budgetGrowth.includes('+') ? 'up' : managerStats.budgetGrowth.includes('-') ? 'down' : 'neutral') as const
    },
  ] : [];

  // エラー時の表示データ
  const errorStats = [
    { label: '管理スタッフ数', value: 'X', unit: '名', icon: UserCheck, gradient: 'from-red-500 to-red-600', change: undefined, trend: 'neutral' as const },
    { label: '今週のシフト', value: 'X', unit: 'コマ', icon: Calendar, gradient: 'from-red-500 to-red-600', change: undefined, trend: 'neutral' as const },
    { label: '承認待ち', value: 'X', unit: '件', icon: Clock, gradient: 'from-red-500 to-red-600', change: undefined, trend: 'neutral' as const },
    { label: '今月の人件費', value: 'X', unit: '円', icon: TrendingUp, gradient: 'from-red-500 to-red-600', change: undefined, trend: 'neutral' as const },
  ];

  // ローディング時の表示データ
  const loadingStats = [
    { label: '管理スタッフ数', value: '--', unit: '名', icon: UserCheck, gradient: 'from-blue-500 to-blue-600', change: undefined, trend: 'neutral' as const },
    { label: '今週のシフト', value: '--', unit: 'コマ', icon: Calendar, gradient: 'from-green-500 to-green-600', change: undefined, trend: 'neutral' as const },
    { label: '承認待ち', value: '--', unit: '件', icon: Clock, gradient: 'from-yellow-500 to-yellow-600', change: undefined, trend: 'neutral' as const },
    { label: '今月の人件費', value: '--', unit: '円', icon: TrendingUp, gradient: 'from-purple-500 to-purple-600', change: undefined, trend: 'neutral' as const },
  ];

  const managerActions = [
    { icon: Eye, label: 'シフト状況確認', href: '/manager/shift-overview', description: '全月のシフト割り振り状況を確認', color: 'bg-teal-500' },
    { icon: Calendar, label: 'シフト作成', href: '/manager/calendar', description: 'カレンダービューでシフト作成・編集', color: 'bg-blue-500' },
    { icon: Users, label: 'スタッフ管理', href: '/manager/staff', description: 'スタッフの情報管理と権限設定', color: 'bg-purple-500' },
    { icon: ClipboardList, label: '人員テンプレート', href: '/manager/staffing-template', description: '月間必要人数の設定・管理', color: 'bg-green-500' },
    { icon: MessageCircle, label: 'チャット', href: '/manager/chat', description: 'スタッフとのリアルタイムチャット', color: 'bg-orange-500' },
    { icon: MessageSquare, label: 'お問い合わせ', href: '/manager/contact', description: '管理者への質問・要望の送信', color: 'bg-red-500' },
  ];


  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50 animate-page-enter">
        <AppHeader title="店長ダッシュボード" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4">

          {/* Manager Stats - Using StatCard Component */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* データ状態に応じて統計カードを表示 */}
            {(error ? errorStats : loading ? loadingStats : displayStats).map((stat, index) => (
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

          {/* エラー時のフィードバック */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-red-500">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-red-800 font-medium">データの取得に失敗しました</p>
                    <p className="text-red-600 text-sm">ネットワーク接続を確認して再試行してください</p>
                  </div>
                </div>
                <button
                  onClick={refreshStats}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  再読み込み
                </button>
              </div>
            </div>
          )}

          {/* Management Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">店長機能</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {managerActions.map((action, index) => (
                <Link
                  key={index}
                  href={action.href}
                  className="group flex items-start p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className={`${action.color} p-3 rounded-full text-white mr-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                    <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}