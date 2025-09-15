'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
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
  Lightbulb
} from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';

interface TimeSlot {
  start: string;
  end: string;
}

interface ShiftRequest {
  date: Date;
  timeSlots: TimeSlot[];
  preference: 'preferred' | 'available' | 'unavailable';
  note: string;
  positions?: string[];
}

export default function NewShiftRequestPage() {
  const { currentUser } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<ShiftRequest>({
    date: addDays(new Date(), 7),
    timeSlots: [{ start: '09:00', end: '17:00' }],
    preference: 'preferred',
    note: '',
    positions: []
  });
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      { date: addDays(currentRequest.date, 1), time: '10:00-16:00', score: 0.72 }
    ]
  };

  // 週の日付を生成
  const weekStart = addWeeks(startOfWeek(new Date()), selectedWeek + 1);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const addTimeSlot = () => {
    setCurrentRequest(prev => ({
      ...prev,
      timeSlots: [...prev.timeSlots, { start: '09:00', end: '17:00' }]
    }));
  };

  const removeTimeSlot = (index: number) => {
    setCurrentRequest(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
    setCurrentRequest(prev => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const addRequest = () => {
    if (currentRequest.timeSlots.length === 0) return;
    
    setRequests(prev => [...prev, { ...currentRequest }]);
    setCurrentRequest({
      date: addDays(currentRequest.date, 1),
      timeSlots: [{ start: '09:00', end: '17:00' }],
      preference: 'preferred',
      note: '',
      positions: []
    });
  };

  const removeRequest = (index: number) => {
    setRequests(prev => prev.filter((_, i) => i !== index));
  };

  const submitRequests = async () => {
    if (requests.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      // ここで実際のAPI呼び出しを行う
      // await shiftService.submitShiftRequests(requests, currentUser);
      
      // サンプル実装：3秒待機してから成功メッセージ
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      alert('シフト希望を正常に提出しました！');
      setRequests([]);
      
    } catch (error) {
      alert('エラーが発生しました。再度お試しください。');
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

  return (
    <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a 
                href="/staff/requests" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">新しいシフト希望提出</h1>
                <p className="text-gray-600">希望するシフトを複数日分まとめて提出できます</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <Brain className="h-5 w-5" />
                <span>AI推奨</span>
              </button>
            </div>
          </div>

          {/* AI Recommendations */}
          {showAIRecommendations && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
              <div className="flex items-center space-x-3 mb-4">
                <Brain className="h-6 w-6 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">AI推奨シフト</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Clock className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-gray-900">推奨時間帯</h3>
                  </div>
                  {aiRecommendations.bestTimes.map((time, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{time.start}-{time.end}</span>
                        <span className="text-xs text-green-600 font-medium">
                          {Math.round(time.score * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{time.reason}</p>
                    </div>
                  ))}
                </div>

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
                        style={{ width: `${(1 - aiRecommendations.approvalProbability) * 100}%` }}
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

              {aiRecommendations.alternativeSlots.length > 0 && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">代替案</span>
                  </div>
                  {aiRecommendations.alternativeSlots.map((slot, index) => (
                    <div key={index} className="text-sm text-yellow-700">
                      {format(slot.date, 'MM/dd (E)', { locale: ja })} {slot.time} - 
                      推奨度 {Math.round(slot.score * 100)}%
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current Request Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">シフト希望入力</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  希望日
                </label>
                <input
                  type="date"
                  value={format(currentRequest.date, 'yyyy-MM-dd')}
                  onChange={(e) => setCurrentRequest(prev => ({
                    ...prev,
                    date: new Date(e.target.value)
                  }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  希望レベル
                </label>
                <select
                  value={currentRequest.preference}
                  onChange={(e) => setCurrentRequest(prev => ({
                    ...prev,
                    preference: e.target.value as any
                  }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="preferred">希望 - 是非この時間で働きたい</option>
                  <option value="available">可能 - 必要であれば勤務可能</option>
                  <option value="unavailable">不可 - この時間は勤務不可</option>
                </select>
              </div>
            </div>

            {/* Time Slots */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                希望時間帯
              </label>
              <div className="space-y-3">
                {currentRequest.timeSlots.map((slot, index) => (
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
                    {currentRequest.timeSlots.length > 1 && (
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
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                希望ポジション（任意）
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availablePositions.map((position) => (
                  <label key={position} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={currentRequest.positions?.includes(position)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCurrentRequest(prev => ({
                            ...prev,
                            positions: [...(prev.positions || []), position]
                          }));
                        } else {
                          setCurrentRequest(prev => ({
                            ...prev,
                            positions: prev.positions?.filter(p => p !== position) || []
                          }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{position}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                備考・理由（任意）
              </label>
              <textarea
                value={currentRequest.note}
                onChange={(e) => setCurrentRequest(prev => ({
                  ...prev,
                  note: e.target.value
                }))}
                placeholder="特別な要望や理由があれば記入してください"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={addRequest}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>リストに追加</span>
              </button>
            </div>
          </div>

          {/* Requests List */}
          {requests.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                提出予定のシフト希望（{requests.length}件）
              </h2>
              <div className="space-y-3">
                {requests.map((request, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-900">
                          {format(request.date, 'MM/dd', { locale: ja })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(request.date, '(E)', { locale: ja })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {request.timeSlots.map(slot => `${slot.start}-${slot.end}`).join(', ')}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPreferenceColor(request.preference)}`}>
                            {getPreferenceText(request.preference)}
                          </span>
                          {request.positions && request.positions.length > 0 && (
                            <span className="text-xs text-gray-600">
                              {request.positions.join(', ')}
                            </span>
                          )}
                        </div>
                        {request.note && (
                          <p className="text-xs text-gray-600 mt-1">{request.note}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeRequest(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setRequests([])}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  クリア
                </button>
                <button
                  onClick={submitRequests}
                  disabled={isSubmitting}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}

          {/* Help Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">提出について</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• シフト希望は複数日分まとめて提出できます</li>
                  <li>• 提出後の変更は管理者の承認が必要になります</li>
                  <li>• AI推奨機能を参考に最適な時間帯を選択してください</li>
                  <li>• 締切日を過ぎた提出は自動的に低優先度になります</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}