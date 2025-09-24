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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AttendanceRecord, AttendanceStatus, AttendanceSummary, User } from '@/types';

class AttendanceService {
  private readonly ATTENDANCE_COLLECTION = 'attendance';
  private readonly STATUS_COLLECTION = 'attendanceStatus';

  /**
   * 出勤記録を作成
   */
  async clockIn(
    user: User,
    shiftId?: string,
    location?: { latitude: number; longitude: number; accuracy?: number },
    notes?: string
  ): Promise<AttendanceRecord> {
    const now = new Date();
    const recordId = `${user.uid}_${now.getTime()}`;

    const attendanceRecord: AttendanceRecord = {
      recordId,
      userId: user.uid,
      shopId: user.shopId!,
      shiftId,
      date: now,
      clockInTime: now,
      status: 'clocked_in',
      location: location ? { ...location, timestamp: now } : undefined,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    // Firestore に保存
    const recordRef = doc(db, this.ATTENDANCE_COLLECTION, recordId);
    await setDoc(recordRef, {
      ...attendanceRecord,
      date: Timestamp.fromDate(attendanceRecord.date),
      clockInTime: Timestamp.fromDate(attendanceRecord.clockInTime!),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 出勤状況を更新
    await this.updateAttendanceStatus(user.uid, {
      userId: user.uid,
      isWorking: true,
      currentRecordId: recordId,
      clockInTime: now,
      workDuration: 0,
      lastActivity: now,
      currentShiftId: shiftId,
    });

    console.log('🎯 Clock in successful:', {
      userId: user.uid,
      recordId,
      time: now.toLocaleTimeString('ja-JP'),
    });

    return attendanceRecord;
  }

  /**
   * 退勤記録を更新
   */
  async clockOut(
    userId: string,
    location?: { latitude: number; longitude: number; accuracy?: number },
    notes?: string
  ): Promise<AttendanceRecord | null> {
    const now = new Date();

    // 現在の出勤状況を取得
    const status = await this.getAttendanceStatus(userId);
    if (!status?.isWorking || !status.currentRecordId) {
      throw new Error('出勤記録が見つかりません');
    }

    // 出勤記録を更新
    const recordRef = doc(db, this.ATTENDANCE_COLLECTION, status.currentRecordId);
    const recordSnap = await getDoc(recordRef);
    
    if (!recordSnap.exists()) {
      throw new Error('出勤記録が見つかりません');
    }

    const existingRecord = recordSnap.data();
    const clockInTime = existingRecord.clockInTime.toDate();
    const totalWorkTime = Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60)); // 分

    const updatedRecord: Partial<AttendanceRecord> = {
      clockOutTime: now,
      status: 'clocked_out',
      totalWorkTime,
      notes: notes || existingRecord.notes,
      updatedAt: now,
    };

    await setDoc(recordRef, {
      ...existingRecord,
      ...updatedRecord,
      clockOutTime: Timestamp.fromDate(now),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 出勤状況をリセット
    await this.updateAttendanceStatus(userId, {
      userId,
      isWorking: false,
      lastActivity: now,
    });

    console.log('🏁 Clock out successful:', {
      userId,
      recordId: status.currentRecordId,
      time: now.toLocaleTimeString('ja-JP'),
      totalMinutes: totalWorkTime,
    });

    // 更新されたレコードを返す
    const finalRecord: AttendanceRecord = {
      ...existingRecord,
      clockInTime: existingRecord.clockInTime.toDate(),
      clockOutTime: now,
      status: 'clocked_out' as const,
      totalWorkTime,
      updatedAt: now,
    } as AttendanceRecord;

    return finalRecord;
  }

  /**
   * 現在の出勤状況を取得
   */
  async getAttendanceStatus(userId: string): Promise<AttendanceStatus | null> {
    const statusRef = doc(db, this.STATUS_COLLECTION, userId);
    const statusSnap = await getDoc(statusRef);

    if (!statusSnap.exists()) {
      return null;
    }

    const data = statusSnap.data();
    return {
      userId: data.userId,
      isWorking: data.isWorking,
      currentRecordId: data.currentRecordId,
      clockInTime: data.clockInTime?.toDate(),
      workDuration: data.workDuration || 0,
      lastActivity: data.lastActivity.toDate(),
      currentShiftId: data.currentShiftId,
    };
  }

  /**
   * 出勤状況をリアルタイムで監視
   */
  subscribeToAttendanceStatus(
    userId: string,
    callback: (status: AttendanceStatus | null) => void
  ): () => void {
    const statusRef = doc(db, this.STATUS_COLLECTION, userId);

    return onSnapshot(statusRef, (doc) => {
      if (!doc.exists()) {
        callback(null);
        return;
      }

      const data = doc.data();
      const status: AttendanceStatus = {
        userId: data.userId,
        isWorking: data.isWorking,
        currentRecordId: data.currentRecordId,
        clockInTime: data.clockInTime?.toDate(),
        workDuration: this.calculateCurrentWorkDuration(data.clockInTime?.toDate()),
        lastActivity: data.lastActivity.toDate(),
        currentShiftId: data.currentShiftId,
      };

      callback(status);
    });
  }

  /**
   * 出勤履歴を取得
   */
  async getAttendanceHistory(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limitCount: number = 30
  ): Promise<AttendanceRecord[]> {
    const attendanceRef = collection(db, this.ATTENDANCE_COLLECTION);
    // Remove orderBy to avoid index requirement
    let q = query(
      attendanceRef,
      where('userId', '==', userId),
      limit(limitCount)
    );

    // 日付範囲でフィルタリング（実装時はより複雑なクエリが必要）
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        recordId: data.recordId,
        userId: data.userId,
        shopId: data.shopId,
        shiftId: data.shiftId,
        date: data.date.toDate(),
        clockInTime: data.clockInTime?.toDate(),
        clockOutTime: data.clockOutTime?.toDate(),
        status: data.status,
        location: data.location,
        notes: data.notes,
        totalWorkTime: data.totalWorkTime,
        breakTime: data.breakTime,
        overtimeMinutes: data.overtimeMinutes,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as AttendanceRecord;
    }).sort((a, b) => b.date.getTime() - a.date.getTime()); // Client-side sorting by date (desc)
  }

  /**
   * 今日の出勤記録を取得
   */
  async getTodayAttendance(userId: string): Promise<AttendanceRecord | null> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const attendanceRef = collection(db, this.ATTENDANCE_COLLECTION);
    // Remove orderBy to avoid index requirement, get multiple records and sort client-side
    const q = query(
      attendanceRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startOfDay))
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    // Sort client-side and get the latest record
    const sortedDocs = querySnapshot.docs.sort((a, b) => {
      const aDate = a.data().date.toDate();
      const bDate = b.data().date.toDate();
      return bDate.getTime() - aDate.getTime(); // Latest first
    });

    const doc = sortedDocs[0];
    const data = doc.data();
    
    return {
      recordId: data.recordId,
      userId: data.userId,
      shopId: data.shopId,
      shiftId: data.shiftId,
      date: data.date.toDate(),
      clockInTime: data.clockInTime?.toDate(),
      clockOutTime: data.clockOutTime?.toDate(),
      status: data.status,
      location: data.location,
      notes: data.notes,
      totalWorkTime: data.totalWorkTime,
      breakTime: data.breakTime,
      overtimeMinutes: data.overtimeMinutes,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as AttendanceRecord;
  }

  /**
   * 出勤状況を内部的に更新
   */
  private async updateAttendanceStatus(userId: string, status: Partial<AttendanceStatus>): Promise<void> {
    const statusRef = doc(db, this.STATUS_COLLECTION, userId);
    
    const updateData: any = {
      userId,
      ...status,
      lastActivity: serverTimestamp(),
    };

    if (status.clockInTime) {
      updateData.clockInTime = Timestamp.fromDate(status.clockInTime);
    }

    await setDoc(statusRef, updateData, { merge: true });
  }

  /**
   * 現在の勤務時間を計算
   */
  private calculateCurrentWorkDuration(clockInTime?: Date): number {
    if (!clockInTime) return 0;
    const now = new Date();
    return Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60)); // 分
  }
}

export const attendanceService = new AttendanceService();