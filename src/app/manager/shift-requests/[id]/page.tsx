'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Save
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MonthlyShiftRequest, DayShiftRequest } from '@/types';
import { shiftRequestService } from '@/lib/shiftRequestService';
import Link from 'next/link';

export default function ShiftRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const requestId = params.id as string;

  const [shiftRequest, setShiftRequest] = useState<MonthlyShiftRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  useEffect(() => {
    if (!currentUser || !requestId) return;

    // Get all manager requests and find the specific one
    const unsubscribe = shiftRequestService.subscribeToManagerMonthlyRequests(
      currentUser.uid,
      (requests) => {
        const request = requests.find(r => r.monthlyRequestId === requestId);
        setShiftRequest(request || null);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, requestId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <AlertCircle className="h-5 w-5" />;
      case 'approved':
        return <CheckCircle className="h-5 w-5" />;
      case 'rejected':
        return <XCircle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'submitted':
        return '提出済み';
      case 'approved':
        return '承認済み';
      case 'rejected':
        return '却下済み';
      default:
        return '下書き';
    }
  };

  const getPreferenceColor = (preference: string) => {
    switch (preference) {
      case 'preferred':
        return 'bg-blue-100 text-blue-800';
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'unavailable':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        return '';
    }
  };

  const handleReviewAction = (action: 'approve' | 'reject') => {
    setReviewAction(action);
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!currentUser || !shiftRequest) return;

    setActionLoading(true);
    try {
      if (reviewAction === 'approve') {
        await shiftRequestService.approveMonthlyShiftRequest(
          shiftRequest.monthlyRequestId,
          currentUser,
          reviewNotes
        );
      } else {
        await shiftRequestService.rejectMonthlyShiftRequest(
          shiftRequest.monthlyRequestId,
          currentUser,
          reviewNotes
        );
      }
      setShowReviewModal(false);
      setReviewNotes('');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('処理に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const renderCalendar = () => {
    if (!shiftRequest?.targetMonth) return null;

    const [year, month] = shiftRequest.targetMonth.split('-').map(Number);
    const currentMonth = new Date(year, month - 1, 1);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { locale: ja, weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { locale: ja, weekStartsOn: 1 });

    const weeks = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate = addDays(currentDate, 1);
      }
      weeks.push(week);
    }

    const getDayRequest = (date: Date): DayShiftRequest | undefined => {
      return shiftRequest.dayRequests?.find(req => {
        const reqDate = new Date(req.date);
        return reqDate.toDateString() === date.toDateString();
      });
    };

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 bg-gray-50">
          {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-medium border-r border-gray-200 last:border-r-0 ${
                index === 5 ? 'text-blue-700' : index === 6 ? 'text-red-700' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="bg-white">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-gray-200 last:border-b-0">
              {week.map((date, dayIndex) => {
                const dayRequest = getDayRequest(date);
                const isCurrentMonthDate = date.getMonth() === currentMonth.getMonth();
                const dayOfWeek = date.getDay();
                const isSaturday = dayOfWeek === 6;
                const isSunday = dayOfWeek === 0;

                const getBackgroundColor = () => {
                  if (!isCurrentMonthDate) return 'bg-gray-50';
                  if (isSaturday) return 'bg-blue-50';
                  if (isSunday) return 'bg-red-50';
                  return 'bg-white';
                };

                return (
                  <div
                    key={dayIndex}
                    className={`p-2 border-r border-gray-200 last:border-r-0 min-h-[100px] ${getBackgroundColor()}`}
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
                        {dayRequest.positions && dayRequest.positions.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {dayRequest.positions.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <AppHeader title="シフト希望詳細" />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!shiftRequest) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <AppHeader title="シフト希望詳細" />
        <DashboardLayout>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              シフト希望が見つかりません
            </h3>
            <p className="text-gray-600 mb-4">
              指定されたシフト希望は存在しないか、アクセス権限がありません。
            </p>
            <Link
              href="/manager/shift-requests"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>一覧に戻る</span>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <AppHeader title="シフト希望詳細" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Back Button */}
          <div>
            <Link
              href="/manager/shift-requests"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>一覧に戻る</span>
            </Link>
          </div>

          {/* Request Header */}
          <div className="bg-white rounded-lg p-6 border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {shiftRequest.title}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>スタッフ: {shiftRequest.staffId}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>対象月: {shiftRequest.targetMonth}</span>
                  </div>
                  {shiftRequest.submittedAt && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>提出: {format(shiftRequest.submittedAt, 'yyyy/MM/dd HH:mm', { locale: ja })}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium border ${getStatusColor(shiftRequest.status)}`}>
                  {getStatusIcon(shiftRequest.status)}
                  <span>{getStatusText(shiftRequest.status)}</span>
                </span>
              </div>
            </div>

            {shiftRequest.overallNote && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">全体的な備考</h3>
                <p className="text-sm text-gray-700">{shiftRequest.overallNote}</p>
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-lg p-6 border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              シフト希望カレンダー
            </h2>
            {renderCalendar()}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {shiftRequest.dayRequests?.filter(req => req.preference === 'preferred').length || 0}
                </div>
                <div className="text-sm text-gray-600">希望日数</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {shiftRequest.dayRequests?.filter(req => req.preference === 'available').length || 0}
                </div>
                <div className="text-sm text-gray-600">可能日数</div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {shiftRequest.dayRequests?.filter(req => req.preference === 'unavailable').length || 0}
                </div>
                <div className="text-sm text-gray-600">不可日数</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {shiftRequest.status === 'submitted' && (
            <div className="bg-white rounded-lg p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">承認・却下</h3>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleReviewAction('approve')}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>承認する</span>
                </button>
                <button
                  onClick={() => handleReviewAction('reject')}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                >
                  <XCircle className="h-5 w-5" />
                  <span>却下する</span>
                </button>
              </div>
            </div>
          )}

          {/* Review History */}
          {(shiftRequest.status === 'approved' || shiftRequest.status === 'rejected') && (
            <div className="bg-white rounded-lg p-6 border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">審査履歴</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  {getStatusIcon(shiftRequest.status)}
                  <span className="font-medium">
                    {shiftRequest.status === 'approved' ? '承認されました' : '却下されました'}
                  </span>
                  {shiftRequest.reviewedAt && (
                    <span className="text-sm text-gray-600">
                      ({format(shiftRequest.reviewedAt, 'yyyy/MM/dd HH:mm', { locale: ja })})
                    </span>
                  )}
                </div>
                {shiftRequest.reviewNotes && (
                  <p className="text-sm text-gray-700">{shiftRequest.reviewNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {reviewAction === 'approve' ? 'シフト希望を承認' : 'シフト希望を却下'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {reviewAction === 'approve' ? '承認コメント（任意）' : '却下理由'}
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder={reviewAction === 'approve'
                      ? 'コメントがあれば入力してください'
                      : '却下の理由を入力してください'}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={reviewAction === 'reject'}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setReviewNotes('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={submitReview}
                  disabled={actionLoading || (reviewAction === 'reject' && !reviewNotes.trim())}
                  className={`px-4 py-2 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    reviewAction === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>処理中...</span>
                    </>
                  ) : (
                    <>
                      {reviewAction === 'approve' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      <span>{reviewAction === 'approve' ? '承認する' : '却下する'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}