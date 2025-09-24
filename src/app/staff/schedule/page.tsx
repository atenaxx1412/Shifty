'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  MapPin,
  AlertCircle,
  CheckCircle,
  FileText,
  Download as DownloadIcon
} from 'lucide-react';
import { format, addDays, isSameDay, startOfDay, startOfMonth, endOfMonth, addMonths, subMonths, getDay, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftService } from '@/lib/shiftService';
import { ShiftExtended } from '@/types';

export default function StaffSchedulePage() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  // デフォルトで月表示を設定
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // リアルタイムでシフトデータを取得
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);
    console.log('📅 Setting up real-time shift subscription for staff:', currentUser.uid);

    // スタッフ専用のリアルタイムシフト取得
    const unsubscribe = shiftService.subscribeToStaffShifts(
      currentUser.uid,
      (updatedShifts) => {
        console.log(`📊 Received ${updatedShifts.length} shifts for staff:`, currentUser.name);
        setShifts(updatedShifts);
        setLoading(false);
        setError(null);
      }
    );

    return () => {
      console.log('🔌 Cleaning up shift subscription');
      unsubscribe();
    };
  }, [currentUser]);

  // 月の情報を取得
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  // カレンダーグリッドの生成（6週間 = 42日）

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // 月曜始まり
  const calendarDates = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));

  // 指定日のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => isSameDay(new Date(shift.date), date));
  };

  // スタッフの特定日のシフトスロットを取得
  const getMyShiftsForDate = (date: Date) => {
    const dayShifts = getShiftsForDate(date);
    const mySlots: Array<{
      shift: ShiftExtended;
      slot: ShiftExtended['slots'][0];
    }> = [];

    dayShifts.forEach(shift => {
      shift.slots.forEach(slot => {
        if (slot.assignedStaff?.includes(currentUser?.uid || '')) {
          mySlots.push({ shift, slot });
        }
      });
    });

    return mySlots;
  };

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subMonths(selectedDate, 1));
    } else {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

  // 今月に戻る
  const goToThisMonth = () => {
    setSelectedDate(new Date());
  };

  // ステータスの色を取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'draft':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'completed':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };


  // 今月の統計
  const monthStats = {
    totalShifts: shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= monthStart && shiftDate <= monthEnd;
    }).reduce((total, shift) => {
      return total + shift.slots.filter(slot =>
        slot.assignedStaff?.includes(currentUser?.uid || '')
      ).length;
    }, 0),
    totalHours: shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= monthStart && shiftDate <= monthEnd;
    }).reduce((total, shift) => {
      return total + shift.slots.filter(slot =>
        slot.assignedStaff?.includes(currentUser?.uid || '')
      ).reduce((slotTotal, slot) => {
        return slotTotal + (parseInt(slot.estimatedDuration || '0') / 60);
      }, 0);
    }, 0),
    confirmedShifts: shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= monthStart && shiftDate <= monthEnd && shift.status === 'published';
    }).reduce((total, shift) => {
      return total + shift.slots.filter(slot =>
        slot.assignedStaff?.includes(currentUser?.uid || '')
      ).length;
    }, 0),
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">シフト表を読み込み中...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
      <AppHeader title="シフト確認" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex justify-end">
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">
                <FileText className="h-4 w-4" />
                <span>印刷</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">
                <DownloadIcon className="h-4 w-4" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Monthly Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">今月のシフト</p>
                  <p className="text-2xl font-bold text-blue-900">{monthStats.totalShifts}件</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">予定時間</p>
                  <p className="text-2xl font-bold text-green-900">{monthStats.totalHours.toFixed(1)}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">確定済み</p>
                  <p className="text-2xl font-bold text-purple-900">{monthStats.confirmedShifts}件</p>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Navigation */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <h2 className="text-lg font-semibold text-gray-900">
                {format(selectedDate, 'yyyy年M月', { locale: ja })}
              </h2>

              <button
                onClick={() => changeMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={goToThisMonth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              今月
            </button>
          </div>

          {/* Monthly Calendar */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Calendar Header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['月', '火', '水', '木', '金', '土', '日'].map((day) => (
                <div key={day} className="p-4 text-center font-medium text-gray-900 bg-gray-50">
                  <div className="text-sm">{day}</div>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDates.map((date, index) => {
                const dayShifts = getMyShiftsForDate(date);
                const isToday = isSameDay(date, new Date());
                const isPast = date < startOfDay(new Date());
                const isCurrentMonth = date >= monthStart && date <= monthEnd;
                const isWeekend = getDay(date) === 0 || getDay(date) === 6; // 日曜日または土曜日

                return (
                  <div
                    key={date.toISOString()}
                    className={`min-h-32 p-2 border-r border-b border-gray-200 ${
                      isToday ? 'bg-blue-50' :
                      !isCurrentMonth ? 'bg-gray-50' :
                      isPast ? 'bg-gray-25' : ''
                    } ${
                      (index + 1) % 7 === 0 ? 'border-r-0' : ''
                    } ${
                      index >= 35 ? 'border-b-0' : ''
                    }`}
                  >
                    {/* 日付表示 */}
                    <div className={`flex justify-between items-center mb-2`}>
                      <span className={`text-sm font-medium ${
                        !isCurrentMonth ? 'text-gray-400' :
                        isToday ? 'text-blue-600' :
                        isWeekend ? 'text-red-500' :
                        'text-gray-900'
                      }`}>
                        {format(date, 'd')}
                      </span>
                      {isToday && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                    </div>

                    {/* シフト表示 */}
                    {isCurrentMonth && (
                      <div className="space-y-1">
                        {dayShifts.slice(0, 3).map(({ shift, slot }, slotIndex) => (
                          <div
                            key={`${shift.shiftId}-${slot.slotId}-${slotIndex}`}
                            className={`p-1 rounded text-xs border ${getStatusColor(shift.status)}`}
                          >
                            <div className="font-medium truncate">
                              {slot.startTime}-{slot.endTime}
                            </div>
                            {slot.positions && slot.positions.length > 0 && (
                              <div className="flex items-center space-x-1 mt-1">
                                <MapPin className="h-2 w-2" />
                                <span className="truncate">{slot.positions[0]}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 追加のシフトがある場合 */}
                        {dayShifts.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{dayShifts.length - 3}件
                          </div>
                        )}

                        {/* シフトがない場合 */}
                        {dayShifts.length === 0 && !isPast && (
                          <div className="text-center text-gray-300 py-2">
                            <div className="text-xs">-</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="text-red-800 font-medium">エラーが発生しました</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && shifts.length === 0 && !error && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">まだシフトが登録されていません</p>
              <p className="text-gray-400 mt-2">
                管理者がシフトを作成するか、シフト希望を提出してください
              </p>
              <a
                href="/staff/requests/new"
                className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                シフト希望を提出
              </a>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}