'use client';

import { useState } from 'react';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';
import { ContactHistoryStorage } from '@/lib/contactHistoryStorage';

interface ContactFormData {
  subject: string;
  message: string;
  category: 'technical' | 'schedule' | 'policy' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export default function ContactForm({ onSubmitSuccess }: { onSubmitSuccess?: () => void }) {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState<ContactFormData>({
    subject: '',
    message: '',
    category: 'other',
    priority: 'normal'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSubmitting(true);
    setError(null);

    try {
      // ユーザー情報取得
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();

      if (!userData) {
        throw new Error('ユーザー情報が見つかりません');
      }

      // お問い合わせ送信
      const timestamp = new Date();
      await addDoc(collection(db, 'inquiries'), {
        timestamp,
        fromRole: 'manager',
        fromUserId: currentUser.uid,
        fromUserName: userData.name || 'Unknown Manager',
        subject: formData.subject,
        message: formData.message,
        status: 'unread',
        category: formData.category,
        priority: formData.priority,
        shopName: userData.shopName || '',
        shopId: userData.shopId || currentUser.uid
      });

      // ローカルストレージに履歴を保存
      ContactHistoryStorage.addToHistory(currentUser.uid, {
        timestamp,
        subject: formData.subject,
        message: formData.message,
        status: 'unread',
        category: formData.category,
        priority: formData.priority
      });

      // フォームリセット
      setFormData({
        subject: '',
        message: '',
        category: 'other',
        priority: 'normal'
      });

      // 成功通知
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

      console.log('✅ お問い合わせが送信され、履歴に保存されました');
    } catch (error) {
      console.error('❌ Error submitting inquiry:', error);
      setError('送信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormChange = (field: keyof ContactFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      technical: '技術的問題',
      schedule: 'スケジュール',
      policy: 'ポリシー・規則',
      other: 'その他'
    };
    return labels[category as keyof typeof labels];
  };

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: '低',
      normal: '通常',
      high: '高',
      urgent: '緊急'
    };
    return labels[priority as keyof typeof labels];
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'text-green-600',
      normal: 'text-blue-600',
      high: 'text-yellow-600',
      urgent: 'text-red-600'
    };
    return colors[priority as keyof typeof colors];
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Send className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">お問い合わせ送信</h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            件名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.subject}
            onChange={(e) => handleFormChange('subject', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="お問い合わせ件名を入力"
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カテゴリ
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleFormChange('category', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              disabled={submitting}
            >
              <option value="technical">{getCategoryLabel('technical')}</option>
              <option value="schedule">{getCategoryLabel('schedule')}</option>
              <option value="policy">{getCategoryLabel('policy')}</option>
              <option value="other">{getCategoryLabel('other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              優先度
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleFormChange('priority', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              disabled={submitting}
            >
              <option value="low" className="text-green-600">{getPriorityLabel('low')}</option>
              <option value="normal" className="text-blue-600">{getPriorityLabel('normal')}</option>
              <option value="high" className="text-yellow-600">{getPriorityLabel('high')}</option>
              <option value="urgent" className="text-red-600">{getPriorityLabel('urgent')}</option>
            </select>
            <p className={`text-xs mt-1 ${getPriorityColor(formData.priority)}`}>
              選択済み: {getPriorityLabel(formData.priority)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={6}
            value={formData.message}
            onChange={(e) => handleFormChange('message', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-vertical"
            placeholder="お問い合わせ内容を詳しく入力してください"
            disabled={submitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.message.length}/1000文字
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting || !formData.subject.trim() || !formData.message.trim()}
            className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>送信中...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>お問い合わせを送信</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFormData({
              subject: '',
              message: '',
              category: 'other',
              priority: 'normal'
            })}
            disabled={submitting}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            リセット
          </button>
        </div>
      </form>
    </div>
  );
}