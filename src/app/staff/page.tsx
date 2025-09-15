'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { UserCheck, Calendar, Clock, Bell, FileText, ArrowRight, Star, Users, Play, Square, MapPin, Timer } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { attendanceService } from '@/lib/attendanceService';
import { AttendanceStatus, AttendanceRecord } from '@/types';

export default function StaffPage() {
  const { currentUser } = useAuth();
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // リアルタイム出勤状況の監視
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = attendanceService.subscribeToAttendanceStatus(
      currentUser.uid,
      (status) => {
        console.log('📊 Attendance status updated:', status);
        setAttendanceStatus(status);
      }
    );

    // 今日の出勤記録を取得
    loadTodayRecord();

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // 現在時刻を1秒ごとに更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadTodayRecord = async () => {
    if (!currentUser?.uid) return;

    try {
      const record = await attendanceService.getTodayAttendance(currentUser.uid);
      setTodayRecord(record);
    } catch (error) {
      console.error('Error loading today record:', error);
    }
  };

  const handleClockIn = async () => {
    if (!currentUser || loading) return;

    setLoading(true);
    try {
      await attendanceService.clockIn(
        currentUser,
        undefined, // shiftId - 今回はシフトとの連携なし
        undefined, // location - 今回は位置情報なし
        '手動出勤記録'
      );
      
      // 成功メッセージを表示できるが、リアルタイム更新により自動的に状態が更新される
      console.log('✅ 出勤記録が完了しました');
      
      // 今日の記録を再取得
      await loadTodayRecord();
    } catch (error) {
      console.error('❌ 出勤記録エラー:', error);
      alert('出勤記録に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentUser || loading) return;

    setLoading(true);
    try {
      await attendanceService.clockOut(
        currentUser.uid,
        undefined, // location
        '手動退勤記録'
      );
      
      console.log('✅ 退勤記録が完了しました');
      
      // 今日の記録を再取得
      await loadTodayRecord();
    } catch (error) {
      console.error('❌ 退勤記録エラー:', error);
      alert('退勤記録に失敗しました。再度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  // 勤務時間をフォーマット
  const formatWorkDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  const staffStats = [
    { label: '今月のシフト', value: '12', unit: '回', icon: Calendar, color: 'bg-blue-500', trend: '+2' },
    { label: '今月の勤務時間', value: '96', unit: '時間', icon: Clock, color: 'bg-green-500', trend: '+8' },
    { label: '未確認の通知', value: '3', unit: '件', icon: Bell, color: 'bg-yellow-500', trend: 'new' },
    { label: '今月の評価', value: '4.8', unit: '/5.0', icon: Star, color: 'bg-purple-500', trend: '+0.2' },
  ];

  const staffActions = [
    { icon: Calendar, label: 'シフト確認', href: '/staff/schedule', description: '自分の今後のシフト予定を確認', color: 'bg-blue-500' },
    { icon: Clock, label: 'シフト希望提出', href: '/staff/requests/new', description: '新しいシフト希望を申請', color: 'bg-green-500' },
    { icon: FileText, label: 'シフト希望履歴', href: '/staff/requests', description: '過去のシフト希望を確認', color: 'bg-purple-500' },
    { icon: Bell, label: 'シフト交換', href: '/staff/exchanges', description: 'スタッフ間でのシフト交換', color: 'bg-yellow-500' },
    { icon: Users, label: '勤務実績', href: '/staff/attendance', description: '過去の勤務実績と給与詳細', color: 'bg-indigo-500' },
    { icon: Star, label: '緊急シフト', href: '/staff/urgent', description: '緊急で募集中のシフト確認', color: 'bg-red-500' },
  ];

  const upcomingShifts = [
    { date: addDays(new Date(), 1), time: '09:00 - 15:00', position: 'ホール', status: '確定' },
    { date: addDays(new Date(), 3), time: '15:00 - 21:00', position: 'キッチン', status: '確定' },
    { date: addDays(new Date(), 5), time: '09:00 - 15:00', position: 'ホール', status: '仮' },
    { date: addDays(new Date(), 7), time: '18:00 - 22:00', position: 'レジ', status: '確定' },
  ];

  const recentNotifications = [
    { type: 'shift_assigned', title: 'シフト確定', message: '明日のシフトが確定しました', time: '2時間前', color: 'bg-blue-100 text-blue-600' },
    { type: 'exchange_request', title: 'シフト交換依頼', message: '田中さんから交換依頼があります', time: '5時間前', color: 'bg-green-100 text-green-600' },
    { type: 'reminder', title: 'シフト希望締切', message: '来週のシフト希望は明日まで', time: '1日前', color: 'bg-yellow-100 text-yellow-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white bg-opacity-20 rounded-full">
                <UserCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">スタッフダッシュボード</h1>
                <p className="text-green-100 mt-1">
                  ようこそ、{currentUser?.name}さん • {format(currentTime, 'MM月dd日（E） HH:mm:ss', { locale: ja })}
                </p>
              </div>
            </div>
          </div>

          {/* 出勤・退勤セクション */}
          <div className="bg-white rounded-lg shadow-lg border-2 border-blue-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Timer className="h-6 w-6 text-blue-600 mr-2" />
                出勤・退勤管理
              </h2>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  attendanceStatus?.isWorking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                }`}></div>
                <span className="text-sm text-gray-600">
                  {attendanceStatus?.isWorking ? '勤務中' : '勤務外'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 出勤・退勤ボタン */}
              <div className="lg:col-span-1">
                <div className="space-y-4">
                  {!attendanceStatus?.isWorking ? (
                    <button
                      onClick={handleClockIn}
                      disabled={loading}
                      className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Play className="h-6 w-6 mr-2" />
                      {loading ? '記録中...' : '出勤する'}
                    </button>
                  ) : (
                    <button
                      onClick={handleClockOut}
                      disabled={loading}
                      className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Square className="h-5 w-5 mr-2" />
                      {loading ? '記録中...' : '退勤する'}
                    </button>
                  )}
                </div>
              </div>

              {/* 現在の状況 */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">出勤時刻</p>
                        <p className="text-lg font-bold text-blue-900">
                          {attendanceStatus?.clockInTime 
                            ? format(attendanceStatus.clockInTime, 'HH:mm', { locale: ja })
                            : '未出勤'
                          }
                        </p>
                      </div>
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">勤務時間</p>
                        <p className="text-lg font-bold text-green-900">
                          {attendanceStatus?.isWorking && attendanceStatus.workDuration
                            ? formatWorkDuration(attendanceStatus.workDuration)
                            : todayRecord?.totalWorkTime
                            ? formatWorkDuration(todayRecord.totalWorkTime)
                            : '0時間0分'
                          }
                        </p>
                      </div>
                      <Timer className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                {/* 今日の詳細情報 */}
                {(attendanceStatus?.isWorking || todayRecord) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">今日の勤務詳細</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      {attendanceStatus?.clockInTime && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          出勤: {format(attendanceStatus.clockInTime, 'HH:mm', { locale: ja })}
                        </div>
                      )}
                      {todayRecord?.clockOutTime && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          退勤: {format(todayRecord.clockOutTime, 'HH:mm', { locale: ja })}
                        </div>
                      )}
                      {todayRecord?.notes && (
                        <div className="text-xs text-gray-500">
                          メモ: {todayRecord.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Staff Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {staffStats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6">
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
                    ) : (
                      <span className={`text-sm font-medium ${stat.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.trend}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Staff Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">スタッフ機能</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffActions.map((action, index) => (
                <a
                  key={index}
                  href={action.href}
                  className="group flex items-start p-4 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-colors"
                >
                  <div className={`${action.color} p-3 rounded-full text-white mr-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                    <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                  </div>
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
                  <h2 className="text-lg font-semibold text-gray-900">今後のシフト</h2>
                  <a href="/shifts" className="text-sm text-green-600 hover:text-green-700 flex items-center">
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </a>
                </div>
                <div className="space-y-3">
                  {upcomingShifts.map((shift, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded">
                          <Calendar className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {format(shift.date, 'MM/dd (E)', { locale: ja })}
                          </p>
                          <p className="text-xs text-gray-500">{shift.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-900">{shift.position}</p>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          shift.status === '確定' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                        }`}>
                          {shift.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Notifications */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">お知らせ</h2>
                  <a href="/notifications" className="text-sm text-green-600 hover:text-green-700 flex items-center">
                    すべて見る
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </a>
                </div>
                <div className="space-y-3">
                  {recentNotifications.map((notification, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded ${notification.color}`}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{notification.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}