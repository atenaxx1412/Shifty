'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { 
  Calendar, 
  Clock, 
  Users,
  Search,
  Download,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftService } from '@/lib/shiftService';
import { ShiftExtended } from '@/types';

export default function ManagerSchedulesPage() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'completed'>('all');

  // 週の開始日を取得
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // リアルタイムでシフトデータを取得
  useEffect(() => {
    if (!currentUser?.shopId) return;

    setLoading(true);
    console.log('📅 Setting up real-time shift subscription for manager schedules');

    const unsubscribe = shiftService.subscribeToShiftUpdates(
      currentUser.shopId,
      (updatedShifts) => {
        console.log(`📊 Received ${updatedShifts.length} shifts for manager schedules`);
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

  // 指定日のシフトを取得
  const getShiftsForDate = (date: Date) => {
    return shifts.filter(shift => isSameDay(new Date(shift.date), date));
  };

  // フィルタリングされたシフト
  const filteredShifts = shifts.filter(shift => {
    const matchesSearch = shift.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shift.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || shift.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

  // スタッフの統計
  const getStaffStats = () => {
    const totalStaff = new Set();
    const assignedSlots = new Set();
    let totalHours = 0;

    shifts.forEach(shift => {
      shift.slots.forEach(slot => {
        if (slot.assignedStaff && slot.assignedStaff.length > 0) {
          slot.assignedStaff.forEach(staffId => {
            totalStaff.add(staffId);
            assignedSlots.add(`${shift.shiftId}-${slot.slotId}`);
          });
          totalHours += (slot.estimatedDuration || 0) / 60;
        }
      });
    });

    return {
      totalStaff: totalStaff.size,
      assignedSlots: assignedSlots.size,
      totalHours: Math.round(totalHours),
      coverage: shifts.length > 0 ? Math.round((assignedSlots.size / shifts.reduce((acc, shift) => acc + shift.slots.length, 0)) * 100) : 0
    };
  };

  const stats = getStaffStats();

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

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root', 'manager']}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">スケジュールを読み込み中...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root', 'manager']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <Link 
                href="/manager" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">スケジュール確認</h1>
                <p className="text-gray-600">
                  スタッフのスケジュールを確認・管理
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">アクティブスタッフ</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalStaff}名</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">アサイン済みスロット</p>
                  <p className="text-2xl font-bold text-green-600">{stats.assignedSlots}件</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">総労働時間</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.totalHours}h</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">カバー率</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.coverage}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="シフト名または説明で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'published' | 'draft' | 'completed')}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全てのステータス</option>
                  <option value="published">確定済み</option>
                  <option value="draft">下書き</option>
                  <option value="completed">完了</option>
                </select>
                <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">
                  <Download className="h-4 w-4" />
                  <span>CSV出力</span>
                </button>
              </div>
            </div>
          </div>

          {/* Weekly Calendar Navigation */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => changeWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <h2 className="text-lg font-semibold text-gray-900">
                {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(addDays(weekStart, 6), 'M月d日', { locale: ja })}
              </h2>
              
              <button
                onClick={() => changeWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>
            
            <button
              onClick={goToThisWeek}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              今週
            </button>
          </div>

          {/* Weekly Schedule View */}
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
                const dayShifts = getShiftsForDate(date);
                const isToday = isSameDay(date, new Date());
                const isPast = date < new Date();

                return (
                  <div
                    key={date.toISOString()}
                    className={`p-2 border-r border-gray-200 ${
                      isToday ? 'bg-blue-50' : isPast ? 'bg-gray-50' : ''
                    } ${index === 6 ? 'border-r-0' : ''}`}
                  >
                    <div className="space-y-1">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.shiftId}
                          className={`p-2 rounded text-xs border ${getStatusColor(shift.status)}`}
                        >
                          <div className="font-medium truncate">{shift.title}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`px-1 py-0.5 rounded text-xs font-medium ${getStatusColor(shift.status)}`}>
                              {getStatusText(shift.status)}
                            </span>
                            <div className="text-gray-500">
                              {shift.slots.length}スロット
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {dayShifts.length === 0 && !isPast && (
                        <div className="text-center text-gray-400 py-4">
                          <div className="text-xs">シフトなし</div>
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
          {!loading && filteredShifts.length === 0 && !error && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">シフトが見つかりません</p>
              <p className="text-gray-400 mt-2">
                条件を変更するか、新しいシフトを作成してください
              </p>
              <Link
                href="/manager/shifts"
                className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                シフトを作成
              </Link>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}