'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { History, Clock, CheckCircle, Eye, AlertTriangle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ContactHistoryStorage, ContactHistoryEntry } from '@/lib/contactHistoryStorage';

type InquiryEntry = ContactHistoryEntry;

interface ContactHistoryProps {
  refreshTrigger?: number;
}

export default function ContactHistory({ refreshTrigger }: ContactHistoryProps) {
  const { currentUser } = useAuth();
  const [inquiries, setInquiries] = useState<InquiryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'resolved'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadInquiries = () => {
      if (!currentUser) {
        console.log('📋 No current user, skipping inquiry load');
        setLoading(false);
        return;
      }

      console.log('📋 Loading inquiries from localStorage for user:', currentUser.uid);

      try {
        const inquiriesData = ContactHistoryStorage.getHistory(currentUser.uid);
        setInquiries(inquiriesData);
        console.log(`📋 Loaded ${inquiriesData.length} inquiries from localStorage`);
      } catch (error) {
        console.error('❌ Error loading inquiries from localStorage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInquiries();
  }, [currentUser, refreshTrigger]);

  const filteredInquiries = inquiries.filter(inquiry => {
    if (filter === 'all') return true;
    return inquiry.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const configs = {
      unread: {
        style: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Clock,
        label: '未読'
      },
      read: {
        style: 'bg-green-100 text-green-800 border-green-200',
        icon: Eye,
        label: '確認済み'
      },
      resolved: {
        style: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: CheckCircle,
        label: '解決済み'
      }
    };

    const config = configs[status as keyof typeof configs];
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs rounded-full border ${config.style}`}>
        <IconComponent className="h-3 w-3" />
        <span>{config.label}</span>
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const configs = {
      low: { style: 'bg-green-50 text-green-700 border-green-200', label: '低' },
      normal: { style: 'bg-blue-50 text-blue-700 border-blue-200', label: '通常' },
      high: { style: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: '高' },
      urgent: { style: 'bg-red-50 text-red-700 border-red-200', label: '緊急' }
    };

    const config = configs[priority as keyof typeof configs];

    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${config.style}`}>
        {priority === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
        {config.label}
      </span>
    );
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      technical: '技術的問題',
      schedule: 'スケジュール',
      policy: 'ポリシー・規則',
      other: 'その他'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusCounts = () => {
    return {
      all: inquiries.length,
      unread: inquiries.filter(i => i.status === 'unread').length,
      read: inquiries.filter(i => i.status === 'read').length,
      resolved: inquiries.filter(i => i.status === 'resolved').length
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <span className="ml-3 text-gray-600">履歴を読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <History className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">送信履歴</h2>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'すべて', count: statusCounts.all },
              { key: 'unread', label: '未読', count: statusCounts.unread },
              { key: 'read', label: '確認済み', count: statusCounts.read },
              { key: 'resolved', label: '解決済み', count: statusCounts.resolved }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredInquiries.length === 0 ? (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            {filter === 'all'
              ? 'まだお問い合わせの送信履歴がありません'
              : `${filter === 'unread' ? '未読' : filter === 'read' ? '確認済み' : '解決済み'}のお問い合わせはありません`
            }
          </p>
          <p className="text-gray-400 mt-2">
            問題や質問がある場合は、上のフォームから送信してください
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <div key={inquiry.id} className="border border-gray-200 rounded-lg">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(inquiry.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900 flex-1 mr-4">{inquiry.subject}</h4>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {getStatusBadge(inquiry.status)}
                    {getPriorityBadge(inquiry.priority)}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {inquiry.message}
                </p>

                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>{format(inquiry.timestamp, 'yyyy年M月d日 HH:mm', { locale: ja })}</span>
                    <span>{getCategoryLabel(inquiry.category)}</span>
                  </div>

                  <div className="flex items-center space-x-4">
                    {inquiry.readAt && (
                      <span className="text-green-600">
                        確認済み: {format(inquiry.readAt, 'M月d日 HH:mm', { locale: ja })}
                      </span>
                    )}
                    {inquiry.resolvedAt && (
                      <span className="text-gray-600">
                        解決済み: {format(inquiry.resolvedAt, 'M月d日 HH:mm', { locale: ja })}
                      </span>
                    )}
                    <span className={`transform transition-transform ${expandedIds.has(inquiry.id) ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedIds.has(inquiry.id) && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <h5 className="font-medium text-gray-900 mb-2">詳細内容</h5>
                  <div className="whitespace-pre-wrap text-sm text-gray-700 bg-white p-3 rounded border">
                    {inquiry.message}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">カテゴリ:</span> {getCategoryLabel(inquiry.category)}
                    </div>
                    <div>
                      <span className="font-medium">優先度:</span> {inquiry.priority === 'urgent' ? '緊急' : inquiry.priority === 'high' ? '高' : inquiry.priority === 'normal' ? '通常' : '低'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}