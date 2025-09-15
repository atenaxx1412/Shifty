'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import { 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  Calendar,
  ArrowLeft,
  Search,
  MessageSquare,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ApprovalRequest {
  requestId: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  type: 'shift_request' | 'shift_exchange' | 'leave_request' | 'overtime_request';
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestDate: Date;
  effectiveDate: Date;
  effectiveTime?: string;
  description: string;
  reason?: string;
  originalShiftId?: string;
  targetShiftId?: string;
  exchangeWithStaffId?: string;
  exchangeWithStaffName?: string;
  comments?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// サンプルデータ
const sampleRequests: ApprovalRequest[] = [
  {
    requestId: 'req-001',
    staffId: 'staff1',
    staffName: '山田太郎',
    staffEmail: 'yamada@shifty.com',
    type: 'shift_request',
    status: 'pending',
    priority: 'medium',
    requestDate: new Date('2025-09-10'),
    effectiveDate: new Date('2025-09-15'),
    effectiveTime: '09:00-17:00',
    description: '来週月曜日の午前シフトを希望します',
    reason: '子供の学校行事のため、午前中のみ勤務可能です',
    createdAt: new Date('2025-09-08'),
    updatedAt: new Date('2025-09-08')
  },
  {
    requestId: 'req-002',
    staffId: 'staff2',
    staffName: '佐藤花子',
    staffEmail: 'sato@shifty.com',
    type: 'shift_exchange',
    status: 'pending',
    priority: 'high',
    requestDate: new Date('2025-09-10'),
    effectiveDate: new Date('2025-09-12'),
    effectiveTime: '15:00-21:00',
    description: '田中さんとのシフト交換を希望します',
    reason: '家族の用事で急遽変更が必要になりました',
    exchangeWithStaffId: 'staff3',
    exchangeWithStaffName: '田中次郎',
    originalShiftId: 'shift-001',
    targetShiftId: 'shift-002',
    createdAt: new Date('2025-09-09'),
    updatedAt: new Date('2025-09-09')
  },
  {
    requestId: 'req-003',
    staffId: 'staff4',
    staffName: '鈴木美咲',
    staffEmail: 'suzuki@shifty.com',
    type: 'leave_request',
    status: 'pending',
    priority: 'low',
    requestDate: new Date('2025-09-10'),
    effectiveDate: new Date('2025-09-20'),
    effectiveTime: '全日',
    description: '有給休暇を取得したいです',
    reason: '旅行の予定があります',
    createdAt: new Date('2025-09-07'),
    updatedAt: new Date('2025-09-07')
  },
  {
    requestId: 'req-004',
    staffId: 'staff1',
    staffName: '山田太郎',
    staffEmail: 'yamada@shifty.com',
    type: 'overtime_request',
    status: 'approved',
    priority: 'urgent',
    requestDate: new Date('2025-09-09'),
    effectiveDate: new Date('2025-09-11'),
    effectiveTime: '21:00-23:00',
    description: '残業申請',
    reason: 'イベント準備のため残業が必要です',
    createdAt: new Date('2025-09-09'),
    updatedAt: new Date('2025-09-09')
  }
];

export default function ManagerApprovalsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>(sampleRequests);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | ApprovalRequest['type']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ApprovalRequest['status']>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | ApprovalRequest['priority']>('all');

  // フィルタリングされた申請
  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || request.type === filterType;
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || request.priority === filterPriority;
    
    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  // 申請タイプのラベル
  const getTypeLabel = (type: ApprovalRequest['type']) => {
    switch (type) {
      case 'shift_request': return 'シフト希望';
      case 'shift_exchange': return 'シフト交換';
      case 'leave_request': return '休暇申請';
      case 'overtime_request': return '残業申請';
      default: return type;
    }
  };

  // ステータスの色とラベル
  const getStatusColor = (status: ApprovalRequest['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: ApprovalRequest['status']) => {
    switch (status) {
      case 'pending': return '承認待ち';
      case 'approved': return '承認済み';
      case 'rejected': return '却下';
      default: return status;
    }
  };

  // 優先度の色
  const getPriorityColor = (priority: ApprovalRequest['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  // 申請承認
  const handleApprove = async (requestId: string) => {
    setRequests(prev => 
      prev.map(req => 
        req.requestId === requestId 
          ? { ...req, status: 'approved' as const, updatedAt: new Date() }
          : req
      )
    );
  };

  // 申請却下
  const handleReject = async (requestId: string) => {
    setRequests(prev => 
      prev.map(req => 
        req.requestId === requestId 
          ? { ...req, status: 'rejected' as const, updatedAt: new Date() }
          : req
      )
    );
  };

  // 統計
  const getStats = () => {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const urgent = requests.filter(r => r.priority === 'urgent' && r.status === 'pending').length;
    
    return { pending, approved, rejected, urgent };
  };

  const stats = getStats();

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
                <h1 className="text-2xl font-bold text-gray-900">承認管理</h1>
                <p className="text-gray-600">
                  スタッフからの申請を確認・承認
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setLoading(!loading)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>更新</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">承認待ち</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}件</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">承認済み</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}件</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">却下</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}件</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">緊急</p>
                  <p className="text-2xl font-bold text-red-600">{stats.urgent}件</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="スタッフ名または内容で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | ApprovalRequest['type'])}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全てのタイプ</option>
                <option value="shift_request">シフト希望</option>
                <option value="shift_exchange">シフト交換</option>
                <option value="leave_request">休暇申請</option>
                <option value="overtime_request">残業申請</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | ApprovalRequest['status'])}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全てのステータス</option>
                <option value="pending">承認待ち</option>
                <option value="approved">承認済み</option>
                <option value="rejected">却下</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as 'all' | ApprovalRequest['priority'])}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全ての優先度</option>
                <option value="urgent">緊急</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                申請一覧 ({filteredRequests.length}件)
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <div key={request.requestId} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <User className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{request.staffName}</span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                          {getStatusLabel(request.status)}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {getTypeLabel(request.type)}
                        </span>
                        <span className={`text-xs font-medium ${getPriorityColor(request.priority)}`}>
                          {request.priority.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-gray-900">{request.description}</p>
                        {request.reason && (
                          <p className="text-sm text-gray-600">理由: {request.reason}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>対象日: {format(request.effectiveDate, 'yyyy年M月d日', { locale: ja })}</span>
                          </div>
                          {request.effectiveTime && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{request.effectiveTime}</span>
                            </div>
                          )}
                        </div>
                        
                        {request.exchangeWithStaffName && (
                          <div className="text-sm text-blue-600">
                            交換相手: {request.exchangeWithStaffName}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400">
                          申請日: {format(request.createdAt, 'yyyy年M月d日 HH:mm', { locale: ja })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleReject(request.requestId)}
                            className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>却下</span>
                          </button>
                          <button
                            onClick={() => handleApprove(request.requestId)}
                            className="flex items-center space-x-1 px-3 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>承認</span>
                          </button>
                        </>
                      )}
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">申請が見つかりません</p>
              <p className="text-gray-400 mt-2">
                検索条件を変更してください
              </p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}