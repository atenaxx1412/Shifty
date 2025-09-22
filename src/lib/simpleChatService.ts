import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  updateDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { LocalStorageManager } from './localStorageManager';

export interface SimpleChatRoom {
  id?: string;
  managerId: string;
  staffId: string;
  managerName: string;
  staffName: string;
  lastMessage?: {
    content: string;
    timestamp: Timestamp;
    senderId: string;
  };
  unreadCount: {
    [userId: string]: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SimpleChatMessage {
  id?: string;
  chatRoomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'manager' | 'staff';
  content: string;
  timestamp: Timestamp;
  read: boolean;
}

export class SimpleChatService {

  /**
   * 店長とスタッフ間のチャットルームを作成または取得
   */
  static async getOrCreateChatRoom(
    managerId: string,
    staffId: string,
    managerName: string,
    staffName: string
  ): Promise<SimpleChatRoom> {
    try {
      // 既存のチャットルームを検索
      const q = query(
        collection(db, 'simpleChatRooms'),
        where('managerId', '==', managerId),
        where('staffId', '==', staffId)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as SimpleChatRoom;
      }

      // 新しいチャットルームを作成
      const newRoom: Omit<SimpleChatRoom, 'id'> = {
        managerId,
        staffId,
        managerName,
        staffName,
        unreadCount: {
          [managerId]: 0,
          [staffId]: 0
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'simpleChatRooms'), newRoom);
      return { id: docRef.id, ...newRoom };
    } catch (error) {
      console.error('❌ Error creating/getting chat room:', error);
      throw error;
    }
  }

  /**
   * ユーザーのチャットルーム一覧を取得
   */
  static async getUserChatRooms(userId: string, userRole: 'manager' | 'staff'): Promise<SimpleChatRoom[]> {
    try {
      const fieldName = userRole === 'manager' ? 'managerId' : 'staffId';
      const q = query(
        collection(db, 'simpleChatRooms'),
        where(fieldName, '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleChatRoom));
    } catch (error) {
      console.error('❌ Error getting user chat rooms:', error);
      return [];
    }
  }

  /**
   * チャットルームをリアルタイムで監視
   */
  static subscribeToUserChatRooms(
    userId: string,
    userRole: 'manager' | 'staff',
    callback: (rooms: SimpleChatRoom[]) => void
  ): () => void {
    const fieldName = userRole === 'manager' ? 'managerId' : 'staffId';
    const q = query(
      collection(db, 'simpleChatRooms'),
      where(fieldName, '==', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleChatRoom));
      callback(rooms);
    }, (error) => {
      console.error('❌ Error in chat rooms subscription:', error);
    });
  }

  /**
   * メッセージを送信
   */
  static async sendMessage(
    chatRoomId: string,
    senderId: string,
    senderName: string,
    senderRole: 'manager' | 'staff',
    content: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const now = Timestamp.now();

      // メッセージを追加
      const messageRef = doc(collection(db, 'simpleChatMessages'));
      const message: SimpleChatMessage = {
        id: messageRef.id,
        chatRoomId,
        senderId,
        senderName,
        senderRole,
        content,
        timestamp: now,
        read: false
      };

      batch.set(messageRef, message);

      // チャットルームの最終メッセージと更新時刻を更新
      const chatRoomRef = doc(db, 'simpleChatRooms', chatRoomId);
      const chatRoom = await getDoc(chatRoomRef);

      if (chatRoom.exists()) {
        const roomData = chatRoom.data() as SimpleChatRoom;

        // 受信者の未読数をインクリメント
        const receiverId = senderRole === 'manager' ? roomData.staffId : roomData.managerId;

        batch.update(chatRoomRef, {
          lastMessage: {
            content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: now,
            senderId
          },
          [`unreadCount.${receiverId}`]: increment(1),
          updatedAt: now
        });
      }

      await batch.commit();
      console.log('✅ Message sent successfully');

      // ローカルストレージにメッセージを保存（1.5ヶ月TTL）
      this.saveMessageToLocalStorage(message);

      // プッシュ通知の送信
      await this.sendChatNotification(chatRoomId, senderId, senderName, senderRole, content, receiverId);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * チャットルームのメッセージをリアルタイムで監視（ローカルストレージ統合版）
   */
  static subscribeToMessages(
    chatRoomId: string,
    callback: (messages: SimpleChatMessage[]) => void
  ): () => void {
    // ローカルストレージからメッセージを初期読み込み
    const cachedMessages = this.getMessagesFromLocalStorage(chatRoomId);
    if (cachedMessages.length > 0) {
      callback(cachedMessages);
      console.log(`📖 Loaded ${cachedMessages.length} messages from local storage`);
    }

    const q = query(
      collection(db, 'simpleChatMessages'),
      where('chatRoomId', '==', chatRoomId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleChatMessage));

      // 新しいメッセージをローカルストレージに保存
      messages.forEach(message => {
        this.saveMessageToLocalStorage(message);
      });

      callback(messages);
    }, (error) => {
      console.error('❌ Error in messages subscription:', error);
    });
  }

  /**
   * チャットルームのメッセージを既読にする
   */
  static async markMessagesAsRead(chatRoomId: string, userId: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // 未読メッセージを取得
      const q = query(
        collection(db, 'simpleChatMessages'),
        where('chatRoomId', '==', chatRoomId),
        where('senderId', '!=', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);

      // 各メッセージを既読にする
      snapshot.forEach(doc => {
        batch.update(doc.ref, {
          read: true
        });
      });

      // チャットルームの未読数をリセット
      const chatRoomRef = doc(db, 'simpleChatRooms', chatRoomId);
      batch.update(chatRoomRef, {
        [`unreadCount.${userId}`]: 0
      });

      await batch.commit();
      console.log('✅ Messages marked as read');
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * 店長配下のスタッフ一覧を取得
   */
  static async getManagerStaff(managerId: string): Promise<{ id: string; name: string }[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'staff')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || 'スタッフ'
      }));
    } catch (error) {
      console.error('❌ Error getting manager staff:', error);
      return [];
    }
  }

  /**
   * ユーザーの総未読数を取得
   */
  static async getTotalUnreadCount(userId: string, userRole: 'manager' | 'staff'): Promise<number> {
    try {
      const rooms = await this.getUserChatRooms(userId, userRole);
      return rooms.reduce((total, room) => {
        return total + (room.unreadCount[userId] || 0);
      }, 0);
    } catch (error) {
      console.error('❌ Error getting total unread count:', error);
      return 0;
    }
  }

  /**
   * ユーザーの総未読数をリアルタイムで監視
   */
  static subscribeToTotalUnreadCount(
    userId: string,
    userRole: 'manager' | 'staff',
    callback: (count: number) => void
  ): () => void {
    return this.subscribeToUserChatRooms(userId, userRole, (rooms) => {
      const totalUnread = rooms.reduce((total, room) => {
        return total + (room.unreadCount[userId] || 0);
      }, 0);
      callback(totalUnread);
    });
  }

  /**
   * 1.5ヶ月制限付きメッセージ監視（最適化版）
   */
  static subscribeToMessagesWithLimit(
    chatRoomId: string,
    callback: (messages: SimpleChatMessage[]) => void
  ): () => void {
    // 1.5ヶ月前の日付を計算
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 45);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    const q = query(
      collection(db, 'simpleChatMessages'),
      where('chatRoomId', '==', chatRoomId),
      where('timestamp', '>=', cutoffTimestamp),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleChatMessage));
      callback(messages);
    }, (error) => {
      console.error('❌ Error in limited messages subscription:', error);
    });
  }

  /**
   * 指定日以降のメッセージを取得
   */
  static async getMessagesAfterDate(chatRoomId: string, afterDate: Date): Promise<SimpleChatMessage[]> {
    try {
      const cutoffTimestamp = Timestamp.fromDate(afterDate);

      const q = query(
        collection(db, 'simpleChatMessages'),
        where('chatRoomId', '==', chatRoomId),
        where('timestamp', '>=', cutoffTimestamp),
        orderBy('timestamp', 'asc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SimpleChatMessage));
    } catch (error) {
      console.error('❌ Error getting messages after date:', error);
      return [];
    }
  }

  /**
   * 1.5ヶ月より古いメッセージをクリーンアップ
   */
  static async cleanupOldMessages(): Promise<{ deletedCount: number }> {
    try {
      // 1.5ヶ月前の日付を計算
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 45);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      // 古いメッセージを検索
      const q = query(
        collection(db, 'simpleChatMessages'),
        where('timestamp', '<', cutoffTimestamp),
        limit(100) // バッチ処理で100件ずつ削除
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('🧹 No old messages to cleanup');
        return { deletedCount: 0 };
      }

      // バッチ削除
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      const deletedCount = snapshot.docs.length;

      console.log(`🧹 Cleaned up ${deletedCount} old chat messages`);

      // 100件削除した場合、まだ古いメッセージがある可能性があるので再帰的に実行
      if (deletedCount === 100) {
        const nextBatch = await this.cleanupOldMessages();
        return { deletedCount: deletedCount + nextBatch.deletedCount };
      }

      return { deletedCount };
    } catch (error) {
      console.error('❌ Error cleaning up old messages:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * 全チャットルームの古いメッセージを一括クリーンアップ
   */
  static async performGlobalMessageCleanup(): Promise<{
    roomsProcessed: number;
    totalDeleted: number;
  }> {
    try {
      console.log('🧹 Starting global chat message cleanup...');

      // すべてのチャットルームを取得
      const roomsSnapshot = await getDocs(collection(db, 'simpleChatRooms'));
      const rooms = roomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      let totalDeleted = 0;

      // 各ルームの古いメッセージをクリーンアップ
      for (const room of rooms) {
        const result = await this.cleanupOldMessages();
        totalDeleted += result.deletedCount;
      }

      console.log(`✅ Global cleanup completed: ${rooms.length} rooms processed, ${totalDeleted} messages deleted`);

      return {
        roomsProcessed: rooms.length,
        totalDeleted
      };
    } catch (error) {
      console.error('❌ Error in global message cleanup:', error);
      return { roomsProcessed: 0, totalDeleted: 0 };
    }
  }

  /**
   * チャット履歴統計情報を取得
   */
  static async getChatStatistics(): Promise<{
    totalRooms: number;
    totalMessages: number;
    oldMessages: number;
    averageMessagesPerRoom: number;
  }> {
    try {
      // チャットルーム数
      const roomsSnapshot = await getDocs(collection(db, 'simpleChatRooms'));
      const totalRooms = roomsSnapshot.size;

      // 全メッセージ数
      const messagesSnapshot = await getDocs(collection(db, 'simpleChatMessages'));
      const totalMessages = messagesSnapshot.size;

      // 1.5ヶ月前の日付
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 45);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      // 古いメッセージ数
      const oldMessagesQuery = query(
        collection(db, 'simpleChatMessages'),
        where('timestamp', '<', cutoffTimestamp)
      );
      const oldMessagesSnapshot = await getDocs(oldMessagesQuery);
      const oldMessages = oldMessagesSnapshot.size;

      return {
        totalRooms,
        totalMessages,
        oldMessages,
        averageMessagesPerRoom: totalRooms > 0 ? Math.round(totalMessages / totalRooms) : 0
      };
    } catch (error) {
      console.error('❌ Error getting chat statistics:', error);
      return {
        totalRooms: 0,
        totalMessages: 0,
        oldMessages: 0,
        averageMessagesPerRoom: 0
      };
    }
  }

  /**
   * チャット通知の送信
   */
  private static async sendChatNotification(
    chatRoomId: string,
    senderId: string,
    senderName: string,
    senderRole: 'manager' | 'staff',
    content: string,
    receiverId: string
  ): Promise<void> {
    try {
      // 動的インポートで循環依存を回避
      const { NotificationService } = await import('./notificationService');

      // 受信者の未読数を取得
      const unreadCount = await this.getTotalUnreadCount(receiverId, senderRole === 'manager' ? 'staff' : 'manager');

      const notificationData = {
        userId: receiverId,
        title: `${senderName}からメッセージ`,
        body: content.length > 50 ? content.substring(0, 50) + '...' : content,
        type: 'chat' as const,
        data: {
          chatRoomId,
          senderId,
          senderName,
          senderRole
        },
        badge: unreadCount + 1 // 新しいメッセージ分を追加
      };

      await NotificationService.sendNotification(notificationData);
    } catch (error) {
      console.error('❌ Error sending chat notification:', error);
      // 通知送信エラーはメッセージ送信を阻害しないようにする
    }
  }

  /**
   * メッセージをローカルストレージに保存
   */
  private static saveMessageToLocalStorage(message: SimpleChatMessage): void {
    try {
      const cacheKey = `chat_message_${message.id || message.chatRoomId}_${message.timestamp}`;

      // 1.5ヶ月のTTLでローカルストレージに保存
      LocalStorageManager.setWithExpiry(
        cacheKey,
        message,
        45 * 24 * 60 * 60 * 1000 // 1.5ヶ月
      );

      console.log(`💾 Message saved to local storage: ${message.id}`);
    } catch (error) {
      console.warn('⚠️ Failed to save message to local storage:', error);
    }
  }

  /**
   * ローカルストレージからメッセージを取得
   */
  private static getMessagesFromLocalStorage(chatRoomId: string): SimpleChatMessage[] {
    try {
      const messages: SimpleChatMessage[] = [];

      // ローカルストレージから該当するチャットルームのメッセージを検索
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`shifty_chat_message_${chatRoomId}`)) {
          const cached = LocalStorageManager.getWithExpiry<SimpleChatMessage>(
            key.replace('shifty_', '')
          );
          if (cached) {
            messages.push(cached);
          }
        }
      }

      // タイムスタンプ順にソート
      return messages.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
    } catch (error) {
      console.warn('⚠️ Failed to get messages from local storage:', error);
      return [];
    }
  }

  /**
   * 特定チャットルームのローカルストレージをクリア
   */
  static clearChatLocalStorage(chatRoomId: string): void {
    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`shifty_chat_message_${chatRoomId}`)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`🧹 Cleared ${keysToRemove.length} local messages for chat room: ${chatRoomId}`);
    } catch (error) {
      console.warn('⚠️ Failed to clear chat local storage:', error);
    }
  }

  /**
   * すべてのチャットローカルストレージをクリア
   */
  static clearAllChatLocalStorage(): void {
    LocalStorageManager.clearByPrefix('chat_');
    console.log('🧹 All chat local storage cleared');
  }
}