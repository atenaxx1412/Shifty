'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Brain,
  Users,
  Save,
  Send,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, isSameDay, startOfMonth, endOfMonth, getDaysInMonth, addMonths, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MonthlyShiftRequest, DayShiftRequest } from '@/types';
import { shiftRequestService } from '@/lib/shiftRequestService';

interface CalendarCell {
  date: Date;
  dayRequests: DayShiftRequest[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export default function NewShiftRequestPage() {
  // Fixed: Date format issue
  const { currentUser } = useAuth();

  // 来月を初期表示
  const [currentMonth, setCurrentMonth] = useState(addMonths(new Date(), 1));
  const [monthlyRequest, setMonthlyRequest] = useState<Partial<MonthlyShiftRequest>>({
    title: '',
    dayRequests: [],
    overallNote: '',
    status: 'draft'
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [currentDayRequest, setCurrentDayRequest] = useState<DayShiftRequest>({
    date: new Date(),
    timeSlots: [{ start: '09:00', end: '17:00' }],
    preference: 'preferred',
    note: '',
    positions: []
  });
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittedSuccessfully, setIsSubmittedSuccessfully] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 利用可能なポジション
  const availablePositions = [
    'ホール',
    'キッチン',
    'レジ',
    'クリーンスタッフ',
    '品出し',
    '接客',
  ];

  // AI推奨データのサンプル
  const aiRecommendations = {
    bestTimes: [
      { start: '09:00', end: '15:00', reason: '過去の勤務実績が良好', score: 0.9 },
      { start: '13:00', end: '19:00', reason: 'スタッフ需要が高い時間帯', score: 0.85 },
    ],
    conflictingRequests: 2,
    approvalProbability: 0.78,
    alternativeSlots: [
      { date: addDays(new Date(), 1), time: '10:00-16:00', score: 0.72 }
    ]
  };

  // カレンダー表示用の関数
  const getCalendarWeeks = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale: ja, weekStartsOn: 1 }); // 月曜日始まり
    const endDate = endOfWeek(monthEnd, { locale: ja, weekStartsOn: 1 });

    const weeks: Date[][] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  };

  // 指定日の既存リクエストを取得
  const getDayRequest = (date: Date): DayShiftRequest | undefined => {
    return monthlyRequest.dayRequests?.find(req =>
      isSameDay(req.date, date)
    );
  };

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => addMonths(prev, direction === 'next' ? 1 : -1));
  };

  // 日付クリック時の処理
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const existingRequest = getDayRequest(date);
    if (existingRequest) {
      setCurrentDayRequest(existingRequest);
    } else {
      setCurrentDayRequest({
        date,
        timeSlots: [{ start: '09:00', end: '17:00' }],
        preference: 'preferred',
        note: '',
        positions: []
      });
    }
    setShowDayModal(true);
  };

  const addTimeSlot = () => {
    setCurrentDayRequest(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { start: '09:00', end: '17:00' }]
    }));
  };

  const removeTimeSlot = (index: number) => {
    setCurrentDayRequest(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    setCurrentDayRequest(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  // 日の希望を保存
  const saveDayRequest = () => {
    if (currentDayRequest.timeSlots.length === 0) return;

    setMonthlyRequest(prev => {
      const newDayRequests = [...(prev.dayRequests || [])];
      const existingIndex = newDayRequests.findIndex(req =>
        isSameDay(req.date, currentDayRequest.date)
      );

      if (existingIndex >= 0) {
        newDayRequests[existingIndex] = currentDayRequest;
      } else {
        newDayRequests.push(currentDayRequest);
      }

      return {
        ...prev,
        dayRequests: newDayRequests
      };
    });

    setShowDayModal(false);
  };

  // 日の希望を削除
  const removeDayRequest = (date: Date) => {
    setMonthlyRequest(prev => ({
      ...prev,
      dayRequests: prev.dayRequests?.filter(req => !isSameDay(req.date, date)) || []
    }));
  };

  // 下書き保存
  const saveDraft = async () => {
    if (!currentUser) {
      console.error('❌ SaveDraft: No currentUser available');
      return;
    }

    console.log('💾 SaveDraft: Starting draft save process:', {
      userId: currentUser.uid,
      userName: currentUser.name,
      managerId: currentUser.managerId,
      targetMonth: format(currentMonth, 'yyyy-MM'),
      dayRequestsCount: monthlyRequest.dayRequests?.length || 0
    });

    setIsSaving(true);
    try {
      const requestData = {
        ...monthlyRequest,
        managerId: currentUser.managerId || '',
        targetMonth: format(currentMonth, 'yyyy-MM'),
        title: monthlyRequest.title || `${format(currentMonth, 'yyyy年M月')}のシフト希望`
      };

      console.log('📝 SaveDraft: Request data prepared:', {
        ...requestData,
        dayRequests: requestData.dayRequests?.map(req => ({
          date: req.date,
          preference: req.preference,
          timeSlots: req.timeSlots
        }))
      });

      const result = await shiftRequestService.createMonthlyShiftRequest(requestData, currentUser);
      console.log('✅ SaveDraft: Draft saved successfully:', {
        requestId: result.monthlyRequestId,
        status: result.status
      });
      alert('下書きを保存しました');
    } catch (error) {
      console.error('❌ SaveDraft: Draft save failed:', {
        error: error.message,
        errorCode: error.code,
        userId: currentUser.uid,
        managerId: currentUser.managerId,
        targetMonth: format(currentMonth, 'yyyy-MM'),
        fullError: error
      });
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 提出
  const submitRequest = async () => {
    if (!currentUser || !monthlyRequest.dayRequests?.length) {
      console.error('❌ SubmitRequest: Validation failed:', {
        hasCurrentUser: !!currentUser,
        dayRequestsCount: monthlyRequest.dayRequests?.length || 0
      });
      return;
    }

    console.log('📤 SubmitRequest: Starting shift request submission:', {
      userId: currentUser.uid,
      userName: currentUser.name,
      managerId: currentUser.managerId,
      targetMonth: format(currentMonth, 'yyyy-MM'),
      dayRequestsCount: monthlyRequest.dayRequests.length,
      title: monthlyRequest.title || `${format(currentMonth, 'yyyy年M月')}のシフト希望`
    });

    setIsSubmitting(true);
    try {
      const requestData = {
        ...monthlyRequest,
        managerId: currentUser.managerId || '',
        targetMonth: format(currentMonth, 'yyyy-MM'),
        title: monthlyRequest.title || `${format(currentMonth, 'yyyy年M月')}のシフト希望`,
        status: 'submitted' as const
      };

      console.log('📋 SubmitRequest: Request data prepared:', {
        ...requestData,
        dayRequests: requestData.dayRequests?.map((req, index) => ({
          index,
          date: req.date,
          preference: req.preference,
          timeSlots: req.timeSlots,
          positions: req.positions
        }))
      });

      console.log('🔄 SubmitRequest: Step 1 - Creating monthly shift request...');
      const result = await shiftRequestService.createMonthlyShiftRequest(requestData, currentUser);

      console.log('✅ SubmitRequest: Step 1 Complete - Request created:', {
        requestId: result.monthlyRequestId,
        status: result.status,
        createdAt: result.createdAt
      });

      console.log('🔄 SubmitRequest: Step 2 - Submitting request...');
      await shiftRequestService.submitMonthlyShiftRequest(result.monthlyRequestId, currentUser);

      console.log('✅ SubmitRequest: Step 2 Complete - Request submitted successfully');

      console.log('🎉 SubmitRequest: Full submission process completed successfully:', {
        finalRequestId: result.monthlyRequestId,
        staffId: currentUser.uid,
        managerId: currentUser.managerId,
        targetMonth: format(currentMonth, 'yyyy-MM'),
        totalDays: requestData.dayRequests.length
      });

      // 成功状態の設定
      setIsSubmittedSuccessfully(true);
      setShowSuccessModal(true);
      setMonthlyRequest({ title: '', dayRequests: [], overallNote: '', status: 'draft' });
    } catch (error) {
      console.error('❌ SubmitRequest: Submission failed:', {
        error: error.message,
        errorCode: error.code,
        userId: currentUser.uid,
        managerId: currentUser.managerId,
        targetMonth: format(currentMonth, 'yyyy-MM'),
        dayRequestsCount: monthlyRequest.dayRequests?.length,
        fullError: error
      });
      alert('提出に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPreferenceColor = (preference: string) => {
    switch (preference) {
      case 'preferred':
        return 'bg-blue-500 text-white';
      case 'available':
        return 'bg-green-500 text-white';
      case 'unavailable':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getPreferenceText = (preference: string) => {
    switch (preference) {
      case 'preferred':
        return '希望';
      case 'available':
        return '可能';
      case 'unavailable':
        return '不可';
      default:
        return preference;
    }
  };

  const isCurrentMonthDate = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
  };

  return (
    <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
      <AppHeader title="新規シフト希望" />
      <DashboardLayout>
        <div className="space-y-6">

          {/* Success Banner */}
          {isSubmittedSuccessfully && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-green-900">
                    シフト希望の提出が完了しました！
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    管理者が確認後、結果をお知らせします。新しい希望を作成する場合は、下記フォームをご利用ください。
                  </p>
                </div>
                <button
                  onClick={() => setIsSubmittedSuccessfully(false)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {showAIRecommendations && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Users className="h-5 w-5 text-yellow-600" />
                    <h3 className="font-medium text-gray-900">競合状況</h3>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600 mb-1">
                    {aiRecommendations.conflictingRequests}件
                  </p>
                  <p className="text-sm text-gray-600">同じ時間帯の希望</p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${Math.max(0, (1 - aiRecommendations.approvalProbability) * 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">競合レベル</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">承認確率</h3>
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mb-1">
                    {Math.round(aiRecommendations.approvalProbability * 100)}%
                  </p>
                  <p className="text-sm text-gray-600">過去の実績に基づく</p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${aiRecommendations.approvalProbability * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
          )}
            </div>

            {aiRecommendations.alternativeSlots.length > 0 && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">代替案</span>
                </div>
                {aiRecommendations.alternativeSlots.map((slot, index) => (
                  <div key={index} className="text-sm text-yellow-700">
                    {`${format(slot.date, 'MM月dd日 (E)', { locale: ja })} ${slot.time} - 推奨度 ${Math.round(slot.score * 100)}%`}
                  </div>
                ))}
              </div>
            )}

          {/* Month Selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}のシフト希望
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => changeMonth('prev')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => changeMonth('next')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Request Title */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                シフト希望タイトル
              </label>
              <input
                type="text"
                value={monthlyRequest.title || ''}
                onChange={(e) => setMonthlyRequest(prev => ({ ...prev, title: e.target.value }))}
                placeholder={`${format(currentMonth, 'yyyy年M月')}のシフト希望`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Calendar Grid */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 bg-gray-50">
                {['月', '火', '水', '木', '金', '土', '日'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="bg-white">
                {getCalendarWeeks().map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
                    {week.map((date, dayIndex) => {
                      const dayRequest = getDayRequest(date);
                      const isCurrentMonthDate = date.getMonth() === currentMonth.getMonth();
                      const dayOfWeek = date.getDay();
                      const isSaturday = dayOfWeek === 6;
                      const isSunday = dayOfWeek === 0;

                      const getBackgroundColor = () => {
                        if (!isCurrentMonthDate) return 'bg-gray-50 text-gray-400';
                        if (isSaturday) return 'bg-blue-50 hover:bg-blue-100 cursor-pointer';
                        if (isSunday) return 'bg-red-50 hover:bg-red-100 cursor-pointer';
                        return 'bg-white hover:bg-blue-50 cursor-pointer';
                      };

                      return (
                        <div
                          key={dayIndex}
                          className={`p-2 border-r border-gray-200 last:border-r-0 min-h-[80px] ${getBackgroundColor()}`}
                          onClick={() => isCurrentMonthDate && handleDateClick(date)}
                        >
                          <div className={`text-sm font-medium mb-1 ${
                            isSaturday ? 'text-blue-700' :
                            isSunday ? 'text-red-700' :
                            isCurrentMonthDate ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {format(date, 'd')}
                          </div>
                          {dayRequest && (
                            <div className="space-y-1">
                              <div className={`text-xs px-1 py-0.5 rounded ${getPreferenceColor(dayRequest.preference)}`}>
                                {getPreferenceText(dayRequest.preference)}
                              </div>
                              {dayRequest.timeSlots.map((slot, slotIndex) => (
                                <div key={slotIndex} className="text-xs text-gray-600">
                                  {slot.start}-{slot.end}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Note */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                全体的な備考（任意）
              </label>
              <textarea
                value={monthlyRequest.overallNote || ''}
                onChange={(e) => setMonthlyRequest(prev => ({ ...prev, overallNote: e.target.value }))}
                placeholder="月全体を通しての要望や備考があれば記入してください"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Summary */}
            {monthlyRequest.dayRequests && monthlyRequest.dayRequests.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  入力済み希望日数: {monthlyRequest.dayRequests.length}日
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">希望:</span>
                    <span className="ml-1 font-medium">
                      {monthlyRequest.dayRequests.filter(req => req.preference === 'preferred').length}日
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700">可能:</span>
                    <span className="ml-1 font-medium">
                      {monthlyRequest.dayRequests.filter(req => req.preference === 'available').length}日
                    </span>
                  </div>
                  <div>
                    <span className="text-red-700">不可:</span>
                    <span className="ml-1 font-medium">
                      {monthlyRequest.dayRequests.filter(req => req.preference === 'unavailable').length}日
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={saveDraft}
                disabled={isSaving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent"></div>
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    <span>下書き保存</span>
                  </>
                )}
              </button>
              <button
                onClick={submitRequest}
                disabled={isSubmitting || !monthlyRequest.dayRequests?.length}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>提出中...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>提出する</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Help Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">提出について</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• カレンダーの日付をクリックしてシフト希望を入力できます</li>
                  <li>• 希望・可能・不可のいずれも時間帯を指定できます</li>
                  <li>• 月全体のシフト希望をまとめて提出できます</li>
                  <li>• 提出後の変更は管理者の承認が必要になります</li>
                  <li>• AI推奨機能を参考に最適な時間帯を選択してください</li>
                </ul>
              </div>
            </div>
          </div>

        {/* Day Selection Modal */}
        {showDayModal && selectedDate && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-2xl rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(selectedDate, 'M月d日(E)', { locale: ja })}のシフト希望
                </h3>
                <button
                  onClick={() => setShowDayModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    希望レベル
                  </label>
                  <select
                    value={currentDayRequest.preference}
                    onChange={(e) => setCurrentDayRequest(prev => ({
                      ...prev,
                      preference: e.target.value as any
                    }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="preferred">希望 - 是非この時間帯で働きたい</option>
                    <option value="available">可能 - 必要であればこの時間帯で勤務可能</option>
                    <option value="unavailable">不可 - この時間帯は勤務不可</option>
                  </select>
                </div>

                {/* Time Slots */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    対象時間帯
                  </label>
                  <div className="space-y-3">
                    {currentDayRequest.timeSlots.map((slot, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateTimeSlot(index, 'start', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-500">〜</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => updateTimeSlot(index, 'end', e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {currentDayRequest.timeSlots.length > 1 && (
                          <button
                            onClick={() => removeTimeSlot(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addTimeSlot}
                      className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>時間帯を追加</span>
                    </button>
                  </div>
                </div>

                {/* Positions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    希望ポジション（任意）
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availablePositions.map((position) => (
                      <label key={position} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={currentDayRequest.positions?.includes(position)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCurrentDayRequest(prev => ({
                                ...prev,
                                positions: [...(prev.positions || []), position]
                              }));
                            } else {
                              setCurrentDayRequest(prev => ({
                                ...prev,
                                positions: prev.positions?.filter(p => p !== position) || []
                              }));
                            }
                          }}
                          className="h-4 w-4 appearance-none rounded border-2 border-gray-300 bg-white checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 checked:before:content-['✓'] checked:before:text-white checked:before:text-xs checked:before:flex checked:before:justify-center checked:before:items-center checked:before:h-full"
                        />
                        <span className="text-sm text-gray-700">{position}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    備考・理由（任意）
                  </label>
                  <textarea
                    value={currentDayRequest.note}
                    onChange={(e) => setCurrentDayRequest(prev => ({
                      ...prev,
                      note: e.target.value
                    }))}
                    placeholder="特別な要望や理由があれば記入してください"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => {
                    if (selectedDate) {
                      removeDayRequest(selectedDate);
                      setShowDayModal(false);
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  削除
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDayModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveDayRequest}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white/90 backdrop-blur-sm border border-white/20 shadow-2xl rounded-2xl p-6 w-full max-w-md">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  提出完了！
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  シフト希望の提出が完了しました。
                </p>
                <p className="text-sm text-gray-600 mb-6">
                  管理者が確認後、結果をお知らせします。
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <Send className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      提出先: 管理者へ送信済み
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    通常1-2営業日以内に返答があります
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setIsSubmittedSuccessfully(false);
                  }}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}