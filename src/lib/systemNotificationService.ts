import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  doc,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface SystemNotification {
  id: string;
  type: 'user_registration' | 'security_alert' | 'system_error' | 'maintenance' | 'statistics' | 'database';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  userId?: string; // For user-specific notifications
  metadata?: any; // Additional data
}

export const SystemNotificationService = {
  // リアルタイムで通知を取得
  subscribeToNotifications: (callback: (notifications: SystemNotification[]) => void, limitCount: number = 5) => {
    const notificationsRef = collection(db, 'systemNotifications');
    const q = query(
      notificationsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          timestamp: data.timestamp?.toDate() || new Date(),
          read: data.read || false,
          priority: data.priority || 'medium',
          userId: data.userId,
          metadata: data.metadata
        } as SystemNotification;
      });
      callback(notifications);
    });
  },

  // 未読通知数を取得
  subscribeToUnreadCount: (callback: (count: number) => void) => {
    const notificationsRef = collection(db, 'systemNotifications');
    const q = query(
      notificationsRef,
      where('read', '==', false)
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.size);
    });
  },

  // 通知を既読にする
  markAsRead: async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'systemNotifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  // 全ての通知を既読にする
  markAllAsRead: async () => {
    try {
      // This would need to be implemented with a cloud function for better performance
      // For now, we'll just log the intention
      console.log('Mark all notifications as read - would need cloud function implementation');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  // 新しい通知を作成
  createNotification: async (notification: Omit<SystemNotification, 'id' | 'timestamp'>) => {
    try {
      const notificationsRef = collection(db, 'systemNotifications');
      await addDoc(notificationsRef, {
        ...notification,
        timestamp: serverTimestamp(),
        read: false
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  },

  // 通知タイプに応じたアイコンとスタイルを取得
  getNotificationStyle: (type: SystemNotification['type'], priority: SystemNotification['priority']) => {
    const styles = {
      user_registration: {
        icon: '👤',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-200'
      },
      security_alert: {
        icon: '🛡️',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-200'
      },
      system_error: {
        icon: '⚠️',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-200'
      },
      maintenance: {
        icon: '🔧',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-200'
      },
      statistics: {
        icon: '📊',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-200'
      },
      database: {
        icon: '💾',
        bgColor: 'bg-purple-100',
        textColor: 'text-purple-800',
        borderColor: 'border-purple-200'
      }
    };

    return styles[type] || styles.system_error;
  },

  // 相対時間を取得
  getRelativeTime: (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP');
  }
};

// サンプル通知データを作成するヘルパー
export const createSampleNotifications = async () => {
  const sampleNotifications = [
    {
      type: 'user_registration' as const,
      title: '新しい店長が登録されました',
      message: '田中太郎さんが新しい店長として登録されました',
      priority: 'medium' as const
    },
    {
      type: 'security_alert' as const,
      title: 'セキュリティアラート',
      message: '複数回のログイン失敗が検出されました',
      priority: 'high' as const
    },
    {
      type: 'system_error' as const,
      title: 'システムエラー',
      message: 'バックアップ処理でエラーが発生しました',
      priority: 'critical' as const
    },
    {
      type: 'maintenance' as const,
      title: 'メンテナンス予定',
      message: '9月15日 2:00-4:00にシステムメンテナンスを実施します',
      priority: 'medium' as const
    },
    {
      type: 'statistics' as const,
      title: 'ユーザー数が100名を突破',
      message: 'システム利用者数が100名を超えました',
      priority: 'low' as const
    }
  ];

  for (const notification of sampleNotifications) {
    await SystemNotificationService.createNotification(notification);
  }
};