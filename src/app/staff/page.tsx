'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { UserCheck, Calendar, Clock, Bell, FileText, ArrowRight, Star, Users, Play, Square, MapPin, Timer, DollarSign, CalendarCheck } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, differenceInDays, addMonths, setDate } from 'date-fns';
import { ja } from 'date-fns/locale';
import { attendanceService } from '@/lib/attendanceService';
import { shiftService } from '@/lib/shiftService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceStatus, AttendanceRecord, ShiftExtended } from '@/types';

export default function StaffPage() {
  const { currentUser } = useAuth();
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 統計情報のstate
  const [monthlyShifts, setMonthlyShifts] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [monthlySalary, setMonthlySalary] = useState(0);
  const [daysToDeadline, setDaysToDeadline] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

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

  // 統計データの取得
  useEffect(() => {
    if (!currentUser?.uid) return;
    loadMonthlyStats();
  }, [currentUser]);

  // 今月のシフト数を取得
  const getMonthlyShifts = async (userId: string): Promise<number> => {
    try {
      const currentDate = new Date();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const shiftsQuery = query(
        collection(db, 'shifts'),
        where('managerId', '==', currentUser?.managerId),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(shiftsQuery);
      let shiftCount = 0;

      snapshot.docs.forEach(doc => {
        const shift = doc.data() as ShiftExtended;
        const shiftDate = shift.date?.toDate?.() || new Date(shift.date);

        if (shiftDate >= monthStart && shiftDate <= monthEnd) {
          // このシフトにユーザーが割り当てられているかチェック
          const isAssigned = shift.slots?.some(slot =>
            slot.assignedStaff?.includes(userId)
          );
          if (isAssigned) {
            shiftCount++;
          }
        }
      });

      return shiftCount;
    } catch (error) {
      console.error('Error fetching monthly shifts:', error);
      return 0;
    }
  };

  // 今月の総勤務時間を取得
  const getMonthlyWorkHours = async (userId: string): Promise<number> => {
    try {
      const currentDate = new Date();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const attendanceQuery = query(
        collection(db, 'attendanceRecords'),
        where('userId', '==', userId),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd)
      );

      const snapshot = await getDocs(attendanceQuery);
      let totalMinutes = 0;

      snapshot.docs.forEach(doc => {
        const record = doc.data() as AttendanceRecord;
        if (record.totalWorkTime) {
          totalMinutes += record.totalWorkTime;
        }
      });

      return Math.round(totalMinutes / 60); // 時間に変換
    } catch (error) {
      console.error('Error fetching monthly work hours:', error);
      return 0;
    }
  };

  // 次のシフト希望締切日までの日数を計算
  const calculateDaysToDeadline = (): number => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 来月の20日が締切
    const nextMonth = addMonths(today, 1);
    const deadline = setDate(nextMonth, 20);

    // 既に今月の20日を過ぎている場合は来月の20日、そうでなければ今月の20日
    const thisMonthDeadline = setDate(today, 20);
    const targetDeadline = today > thisMonthDeadline ? deadline : thisMonthDeadline;

    return Math.max(0, differenceInDays(targetDeadline, today));
  };

  // 統計データをまとめて読み込み
  const loadMonthlyStats = async () => {
    if (!currentUser?.uid) return;

    setStatsLoading(true);
    try {
      const [shifts, hours] = await Promise.all([
        getMonthlyShifts(currentUser.uid),
        getMonthlyWorkHours(currentUser.uid)
      ]);

      setMonthlyShifts(shifts);
      setMonthlyHours(hours);

      // 給料計算（時給 × 勤務時間）
      const hourlyRate = currentUser.hourlyRate || 1000; // デフォルト1000円
      setMonthlySalary(hours * hourlyRate);

      // 締切日までの日数
      setDaysToDeadline(calculateDaysToDeadline());
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

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

  // 給料をフォーマットする関数
  const formatSalary = (amount: number): string => {
    return new Intl.NumberFormat('ja-JP').format(amount);
  };

  const staffStats = [
    {
      label: '今月のシフト',
      value: statsLoading ? '-' : monthlyShifts.toString(),
      unit: '回',
      icon: Calendar,
      color: 'bg-blue-500',
      trend: monthlyShifts > 10 ? '+' + (monthlyShifts - 10) : monthlyShifts < 10 ? (monthlyShifts - 10).toString() : '±0'
    },
    {
      label: '今月の勤務時間',
      value: statsLoading ? '-' : monthlyHours.toString(),
      unit: '時間',
      icon: Clock,
      color: 'bg-green-500',
      trend: monthlyHours > 80 ? '+' + (monthlyHours - 80) : monthlyHours < 80 ? (monthlyHours - 80).toString() : '±0'
    },
    {
      label: '今月の給料',
      value: statsLoading ? '-' : formatSalary(monthlySalary),
      unit: '円',
      icon: DollarSign,
      color: 'bg-yellow-500',
      trend: monthlySalary > 100000 ? '高額' : monthlySalary > 50000 ? '標準' : '追加勤務可'
    },
    {
      label: '来月シフト希望締切',
      value: statsLoading ? '-' : daysToDeadline.toString(),
      unit: '日後',
      icon: CalendarCheck,
      color: daysToDeadline <= 5 ? 'bg-red-500' : daysToDeadline <= 10 ? 'bg-orange-500' : 'bg-purple-500',
      trend: daysToDeadline <= 5 ? '緊急' : daysToDeadline <= 10 ? '注意' : '余裕あり'
    },
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
      <AppHeader />
      <DashboardLayout>
        <div className="space-y-6 animate-page-enter">
          {/* Staff Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {staffStats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className={`text-2xl font-semibold mt-1 ${
                      stat.label === '来月シフト希望締切' && daysToDeadline <= 5 && !statsLoading
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}>
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
                    {stat.trend === '緊急' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-100 rounded-full">
                        緊急
                      </span>
                    ) : stat.trend === '注意' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-orange-600 bg-orange-100 rounded-full">
                        注意
                      </span>
                    ) : stat.trend === '余裕あり' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-100 rounded-full">
                        余裕あり
                      </span>
                    ) : stat.trend === '高額' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-purple-600 bg-purple-100 rounded-full">
                        高額
                      </span>
                    ) : stat.trend === '標準' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full">
                        標準
                      </span>
                    ) : stat.trend === '追加勤務可' ? (
                      <span className="px-2 py-1 text-xs font-semibold text-yellow-600 bg-yellow-100 rounded-full">
                        追加勤務可
                      </span>
                    ) : (
                      <span className={`text-sm font-medium ${stat.trend.startsWith('+') ? 'text-green-600' : stat.trend.startsWith('-') ? 'text-red-600' : 'text-gray-600'}`}>
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