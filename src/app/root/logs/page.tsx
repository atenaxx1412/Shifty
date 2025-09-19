'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  MessageCircle,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  User,
  Mail,
  Eye,
  EyeOff,
  Star,
  Building,
  MessageSquare,
  Users,
  Calendar
} from 'lucide-react';
import GradientHeader from '@/components/ui/GradientHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFirebaseData } from '@/hooks/useFirebaseData';

interface InquiryEntry {
  id: string;
  timestamp: Date;
  fromRole: 'manager' | 'staff';
  fromUserId: string;
  fromUserName: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'resolved';
  category: 'technical' | 'schedule' | 'policy' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  shopName?: string;
  shopId?: string;
}

export default function InquiriesPage() {
  const { currentUser } = useAuth();
  const [filteredInquiries, setFilteredInquiries] = useState<InquiryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Use the custom hook for inquiries data
  const { data: inquiries, loading, refresh: refreshInquiries } = useFirebaseData<InquiryEntry>('inquiries');

  // Initialize filtered inquiries when inquiries data changes
  useEffect(() => {
    setFilteredInquiries(inquiries.map(inquiry => {
      const inquiryData = inquiry as any;
      return {
        id: inquiryData.id,
        timestamp: inquiryData.timestamp?.toDate ? inquiryData.timestamp.toDate() : new Date(inquiryData.timestamp),
        fromRole: inquiryData.fromRole || 'staff',
        fromUserId: inquiryData.fromUserId || '',
        fromUserName: inquiryData.fromUserName || 'Unknown User',
        subject: inquiryData.subject || 'No Subject',
        message: inquiryData.message || '',
        status: inquiryData.status || 'unread',
        category: inquiryData.category || 'other',
        priority: inquiryData.priority || 'normal',
        shopName: inquiryData.shopName,
        shopId: inquiryData.shopId
      } as InquiryEntry;
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, [inquiries]);

  // Mark inquiry as read
  const handleMarkAsRead = async (inquiryId: string, currentStatus: string) => {
    if (currentStatus === 'read') return;

    try {
      await updateDoc(doc(db, 'inquiries', inquiryId), {
        status: 'read',
        readAt: new Date(),
        readBy: currentUser?.uid
      });

      // Refresh inquiries after update
      refreshInquiries();

      console.log(`Inquiry marked as read: ${inquiryId}`);
    } catch (error) {
      console.error('Error marking inquiry as read:', error);
      alert('お問い合わせの状態更新に失敗しました');
    }
  };

  // Mark inquiry as resolved
  const handleMarkAsResolved = async (inquiryId: string) => {
    try {
      await updateDoc(doc(db, 'inquiries', inquiryId), {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: currentUser?.uid
      });

      // Refresh inquiries after update
      refreshInquiries();

      console.log(`Inquiry marked as resolved: ${inquiryId}`);
    } catch (error) {
      console.error('Error marking inquiry as resolved:', error);
      alert('お問い合わせの解決マーク更新に失敗しました');
    }
  };

  // Filter inquiries based on search and filters
  useEffect(() => {
    let filtered = inquiries;

    if (searchTerm) {
      filtered = filtered.filter(inquiry =>
        inquiry.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.fromUserName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.shopName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.status === statusFilter);
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.fromRole === roleFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.priority === priorityFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.category === categoryFilter);
    }

    // Sort by timestamp (newest first)
    filtered = filtered.sort((a, b) => {
      const aTime = a.timestamp?.getTime ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const bTime = b.timestamp?.getTime ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return bTime - aTime;
    });

    setFilteredInquiries(filtered);
  }, [inquiries, searchTerm, statusFilter, roleFilter, priorityFilter, categoryFilter]);

  const getStatusIcon = (status: InquiryEntry['status']) => {
    switch (status) {
      case 'unread': return <Mail className="h-4 w-4 text-blue-500" />;
      case 'read': return <Eye className="h-4 w-4 text-green-500" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: InquiryEntry['status']) => {
    switch (status) {
      case 'unread': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'read': return 'bg-green-50 text-green-800 border-green-200';
      case 'resolved': return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: InquiryEntry['priority']) => {
    switch (priority) {
      case 'low': return <Star className="h-4 w-4 text-gray-400" />;
      case 'normal': return <Star className="h-4 w-4 text-blue-400" />;
      case 'high': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'urgent': return <Star className="h-4 w-4 text-red-500" />;
    }
  };

  const getPriorityColor = (priority: InquiryEntry['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-50 text-gray-600 border-gray-200';
      case 'normal': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'high': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'urgent': return 'bg-red-50 text-red-700 border-red-200';
    }
  };

  const getRoleIcon = (role: InquiryEntry['fromRole']) => {
    switch (role) {
      case 'manager': return <Building className="h-4 w-4 text-purple-500" />;
      case 'staff': return <User className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const inquiryStats = [
    {
      label: '総件数',
      value: inquiries.length,
      icon: MessageCircle,
      gradient: 'from-gray-600 to-slate-700'
    },
    {
      label: '未読',
      value: inquiries.filter(i => (i as any).status === 'unread').length,
      icon: Mail,
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      label: '確認済み',
      value: inquiries.filter(i => (i as any).status === 'read').length,
      icon: Eye,
      gradient: 'from-green-500 to-green-600'
    },
    {
      label: '解決済み',
      value: inquiries.filter(i => (i as any).status === 'resolved').length,
      icon: CheckCircle,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      label: '緊急',
      value: inquiries.filter(i => (i as any).priority === 'urgent').length,
      icon: AlertTriangle,
      gradient: 'from-red-500 to-red-600'
    }
  ];

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gray-50">
          <AppHeader title="お問い合わせ確認" />
          <main className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-center min-h-64">
              <LoadingSpinner text="お問い合わせデータを読み込み中..." size="lg" />
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="お問い合わせ確認" />

        <main className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Header - Responsive */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <MessageCircle className="h-6 w-6 text-gray-700" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">お問い合わせ確認</h1>
                    <p className="text-sm text-gray-500">マネージャーとスタッフからのお問い合わせ管理</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={refreshInquiries}
                    className="inline-flex items-center px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 text-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">更新</span>
                    <span className="sm:hidden">更新</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Cards - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
              {inquiryStats.map((stat, index) => (
                <StatCard
                  key={index}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  gradient={stat.gradient}
                  size="sm"
                  className="text-center"
                />
              ))}
            </div>

            {/* Filters - Responsive */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="件名、内容、送信者名、店舗名で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-base sm:text-sm"
                  >
                    <option value="all">全ステータス</option>
                    <option value="unread">未読</option>
                    <option value="read">確認済み</option>
                    <option value="resolved">解決済み</option>
                  </select>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-base sm:text-sm"
                  >
                    <option value="all">全権限</option>
                    <option value="manager">マネージャー</option>
                    <option value="staff">スタッフ</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-base sm:text-sm"
                  >
                    <option value="all">全優先度</option>
                    <option value="urgent">緊急</option>
                    <option value="high">高</option>
                    <option value="normal">通常</option>
                    <option value="low">低</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-base sm:text-sm"
                  >
                    <option value="all">全カテゴリ</option>
                    <option value="technical">技術的</option>
                    <option value="schedule">スケジュール</option>
                    <option value="policy">ポリシー</option>
                    <option value="other">その他</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Inquiry Entries - Responsive */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  お問い合わせ一覧 ({filteredInquiries.length}件)
                </h3>
              </div>

              <div className="max-h-96 sm:max-h-[500px] overflow-y-auto">
                {filteredInquiries.map((inquiry) => (
                  <div key={inquiry.id} className="px-4 sm:px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {getStatusIcon(inquiry.status)}
                          {getRoleIcon(inquiry.fromRole)}
                          {getPriorityIcon(inquiry.priority)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(inquiry.status)} w-fit`}>
                              {inquiry.status === 'unread' ? '未読' : inquiry.status === 'read' ? '確認済み' : '解決済み'}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(inquiry.priority)} w-fit`}>
                              {inquiry.priority === 'urgent' ? '緊急' : inquiry.priority === 'high' ? '高' : inquiry.priority === 'normal' ? '通常' : '低'}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{inquiry.fromRole === 'manager' ? 'マネージャー' : 'スタッフ'}</span>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(inquiry.timestamp)}
                            </div>
                          </div>

                          <p className="text-sm sm:text-base text-gray-900 mb-2 font-medium break-words">{inquiry.subject}</p>

                          <p className="text-sm text-gray-700 mb-2 break-words line-clamp-2">{inquiry.message}</p>

                          <div className="flex items-center text-xs text-gray-600 mb-2">
                            <User className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="break-words">{inquiry.fromUserName}</span>
                            {inquiry.shopName && (
                              <>
                                <span className="mx-2">•</span>
                                <Building className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="break-words">{inquiry.shopName}</span>
                              </>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 break-words">
                            <span className="font-medium">カテゴリ: </span>
                            {inquiry.category === 'technical' ? '技術的' :
                             inquiry.category === 'schedule' ? 'スケジュール' :
                             inquiry.category === 'policy' ? 'ポリシー' : 'その他'}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2 sm:ml-4 flex space-x-1">
                        {inquiry.status === 'unread' && (
                          <button
                            onClick={() => handleMarkAsRead(inquiry.id, inquiry.status)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200"
                            title="確認済みにする"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {inquiry.status !== 'resolved' && (
                          <button
                            onClick={() => handleMarkAsResolved(inquiry.id)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="解決済みにする"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredInquiries.length === 0 && (
                <div className="px-4 sm:px-6 py-12 text-center">
                  <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">お問い合わせが見つかりません</h3>
                  <p className="text-sm sm:text-base text-gray-500">検索条件を変更するか、新しいお問い合わせをお待ちください</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}