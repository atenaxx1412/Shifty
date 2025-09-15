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
      relatedShiftId,
      unreadCount,
      isActive: true,
      createdBy: createdBy.uid,
      createdAt: now,
      updatedAt: now,
    };

    // Firestore に保存
    const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);
    await setDoc(roomRef, {
      ...chatRoom,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
    // 既存の直接チャットを検索
    const existingRoom = await this.findExistingDirectChat(shopId, user1.uid, user2.uid);
    
    if (existingRoom) {
      // シフト関連の場合、関連シフトIDを更新
      if (relatedShiftId && !existingRoom.relatedShiftId) {
        await this.updateChatRoomShift(existingRoom.chatRoomId, relatedShiftId);
        existingRoom.relatedShiftId = relatedShiftId;
      }
      return existingRoom;
    }

    // 新しい直接チャットを作成
    return await this.createChatRoom(
      shopId,
      user1,
      [user2],
      'direct',
      undefined,
      relatedShiftId
    );
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
      relatedShiftId,
      relatedData,
      isRead: false,
      readBy: [sender.uid], // 送信者は既読
      createdAt: now,
      updatedAt: now,
    };

    // Firestore にメッセージを保存
    const messageRef = doc(db, this.CHAT_MESSAGES_COLLECTION, messageId);
    await setDoc(messageRef, {
      ...chatMessage,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // チャットルームの最新メッセージ情報を更新
    await this.updateChatRoomLastMessage(chatRoomId, message, sender.name, now, sender.uid);

    // 他の参加者に通知を送信
    await this.sendMessageNotifications(chatRoomId, messageId, sender, message);

    console.log('📨 Message sent:', {
      messageId,
      chatRoomId,
      sender: sender.name,
      messageType,
      length: message.length,
    });

    return chatMessage;
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
    
    let q = query(
      messagesRef,
      where('chatRoomId', '==', chatRoomId),
      orderBy('createdAt', 'desc'),
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
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as ChatMessage;
    }).reverse(); // 時系列順に並べ替え
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
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
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
        lastMessageTime: data.lastMessageTime?.toDate(),
        lastMessageSender: data.lastMessageSender,
        unreadCount: data.unreadCount || {},
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
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
    const messagesRef = collection(db, this.CHAT_MESSAGES_COLLECTION);
    
    const q = query(
      messagesRef,
      where('chatRoomId', '==', chatRoomId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
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
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ChatMessage;
      }).reverse();

      callback(messages);
    });
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
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
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
          lastMessageTime: data.lastMessageTime?.toDate(),
          lastMessageSender: data.lastMessageSender,
          unreadCount: data.unreadCount || {},
          isActive: data.isActive,
          createdBy: data.createdBy,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ChatRoom;
      });

      callback(rooms);
    });
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
    const roomsRef = collection(db, this.CHAT_ROOMS_COLLECTION);
    
    const q = query(
      roomsRef,
      where('shopId', '==', shopId),
      where('roomType', '==', 'direct'),
      where('participants', 'array-contains', user1Id),
      where('isActive', '==', true)
    );

    const querySnapshot = await getDocs(q);
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (data.participants.includes(user2Id) && data.participants.length === 2) {
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
          lastMessageTime: data.lastMessageTime?.toDate(),
          lastMessageSender: data.lastMessageSender,
          unreadCount: data.unreadCount || {},
          isActive: data.isActive,
          createdBy: data.createdBy,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ChatRoom;
      }
    }

    return null;
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
    const roomRef = doc(db, this.CHAT_ROOMS_COLLECTION, chatRoomId);
    
    // 他の参加者の未読数を増加
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

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

    await updateDoc(roomRef, {
      lastMessage: message.length > 50 ? message.substring(0, 47) + '...' : message,
      lastMessageTime: Timestamp.fromDate(timestamp),
      lastMessageSender: senderName,
      unreadCount: updatedUnreadCount,
      updatedAt: serverTimestamp(),
    });
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