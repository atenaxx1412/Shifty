'use client';

import { useState, useEffect } from 'react';
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
  Eye,
  Filter,
  Search,
  Users,
  Plus
} from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MonthlyShiftRequest, User as UserType } from '@/types';
import { shiftRequestService } from '@/lib/shiftRequestService';
import { ManagerDataService } from '@/lib/managerDataService';
import Link from 'next/link';

export default function ShiftRequestsPage() {
  const { currentUser } = useAuth();
  const [shiftRequests, setShiftRequests] = useState<MonthlyShiftRequest[]>([]);
  const [staffList, setStaffList] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTargetMonth, setCurrentTargetMonth] = useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'requests' | 'staff'>('staff'); // デフォルトをstaffに変更

  useEffect(() => {
    if (!currentUser) {
      console.log('No currentUser, skipping data loading');
      setLoading(false);
      setStaffLoading(false);
      return;
    }

    console.log('Setting up data loading for user:', {
      uid: currentUser.uid,
      role: currentUser.role,
      managerId: currentUser.managerId
    });

    // タイムアウト設定（10秒）
    const loadingTimeout = setTimeout(() => {
      console.warn('Loading timeout reached');
      setError('データの読み込みがタイムアウトしました');
      setStaffError('スタッフデータの読み込みがタイムアウトしました');
      setLoading(false);
      setStaffLoading(false);
    }, 10000);

    let unsubscribe: (() => void) | null = null;

    try {
      // 管理者IDを決定（管理者の場合は自分のuid、スタッフの場合はmanagerId）
      const managerIdToUse = currentUser.role === 'manager' || currentUser.role === 'root'
        ? currentUser.uid
        : currentUser.managerId;

      console.log('Setting up shift requests subscription:', {
        managerId: managerIdToUse,
        userRole: currentUser.role,
        userUid: currentUser.uid
      });

      if (!managerIdToUse) {
        throw new Error('管理者IDが特定できません');
      }

      // エラーハンドリング付きでシフト希望データを取得
      unsubscribe = shiftRequestService.subscribeToManagerMonthlyRequests(
        managerIdToUse,
        (requests) => {
          console.log('Received shift requests:', requests.length, 'items');
          if (requests.length > 0) {
            console.log('First request sample:', requests[0]);
          }
          setShiftRequests(requests);
          setLoading(false);
          setError(null);
          clearTimeout(loadingTimeout);
        }
      );

      // 3秒後にシフト希望データの読み込み完了をチェック
      setTimeout(() => {
        if (loading) {
          console.log('Shift requests still loading after 3 seconds, setting empty array');
          setShiftRequests([]);
          setLoading(false);
        }
      }, 3000);

      // スタッフ一覧の取得
      const loadStaffData = async () => {
        try {
          setStaffLoading(true);
          setStaffError(null);
          console.log('Loading staff data for manager:', managerIdToUse);

          const staff = await ManagerDataService.getOptimizedStaffData(managerIdToUse);
          console.log('Loaded staff data:', staff.length, 'staff members');

          setStaffList(staff);
          setStaffError(null);
        } catch (error) {
          console.error('Failed to load staff data:', error);
          setStaffError(error instanceof Error ? error.message : 'スタッフデータの読み込みに失敗しました');
          // エラーでも空配列を設定してページを表示可能にする
          setStaffList([]);
        } finally {
          setStaffLoading(false);
        }
      };

      // スタッフデータの読み込みタイムアウト
      setTimeout(() => {
        if (staffLoading) {
          console.log('Staff data still loading after 5 seconds, setting empty array');
          setStaffList([]);
          setStaffLoading(false);
        }
      }, 5000);

      loadStaffData();
    } catch (error) {
      console.error('Error setting up data loading:', error);
      setError(error instanceof Error ? error.message : 'データの初期化に失敗しました');
      setLoading(false);
      setStaffLoading(false);
      clearTimeout(loadingTimeout);
    }

    return () => {
      clearTimeout(loadingTimeout);
      if (unsubscribe) {
        console.log('Cleaning up subscription');
        unsubscribe();
      }
    };
  }, [currentUser]);

  // ヘルパー関数を先に定義
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
        return <AlertCircle className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // スタッフの提出状況を取得するヘルパー関数
  const getStaffSubmissionStatus = (staffId: string) => {
    const request = shiftRequests.find(r =>
      r.staffId === staffId &&
      r.targetMonth === currentTargetMonth
    );

    if (!request) {
      return {
        status: 'not_submitted',
        statusText: '未提出',
        statusColor: 'bg-red-100 text-red-800 border-red-200',
        request: null
      };
    }

    return {
      status: request.status,
      statusText: getStatusText(request.status),
      statusColor: getStatusColor(request.status),
      request: request
    };
  };

  // 提出統計を計算
  const submissionStats = {
    total: staffList.length,
    submitted: staffList.filter(staff => {
      const status = getStaffSubmissionStatus(staff.uid);
      return status.status === 'submitted' || status.status === 'approved' || status.status === 'rejected';
    }).length,
    notSubmitted: staffList.filter(staff => {
      const status = getStaffSubmissionStatus(staff.uid);
      return status.status === 'not_submitted';
    }).length,
    approved: staffList.filter(staff => {
      const status = getStaffSubmissionStatus(staff.uid);
      return status.status === 'approved';
    }).length,
    rejected: staffList.filter(staff => {
      const status = getStaffSubmissionStatus(staff.uid);
      return status.status === 'rejected';
    }).length
  };

  const filteredRequests = shiftRequests.filter(request => {
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesSearch = !searchTerm ||
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.staffId && request.staffId.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: shiftRequests.length,
    submitted: shiftRequests.filter(r => r.status === 'submitted').length,
    approved: shiftRequests.filter(r => r.status === 'approved').length,
    rejected: shiftRequests.filter(r => r.status === 'rejected').length,
  };

  // 初期ローディング（両方とも読み込み中の場合のみ）
  // データが一つも取得できていない初期状態のみローディング画面を表示
  const hasAnyData = shiftRequests.length > 0 || staffList.length > 0;
  const isInitialLoading = (loading && staffLoading) && !hasAnyData && !error && !staffError;

  if (isInitialLoading) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <AppHeader title="シフト希望確認" />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">データを読み込んでいます...</p>
              <p className="text-xs text-gray-500 mt-2">
                初期化中... (タイムアウト: 10秒)
              </p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  // クリティカルエラー（両方ともエラーかつデータが全くない場合のみ）
  if (error && staffError && !hasAnyData) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <AppHeader title="シフト希望確認" />
        <DashboardLayout>
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-medium text-red-900">データの読み込みエラー</h3>
              </div>
              {error && (
                <p className="text-red-700 mb-2">シフト希望データ: {error}</p>
              )}
              {staffError && (
                <p className="text-red-700 mb-4">スタッフデータ: {staffError}</p>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setStaffError(null);
                  setLoading(true);
                  setStaffLoading(true);
                  // ページをリロード
                  window.location.reload();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                再試行
              </button>
            </div>

            {/* フォールバック：基本機能を有効にする */}
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">制限モードで続行</h3>
              <p className="text-blue-700 text-sm mb-3">
                データの読み込みに問題がありますが、基本機能は使用できます。
              </p>
              <button
                onClick={() => {
                  setError(null);
                  setStaffError(null);
                  setLoading(false);
                  setStaffLoading(false);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                制限モードで続行
              </button>
            </div>

            {/* デバッグ情報 */}
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">デバッグ情報</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>ユーザーID: {currentUser?.uid || 'なし'}</p>
                <p>ロール: {currentUser?.role || 'なし'}</p>
                <p>管理者ID: {currentUser?.managerId || 'なし'}</p>
                <p>使用中管理者ID: {
                  currentUser?.role === 'manager' || currentUser?.role === 'root'
                    ? currentUser?.uid
                    : currentUser?.managerId || 'なし'
                }</p>
                <p>シフト希望数: {shiftRequests.length}</p>
                <p>スタッフ数: {staffList.length}</p>
                <p>現在時刻: {new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <AppHeader title="シフト希望確認" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* 部分的なエラー表示 */}
          {(error || staffError) && !(error && staffError) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <h3 className="text-sm font-medium text-yellow-900">一部データの読み込みエラー</h3>
              </div>
              {error && (
                <p className="text-yellow-700 text-sm">シフト希望データの読み込みに失敗しました</p>
              )}
              {staffError && (
                <p className="text-yellow-700 text-sm">スタッフデータの読み込みに失敗しました</p>
              )}
              <p className="text-yellow-600 text-xs mt-1">利用可能なデータで表示しています</p>
            </div>
          )}

          {/* ローディング表示（部分的） */}
          {(loading || staffLoading) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-blue-700 text-sm">
                  {loading && 'シフト希望データ読み込み中...'}
                  {staffLoading && 'スタッフデータ読み込み中...'}
                </span>
              </div>
            </div>
          )}
          {/* Month Selector */}
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">シフト希望確認</h1>
                <p className="text-sm text-gray-600">スタッフのシフト希望提出状況と内容を確認できます</p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">対象月:</label>
                <input
                  type="month"
                  value={currentTargetMonth}
                  onChange={(e) => setCurrentTargetMonth(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-600">全スタッフ</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {submissionStats.total}人
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-600">提出済み</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {submissionStats.submitted}人
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center space-x-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-600">未提出</span>
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">
                {submissionStats.notSubmitted}人
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-600">承認済み</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {submissionStats.approved}人
              </div>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">表示モード:</span>
              <div className="flex rounded-lg border border-gray-300 p-1">
                <button
                  onClick={() => setViewMode('staff')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'staff'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>スタッフ別</span>
                  </div>
                </button>
                <button
                  onClick={() => setViewMode('requests')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'requests'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>希望一覧</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Content based on view mode */}
          {viewMode === 'staff' ? (
            /* Staff List View */
            <div className="bg-white rounded-lg border">
              {staffList.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    スタッフデータがありません
                  </h3>
                  <p className="text-gray-600">
                    管理対象のスタッフが登録されていないか、データの読み込みに失敗しました。
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {staffList
                    .filter(staff => !searchTerm || staff.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((staff) => {
                      const submissionData = getStaffSubmissionStatus(staff.uid);
                      return (
                        <div key={staff.uid} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                  <User className="h-6 w-6 text-gray-600" />
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">{staff.name}</h3>
                                <p className="text-sm text-gray-600">{staff.email}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${submissionData.statusColor}`}>
                                    <span>{submissionData.statusText}</span>
                                  </span>
                                  {submissionData.request && (
                                    <span className="text-xs text-gray-500">
                                      {submissionData.request.dayRequests?.length || 0}日分
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              {submissionData.request ? (
                                <Link
                                  href={`/manager/shift-requests/${submissionData.request.monthlyRequestId}`}
                                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>詳細確認</span>
                                </Link>
                              ) : (
                                <div className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg">
                                  <span className="text-sm">未提出</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            /* Requests List View */
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Status Filter */}
                  <div className="flex items-center space-x-2">
                    <Filter className="h-5 w-5 text-gray-600" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">すべて</option>
                      <option value="submitted">提出済み</option>
                      <option value="approved">承認済み</option>
                      <option value="rejected">却下済み</option>
                    </select>
                  </div>

                  {/* Search */}
                  <div className="flex items-center space-x-2 flex-1">
                    <Search className="h-5 w-5 text-gray-600" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="タイトルで検索..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Shift Requests List */}
              <div className="bg-white rounded-lg border">
                {filteredRequests.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      シフト希望がありません
                    </h3>
                    <p className="text-gray-600">
                      {currentTargetMonth}の月のシフト希望提出がまだありません。
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredRequests.map((request) => (
                      <div key={request.monthlyRequestId} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-medium text-gray-900">
                                {request.title}
                              </h3>
                              <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                {getStatusIcon(request.status)}
                                <span>{getStatusText(request.status)}</span>
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4" />
                                <span>スタッフ: {request.staffId}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4" />
                                <span>対象月: {request.targetMonth}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  提出: {request.submittedAt ? format(request.submittedAt, 'MM/dd HH:mm', { locale: ja }) : '-'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>{request.dayRequests?.length || 0}日分の希望</span>
                              {request.overallNote && (
                                <span className="truncate">備考: {request.overallNote}</span>
                              )}
                            </div>
                          </div>

                          <div className="ml-4">
                            <Link
                              href={`/manager/shift-requests/${request.monthlyRequestId}`}
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                              <span>詳細確認</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Search Filter for Staff View */}
          {viewMode === 'staff' && (
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-gray-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="スタッフ名で検索..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}