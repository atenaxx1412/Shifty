'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Calendar, 
  Clock, 
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle,
  FileText,
  Download as DownloadIcon
} from 'lucide-react';
import { format, addDays, subDays, startOfWeek, addWeeks, subWeeks, isSameDay, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftService } from '@/lib/shiftService';
import { ShiftExtended } from '@/types';

export default function StaffSchedulePage() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // リアルタイムでシフトデータを取得
  useEffect(() => {
    if (!currentUser?.shopId) return;

    setLoading(true);
    console.log('📅 Setting up real-time shift subscription for staff:', currentUser.uid);

    // リアルタイムシフト取得
    const unsubscribe = shiftService.subscribeToShiftUpdates(
      currentUser.shopId,
      (updatedShifts) => {
        // 自分に関連するシフトのみフィルタリング
        const myShifts = updatedShifts.filter(shift => 
          shift.slots.some(slot => 
            slot.assignedStaff?.includes(currentUser.uid)
          )
        );
        
        console.log(`📊 Received ${myShifts.length} shifts for staff:`, currentUser.name);
        setShifts(myShifts);
        setLoading(false);
        setError(null);
      }
    );

    return () => {
      console.log('🔌 Cleaning up shift subscription');
      unsubscribe();
    };
  }, [currentUser]);

  // 週の開始日を取得
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // 月曜始まり
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // 指定日のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => isSameDay(new Date(shift.date), date));
  };

  // スタッフの特定日のシフトスロットを取得
  const getMyShiftsForDate = (date: Date) => {
    const dayShifts = getShiftsForDate(date);
    const mySlots: Array<{
      shift: ShiftExtended;
      slot: any;
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

  // 週を変更
  const changeWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subWeeks(selectedDate, 1));
    } else {
      setSelectedDate(addWeeks(selectedDate, 1));
    }
  };

  // 今週に戻る
  const goToThisWeek = () => {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return '確定';
      case 'draft':
        return '下書き';
      case 'completed':
        return '完了';
      default:
        return status;
    }
  };

  // 今日の統計
  const todayStats = {
    totalShifts: getMyShiftsForDate(new Date()).length,
    totalHours: getMyShiftsForDate(new Date()).reduce((total, { slot }) => {
      const duration = parseInt(slot.estimatedDuration || '0') / 60;
      return total + duration;
    }, 0),
    confirmedShifts: getMyShiftsForDate(new Date()).filter(({ shift }) => shift.status === 'published').length,
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
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <a 
                href="/staff" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">私のシフト表</h1>
                <p className="text-gray-600">
                  {currentUser?.name}さんのシフトスケジュール
                </p>
              </div>
            </div>
            
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

          {/* Today's Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">今日のシフト</p>
                  <p className="text-2xl font-bold text-blue-900">{todayStats.totalShifts}件</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">予定時間</p>
                  <p className="text-2xl font-bold text-green-900">{todayStats.totalHours.toFixed(1)}h</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">確定済み</p>
                  <p className="text-2xl font-bold text-purple-900">{todayStats.confirmedShifts}件</p>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Navigation */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => changeWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <h2 className="text-lg font-semibold text-gray-900">
                {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(addDays(weekStart, 6), 'M月d日', { locale: ja })}
              </h2>
              
              <button
                onClick={() => changeWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            
            <button
              onClick={goToThisWeek}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              今週
            </button>
          </div>

          {/* Weekly Calendar */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
                <div key={day} className="p-4 text-center font-medium text-gray-900 bg-gray-50">
                  <div className="text-sm">{day}</div>
                  <div className="text-lg">{format(weekDates[index], 'd')}</div>
                  {isSameDay(weekDates[index], new Date()) && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full mx-auto mt-1"></div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 min-h-96">
              {weekDates.map((date, index) => {
                const dayShifts = getMyShiftsForDate(date);
                const isToday = isSameDay(date, new Date());
                const isPast = date < startOfDay(new Date());

                return (
                  <div
                    key={date.toISOString()}
                    className={`p-2 border-r border-gray-200 ${
                      isToday ? 'bg-blue-50' : isPast ? 'bg-gray-50' : ''
                    } ${index === 6 ? 'border-r-0' : ''}`}
                  >
                    <div className="space-y-1">
                      {dayShifts.map(({ shift, slot }, slotIndex) => (
                        <div
                          key={`${shift.shiftId}-${slot.slotId}-${slotIndex}`}
                          className={`p-2 rounded text-xs border ${getStatusColor(shift.status)}`}
                        >
                          <div className="font-medium">
                            {slot.startTime}-{slot.endTime}
                          </div>
                          {slot.positions && slot.positions.length > 0 && (
                            <div className="flex items-center space-x-1 mt-1">
                              <MapPin className="h-3 w-3" />
                              <span>{slot.positions.join(', ')}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${getStatusColor(shift.status)}`}>
                              {getStatusText(shift.status)}
                            </span>
                            <div className="text-gray-500">
                              {Math.round((slot.estimatedDuration || 0) / 60)}h
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {dayShifts.length === 0 && !isPast && (
                        <div className="text-center text-gray-400 py-4">
                          <div className="text-xs">休み</div>
                        </div>
                      )}
                    </div>
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