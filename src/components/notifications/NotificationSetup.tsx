'use client';

import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, BellOff, X, Check } from 'lucide-react';

export default function NotificationSetup() {
  const { currentUser } = useAuth();
  const {
    isSupported,
    isPermissionGranted,
    isInitialized,
    canRequestPermission,
    requestPermission
  } = useNotifications();

  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasShownPrompt, setHasShownPrompt] = useState(false);

  // 通知権限のプロンプト表示ロジック
  useEffect(() => {
    if (!currentUser?.uid || hasShownPrompt) return;

    // 数秒待ってからプロンプトを表示（ユーザビリティのため）
    const timer = setTimeout(() => {
      if (canRequestPermission) {
        setShowPrompt(true);
        setHasShownPrompt(true);
      }
    }, 3000); // 3秒後に表示

    return () => clearTimeout(timer);
  }, [currentUser?.uid, canRequestPermission, hasShownPrompt]);

  // 通知権限の要求
  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const success = await requestPermission();
      if (success) {
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  // プロンプトを閉じる
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  // ローカルストレージから前回の拒否をチェック
  useEffect(() => {
    const dismissed = localStorage.getItem('notification-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      if (dismissedTime > oneDayAgo) {
        setHasShownPrompt(true);
      }
    }
  }, []);

  // 通知が不要な場合は何も表示しない
  if (!currentUser?.uid || !isSupported) {
    return null;
  }

  // 通知許可プロンプト
  if (showPrompt && canRequestPermission) {
    return (
      <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-slide-up">
        <div className="flex items-start space-x-3">
          <div className="bg-blue-100 p-2 rounded-full">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              通知を有効にしませんか？
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              新しいメッセージやシフト更新を即座に受け取れます
            </p>
            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                <span>{isRequesting ? '設定中...' : '有効にする'}</span>
              </button>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700 px-2 py-1.5 text-xs"
              >
                後で
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // 通知状況の表示（デバッグ用、本番では非表示にしても良い）
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 left-4 bg-gray-800 text-white text-xs p-3 rounded-lg max-w-xs z-40 opacity-80">
        <div className="flex items-center space-x-2 mb-2">
          {isPermissionGranted ? (
            <Bell className="h-4 w-4 text-green-400" />
          ) : (
            <BellOff className="h-4 w-4 text-gray-400" />
          )}
          <span className="font-medium">通知状況</span>
        </div>
        <div className="space-y-1 text-xs">
          <div>サポート: {isSupported ? '✅' : '❌'}</div>
          <div>権限: {isPermissionGranted ? '✅' : '❌'}</div>
          <div>初期化: {isInitialized ? '✅' : '❌'}</div>
        </div>
      </div>
    );
  }

  return null;
}