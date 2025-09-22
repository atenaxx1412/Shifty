import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/lib/notificationService';

interface NotificationState {
  isSupported: boolean;
  isPermissionGranted: boolean;
  isInitialized: boolean;
  fcmToken: string | null;
  unreadCount: number;
}

export function useNotifications() {
  const { currentUser } = useAuth();
  const [state, setState] = useState<NotificationState>({
    isSupported: false,
    isPermissionGranted: false,
    isInitialized: false,
    fcmToken: null,
    unreadCount: 0
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  // PWAサポートとPermissionの確認
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 'serviceWorker' in navigator && 'Notification' in window && typeof Notification !== 'undefined';
      const isPermissionGranted = isSupported && typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false;

      setState(prev => ({
        ...prev,
        isSupported,
        isPermissionGranted
      }));
    };

    checkSupport();
  }, []);

  // ユーザーログイン時の通知初期化
  useEffect(() => {
    if (!currentUser?.uid || !state.isSupported) return;

    const initNotifications = async () => {
      try {
        console.log('🔔 Initializing notifications for user:', currentUser.uid);

        const userRole = currentUser.role === 'manager' ? 'manager' : 'staff';
        const success = await NotificationService.initializeNotifications(
          currentUser.uid,
          userRole
        );

        if (success) {
          setState(prev => ({
            ...prev,
            isInitialized: true,
            isPermissionGranted: state.isSupported && typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false
          }));

          console.log('✅ Notifications initialized successfully');
        } else {
          console.log('❌ Failed to initialize notifications');
        }
      } catch (error) {
        console.error('❌ Error initializing notifications:', error);
      }
    };

    initNotifications();

    // クリーンアップ関数の登録
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      // Service Workerにバッジクリア通知
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_BADGE'
        });
      }
    };
  }, [currentUser?.uid, state.isSupported]);

  // アプリがアクティブになった時のバッジクリア
  useEffect(() => {
    const handleFocus = () => {
      if (state.isInitialized && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_BADGE'
        });
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isInitialized]);

  // 通知権限の要求
  const requestPermission = async (): Promise<boolean> => {
    if (!currentUser?.uid || !state.isSupported) {
      console.log('❌ Cannot request permission: user not logged in or not supported');
      return false;
    }

    try {
      const userRole = currentUser.role === 'manager' ? 'manager' : 'staff';
      const token = await NotificationService.requestPermissionAndGetToken(currentUser.uid);

      if (token) {
        setState(prev => ({
          ...prev,
          isPermissionGranted: true,
          fcmToken: token
        }));

        // 通知の初期化
        const success = await NotificationService.initializeNotifications(
          currentUser.uid,
          userRole
        );

        setState(prev => ({
          ...prev,
          isInitialized: success
        }));

        return success;
      }

      return false;
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return false;
    }
  };

  // バッジ数の更新
  const updateBadgeCount = (count: number) => {
    setState(prev => ({
      ...prev,
      unreadCount: count
    }));

    NotificationService.updateBadgeCount(count);

    // Service Workerにも通知
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_BADGE',
        count
      });
    }
  };

  // バッジのクリア
  const clearBadge = () => {
    updateBadgeCount(0);
  };

  return {
    ...state,
    requestPermission,
    updateBadgeCount,
    clearBadge,

    // 便利な計算済み値
    canRequestPermission: state.isSupported && !state.isPermissionGranted,
    isReady: state.isSupported && state.isPermissionGranted && state.isInitialized
  };
}