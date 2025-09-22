import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { messaging } from './firebase';
import { doc, setDoc, getDoc, collection, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface FCMToken {
  id?: string;
  userId: string;
  token: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  userAgent: string;
  createdAt: Timestamp;
  lastUsed: Timestamp;
  isActive: boolean;
}

export interface NotificationData {
  userId: string;
  title: string;
  body: string;
  type: 'chat' | 'shift' | 'system';
  data?: {
    chatRoomId?: string;
    senderId?: string;
    senderName?: string;
    [key: string]: any;
  };
  badge?: number;
}

export class NotificationService {
  private static vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  /**
   * 通知権限を要求し、FCMトークンを取得
   */
  static async requestPermissionAndGetToken(userId: string): Promise<string | null> {
    try {
      // 通知権限の確認・要求
      if ('Notification' in window && typeof Notification !== 'undefined') {
        let permission;
        try {
          permission = Notification.permission;

          if (permission === 'default') {
            permission = await Notification.requestPermission();
          }
        } catch (error) {
          console.warn('Notification permission check failed:', error);
          permission = 'denied';
        }

        if (permission !== 'granted') {
          console.log('❌ Notification permission denied');
          return null;
        }
      } else {
        console.log('🔔 Notification API not available on this device');
        // モバイルなど通知機能がない場合でもFCMトークンは取得する
      }

      // Service Worker登録の確認
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          console.log('❌ Service Worker not registered');
          return null;
        }
      }

      // FCMトークンの取得
      if (!messaging) {
        console.log('❌ Firebase Messaging not supported');
        return null;
      }

      const currentToken = await getToken(messaging, {
        vapidKey: this.vapidKey,
      });

      if (currentToken) {
        console.log('✅ FCM Token obtained:', currentToken);

        // トークンをFirestoreに保存
        await this.saveTokenToFirestore(userId, currentToken);

        return currentToken;
      } else {
        console.log('❌ No registration token available');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * FCMトークンをFirestoreに保存
   */
  private static async saveTokenToFirestore(userId: string, token: string): Promise<void> {
    try {
      const deviceType = this.detectDeviceType();
      const userAgent = navigator.userAgent;

      const tokenData: Omit<FCMToken, 'id'> = {
        userId,
        token,
        deviceType,
        userAgent,
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
        isActive: true
      };

      // トークンIDとしてトークンのハッシュを使用
      const tokenId = btoa(token).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

      await setDoc(doc(db, 'fcmTokens', tokenId), tokenData, { merge: true });
      console.log('✅ FCM token saved to Firestore');
    } catch (error) {
      console.error('❌ Error saving FCM token:', error);
    }
  }

  /**
   * デバイス種別の判定
   */
  private static detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent;

    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }

    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }

    return 'desktop';
  }

  /**
   * フォアグラウンドメッセージの監視
   */
  static setupForegroundMessageListener(): () => void {
    if (!messaging) {
      console.log('❌ Firebase Messaging not available');
      return () => {};
    }

    return onMessage(messaging, (payload: MessagePayload) => {
      console.log('📱 Foreground message received:', payload);

      // フォアグラウンドでの通知表示
      if (payload.notification) {
        this.showLocalNotification(
          payload.notification.title || 'Shifty',
          payload.notification.body || '',
          payload.data
        );
      }

      // バッジ数の更新
      if (payload.data?.badge) {
        this.updateBadgeCount(parseInt(payload.data.badge));
      }

      // チャット画面が開いている場合は音声通知のみ
      if (window.location.pathname.includes('/chat')) {
        this.playNotificationSound();
      }
    });
  }

  /**
   * ローカル通知の表示
   */
  private static showLocalNotification(title: string, body: string, data?: any): void {
    if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/images/pwa-icon-192.png',
          badge: '/images/pwa-icon-192.png',
          tag: data?.chatRoomId || 'general',
          data
        });

        notification.onclick = () => {
          window.focus();
          if (data?.chatRoomId) {
            window.location.href = `/manager/chat?room=${data.chatRoomId}`;
          }
          notification.close();
        };

        // 5秒後に自動的に閉じる
        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        console.warn('Failed to show notification:', error);
      }
    } else {
      console.log('🔔 Notification not available, showing fallback alert');
      // フォールバック: 簡単なアラート音のみ
      this.playNotificationSound();
    }
  }

  /**
   * 通知音の再生
   */
  private static playNotificationSound(): void {
    try {
      // ブラウザの基本的な通知音
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAaBDuF1+/EdCMHKIHG6tf/AAA=');
      audio.volume = 0.3;
      audio.play().catch(console.warn);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }

  /**
   * バッジ数の更新
   */
  static updateBadgeCount(count: number): void {
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          (navigator as any).setAppBadge(count);
        } else {
          (navigator as any).clearAppBadge();
        }
      }

      // Favicon badge as fallback
      this.updateFaviconBadge(count);
    } catch (error) {
      console.warn('Could not update app badge:', error);
    }
  }

  /**
   * Faviconバッジの更新（フォールバック）
   */
  private static updateFaviconBadge(count: number): void {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 32;
      canvas.height = 32;

      // ベースのアイコンを描画（簡易版）
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(0, 0, 32, 32);

      // バッジの描画
      if (count > 0) {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(24, 8, 8, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(count.toString(), 24, 12);
      }

      // Faviconの更新
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = canvas.toDataURL();
      }
    } catch (error) {
      console.warn('Could not update favicon badge:', error);
    }
  }

  /**
   * ユーザーの総未読数を監視してバッジを更新
   */
  static setupBadgeUpdateListener(userId: string, userRole: 'manager' | 'staff'): () => void {
    // SimpleChatServiceのimportは動的に行う（循環依存回避）
    const setupListener = async () => {
      const { SimpleChatService } = await import('./simpleChatService');

      return SimpleChatService.subscribeToTotalUnreadCount(
        userId,
        userRole,
        (count) => {
          this.updateBadgeCount(count);
        }
      );
    };

    let unsubscribe: (() => void) | null = null;

    setupListener().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  /**
   * プッシュ通知の送信（サーバーサイドで使用）
   */
  static async sendNotification(notificationData: NotificationData): Promise<void> {
    try {
      // 実際の実装では、Cloud Functions や サーバーサイドでFCM Admin SDKを使用
      console.log('📤 Sending notification:', notificationData);

      // ここではクライアント側での疑似実装
      // 実際のプロダクションでは、サーバーサイドのAPI呼び出しになる
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
      });
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  }

  /**
   * トークンの無効化
   */
  static async invalidateToken(userId: string, token: string): Promise<void> {
    try {
      const tokenId = btoa(token).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      await updateDoc(doc(db, 'fcmTokens', tokenId), {
        isActive: false,
        lastUsed: Timestamp.now()
      });
    } catch (error) {
      console.error('❌ Error invalidating token:', error);
    }
  }

  /**
   * 通知設定の初期化
   */
  static async initializeNotifications(userId: string, userRole: 'manager' | 'staff'): Promise<boolean> {
    try {
      console.log('🔔 Initializing notifications for user:', userId);

      // FCMトークンの取得
      const token = await this.requestPermissionAndGetToken(userId);
      if (!token) {
        console.log('❌ Could not get FCM token');
        return false;
      }

      // フォアグラウンドメッセージの監視開始
      const unsubscribeMessages = this.setupForegroundMessageListener();

      // バッジ更新の監視開始
      const unsubscribeBadge = this.setupBadgeUpdateListener(userId, userRole);

      // クリーンアップ関数をグローバルに保存
      (window as any).notificationCleanup = () => {
        unsubscribeMessages();
        unsubscribeBadge();
      };

      console.log('✅ Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
      return false;
    }
  }
}