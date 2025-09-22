'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Mail,
  Eye,
  Star,
  Building,
  Reply,
  Send
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

  // Reply functionality states
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyingToInquiry, setReplyingToInquiry] = useState<InquiryEntry | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [repliedInquiries, setRepliedInquiries] = useState<Set<string>>(new Set());

  // Use the custom hook for inquiries data
  const { data: inquiries, loading, refresh: refreshInquiries } = useFirebaseData<InquiryEntry>('inquiries');

  // Load replied inquiries from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('repliedInquiries');
      if (stored) {
        const repliedIds = JSON.parse(stored) as string[];
        setRepliedInquiries(new Set(repliedIds));
      }
    } catch (error) {
      console.error('Error loading replied inquiries:', error);
    }
  }, []);

  // Initialize filtered inquiries when inquiries data changes
  useEffect(() => {
    const processedInquiries = inquiries.map(inquiry => {
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
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    setFilteredInquiries(processedInquiries);
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

  // Open reply modal
  const handleReplyClick = (inquiry: InquiryEntry) => {
    setReplyingToInquiry(inquiry);
    setReplyMessage('');
    setReplyModalOpen(true);
  };

  // Send reply
  const handleSendReply = async () => {
    if (!replyingToInquiry || !replyMessage.trim() || !currentUser) return;

    setSendingReply(true);
    try {
      // Add reply to replies collection
      await addDoc(collection(db, 'replies'), {
        inquiryId: replyingToInquiry.id,
        message: replyMessage.trim(),
        fromUserId: currentUser.uid,
        fromUserName: 'システム管理者',
        fromRole: 'root',
        timestamp: new Date(),
        toUserId: replyingToInquiry.fromUserId,
        toUserName: replyingToInquiry.fromUserName
      });

      // Mark inquiry as read if it was unread
      if (replyingToInquiry.status === 'unread') {
        await updateDoc(doc(db, 'inquiries', replyingToInquiry.id), {
          status: 'read',
          readAt: new Date(),
          readBy: currentUser.uid
        });
      }

      // Mark as replied in localStorage
      const newRepliedInquiries = new Set(repliedInquiries);
      newRepliedInquiries.add(replyingToInquiry.id);
      setRepliedInquiries(newRepliedInquiries);

      try {
        localStorage.setItem('repliedInquiries', JSON.stringify(Array.from(newRepliedInquiries)));
      } catch (error) {
        console.error('Error saving replied inquiry:', error);
      }

      // Close modal and refresh
      setReplyModalOpen(false);
      setReplyingToInquiry(null);
      setReplyMessage('');
      refreshInquiries();

      alert('返信を送信しました');
      console.log(`Reply sent for inquiry: ${replyingToInquiry.id}`);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('返信の送信に失敗しました');
    } finally {
      setSendingReply(false);
    }
  };


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
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <MessageCircle className="h-6 w-6 text-gray-700" />
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-gray-900">お問い合わせ確認</h1>
                    <p className="text-sm text-gray-500 hidden sm:block">マネージャーとスタッフからのお問い合わせ管理</p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-3">
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


            {/* Inquiry Entries - Responsive */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  お問い合わせ一覧 ({filteredInquiries.length}件)
                </h3>
              </div>

              <div className="max-h-96 sm:max-h-[500px] overflow-y-auto">
                {filteredInquiries.map((inquiry) => (
                  <div key={inquiry.id} className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    {/* Mobile Layout */}
                    <div className="block sm:hidden">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(inquiry.status)}
                          {getRoleIcon(inquiry.fromRole)}
                          <span className="text-xs text-gray-500">{inquiry.fromRole === 'manager' ? 'マネージャー' : 'スタッフ'}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDate(inquiry.timestamp)}
                        </div>
                      </div>

                      <div className="mb-2">
                        <h4 className="text-sm font-medium text-gray-900 mb-1 break-words">{inquiry.subject}</h4>
                        <p className="text-sm text-gray-700 line-clamp-2 break-words">{inquiry.message}</p>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(inquiry.status)}`}>
                          {inquiry.status === 'unread' ? '未読' : inquiry.status === 'read' ? '確認済み' : '解決済み'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(inquiry.priority)}`}>
                          {inquiry.priority === 'urgent' ? '緊急' : inquiry.priority === 'high' ? '高' : inquiry.priority === 'normal' ? '通常' : '低'}
                        </span>
                        {repliedInquiries.has(inquiry.id) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                            <Reply className="h-3 w-3 mr-1" />
                            返信済み
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-gray-600 flex-1 min-w-0">
                          <User className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{inquiry.fromUserName}</span>
                          {inquiry.shopName && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="truncate">{inquiry.shopName}</span>
                            </>
                          )}
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <button
                            onClick={() => handleReplyClick(inquiry)}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="返信する"
                          >
                            <Reply className="h-4 w-4" />
                          </button>
                          {inquiry.status === 'unread' && (
                            <button
                              onClick={() => handleMarkAsRead(inquiry.id, inquiry.status)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="確認済みにする"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          {inquiry.status !== 'resolved' && (
                            <button
                              onClick={() => handleMarkAsResolved(inquiry.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="解決済みにする"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:block">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {getStatusIcon(inquiry.status)}
                            {getRoleIcon(inquiry.fromRole)}
                            {getPriorityIcon(inquiry.priority)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(inquiry.status)}`}>
                                {inquiry.status === 'unread' ? '未読' : inquiry.status === 'read' ? '確認済み' : '解決済み'}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(inquiry.priority)}`}>
                                {inquiry.priority === 'urgent' ? '緊急' : inquiry.priority === 'high' ? '高' : inquiry.priority === 'normal' ? '通常' : '低'}
                              </span>
                              {repliedInquiries.has(inquiry.id) && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                                  <Reply className="h-3 w-3 mr-1" />
                                  返信済み
                                </span>
                              )}
                              <span className="text-xs text-gray-500">{inquiry.fromRole === 'manager' ? 'マネージャー' : 'スタッフ'}</span>
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatDate(inquiry.timestamp)}
                              </div>
                            </div>

                            <p className="text-base text-gray-900 mb-2 font-medium break-words">{inquiry.subject}</p>
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

                        <div className="flex-shrink-0 ml-4 flex space-x-1">
                          <button
                            onClick={() => handleReplyClick(inquiry)}
                            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors duration-200"
                            title="返信する"
                          >
                            <Reply className="h-4 w-4" />
                          </button>
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

        {/* Reply Modal */}
        {replyModalOpen && replyingToInquiry && (
          <div className="fixed inset-0 bg-gradient-to-br from-gray-900/20 via-slate-900/30 to-gray-800/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Reply className="h-5 w-5 mr-2 text-purple-600" />
                    返信を送信
                  </h3>
                  <button
                    onClick={() => setReplyModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Original Inquiry */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">元のお問い合わせ</h4>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2" />
                      {replyingToInquiry.fromUserName}
                      {replyingToInquiry.shopName && (
                        <>
                          <span className="mx-2">•</span>
                          <Building className="h-4 w-4 mr-1" />
                          {replyingToInquiry.shopName}
                        </>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{replyingToInquiry.subject}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{replyingToInquiry.message}</p>
                  </div>
                </div>

                {/* Reply Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    返信内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="お問い合わせへの返信を入力してください..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                    disabled={sendingReply}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {replyMessage.length}/1000文字
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyMessage.trim()}
                    className="flex-1 py-3 px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {sendingReply ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>送信中...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>返信を送信</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setReplyModalOpen(false)}
                    disabled={sendingReply}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}