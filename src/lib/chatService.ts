import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChatMessage, ChatRoom, ChatNotification, User, UserRole } from '@/types';

class ChatService {
  private readonly CHAT_ROOMS_COLLECTION = 'chatRooms';
  private readonly CHAT_MESSAGES_COLLECTION = 'chatMessages';
  private readonly CHAT_NOTIFICATIONS_COLLECTION = 'chatNotifications';

  /**
   * 新しいチャットルームを作成
   */
  async createChatRoom(
    shopId: string,
    createdBy: User,
    participants: User[],
    roomType: 'direct' | 'group' | 'shift_discussion' | 'general',
    title?: string,
    relatedShiftId?: string
  ): Promise<ChatRoom> {
    const now = new Date();
    const chatRoomId = `${shopId}_${roomType}_${now.getTime()}`;

    // 参加者情報をマッピング
    const participantNames: Record<string, string> = {};
    const participantRoles: Record<string, UserRole> = {};
    const participantIds = participants.map(user => {
      participantNames[user.uid] = user.name;
      participantRoles[user.uid] = user.role;
      return user.uid;
    });

    // 作成者も参加者に含める
    if (!participantIds.includes(createdBy.uid)) {
      participantIds.push(createdBy.uid);
      participantNames[createdBy.uid] = createdBy.name;
      participantRoles[createdBy.uid] = createdBy.role;
    }

    // 未読数を初期化
    const unreadCount: Record<string, number> = {};
    participantIds.forEach(id => {
      unreadCount[id] = 0;
    });

    const chatRoom: ChatRoom = {
      chatRoomId,
      shopId,
      roomType,
      participants: participantIds,
      participantNames,
      participantRoles,
      title: title || this.generateRoomTitle(roomType, participants),
      ...(relatedShiftId && { relatedShiftId }), // 条件付きで追加
      unreadCount,
      isActive: true,
      createdBy: createdBy.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Firestore に保存 (undefined値を除外)
    const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);
    const roomData = {
      ...chatRoom,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // undefined値を除外
    Object.keys(roomData).forEach(key => {
      if (roomData[key] === undefined) {
        delete roomData[key];
      }
    });

    await setDoc(roomRef, roomData);

    // システムメッセージを送信
    await this.sendSystemMessage(
      chatRoomId,
      `${createdBy.name}さんがチャットルームを作成しました`,
      createdBy
    );

    console.log('💬 Chat room created:', {
      chatRoomId,
      roomType,
      participants: participantIds.length,
      title: chatRoom.title,
    });

    return chatRoom;
  }

  /**
   * シフト関連の直接チャットを作成/取得
   */
  async getOrCreateDirectChat(
    shopId: string,
    user1: User,
    user2: User,
    relatedShiftId?: string
  ): Promise<ChatRoom> {
    try {
      console.log('🚀 ChatService: getOrCreateDirectChat started', {
        shopId,
        user1: user1.name,
        user2: user2.name,
        relatedShiftId
      });

      // 既存の直接チャットを検索
      const existingRoom = await this.findExistingDirectChat(shopId, user1.uid, user2.uid);

      if (existingRoom) {
        console.log('✅ ChatService: Found existing room, returning it');
        // シフト関連の場合、関連シフトIDを更新
        if (relatedShiftId && !existingRoom.relatedShiftId) {
          await this.updateChatRoomShift(existingRoom.chatRoomId, relatedShiftId);
          existingRoom.relatedShiftId = relatedShiftId;
        }
        return existingRoom;
      }

      console.log('🛠️ ChatService: No existing room found, creating new one');
      // 新しい直接チャットを作成
      const newRoom = await this.createChatRoom(
        shopId,
        user1,
        [user2],
        'direct',
        undefined,
        relatedShiftId
      );
      console.log('✅ ChatService: New room created successfully:', newRoom.chatRoomId);
      return newRoom;
    } catch (error) {
      console.error('❌ ChatService: Error in getOrCreateDirectChat:', error);
      throw error;
    }
  }

  /**
   * スタッフ-マネージャー専用チャットルームを取得/作成
   * 1スタッフにつき1つのルームを保証
   */
  async getOrCreateStaffManagerRoom(
    roomId: string,
    staff: User,
    manager: User
  ): Promise<ChatRoom> {
    try {
      console.log('🔍 ChatService: Getting/Creating staff-manager room:', roomId);

      // 指定されたIDでルームを直接取得を試行
      const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, roomId);

      let roomExists = false;
      let existingRoomData = null;

      try {
        console.log('📖 ChatService: Checking if room exists');
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
          console.log('✅ ChatService: Found existing room:', roomId);
          roomExists = true;
          existingRoomData = roomSnap.data();
        } else {
          console.log('📝 ChatService: Room does not exist, will create new one');
        }
      } catch (getDocError) {
        console.log('⚠️ ChatService: Error checking room existence (probably offline):', getDocError);
        // If offline, we'll try to create the room anyway
        // The setDoc operation might succeed even if getDoc fails
      }

      if (roomExists && existingRoomData) {
        return {
          chatRoomId: existingRoomData.chatRoomId,
          shopId: existingRoomData.shopId,
          roomType: existingRoomData.roomType,
          participants: existingRoomData.participants,
          participantNames: existingRoomData.participantNames,
          participantRoles: existingRoomData.participantRoles,
          title: existingRoomData.title,
          description: existingRoomData.description,
          ...(existingRoomData.relatedShiftId && { relatedShiftId: existingRoomData.relatedShiftId }),
          lastMessage: existingRoomData.lastMessage,
          lastMessageTime: existingRoomData.lastMessageTime?.toDate?.() || null,
          lastMessageSender: existingRoomData.lastMessageSender,
          unreadCount: existingRoomData.unreadCount || {},
          isActive: existingRoomData.isActive,
          createdBy: existingRoomData.createdBy,
          createdAt: existingRoomData.createdAt?.toDate?.() || new Date(),
          updatedAt: existingRoomData.updatedAt?.toDate?.() || new Date(),
        } as ChatRoom;
      }

      console.log('🛠️ ChatService: Creating new room:', roomId);
      // ルームが存在しない場合は作成
      const now = new Date();
      const participantNames: Record<string, string> = {
        [staff.uid]: staff.name,
        [manager.uid]: manager.name
      };
      const participantRoles: Record<string, UserRole> = {
        [staff.uid]: staff.role,
        [manager.uid]: manager.role
      };
      const unreadCount: Record<string, number> = {
        [staff.uid]: 0,
        [manager.uid]: 0
      };

      const chatRoom: ChatRoom = {
        chatRoomId: roomId,
        shopId: manager.uid, // Use manager's ID as shopId
        roomType: 'direct',
        participants: [staff.uid, manager.uid],
        participantNames,
        participantRoles,
        title: `${staff.name} と ${manager.name}`,
        unreadCount,
        isActive: true,
        createdBy: staff.uid,
        createdAt: now,
        updatedAt: now,
      };

      // Firestore に保存 (undefined値を除外)
      const roomData = {
        ...chatRoom,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // undefined値を除外
      Object.keys(roomData).forEach(key => {
        if (roomData[key] === undefined) {
          delete roomData[key];
        }
      });

      try {
        await setDoc(roomRef, roomData);
        console.log('✅ ChatService: Room document created successfully');

        // システムメッセージを送信 (オフラインの場合は失敗してもOK)
        try {
          await this.sendSystemMessage(
            roomId,
            `${staff.name}さんと${manager.name}さんの会話が開始されました`,
            staff
          );
          console.log('✅ ChatService: System message sent');
        } catch (systemMessageError) {
          console.log('⚠️ ChatService: System message failed (probably offline):', systemMessageError);
          // システムメッセージの失敗は無視して続行
        }

        console.log('✅ ChatService: New room created:', roomId);
        return chatRoom;
      } catch (setDocError) {
        console.error('❌ ChatService: Failed to create room document:', setDocError);

        // オフラインエラーの場合でも、メモリ内のオブジェクトを返す
        if (setDocError.code === 'unavailable' || setDocError.message.includes('offline')) {
          console.log('📱 ChatService: Returning offline room object');
          return chatRoom;
        } else {
          throw setDocError;
        }
      }
    } catch (error) {
      console.error('❌ ChatService: Error in getOrCreateStaffManagerRoom:', error);
      throw error;
    }
  }

  /**
   * メッセージを送信
   */
  async sendMessage(
    chatRoomId: string,
    sender: User,
    message: string,
    messageType: 'text' | 'system' | 'shift_related' = 'text',
    relatedShiftId?: string,
    relatedData?: Record<string, any>
  ): Promise<ChatMessage> {
    try {
      console.log('📨 ChatService: sendMessage called', {
        chatRoomId,
        sender: sender.name,
        messageLength: message.length,
        messageType
      });

      const now = new Date();
      const messageId = `${chatRoomId}_${sender.uid}_${now.getTime()}`;

      const chatMessage: ChatMessage = {
        messageId,
        chatRoomId,
        senderId: sender.uid,
        senderName: sender.name,
        senderRole: sender.role,
        message,
        messageType,
        ...(relatedShiftId && { relatedShiftId }),
        ...(relatedData && { relatedData }),
        isRead: false,
        readBy: [sender.uid], // 送信者は既読
        createdAt: now,
        updatedAt: now,
      };

      console.log('💾 ChatService: Saving message to Firestore');

      // Firestore にメッセージを保存 (undefined値を除外)
      const messageRef = doc(db, this.CHAT_MESSAGES_COLLECTION, messageId);
      const messageData = {
        ...chatMessage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // undefined値を除外
      Object.keys(messageData).forEach(key => {
        if (messageData[key] === undefined) {
          delete messageData[key];
        }
      });

      await setDoc(messageRef, messageData);
      console.log('✅ ChatService: Message saved to Firestore');

      // チャットルームの最新メッセージ情報を更新
      console.log('🔄 ChatService: Updating chat room last message');
      await this.updateChatRoomLastMessage(chatRoomId, message, sender.name, now, sender.uid);

      // 他の参加者に通知を送信
      console.log('🔔 ChatService: Sending notifications');
      await this.sendMessageNotifications(chatRoomId, messageId, sender, message);

      console.log('✅ ChatService: Message sent successfully:', {
        messageId,
        chatRoomId,
        sender: sender.name,
        messageType,
        length: message.length,
      });

      return chatMessage;
    } catch (error) {
      console.error('❌ ChatService: Error in sendMessage:', error);
      throw error;
    }
  }

  /**
   * システムメッセージを送信
   */
  async sendSystemMessage(
    chatRoomId: string,
    message: string,
    triggeredBy: User,
    relatedShiftId?: string
  ): Promise<ChatMessage> {
    return await this.sendMessage(
      chatRoomId,
      {
        ...triggeredBy,
        name: 'システム',
      },
      message,
      'system',
      relatedShiftId
    );
  }

  /**
   * シフト関連メッセージを送信
   */
  async sendShiftRelatedMessage(
    chatRoomId: string,
    sender: User,
    message: string,
    shiftId: string,
    relatedData?: Record<string, any>
  ): Promise<ChatMessage> {
    return await this.sendMessage(
      chatRoomId,
      sender,
      message,
      'shift_related',
      shiftId,
      relatedData
    );
  }

  /**
   * チャットルームのメッセージを取得
   */
  async getChatMessages(
    chatRoomId: string,
    limitCount: number = 50,
    beforeTimestamp?: Date
  ): Promise<ChatMessage[]> {
    const messagesRef = collection(db, this.CHAT_MESSAGES_COLLECTION);
    
    // Temporarily remove orderBy to avoid index requirement
    let q = query(
      messagesRef,
      where('chatRoomId', '==', chatRoomId),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        messageId: data.messageId,
        chatRoomId: data.chatRoomId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderRole: data.senderRole,
        message: data.message,
        messageType: data.messageType,
        relatedShiftId: data.relatedShiftId,
        relatedData: data.relatedData,
        isRead: data.isRead,
        readBy: data.readBy || [],
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as ChatMessage;
    }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // Client-side sorting by createdAt
  }

  /**
   * ユーザーのチャットルーム一覧を取得
   */
  async getUserChatRooms(userId: string, shopId: string): Promise<ChatRoom[]> {
    const roomsRef = collection(db, this.CHAT_ROOMS_COLLECTION);
    
    const q = query(
      roomsRef,
      where('shopId', '==', shopId),
      where('participants', 'array-contains', userId),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        chatRoomId: data.chatRoomId,
        shopId: data.shopId,
        roomType: data.roomType,
        participants: data.participants,
        participantNames: data.participantNames,
        participantRoles: data.participantRoles,
        title: data.title,
        description: data.description,
        relatedShiftId: data.relatedShiftId,
        lastMessage: data.lastMessage,
        lastMessageTime: data.lastMessageTime?.toDate?.() || null,
        lastMessageSender: data.lastMessageSender,
        unreadCount: data.unreadCount || {},
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as ChatRoom;
    });
  }

  /**
   * メッセージをリアルタイムで監視
   */
  subscribeToMessages(
    chatRoomId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    console.log('🔄 ChatService: subscribeToMessages called for room:', chatRoomId);

    const messagesRef = collection(db, this.CHAT_MESSAGES_COLLECTION);

    // Temporarily remove orderBy to avoid index requirement
    const q = query(
      messagesRef,
      where('chatRoomId', '==', chatRoomId),
      limit(50)
    );

    return onSnapshot(q,
      (snapshot) => {
        console.log('📡 ChatService: Message subscription callback fired');
        console.log('📡 ChatService: Snapshot docs count:', snapshot.docs.length);
        console.log('📡 ChatService: Query chatRoomId:', chatRoomId);

        const messages = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('📄 ChatService: Processing message doc:', {
            messageId: data.messageId,
            chatRoomId: data.chatRoomId,
            senderName: data.senderName,
            message: data.message,
            createdAt: data.createdAt
          });

          return {
            messageId: data.messageId,
            chatRoomId: data.chatRoomId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            message: data.message,
            messageType: data.messageType,
            relatedShiftId: data.relatedShiftId,
            relatedData: data.relatedData,
            isRead: data.isRead,
            readBy: data.readBy || [],
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as ChatMessage;
        }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()); // Client-side sorting by createdAt

        console.log('📨 ChatService: Processed messages:', messages.length);
        callback(messages);
      },
      (error) => {
        console.error('❌ ChatService: subscribeToMessages error:', error);
        callback([]); // Empty array on error
      }
    );
  }

  /**
   * チャットルーム一覧をリアルタイムで監視
   */
  subscribeToChatRooms(
    userId: string,
    shopId: string,
    callback: (rooms: ChatRoom[]) => void
  ): () => void {
    const roomsRef = collection(db, this.CHAT_ROOMS_COLLECTION);
    
    const q = query(
      roomsRef,
      where('shopId', '==', shopId),
      where('participants', 'array-contains', userId),
      where('isActive', '==', true)
    );

    return onSnapshot(q,
      (snapshot) => {
        console.log('📡 ChatService: subscribeToChatRooms callback - snapshot received');
        console.log('📡 ChatService: Snapshot docs count:', snapshot.docs.length);
        console.log('📡 ChatService: Query params - shopId:', shopId, 'userId:', userId);

        const rooms = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            chatRoomId: data.chatRoomId,
            shopId: data.shopId,
            roomType: data.roomType,
            participants: data.participants,
            participantNames: data.participantNames,
            participantRoles: data.participantRoles,
            title: data.title,
            description: data.description,
            relatedShiftId: data.relatedShiftId,
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime?.toDate?.() || null,
            lastMessageSender: data.lastMessageSender,
            unreadCount: data.unreadCount || {},
            isActive: data.isActive,
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as ChatRoom;
        });

        console.log('📡 ChatService: Mapped rooms count:', rooms.length);
        callback(rooms);
      },
      (error) => {
        console.error('❌ ChatService: subscribeToChatRooms error:', error);
        // Still call callback with empty array to prevent infinite loading
        callback([]);
      }
    );
  }

  /**
   * メッセージを既読にする
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    const messageRef = doc(db, this.CHAT_MESSAGES_COLLECTION, messageId);
    
    await updateDoc(messageRef, {
      readBy: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * チャットルームの全メッセージを既読にする
   */
  async markChatRoomAsRead(chatRoomId: string, userId: string): Promise<void> {
    // チャットルームの未読数をリセット
    const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);
    await updateDoc(roomRef, {
      [`unreadCount.${userId}`]: 0,
      updatedAt: serverTimestamp(),
    });

    console.log('👁️ Chat room marked as read:', { chatRoomId, userId });
  }

  // ========== PRIVATE METHODS ==========

  /**
   * 既存の直接チャットを検索
   */
  private async findExistingDirectChat(
    shopId: string,
    user1Id: string,
    user2Id: string
  ): Promise<ChatRoom | null> {
    console.log('🔍 ChatService: Finding existing direct chat', { shopId, user1Id, user2Id });

    const roomsRef = collection(db, this.CHAT_ROOMS_COLLECTION);

    // Simplified query to avoid composite index issues
    const q = query(
      roomsRef,
      where('shopId', '==', shopId),
      where('participants', 'array-contains', user1Id)
    );

    try {
      const querySnapshot = await getDocs(q);
      console.log('🔍 ChatService: Found rooms:', querySnapshot.docs.length);

      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        console.log('🔍 ChatService: Checking room:', {
          chatRoomId: data.chatRoomId,
          roomType: data.roomType,
          participants: data.participants,
          isActive: data.isActive
        });

        // Filter in JavaScript to avoid composite index
        if (
          data.roomType === 'direct' &&
          data.isActive === true &&
          data.participants.includes(user2Id) &&
          data.participants.length === 2
        ) {
          console.log('✅ ChatService: Found existing direct chat:', data.chatRoomId);
          return {
            chatRoomId: data.chatRoomId,
            shopId: data.shopId,
            roomType: data.roomType,
            participants: data.participants,
            participantNames: data.participantNames,
            participantRoles: data.participantRoles,
            title: data.title,
            description: data.description,
            relatedShiftId: data.relatedShiftId,
            lastMessage: data.lastMessage,
            lastMessageTime: data.lastMessageTime?.toDate?.() || null,
            lastMessageSender: data.lastMessageSender,
            unreadCount: data.unreadCount || {},
            isActive: data.isActive,
            createdBy: data.createdBy,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          } as ChatRoom;
        }
      }

      console.log('🔍 ChatService: No existing direct chat found');
      return null;
    } catch (error) {
      console.error('❌ ChatService: Error finding existing direct chat:', error);
      return null;
    }
  }

  /**
   * ルームタイトルを生成
   */
  private generateRoomTitle(roomType: string, participants: User[]): string {
    switch (roomType) {
      case 'direct':
        return participants.map(p => p.name).join(' と ');
      case 'shift_discussion':
        return 'シフト相談';
      case 'group':
        return `グループチャット (${participants.length}人)`;
      case 'general':
        return '全体チャット';
      default:
        return 'チャット';
    }
  }

  /**
   * チャットルームの最新メッセージ情報を更新
   */
  private async updateChatRoomLastMessage(
    chatRoomId: string,
    message: string,
    senderName: string,
    timestamp: Date,
    senderId: string
  ): Promise<void> {
    try {
      console.log('🔄 ChatService: updateChatRoomLastMessage called', { chatRoomId, senderName });

      const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);

      console.log('📖 ChatService: Getting room document');
      // 他の参加者の未読数を増加
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        console.log('❌ ChatService: Room not found:', chatRoomId);
        return;
      }

      console.log('✅ ChatService: Room found, updating unread counts');
      const roomData = roomSnap.data();
      const participants = roomData.participants || [];
      const currentUnreadCount = roomData.unreadCount || {};

      // 送信者以外の未読数を増加
      const updatedUnreadCount = { ...currentUnreadCount };
      participants.forEach((participantId: string) => {
        if (participantId !== senderId) {
          updatedUnreadCount[participantId] = (updatedUnreadCount[participantId] || 0) + 1;
        }
      });

      console.log('💾 ChatService: Updating room document with last message');

      await updateDoc(roomRef, {
        lastMessage: message.length > 50 ? message.substring(0, 47) + '...' : message,
        lastMessageTime: Timestamp.fromDate(timestamp),
        lastMessageSender: senderName,
        unreadCount: updatedUnreadCount,
        updatedAt: serverTimestamp(),
      });

      console.log('✅ ChatService: Room last message updated successfully');
    } catch (error) {
      console.error('❌ ChatService: Error updating room last message:', error);
      throw error;
    }
  }

  /**
   * メッセージ通知を送信
   */
  private async sendMessageNotifications(
    chatRoomId: string,
    messageId: string,
    sender: User,
    message: string
  ): Promise<void> {
    // 実装を簡略化 - 実際の通知システムと連携する場合はここで実装
    console.log('🔔 Message notification sent:', {
      chatRoomId,
      messageId,
      sender: sender.name,
      message: message.length > 50 ? message.substring(0, 47) + '...' : message,
    });
  }

  /**
   * チャットルームのシフト関連情報を更新
   */
  private async updateChatRoomShift(chatRoomId: string, shiftId: string): Promise<void> {
    const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);
    await updateDoc(roomRef, {
      relatedShiftId: shiftId,
      updatedAt: serverTimestamp(),
    });
  }
}

export const chatService = new ChatService();