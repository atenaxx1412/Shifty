'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import StaffContactForm from './components/StaffContactForm';
import StaffContactHistory from './components/StaffContactHistory';
import { MessageSquare, Send, History, CheckCircle } from 'lucide-react';

export default function StaffContactPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSubmitSuccess = () => {
    setShowSuccessMessage(true);
    // 履歴を更新
    setRefreshTrigger(prev => prev + 1);

    // 成功メッセージを3秒後に非表示
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 3000);

    // 履歴タブに自動切り替え（2秒後）
    setTimeout(() => {
      setActiveTab('history');
    }, 2000);
  };

  return (
    <ProtectedRoute requiredRoles={['root', 'manager', 'staff']}>
      <div className="h-screen overflow-hidden bg-gray-50 animate-page-enter">
        <AppHeader title="お問い合わせ" />

        <main className="px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Success Message */}
            {showSuccessMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-slide-up">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="text-green-800 font-medium">お問い合わせが送信されました</p>
                    <p className="text-green-700 text-sm">管理者が確認次第、対応いたします。</p>
                  </div>
                </div>
              </div>
            )}

            {/* Header Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-4 mb-4">
                <MessageSquare className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">お問い合わせ</h1>
                  <p className="text-gray-600">技術的な問題や質問を管理者に送信できます</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                    activeTab === 'form'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Send className="h-4 w-4" />
                  <span>新規送信</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                    activeTab === 'history'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>送信履歴</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
              {activeTab === 'form' ? (
                <StaffContactForm onSubmitSuccess={handleSubmitSuccess} />
              ) : (
                <StaffContactHistory refreshTrigger={refreshTrigger} />
              )}
            </div>

            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">お問い合わせについて</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium mb-2">📋 カテゴリについて</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• <strong>技術的問題</strong>: アプリの不具合やエラー</li>
                    <li>• <strong>スケジュール</strong>: シフト関連の問題</li>
                    <li>• <strong>ポリシー・規則</strong>: 運用ルールに関する質問</li>
                    <li>• <strong>その他</strong>: 上記以外の質問</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">⚡ 優先度について</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>• <strong>緊急</strong>: 業務に大きな影響がある問題</li>
                    <li>• <strong>高</strong>: 早急な対応が必要</li>
                    <li>• <strong>通常</strong>: 一般的な質問や要望</li>
                    <li>• <strong>低</strong>: 急ぎではない改善提案</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
                <p className="text-sm text-blue-800">
                  <strong>💡 ヒント:</strong> 問題の詳細（発生した画面、操作手順、エラーメッセージなど）を具体的に記載いただくと、
                  より迅速で正確な対応が可能です。
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}