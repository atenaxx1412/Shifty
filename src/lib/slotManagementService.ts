import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ========== TYPE DEFINITIONS ==========

export interface ManagerSlot {
  managerId: string;
  managerName?: string;
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotRequest {
  requestId?: string;
  managerId: string;
  managerName?: string;
  requestedBy: string;
  requestedByName?: string;
  requestedSlots: number;
  currentSlots: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotHistory {
  historyId?: string;
  managerId: string;
  managerName?: string;
  changeType: 'initial' | 'increase' | 'decrease' | 'adjustment';
  previousSlots: number;
  newSlots: number;
  changedBy: string;
  changedByName?: string;
  requestId?: string;
  note?: string;
  createdAt: Date;
}

// ========== SLOT MANAGEMENT SERVICE ==========

export class SlotManagementService {
  private readonly COLLECTION_SLOTS = 'manager_slots';
  private readonly COLLECTION_REQUESTS = 'slot_requests';
  private readonly COLLECTION_HISTORY = 'slot_history';
  private readonly DEFAULT_INITIAL_SLOTS = 0; // デフォルトの初期枠数 // デフォルトの初期枠数

  // ========== INITIALIZATION ==========

  /**
   * 店長の枠数を初期化
   */
  async initializeManagerSlots(managerId: string, managerName?: string, initialSlots: number = this.DEFAULT_INITIAL_SLOTS): Promise<void> {
    try {
      console.log(`🔧 Initializing slots for manager: ${managerId} with ${initialSlots} slots`);

      const slotDoc = doc(db, this.COLLECTION_SLOTS, managerId);
      const existingDoc = await getDoc(slotDoc);

      if (existingDoc.exists()) {
        console.log(`⚠️ Manager ${managerId} already has slots initialized`);
        return;
      }

      const slotData: ManagerSlot = {
        managerId,
        managerName,
        totalSlots: initialSlots,
        usedSlots: 0,
        availableSlots: initialSlots,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(slotDoc, slotData);

      // 履歴に記録
      await this.addSlotHistory({
        managerId,
        managerName,
        changeType: 'initial',
        previousSlots: 0,
        newSlots: initialSlots,
        changedBy: 'system',
        changedByName: 'システム',
        note: '初期枠数割り当て',
        createdAt: new Date()
      });

      console.log(`✅ Successfully initialized ${initialSlots} slots for manager: ${managerId}`);
    } catch (error) {
      console.error('❌ Error initializing manager slots:', error);
      throw error;
    }
  }

  /**
   * 全店長の枠数を一括初期化（マイグレーション用）
   */
  async initializeAllManagerSlots(): Promise<void> {
    try {
      console.log('🔧 Starting bulk initialization of manager slots...');

      // 全店長を取得
      const managersQuery = query(collection(db, 'users'), where('role', '==', 'manager'));
      const managersSnapshot = await getDocs(managersQuery);

      const initPromises = managersSnapshot.docs.map(doc => {
        const managerData = doc.data();
        return this.initializeManagerSlots(managerData.uid, managerData.name);
      });

      await Promise.all(initPromises);
      console.log(`✅ Successfully initialized slots for ${managersSnapshot.docs.length} managers`);
    } catch (error) {
      console.error('❌ Error in bulk initialization:', error);
      throw error;
    }
  }

  // ========== SLOT RETRIEVAL ==========

  /**
   * 店長の枠数情報を取得
   */
  async getManagerSlots(managerId: string): Promise<ManagerSlot | null> {
    try {
      const slotDoc = doc(db, this.COLLECTION_SLOTS, managerId);
      const snapshot = await getDoc(slotDoc);

      // 常に最新のスタッフ数をデータベースから取得
      const staffQuery = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'staff')
      );
      const staffSnapshot = await getDocs(staffQuery);
      const currentStaffCount = staffSnapshot.size;

      if (!snapshot.exists()) {
        console.log(`⚠️ No slot data found for manager: ${managerId}, creating with current staff count: ${currentStaffCount}`);
        // managerSlotsコレクションにデータがない場合でも、最新のスタッフ数を返す
        return {
          managerId,
          managerName: 'Unknown Manager',
          totalSlots: 0, // デフォルト0枠
          usedSlots: currentStaffCount, // 実際のスタッフ数
          availableSlots: Math.max(0, 0 - currentStaffCount),
          createdAt: new Date(),
          updatedAt: new Date()
        } as ManagerSlot;
      }

      const data = snapshot.data();
      
      // 既存データがある場合も、常に最新のスタッフ数を使用
      const updatedSlotData = {
        ...data,
        usedSlots: currentStaffCount, // 常にデータベースから最新を取得
        availableSlots: Math.max(0, (data.totalSlots || 0) - currentStaffCount), // 再計算
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: new Date() // 参照時に更新
      } as ManagerSlot;

      // データベースの usedSlots も更新（非同期で）
      setDoc(slotDoc, {
        ...data,
        usedSlots: currentStaffCount,
        availableSlots: Math.max(0, (data.totalSlots || 0) - currentStaffCount),
        updatedAt: new Date()
      }, { merge: true }).catch(error => {
        console.error('❌ Error updating slot data:', error);
      });

      return updatedSlotData;
    } catch (error) {
      console.error('❌ Error fetching manager slots:', error);
      throw error;
    }
  }

  /**
   * 全店長の枠数情報を取得
   */
  async getAllManagerSlots(): Promise<ManagerSlot[]> {
    try {
      const slotsSnapshot = await getDocs(collection(db, this.COLLECTION_SLOTS));

      return slotsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as ManagerSlot;
      });
    } catch (error) {
      console.error('❌ Error fetching all manager slots:', error);
      throw error;
    }
  }

  /**
   * リアルタイムで店長の枠数を監視
   */
  subscribeToManagerSlots(managerId: string, callback: (slots: ManagerSlot | null) => void): () => void {
    const slotDoc = doc(db, this.COLLECTION_SLOTS, managerId);

    const unsubscribe = onSnapshot(slotDoc, (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = snapshot.data();
      callback({
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as ManagerSlot);
    });

    return unsubscribe;
  }

  // ========== SLOT UPDATE ==========

  /**
   * 店長の使用枠数を更新
   */
  async updateUsedSlots(managerId: string): Promise<void> {
    try {
      // 現在のスタッフ数を取得
      const staffQuery = query(collection(db, 'users'), where('managerId', '==', managerId), where('role', '==', 'staff'));
      const staffSnapshot = await getDocs(staffQuery);
      const staffCount = staffSnapshot.docs.length;

      // 枠数情報を更新
      const slotDoc = doc(db, this.COLLECTION_SLOTS, managerId);
      const currentSlots = await this.getManagerSlots(managerId);

      if (!currentSlots) {
        console.warn(`⚠️ No slot data found for manager: ${managerId}`);
        return;
      }

      await updateDoc(slotDoc, {
        usedSlots: staffCount,
        availableSlots: currentSlots.totalSlots - staffCount,
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Updated used slots for manager ${managerId}: ${staffCount}/${currentSlots.totalSlots}`);
    } catch (error) {
      console.error('❌ Error updating used slots:', error);
      throw error;
    }
  }

  /**
   * Root用: マネージャーの枠数を直接設定
   */
  async setManagerSlots(
    managerId: string, 
    newSlots: number, 
    changedBy: string, 
    changedByName: string, 
    note?: string
  ): Promise<void> {
    try {
      console.log(`🔧 Setting slots for manager ${managerId} to ${newSlots} slots`);

      const slotRef = doc(db, this.COLLECTION_SLOTS, managerId);
      const slotDoc = await getDoc(slotRef);
      
      let previousSlots = this.DEFAULT_INITIAL_SLOTS;
      let managerName = 'Unknown Manager';
      
      if (slotDoc.exists()) {
        const currentData = slotDoc.data() as ManagerSlot;
        previousSlots = currentData.totalSlots;
        managerName = currentData.managerName || 'Unknown Manager';
      }

      // 現在のスタッフ数を取得
      const staffQuery = query(collection(db, 'users'), where('managerId', '==', managerId), where('role', '==', 'staff'));
      const staffSnapshot = await getDocs(staffQuery);
      const currentStaffCount = staffSnapshot.size;

      // 枠数がスタッフ数より少ない場合はエラー
      if (newSlots < currentStaffCount) {
        throw new Error(`設定しようとしている枠数(${newSlots})が現在のスタッフ数(${currentStaffCount})より少なくなっています。`);
      }

      // 枠数を更新
      const slotData: ManagerSlot = {
        managerId,
        managerName,
        totalSlots: newSlots,
        usedSlots: currentStaffCount,
        availableSlots: newSlots - currentStaffCount,
        createdAt: slotDoc.exists() ? slotDoc.data()?.createdAt || new Date() : new Date(),
        updatedAt: new Date()
      };

      await setDoc(slotRef, slotData, { merge: true });

      // 履歴に記録
      await this.addSlotHistory({
        managerId,
        managerName,
        changeType: newSlots > previousSlots ? 'increase' : newSlots < previousSlots ? 'decrease' : 'no_change',
        previousSlots,
        newSlots,
        changedBy,
        changedByName,
        note: note || `Root管理者により枠数を${previousSlots}から${newSlots}に変更`,
        createdAt: new Date()
      });

      console.log(`✅ Successfully set slots for manager ${managerId}: ${previousSlots} → ${newSlots}`);
    } catch (error) {
      console.error('❌ Error setting manager slots:', error);
      throw error;
    }
  }

  /**
   * マネージャーの枠数データを削除（マネージャー削除時に使用）
   */
  async deleteManagerSlots(managerId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting slots for manager: ${managerId}`);

      const slotRef = doc(db, this.COLLECTION_SLOTS, managerId);
      const slotDoc = await getDoc(slotRef);

      if (slotDoc.exists()) {
        await deleteDoc(slotRef);
        console.log(`✅ Successfully deleted slots for manager: ${managerId}`);
      } else {
        console.log(`⚠️ No slot data found for manager: ${managerId}`);
      }
    } catch (error) {
      console.error('❌ Error deleting manager slots:', error);
      throw error;
    }
  }

  // ========== SLOT REQUEST MANAGEMENT ==========

  /**
   * 枠追加申請を作成
   */
  async createSlotRequest(request: Omit<SlotRequest, 'requestId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log('📝 Creating slot request:', request);

      const requestData = {
        ...request,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_REQUESTS), requestData);
      console.log(`✅ Created slot request with ID: ${docRef.id}`);

      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating slot request:', error);
      throw error;
    }
  }

  /**
   * 申請を取得（ステータスでフィルタ可能）
   */
  async getSlotRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<SlotRequest[]> {
    try {
      let q = query(collection(db, this.COLLECTION_REQUESTS), orderBy('createdAt', 'desc'));

      if (status) {
        // インデックス不要のシンプルなクエリに変更
        q = query(collection(db, this.COLLECTION_REQUESTS), where('status', '==', status));
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        requestId: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        approvedAt: doc.data().approvedAt?.toDate()
      } as SlotRequest));
    } catch (error) {
      console.error('❌ Error fetching slot requests:', error);
      throw error;
    }
  }

  /**
   * 申請を承認
   */
  async approveSlotRequest(requestId: string, approvedBy: string, approvedByName?: string): Promise<void> {
    try {
      console.log(`✅ Approving slot request: ${requestId}`);

      await runTransaction(db, async (transaction) => {
        // 申請を取得
        const requestRef = doc(db, this.COLLECTION_REQUESTS, requestId);
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists()) {
          throw new Error('Request not found');
        }

        const request = requestDoc.data() as SlotRequest;

        if (request.status !== 'pending') {
          throw new Error('Request is not pending');
        }

        // 店長の枠数を取得・更新
        const slotRef = doc(db, this.COLLECTION_SLOTS, request.managerId);
        const slotDoc = await transaction.get(slotRef);

        if (!slotDoc.exists()) {
          throw new Error('Manager slot data not found');
        }

        const currentSlots = slotDoc.data() as ManagerSlot;
        const newTotalSlots = currentSlots.totalSlots + request.requestedSlots;

        // 枠数を更新
        transaction.update(slotRef, {
          totalSlots: newTotalSlots,
          availableSlots: newTotalSlots - currentSlots.usedSlots,
          updatedAt: serverTimestamp()
        });

        // 申請を承認済みに更新
        transaction.update(requestRef, {
          status: 'approved',
          approvedBy,
          approvedByName,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // 履歴に追加
        const historyRef = doc(collection(db, this.COLLECTION_HISTORY));
        transaction.set(historyRef, {
          managerId: request.managerId,
          managerName: request.managerName,
          changeType: 'increase',
          previousSlots: currentSlots.totalSlots,
          newSlots: newTotalSlots,
          changedBy: approvedBy,
          changedByName: approvedByName,
          requestId: requestId,
          note: `申請承認: ${request.reason}`,
          createdAt: serverTimestamp()
        });
      });

      console.log(`✅ Successfully approved slot request: ${requestId}`);
    } catch (error) {
      console.error('❌ Error approving slot request:', error);
      throw error;
    }
  }

  /**
   * 申請を却下
   */
  async rejectSlotRequest(requestId: string, rejectedBy: string, rejectionReason: string): Promise<void> {
    try {
      console.log(`❌ Rejecting slot request: ${requestId}`);

      const requestRef = doc(db, this.COLLECTION_REQUESTS, requestId);

      await updateDoc(requestRef, {
        status: 'rejected',
        approvedBy: rejectedBy,
        rejectionReason,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log(`✅ Successfully rejected slot request: ${requestId}`);
    } catch (error) {
      console.error('❌ Error rejecting slot request:', error);
      throw error;
    }
  }

  // ========== SLOT HISTORY ==========

  /**
   * 枠数変更履歴を追加
   */
  async addSlotHistory(history: SlotHistory): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION_HISTORY), {
        ...history,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error adding slot history:', error);
      throw error;
    }
  }

  /**
   * 店長の枠数変更履歴を取得
   */
  async getSlotHistory(managerId?: string): Promise<SlotHistory[]> {
    try {
      let q = query(collection(db, this.COLLECTION_HISTORY), orderBy('createdAt', 'desc'));

      if (managerId) {
        q = query(collection(db, this.COLLECTION_HISTORY), where('managerId', '==', managerId), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        historyId: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      } as SlotHistory));
    } catch (error) {
      console.error('❌ Error fetching slot history:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const slotManagementService = new SlotManagementService();