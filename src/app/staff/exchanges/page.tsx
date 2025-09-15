'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  ArrowLeft,
  RefreshCw,
  Plus,
  Users,
  Clock,
  Calendar,
  Check,
  X,
  AlertCircle,
  MessageCircle,
  ArrowRight,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftExchangeService } from '@/lib/shiftExchangeService';
import { shiftService } from '@/lib/shiftService';
import { ShiftExchange, ShiftExtended } from '@/types';

export default function StaffExchangesPage() {
  const { currentUser } = useAuth();
  const [myRequests, setMyRequests] = useState<ShiftExchange[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ShiftExchange[]>([]);
  const [myShifts, setMyShifts] = useState<ShiftExtended[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<{shiftId: string, slotId: string} | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      loadExchangeData();
      loadMyShifts();

      // リアルタイム監視
      const unsubscribe = shiftExchangeService.subscribeToExchangeRequests(
        currentUser.uid,
        (exchanges) => {
          setMyRequests(exchanges);
        }
      );

      return () => unsubscribe();
    }
  }, [currentUser]);

  const loadExchangeData = async () => {
    if (!currentUser?.uid) return;

    setLoading(true);
    try {
      const [myExchanges, received] = await Promise.all([
        shiftExchangeService.getUserExchangeRequests(currentUser.uid),
        shiftExchangeService.getReceivedExchangeRequests(currentUser.uid)
      ]);

      setMyRequests(myExchanges);
      setReceivedRequests(received);
    } catch (error) {
      console.error('Error loading exchange data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyShifts = async () => {
    if (!currentUser?.shopId) return;

    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30日後まで
      
      const shifts = await shiftService.getShiftsByShop(
        currentUser.shopId,
        now,
        futureDate
      );

      // 自分に割り当てられたシフトのみフィルタリング
      const myAssignedShifts = shifts.filter(shift =>
        shift.slots.some(slot =>
          slot.assignedStaff?.includes(currentUser.uid)
        )
      );

      setMyShifts(myAssignedShifts);
    } catch (error) {
      console.error('Error loading my shifts:', error);
    }
  };

  const handleCreateExchange = async (
    shiftId: string,
    slotId: string,
    reason: string,
    targetUserId?: string
  ) => {
    if (!currentUser) return;

    try {
      await shiftExchangeService.createExchangeRequest(
        currentUser,
        shiftId,
        slotId,
        targetUserId,
        reason
      );

      console.log('✅ Exchange request created successfully');
      setShowCreateModal(false);
      await loadExchangeData();
    } catch (error) {
      console.error('❌ Error creating exchange request:', error);
      alert('交換リクエストの作成に失敗しました。');
    }
  };

  const handleApproveExchange = async (exchangeId: string) => {
    if (!currentUser) return;

    try {
      await shiftExchangeService.approveExchangeRequest(exchangeId, currentUser.uid);
      console.log('✅ Exchange approved successfully');
      await loadExchangeData();
    } catch (error) {
      console.error('❌ Error approving exchange:', error);
      alert('交換の承認に失敗しました。');
    }
  };

  const handleRejectExchange = async (exchangeId: string, reason?: string) => {
    if (!currentUser) return;

    try {
      await shiftExchangeService.rejectExchangeRequest(exchangeId, currentUser.uid, reason);
      console.log('✅ Exchange rejected successfully');
      await loadExchangeData();
    } catch (error) {
      console.error('❌ Error rejecting exchange:', error);
      alert('交換の拒否に失敗しました。');
    }
  };

  const handleCancelExchange = async (exchangeId: string) => {
    if (!currentUser) return;

    if (!confirm('この交換リクエストをキャンセルしますか？')) return;

    try {
      await shiftExchangeService.cancelExchangeRequest(exchangeId, currentUser.uid);
      console.log('✅ Exchange cancelled successfully');
      await loadExchangeData();
    } catch (error) {
      console.error('❌ Error cancelling exchange:', error);
      alert('交換のキャンセルに失敗しました。');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const labels = {
      pending: '承認待ち',
      approved: '承認済み',
      rejected: '拒否',
      cancelled: 'キャンセル'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getShiftInfo = (shiftId: string, slotId: string) => {
    const shift = myShifts.find(s => s.shiftId === shiftId);
    if (!shift) return null;

    const slot = shift.slots.find(s => s.slotId === slotId);
    if (!slot) return null;

    return { shift, slot };
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">シフト交換データを読み込み中...</p>
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
                <h1 className="text-2xl font-bold text-gray-900">シフト交換</h1>
                <p className="text-gray-600">スタッフ間でのシフト交換管理</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={loadExchangeData}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>更新</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>交換依頼作成</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-6 w-6 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-600 font-medium">承認待ち</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {myRequests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Check className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm text-green-600 font-medium">承認済み</p>
                  <p className="text-2xl font-bold text-green-900">
                    {myRequests.filter(r => r.status === 'approved').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600 font-medium">受信依頼</p>
                  <p className="text-2xl font-bold text-blue-900">{receivedRequests.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600 font-medium">交換可能シフト</p>
                  <p className="text-2xl font-bold text-purple-900">{myShifts.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 自分の交換リクエスト */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  自分の交換リクエスト ({myRequests.length}件)
                </h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {myRequests.map((request) => {
                  const shiftInfo = getShiftInfo(request.shiftId, request.shiftSlotId);
                  return (
                    <div key={request.exchangeId} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(request.status)}
                          <span className="text-sm text-gray-500">
                            {format(request.createdAt, 'MM/dd HH:mm', { locale: ja })}
                          </span>
                        </div>
                        {request.status === 'pending' && (
                          <button
                            onClick={() => handleCancelExchange(request.exchangeId)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            キャンセル
                          </button>
                        )}
                      </div>
                      {shiftInfo && (
                        <div className="text-sm text-gray-600 mb-2">
                          {format(shiftInfo.shift.date, 'MM月dd日（E）', { locale: ja })} 
                          {shiftInfo.slot.startTime}-{shiftInfo.slot.endTime}
                        </div>
                      )}
                      <div className="text-sm text-gray-600">
                        {request.toUserId ? '特定スタッフへの依頼' : '全体募集'}
                      </div>
                      {request.reason && (
                        <div className="text-sm text-gray-500 mt-1">
                          理由: {request.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
                {myRequests.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>交換リクエストがありません</p>
                  </div>
                )}
              </div>
            </div>

            {/* 受信した交換リクエスト */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  受信した交換依頼 ({receivedRequests.length}件)
                </h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {receivedRequests.map((request) => (
                  <div key={request.exchangeId} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">
                          {request.fromUserId} さんから
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {format(request.createdAt, 'MM/dd HH:mm', { locale: ja })}
                      </span>
                    </div>
                    {request.reason && (
                      <div className="text-sm text-gray-600 mb-3">
                        理由: {request.reason}
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApproveExchange(request.exchangeId)}
                        className="flex items-center px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-sm"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        承認
                      </button>
                      <button
                        onClick={() => handleRejectExchange(request.exchangeId)}
                        className="flex items-center px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        拒否
                      </button>
                    </div>
                  </div>
                ))}
                {receivedRequests.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>交換依頼がありません</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 交換可能なシフト一覧 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                交換可能なシフト ({myShifts.length}件)
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {myShifts.map((shift) => (
                <div key={shift.shiftId} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {format(shift.date, 'MM月dd日（E）', { locale: ja })}
                      </h3>
                      <div className="text-sm text-gray-600 mt-1">
                        {shift.slots
                          .filter(slot => slot.assignedStaff?.includes(currentUser?.uid || ''))
                          .map(slot => `${slot.startTime}-${slot.endTime}`)
                          .join(', ')
                        }
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const mySlot = shift.slots.find(slot => 
                          slot.assignedStaff?.includes(currentUser?.uid || '')
                        );
                        if (mySlot) {
                          setSelectedShift({ shiftId: shift.shiftId, slotId: mySlot.slotId });
                          setShowCreateModal(true);
                        }
                      }}
                      className="flex items-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      <ArrowRight className="h-4 w-4" />
                      <span>交換依頼</span>
                    </button>
                  </div>
                </div>
              ))}
              {myShifts.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>交換可能なシフトがありません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}