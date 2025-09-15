'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Calendar, 
  Clock, 
  Plus,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Filter,
  Search,
  Eye
} from 'lucide-react';
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function StaffRequestsPage() {
  const { currentUser } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // シフト希望のサンプルデータ
  const shiftRequests = [
    {
      id: '1',
      date: addDays(new Date(), 7),
      timeSlots: [{ start: '09:00', end: '15:00' }],
      preference: 'preferred',
      status: 'approved',
      note: '平日の午前中希望',
      createdAt: addDays(new Date(), -5),
      aiRecommendation: {
        score: 0.85,
        reasoning: '勤務実績と希望時間がマッチしています',
      },
      priority: 'medium'
    },
    {
      id: '2',
      date: addDays(new Date(), 8),
      timeSlots: [{ start: '15:00', end: '21:00' }],
      preference: 'available',
      status: 'pending',
      note: '夕方の勤務も可能',
      createdAt: addDays(new Date(), -3),
      aiRecommendation: {
        score: 0.72,
        reasoning: '他のスタッフと時間帯が重複しています',
      },
      priority: 'low'
    },
    {
      id: '3',
      date: addDays(new Date(), 14),
      timeSlots: [{ start: '10:00', end: '16:00' }],
      preference: 'preferred',
      status: 'rejected',
      note: '土曜日の勤務希望',
      createdAt: addDays(new Date(), -2),
      rejectionReason: 'スタッフが充足しているため',
      aiRecommendation: {
        score: 0.45,
        reasoning: '土曜日は競争が激しいです',
      },
      priority: 'high'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'rejected':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getPreferenceColor = (preference: string) => {
    switch (preference) {
      case 'preferred':
        return 'text-blue-600 bg-blue-100';
      case 'available':
        return 'text-green-600 bg-green-100';
      case 'unavailable':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '承認済み';
      case 'pending':
        return '審査中';
      case 'rejected':
        return '却下';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
      case 'urgent':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const filteredRequests = shiftRequests.filter(request => {
    if (filterStatus !== 'all' && request.status !== filterStatus) return false;
    if (searchTerm && !request.note.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: shiftRequests.length,
    approved: shiftRequests.filter(r => r.status === 'approved').length,
    pending: shiftRequests.filter(r => r.status === 'pending').length,
    rejected: shiftRequests.filter(r => r.status === 'rejected').length,
  };

  return (
    <ProtectedRoute allowedRoles={['root', 'manager', 'staff']}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a 
                href="/staff" 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-600" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">シフト希望履歴</h1>
                <p className="text-gray-600">提出したシフト希望の確認と管理</p>
              </div>
            </div>
            <a 
              href="/staff/requests/new" 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>新しい希望提出</span>
            </a>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-sm text-gray-600">総申請数</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
                  <p className="text-sm text-gray-600">承認済み</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                  <p className="text-sm text-gray-600">審査中</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
                  <p className="text-sm text-gray-600">却下</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">すべてのステータス</option>
                    <option value="pending">審査中</option>
                    <option value="approved">承認済み</option>
                    <option value="rejected">却下</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="ノートで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-5 w-5 text-gray-500" />
                        <span className="text-lg font-semibold text-gray-900">
                          {format(request.date, 'MM/dd (E)', { locale: ja })}
                        </span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPreferenceColor(request.preference)}`}>
                        {getPreferenceText(request.preference)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">希望時間</p>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {request.timeSlots.map(slot => `${slot.start}-${slot.end}`).join(', ')}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm text-gray-600 mb-1">AI推奨度</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${request.aiRecommendation.score * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {Math.round(request.aiRecommendation.score * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {request.aiRecommendation.reasoning}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600 mb-1">優先度</p>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getPriorityColor(request.priority).replace('text-', 'bg-')}`}></div>
                          <span className={`text-sm font-medium capitalize ${getPriorityColor(request.priority)}`}>
                            {request.priority}
                          </span>
                        </div>
                      </div>
                    </div>

                    {request.note && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">ノート</p>
                        <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">{request.note}</p>
                      </div>
                    )}

                    {request.status === 'rejected' && request.rejectionReason && (
                      <div className="mb-4">
                        <p className="text-sm text-red-600 mb-1">却下理由</p>
                        <p className="text-sm text-red-800 bg-red-50 p-3 rounded-lg border border-red-200">
                          {request.rejectionReason}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      提出日: {format(request.createdAt, 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2 lg:ml-6">
                    <button className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye className="h-4 w-4" />
                      <span>詳細</span>
                    </button>
                    {request.status === 'pending' && (
                      <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                        <FileText className="h-4 w-4" />
                        <span>編集</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRequests.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">条件に一致するシフト希望が見つかりません</p>
              <p className="text-gray-400 mt-2">新しいシフト希望を提出してみましょう</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}