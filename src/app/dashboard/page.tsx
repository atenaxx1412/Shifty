'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Calendar, Users, Clock, TrendingUp, Bell, FileText, UserCheck, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function DashboardPage() {
  const { currentUser } = useAuth();

  const getRoleDisplayName = () => {
    switch (currentUser?.role) {
      case 'root':
        return 'システム管理者';
      case 'manager':
        return '店長';
      case 'staff':
        return 'スタッフ';
      default:
        return 'ユーザー';
    }
  };

  const getQuickActions = () => {
    if (!currentUser) return [];

    switch (currentUser.role) {
      case 'root':
        return [
          { icon: Users, label: '店舗管理', href: '/admin/shops', color: 'bg-blue-500' },
          { icon: UserCheck, label: 'ユーザー管理', href: '/admin/users', color: 'bg-green-500' },
          { icon: FileText, label: 'レポート', href: '/reports', color: 'bg-purple-500' },
          { icon: TrendingUp, label: '分析', href: '/analytics', color: 'bg-yellow-500' },
        ];
      case 'manager':
        return [
          { icon: Calendar, label: 'シフト作成', href: '/shifts/create', color: 'bg-blue-500' },
          { icon: UserCheck, label: 'シフト承認', href: '/shifts/approve', color: 'bg-green-500' },
          { icon: FileText, label: 'レポート', href: '/reports', color: 'bg-purple-500' },
          { icon: Users, label: 'スタッフ管理', href: '/staff', color: 'bg-yellow-500' },
        ];
      case 'staff':
        return [
          { icon: Calendar, label: 'シフト確認', href: '/shifts', color: 'bg-blue-500' },
          { icon: Clock, label: 'シフト希望', href: '/shifts/request', color: 'bg-green-500' },
          { icon: Bell, label: 'シフト交換', href: '/shifts/exchange', color: 'bg-purple-500' },
          { icon: FileText, label: '勤務実績', href: '/timesheet', color: 'bg-yellow-500' },
        ];
      default:
        return [];
    }
  };

  const stats = currentUser?.role === 'staff' 
    ? [
        { label: '今月のシフト', value: '12', unit: '回', trend: '+2' },
        { label: '今月の勤務時間', value: '96', unit: '時間', trend: '+8' },
        { label: '未確認の通知', value: '3', unit: '件', trend: 'new' },
        { label: '承認待ち', value: '1', unit: '件', trend: '0' },
      ]
    : [
        { label: '本日の出勤者', value: '8', unit: '名', trend: '+2' },
        { label: '今週のシフト', value: '42', unit: 'コマ', trend: '+5' },
        { label: '承認待ち', value: '5', unit: '件', trend: 'new' },
        { label: 'スタッフ数', value: '15', unit: '名', trend: '+1' },
      ];

  const upcomingShifts = [
    { date: new Date(2025, 8, 4), time: '09:00 - 15:00', position: 'ホール' },
    { date: new Date(2025, 8, 5), time: '15:00 - 21:00', position: 'キッチン' },
    { date: new Date(2025, 8, 7), time: '09:00 - 15:00', position: 'ホール' },
  ];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Welcome Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  おかえりなさい、{currentUser?.name || 'ユーザー'}さん
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {getRoleDisplayName()} • {format(new Date(), 'yyyy年MM月dd日(E)', { locale: ja })}
                </p>
              </div>
              <div className="hidden md:block">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  通知設定
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">
                      {stat.value}
                      <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>
                    </p>
                  </div>
                  {stat.trend === 'new' ? (
                    <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded-full">
                      NEW
                    </span>
                  ) : stat.trend !== '0' ? (
                    <span className="text-sm font-medium text-green-600">
                      {stat.trend}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">クイックアクション</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {getQuickActions().map((action, index) => (
                <a
                  key={index}
                  href={action.href}
                  className="group flex flex-col items-center justify-center p-6 rounded-lg border-2 border-gray-200 hover:border-indigo-500 transition-colors"
                >
                  <div className={`${action.color} p-3 rounded-full text-white group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <span className="mt-3 text-sm font-medium text-gray-900">{action.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Shifts */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentUser?.role === 'staff' ? '今後のシフト' : '本日のシフト状況'}
                  </h2>
                  <a href="/shifts" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center">
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </a>
                </div>
                <div className="space-y-3">
                  {upcomingShifts.map((shift, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="bg-indigo-100 p-2 rounded">
                          <Calendar className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {format(shift.date, 'MM/dd (E)', { locale: ja })}
                          </p>
                          <p className="text-xs text-gray-500">{shift.time}</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-full">
                        {shift.position}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">お知らせ</h2>
                  <a href="/notifications" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center">
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </a>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-100 p-2 rounded">
                      <Bell className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">シフト確定のお知らせ</p>
                      <p className="text-xs text-gray-500 mt-1">来週のシフトが確定しました</p>
                      <p className="text-xs text-gray-400 mt-1">2時間前</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-100 p-2 rounded">
                      <UserCheck className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">シフト交換リクエスト</p>
                      <p className="text-xs text-gray-500 mt-1">田中さんからシフト交換の依頼があります</p>
                      <p className="text-xs text-gray-400 mt-1">5時間前</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-yellow-100 p-2 rounded">
                      <Clock className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">シフト希望提出期限</p>
                      <p className="text-xs text-gray-500 mt-1">再来週のシフト希望は明日まで</p>
                      <p className="text-xs text-gray-400 mt-1">昨日</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}