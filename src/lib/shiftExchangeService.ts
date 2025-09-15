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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShiftExchange, ShiftExtended, User } from '@/types';

class ShiftExchangeService {
  private readonly EXCHANGE_COLLECTION = 'shiftExchanges';
  private readonly NOTIFICATION_COLLECTION = 'notifications';

  /**
   * シフト交換リクエストを作成
   */
  async createExchangeRequest(
    fromUser: User,
    shiftId: string,
    shiftSlotId: string,
    toUserId?: string,
    reason?: string
  ): Promise<ShiftExchange> {
    const now = new Date();
    const exchangeId = `${fromUser.uid}_${shiftId}_${now.getTime()}`;

    const exchangeRequest: ShiftExchange = {
      exchangeId,
      fromUserId: fromUser.uid,
      toUserId,
      shiftId,
      shiftSlotId,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    // Firestore に保存
    const exchangeRef = doc(db, this.EXCHANGE_COLLECTION, exchangeId);
    await setDoc(exchangeRef, {
      ...exchangeRequest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 通知を送信（対象ユーザーまたは全スタッフ）
    if (toUserId) {
      await this.sendExchangeNotification(
        toUserId,
        fromUser.name,
        'exchange_request',
        `${fromUser.name}さんからシフト交換依頼があります`,
        exchangeId
      );
    } else {
      // 全スタッフに交換募集通知を送信
      await this.broadcastExchangeOpportunity(fromUser, shiftId, shiftSlotId, exchangeId);
    }

    console.log('🔄 Exchange request created:', {
      exchangeId,
      fromUser: fromUser.name,
      toUser: toUserId || 'anyone',
      shiftId,
      slotId: shiftSlotId,
    });

    return exchangeRequest;
  }

  /**
   * シフト交換リクエストを承認
   */
  async approveExchangeRequest(
    exchangeId: string,
    approvingUserId: string,
    isManagerApproval: boolean = false
  ): Promise<ShiftExchange> {
    const exchangeRef = doc(db, this.EXCHANGE_COLLECTION, exchangeId);
    const exchangeSnap = await getDoc(exchangeRef);

    if (!exchangeSnap.exists()) {
      throw new Error('交換リクエストが見つかりません');
    }

    const exchange = exchangeSnap.data() as ShiftExchange;

    // 承認権限チェック
    if (!isManagerApproval && exchange.toUserId && exchange.toUserId !== approvingUserId) {
      throw new Error('この交換リクエストを承認する権限がありません');
    }

    const updatedExchange: Partial<ShiftExchange> = {
      status: 'approved',
      approvedBy: approvingUserId,
      toUserId: exchange.toUserId || approvingUserId,
      updatedAt: new Date(),
    };

    await updateDoc(exchangeRef, {
      ...updatedExchange,
      updatedAt: serverTimestamp(),
    });

    // 実際のシフト交換を実行
    await this.executeShiftExchange(
      exchange.fromUserId,
      updatedExchange.toUserId!,
      exchange.shiftId,
      exchange.shiftSlotId
    );

    // 関係者に通知
    await this.sendExchangeNotification(
      exchange.fromUserId,
      '',
      'exchange_response',
      'シフト交換が承認されました',
      exchangeId
    );

    console.log('✅ Exchange approved and executed:', {
      exchangeId,
      fromUser: exchange.fromUserId,
      toUser: updatedExchange.toUserId,
      approvedBy: approvingUserId,
    });

    return { ...exchange, ...updatedExchange } as ShiftExchange;
  }

  /**
   * シフト交換リクエストを拒否
   */
  async rejectExchangeRequest(
    exchangeId: string,
    rejectingUserId: string,
    reason?: string
  ): Promise<ShiftExchange> {
    const exchangeRef = doc(db, this.EXCHANGE_COLLECTION, exchangeId);
    const exchangeSnap = await getDoc(exchangeRef);

    if (!exchangeSnap.exists()) {
      throw new Error('交換リクエストが見つかりません');
    }

    const exchange = exchangeSnap.data() as ShiftExchange;

    const updatedExchange: Partial<ShiftExchange> = {
      status: 'rejected',
      reason: reason || exchange.reason,
      updatedAt: new Date(),
    };

    await updateDoc(exchangeRef, {
      ...updatedExchange,
      updatedAt: serverTimestamp(),
    });

    // 申請者に通知
    await this.sendExchangeNotification(
      exchange.fromUserId,
      '',
      'exchange_response',
      'シフト交換リクエストが拒否されました',
      exchangeId
    );

    console.log('❌ Exchange rejected:', {
      exchangeId,
      fromUser: exchange.fromUserId,
      rejectedBy: rejectingUserId,
      reason,
    });

    return { ...exchange, ...updatedExchange } as ShiftExchange;
  }

  /**
   * シフト交換リクエストをキャンセル
   */
  async cancelExchangeRequest(exchangeId: string, userId: string): Promise<ShiftExchange> {
    const exchangeRef = doc(db, this.EXCHANGE_COLLECTION, exchangeId);
    const exchangeSnap = await getDoc(exchangeRef);

    if (!exchangeSnap.exists()) {
      throw new Error('交換リクエストが見つかりません');
    }

    const exchange = exchangeSnap.data() as ShiftExchange;

    // キャンセル権限チェック
    if (exchange.fromUserId !== userId) {
      throw new Error('この交換リクエストをキャンセルする権限がありません');
    }

    const updatedExchange: Partial<ShiftExchange> = {
      status: 'cancelled',
      updatedAt: new Date(),
    };

    await updateDoc(exchangeRef, {
      ...updatedExchange,
      updatedAt: serverTimestamp(),
    });

    console.log('🚫 Exchange cancelled:', {
      exchangeId,
      cancelledBy: userId,
    });

    return { ...exchange, ...updatedExchange } as ShiftExchange;
  }

  /**
   * ユーザーの交換リクエスト一覧を取得
   */
  async getUserExchangeRequests(
    userId: string,
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
  ): Promise<ShiftExchange[]> {
    const exchangeRef = collection(db, this.EXCHANGE_COLLECTION);
    
    let q = query(
      exchangeRef,
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    if (status) {
      q = query(
        exchangeRef,
        where('fromUserId', '==', userId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
    }

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        exchangeId: data.exchangeId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        shiftId: data.shiftId,
        shiftSlotId: data.shiftSlotId,
        reason: data.reason,
        status: data.status,
        approvedBy: data.approvedBy,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as ShiftExchange;
    });
  }

  /**
   * 受け取った交換リクエストを取得
   */
  async getReceivedExchangeRequests(userId: string): Promise<ShiftExchange[]> {
    const exchangeRef = collection(db, this.EXCHANGE_COLLECTION);
    
    // 直接指名された交換リクエスト
    const directQuery = query(
      exchangeRef,
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    // 全体募集の交換リクエスト (toUserId が null/undefined)
    const openQuery = query(
      exchangeRef,
      where('toUserId', '==', null),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const [directSnapshot, openSnapshot] = await Promise.all([
      getDocs(directQuery),
      getDocs(openQuery)
    ]);

    const results: ShiftExchange[] = [];

    // 直接指名されたリクエスト
    directSnapshot.docs.forEach(doc => {
      const data = doc.data();
      results.push({
        exchangeId: data.exchangeId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        shiftId: data.shiftId,
        shiftSlotId: data.shiftSlotId,
        reason: data.reason,
        status: data.status,
        approvedBy: data.approvedBy,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as ShiftExchange);
    });

    // 全体募集のリクエスト（自分以外）
    openSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.fromUserId !== userId) { // 自分のリクエストは除外
        results.push({
          exchangeId: data.exchangeId,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          shiftId: data.shiftId,
          shiftSlotId: data.shiftSlotId,
          reason: data.reason,
          status: data.status,
          approvedBy: data.approvedBy,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ShiftExchange);
      }
    });

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 交換リクエストをリアルタイムで監視
   */
  subscribeToExchangeRequests(
    userId: string,
    callback: (exchanges: ShiftExchange[]) => void
  ): () => void {
    const exchangeRef = collection(db, this.EXCHANGE_COLLECTION);
    
    // ユーザーに関連する交換リクエストを監視
    const userQuery = query(
      exchangeRef,
      where('fromUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(userQuery, (snapshot) => {
      const exchanges = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          exchangeId: data.exchangeId,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          shiftId: data.shiftId,
          shiftSlotId: data.shiftSlotId,
          reason: data.reason,
          status: data.status,
          approvedBy: data.approvedBy,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as ShiftExchange;
      });

      callback(exchanges);
    });
  }

  /**
   * 実際のシフト交換を実行
   * 注意: この関数は簡略化されており、実際の実装では
   * shiftServiceと連携してシフトスロットのassignedStaffを更新する必要があります
   */
  private async executeShiftExchange(
    fromUserId: string,
    toUserId: string,
    shiftId: string,
    shiftSlotId: string
  ): Promise<void> {
    // TODO: shiftServiceと連携してシフトスロットの配置を更新
    // 現在は実装を簡略化
    console.log('🔄 Executing shift exchange:', {
      fromUserId,
      toUserId,
      shiftId,
      shiftSlotId,
    });

    // 実際の実装では以下が必要:
    // 1. shiftServiceを使用してシフトを取得
    // 2. 該当スロットのassignedStaffからfromUserIdを削除
    // 3. 該当スロットのassignedStaffにtoUserIdを追加
    // 4. シフトを更新してFirestoreに保存
  }

  /**
   * 交換通知を送信
   */
  private async sendExchangeNotification(
    userId: string,
    fromUserName: string,
    type: 'exchange_request' | 'exchange_response',
    message: string,
    exchangeId: string
  ): Promise<void> {
    const notificationId = `${userId}_${exchangeId}_${Date.now()}`;
    const notificationRef = doc(db, this.NOTIFICATION_COLLECTION, notificationId);

    await setDoc(notificationRef, {
      notificationId,
      userId,
      type,
      title: type === 'exchange_request' ? 'シフト交換依頼' : 'シフト交換回答',
      message,
      data: { exchangeId },
      read: false,
      createdAt: serverTimestamp(),
    });

    console.log('📱 Exchange notification sent:', { userId, type, message });
  }

  /**
   * 交換募集を全スタッフにブロードキャスト
   */
  private async broadcastExchangeOpportunity(
    fromUser: User,
    shiftId: string,
    shiftSlotId: string,
    exchangeId: string
  ): Promise<void> {
    // TODO: 同じ店舗のスタッフ一覧を取得して全員に通知
    // 実装を簡略化
    console.log('📢 Broadcasting exchange opportunity:', {
      fromUser: fromUser.name,
      shiftId,
      slotId: shiftSlotId,
      exchangeId,
    });
  }
}

export const shiftExchangeService = new ShiftExchangeService();