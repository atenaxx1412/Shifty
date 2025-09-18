'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Search,
  MessageSquare,
  Eye,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MonthlyShiftRequest, MonthlyShiftRequestWithStaff } from '@/types';
import { shiftRequestService } from '@/lib/shiftRequestService';


// サンプルスタッフデータ（実際は認証システムから取得）
const sampleStaffData: Record<string, { name: string; email: string }> = {
  'staff1': { name: '山田太郎', email: 'yamada@shifty.com' },
  'staff2': { name: '佐藤花子', email: 'sato@shifty.com' },
  'staff3': { name: '田中次郎', email: 'tanaka@shifty.com' },
  'staff4': { name: '鈴木美咲', email: 'suzuki@shifty.com' },
};

export default function ManagerShiftReceivePage() {
  const { currentUser } = useAuth();
  const [monthlyRequests, setMonthlyRequests] = useState<MonthlyShiftRequestWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | MonthlyShiftRequest['status']>('all');
  const [selectedRequest, setSelectedRequest] = useState<MonthlyShiftRequestWithStaff | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // データ取得
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribe = shiftRequestService.subscribeToManagerMonthlyRequests(
      currentUser.uid,
      (requests) => {
        const requestsWithStaffInfo = requests.map(request => ({
          ...request,
          staffName: sampleStaffData[request.staffId]?.name || `スタッフ${request.staffId}`,
          staffEmail: sampleStaffData[request.staffId]?.email
        }));
        setMonthlyRequests(requestsWithStaffInfo);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // フィルタリングされた申請
  const filteredRequests = monthlyRequests.filter(request => {
    const matchesSearch = request.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.overallNote?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // 月間シフト希望の統計を計算
  const getRequestStats = (request: MonthlyShiftRequestWithStaff) => {
    const totalDays = request.dayRequests.length;
    const preferredDays = request.dayRequests.filter(day => day.preference === 'preferred').length;
    const availableDays = request.dayRequests.filter(day => day.preference === 'available').length;
    const unavailableDays = request.dayRequests.filter(day => day.preference === 'unavailable').length;

    return { totalDays, preferredDays, availableDays, unavailableDays };
  };

  // ステータスの色とラベル
  const getStatusColor = (status: MonthlyShiftRequest['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_approved':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-purple-100 text-purple-800 border-purple-200';
    }
  };

  const getStatusLabel = (status: MonthlyShiftRequest['status']) => {
    switch (status) {
      case 'draft': return '下書き';
      case 'submitted': return '提出済み';
      case 'under_review': return '確認中';
      case 'approved': return '承認済み';
      case 'partially_approved': return '一部承認';
      case 'rejected': return '却下';
      default: return status;
    }
  };

  // 希望レベルの表示
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
      case 'preferred': return '希望';
      case 'available': return '可能';
      case 'unavailable': return '不可';
      default: return preference;
    }
  };

  // 月間シフト希望承認
  const handleApprove = async (monthlyRequestId: string) => {
    if (!currentUser) return;

    try {
      await shiftRequestService.approveMonthlyShiftRequest(
        monthlyRequestId,
        currentUser
      );
    } catch (error) {
      console.error('承認エラー:', error);
      alert('承認に失敗しました');
    }
  };

  // 月間シフト希望却下
  const handleReject = async (monthlyRequestId: string, reason: string) => {
    if (!currentUser) return;

    try {
      await shiftRequestService.rejectMonthlyShiftRequest(
        monthlyRequestId,
        currentUser,
        reason
      );
    } catch (error) {
      console.error('却下エラー:', error);
      alert('却下に失敗しました');
    }
  };

  // 詳細表示
  const handleViewDetail = (request: MonthlyShiftRequestWithStaff) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // 統計
  const getStats = () => {
    const submitted = monthlyRequests.filter(r => r.status === 'submitted').length;
    const underReview = monthlyRequests.filter(r => r.status === 'under_review').length;
    const approved = monthlyRequests.filter(r => r.status === 'approved').length;
    const rejected = monthlyRequests.filter(r => r.status === 'rejected').length;

    return { submitted, underReview, approved, rejected };
  };

  const stats = getStats();

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="シフト受け取り" />
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">提出済み</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.submitted}件</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">確認中</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.underReview}件</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">承認済み</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}件</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">却下</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}件</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="スタッフ名またはタイトルで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | MonthlyShiftRequest['status'])}
                className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全てのステータス</option>
                <option value="submitted">提出済み</option>
                <option value="under_review">確認中</option>
                <option value="approved">承認済み</option>
                <option value="partially_approved">一部承認</option>
                <option value="rejected">却下</option>
              </select>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                  }}
                  className="px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  フィルターをクリア
                </button>
              </div>
            </div>
          </div>

          {/* Monthly Shift Requests List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900">
                月間シフト希望一覧 ({filteredRequests.length}件)
              </h3>
            </div>
            <div className="divide-y divide-blue-200">
              {filteredRequests.map((request) => {
                const stats = getRequestStats(request);
                return (
                  <div key={request.monthlyRequestId} className="p-6 hover:bg-blue-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-2">
                            <User className="h-5 w-5 text-blue-400" />
                            <span className="font-medium text-blue-900">{request.staffName}</span>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                            {getStatusLabel(request.status)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            月間シフト希望
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-lg font-medium text-blue-900">{request.title}</h4>

                          <div className="flex items-center space-x-4 text-sm text-blue-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>対象月: {request.targetMonth}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>提出日: {format(request.submittedAt || request.createdAt, 'M月d日', { locale: ja })}</span>
                            </div>
                          </div>

                          {/* 統計情報 */}
                          <div className="flex items-center space-x-4 mt-3">
                            <div className="text-sm">
                              <span className="text-blue-600">総日数: </span>
                              <span className="font-medium">{stats.totalDays}日</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded text-xs ${getPreferenceColor('preferred')}`}>
                                希望 {stats.preferredDays}日
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${getPreferenceColor('available')}`}>
                                可能 {stats.availableDays}日
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${getPreferenceColor('unavailable')}`}>
                                不可 {stats.unavailableDays}日
                              </span>
                            </div>
                          </div>

                          {request.overallNote && (
                            <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
                              <span className="font-medium">備考: </span>
                              {request.overallNote}
                            </div>
                          )}

                          <div className="text-xs text-blue-400">
                            作成日: {format(request.createdAt, 'yyyy年M月d日 HH:mm', { locale: ja })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleViewDetail(request)}
                          className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          <span>詳細</span>
                        </button>

                        {(request.status === 'submitted' || request.status === 'under_review') && (
                          <>
                            <button
                              onClick={() => handleReject(request.monthlyRequestId, '要件を満たしていません')}
                              className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                            >
                              <XCircle className="h-4 w-4" />
                              <span>却下</span>
                            </button>
                            <button
                              onClick={() => handleApprove(request.monthlyRequestId)}
                              className="flex items-center space-x-1 px-3 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                              <CheckCircle className="h-4 w-4" />
                              <span>承認</span>
                            </button>
                          </>
                        )}

                        <button className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty State */}
          {filteredRequests.length === 0 && !loading && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <p className="text-blue-500 text-lg">
                {searchTerm || filterStatus !== 'all'
                  ? 'シフト希望が見つかりません'
                  : 'まだシフト希望の提出がありません'
                }
              </p>
              <p className="text-blue-400 mt-2">
                {searchTerm || filterStatus !== 'all'
                  ? '検索条件を変更してください'
                  : 'スタッフからのシフト希望提出をお待ちください'
                }
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-blue-500 text-lg">読み込み中...</p>
            </div>
          )}
          </div>

          {/* Detail Modal */}
          {showDetailModal && selectedRequest && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-blue-900">
                    {selectedRequest.staffName}さんの月間シフト希望詳細
                  </h3>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-blue-500 hover:text-blue-700">
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Request Info */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                    <div>
                      <span className="text-sm text-blue-600">タイトル:</span>
                      <p className="font-medium">{selectedRequest.title}</p>
                    </div>
                    <div>
                      <span className="text-sm text-blue-600">対象月:</span>
                      <p className="font-medium">{selectedRequest.targetMonth}</p>
                    </div>
                    <div>
                      <span className="text-sm text-blue-600">ステータス:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                        {getStatusLabel(selectedRequest.status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-blue-600">提出日:</span>
                      <p className="font-medium">
                        {format(selectedRequest.submittedAt || selectedRequest.createdAt, 'yyyy年M月d日 HH:mm', { locale: ja })}
                      </p>
                    </div>
                  </div>

                  {/* Overall Note */}
                  {selectedRequest.overallNote && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-2">全体的な備考</h4>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">{selectedRequest.overallNote}</p>
                      </div>
                    </div>
                  )}

                  {/* Day Requests */}
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 mb-3">
                      日別シフト希望 ({selectedRequest.dayRequests.length}日)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedRequest.dayRequests.map((dayRequest, index) => (
                        <div key={index} className="border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-blue-900">
                              {format(dayRequest.date, 'M月d日(E)', { locale: ja })}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${getPreferenceColor(dayRequest.preference)}`}>
                              {getPreferenceText(dayRequest.preference)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {dayRequest.timeSlots.map((slot, slotIndex) => (
                              <div key={slotIndex} className="text-sm text-blue-600">
                                {slot.start} - {slot.end}
                              </div>
                            ))}
                          </div>

                          {dayRequest.positions && dayRequest.positions.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-blue-500">希望ポジション:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {dayRequest.positions.map((position, posIndex) => (
                                  <span key={posIndex} className="px-1 py-0.5 bg-blue-100 text-xs rounded">
                                    {position}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {dayRequest.note && (
                            <div className="mt-2 text-xs text-blue-600">
                              <span className="font-medium">備考:</span> {dayRequest.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4 border-t border-blue-200">
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      閉じる
                    </button>

                    {(selectedRequest.status === 'submitted' || selectedRequest.status === 'under_review') && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            handleReject(selectedRequest.monthlyRequestId, '要件を満たしていません');
                            setShowDetailModal(false);
                          }}
                          className="flex items-center space-x-1 px-4 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>却下</span>
                        </button>
                        <button
                          onClick={() => {
                            handleApprove(selectedRequest.monthlyRequestId);
                            setShowDetailModal(false);
                          }}
                          className="flex items-center space-x-1 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>承認</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}