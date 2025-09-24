import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { MonthlyShiftRequest, DayShiftRequest, User } from '@/types';
import { logDataChange } from './auditLogger';

export class ShiftRequestService {
  private static instance: ShiftRequestService;
  private realtimeListeners = new Map<string, () => void>();

  private constructor() {}

  public static getInstance(): ShiftRequestService {
    if (!ShiftRequestService.instance) {
      ShiftRequestService.instance = new ShiftRequestService();
    }
    return ShiftRequestService.instance;
  }

  // ========== MONTHLY SHIFT REQUEST MANAGEMENT ==========

  /**
   * 月間シフト希望を作成
   */
  async createMonthlyShiftRequest(
    requestData: Partial<MonthlyShiftRequest>,
    staff: User
  ): Promise<MonthlyShiftRequest> {
    const now = new Date();
    const monthlyRequestId = `monthly_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!requestData.managerId) {
      throw new Error('Manager ID is required');
    }

    const newRequest: MonthlyShiftRequest = {
      monthlyRequestId,
      staffId: staff.uid,
      managerId: requestData.managerId,
      targetMonth: requestData.targetMonth || '',
      title: requestData.title || `${staff.name}さんのシフト希望`,
      dayRequests: requestData.dayRequests || [],
      overallNote: requestData.overallNote || '',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, 'monthly_shift_requests'), {
        ...newRequest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logDataChange('monthly_shift_requests', docRef.id, 'CREATE', staff.uid, null, newRequest);

      console.log('✅ Monthly shift request created:', monthlyRequestId);
      return { ...newRequest, monthlyRequestId: docRef.id };
    } catch (error) {
      console.error('❌ Error creating monthly shift request:', error);
      throw error;
    }
  }

  /**
   * 月間シフト希望を提出
   */
  async submitMonthlyShiftRequest(
    monthlyRequestId: string,
    staff: User
  ): Promise<void> {
    const now = new Date();

    try {
      await updateDoc(doc(db, 'monthly_shift_requests', monthlyRequestId), {
        status: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logDataChange(
        'monthly_shift_requests',
        monthlyRequestId,
        'UPDATE',
        staff.uid,
        { status: 'draft' },
        { status: 'submitted', submittedAt: now }
      );

      console.log('✅ Monthly shift request submitted:', monthlyRequestId);
    } catch (error) {
      console.error('❌ Error submitting monthly shift request:', error);
      throw error;
    }
  }

  /**
   * 月間シフト希望を更新
   */
  async updateMonthlyShiftRequest(
    monthlyRequestId: string,
    updates: Partial<MonthlyShiftRequest>,
    updatedBy: User
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'monthly_shift_requests', monthlyRequestId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      await logDataChange(
        'monthly_shift_requests',
        monthlyRequestId,
        'UPDATE',
        updatedBy.uid,
        null,
        updates
      );

      console.log('✅ Monthly shift request updated:', monthlyRequestId);
    } catch (error) {
      console.error('❌ Error updating monthly shift request:', error);
      throw error;
    }
  }

  /**
   * スタッフの月間シフト希望一覧を取得（リアルタイム）
   */
  subscribeToStaffMonthlyRequests(
    staffId: string,
    callback: (requests: MonthlyShiftRequest[]) => void
  ): () => void {
    const listenerKey = `staff_monthly_requests_${staffId}`;

    if (this.realtimeListeners.has(listenerKey)) {
      this.realtimeListeners.get(listenerKey)!();
    }

    console.log('📡 Setting up real-time subscription for staff monthly requests:', staffId);

    // Remove orderBy to avoid index requirement
    const q = query(
      collection(db, 'monthly_shift_requests'),
      where('staffId', '==', staffId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: MonthlyShiftRequest[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        requests.push({
          ...data,
          monthlyRequestId: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          submittedAt: data.submittedAt?.toDate(),
          reviewedAt: data.reviewedAt?.toDate(),
          dayRequests: data.dayRequests?.map((day: Partial<DayShiftRequest> & { date?: any }) => ({
            ...day,
            date: day.date?.toDate() || new Date(day.date)
          })) || []
        } as MonthlyShiftRequest);
      });

      console.log(`📊 Real-time update: ${requests.length} monthly requests for staff ${staffId}`);
      // Client-side sorting by createdAt (desc)
      const sortedRequests = requests.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      callback(sortedRequests);
    }, (error) => {
      console.error('❌ Error in staff monthly requests subscription:', {
        staffId,
        error: error?.message || String(error),
        code: error?.code || 'unknown',
        fullError: error
      });
      // エラーが発生してもコールバックを呼んで、空の配列を返す
      callback([]);
    });

    this.realtimeListeners.set(listenerKey, unsubscribe);
    return unsubscribe;
  }

  /**
   * マネージャーの月間シフト希望一覧を取得（リアルタイム）
   */
  subscribeToManagerMonthlyRequests(
    managerId: string,
    callback: (requests: MonthlyShiftRequest[]) => void
  ): () => void {
    const listenerKey = `manager_monthly_requests_${managerId}`;

    if (this.realtimeListeners.has(listenerKey)) {
      this.realtimeListeners.get(listenerKey)!();
    }

    console.log('📡 Setting up real-time subscription for manager monthly requests:', managerId);

    // Remove orderBy to avoid index requirement
    const q = query(
      collection(db, 'monthly_shift_requests'),
      where('managerId', '==', managerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const requests: MonthlyShiftRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          requests.push({
            ...data,
            monthlyRequestId: doc.id,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            submittedAt: data.submittedAt?.toDate(),
            reviewedAt: data.reviewedAt?.toDate(),
            dayRequests: data.dayRequests?.map((day: Partial<DayShiftRequest> & { date?: any }) => ({
              ...day,
              date: day.date?.toDate() || new Date(day.date)
            })) || []
          } as MonthlyShiftRequest);
        });

        console.log(`📊 Real-time update: ${requests.length} monthly requests for manager ${managerId}`);
        // Client-side sorting by createdAt (desc)
        const sortedRequests = requests.sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
        callback(sortedRequests);
      } catch (processingError) {
        console.error('❌ Error processing snapshot data:', processingError);
        callback([]);
      }
    }, (error) => {
      console.error('❌ Error in manager monthly requests subscription:', {
        managerId,
        error: error?.message || String(error),
        code: error?.code || 'unknown',
        fullError: error
      });
      // エラーが発生してもコールバックを呼んで、空の配列を返す
      callback([]);
    });

    this.realtimeListeners.set(listenerKey, unsubscribe);
    return unsubscribe;
  }

  /**
   * 月間シフト希望を承認
   */
  async approveMonthlyShiftRequest(
    monthlyRequestId: string,
    manager: User,
    reviewNotes?: string
  ): Promise<void> {
    const now = new Date();

    try {
      await updateDoc(doc(db, 'monthly_shift_requests', monthlyRequestId), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: manager.uid,
        reviewNotes: reviewNotes || '',
        updatedAt: serverTimestamp(),
      });

      await logDataChange(
        'monthly_shift_requests',
        monthlyRequestId,
        'UPDATE',
        manager.uid,
        null,
        { status: 'approved', reviewedBy: manager.uid, reviewNotes }
      );

      console.log('✅ Monthly shift request approved:', monthlyRequestId);
    } catch (error) {
      console.error('❌ Error approving monthly shift request:', error);
      throw error;
    }
  }

  /**
   * 月間シフト希望を却下
   */
  async rejectMonthlyShiftRequest(
    monthlyRequestId: string,
    manager: User,
    reviewNotes: string
  ): Promise<void> {
    const now = new Date();

    try {
      await updateDoc(doc(db, 'monthly_shift_requests', monthlyRequestId), {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: manager.uid,
        reviewNotes,
        updatedAt: serverTimestamp(),
      });

      await logDataChange(
        'monthly_shift_requests',
        monthlyRequestId,
        'UPDATE',
        manager.uid,
        null,
        { status: 'rejected', reviewedBy: manager.uid, reviewNotes }
      );

      console.log('✅ Monthly shift request rejected:', monthlyRequestId);
    } catch (error) {
      console.error('❌ Error rejecting monthly shift request:', error);
      throw error;
    }
  }

  /**
   * 月間シフト希望を削除
   */
  async deleteMonthlyShiftRequest(
    monthlyRequestId: string,
    deletedBy: User
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, 'monthly_shift_requests', monthlyRequestId));

      await logDataChange(
        'monthly_shift_requests',
        monthlyRequestId,
        'DELETE',
        deletedBy.uid,
        null,
        null
      );

      console.log('✅ Monthly shift request deleted:', monthlyRequestId);
    } catch (error) {
      console.error('❌ Error deleting monthly shift request:', error);
      throw error;
    }
  }

  /**
   * リアルタイムリスナーをクリーンアップ
   */
  cleanup(): void {
    console.log('🔌 Cleaning up shift request service listeners');
    this.realtimeListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.realtimeListeners.clear();
  }
}

// シングルトンインスタンスをエクスポート
export const shiftRequestService = ShiftRequestService.getInstance();