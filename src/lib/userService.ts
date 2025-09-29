import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';

export class UserService {
  /**
   * 店長配下のスタッフ一覧を取得
   */
  async getStaffByManager(managerId: string): Promise<User[]> {
    try {
      console.log('👥 Fetching staff for manager:', managerId);
      
      const q = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'staff')
      );
      
      const querySnapshot = await getDocs(q);
      const staff: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // デバッグ用：実際のFirestoreデータをログ出力
        console.log('🔍 Raw user data from Firestore:', {
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          createdAt: userData.createdAt,
          createdAtType: typeof userData.createdAt,
          updatedAt: userData.updatedAt,
          updatedAtType: typeof userData.updatedAt
        });

        // 安全な日付変換
        let createdAt: Date;
        let updatedAt: Date;

        try {
          if (userData.createdAt && userData.createdAt.toDate) {
            createdAt = userData.createdAt.toDate();
          } else if (userData.createdAt instanceof Date) {
            createdAt = userData.createdAt;
          } else {
            console.warn('⚠️ Invalid createdAt for user:', userData.name, 'using current date');
            createdAt = new Date();
          }
        } catch (error) {
          console.warn('⚠️ Error converting createdAt for user:', userData.name, error);
          createdAt = new Date();
        }

        try {
          if (userData.updatedAt && userData.updatedAt.toDate) {
            updatedAt = userData.updatedAt.toDate();
          } else if (userData.updatedAt instanceof Date) {
            updatedAt = userData.updatedAt;
          } else {
            console.warn('⚠️ Invalid updatedAt for user:', userData.name, 'using current date');
            updatedAt = new Date();
          }
        } catch (error) {
          console.warn('⚠️ Error converting updatedAt for user:', userData.name, error);
          updatedAt = new Date();
        }

        staff.push({
          uid: userData.uid || doc.id,
          userId: userData.userId || userData.uid || doc.id,
          password: userData.password || '',
          email: userData.email || '',
          name: userData.name || '',
          role: userData.role || 'staff',
          managerId: userData.managerId,
          employmentType: userData.employmentType,
          skills: userData.skills || [],
          hourlyRate: userData.hourlyRate,
          maxHoursPerWeek: userData.maxHoursPerWeek,
          availability: userData.availability,
          // 拡張フィールド
          nameKana: userData.nameKana,
          displayName: userData.displayName,
          position: userData.position,
          transportationCost: userData.transportationCost,
          fixedShift: userData.fixedShift,
          gender: userData.gender,
          createdAt,
          updatedAt
        } as User);
      });
      
      // クライアント側で名前順にソート
      staff.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log(`✅ Found ${staff.length} staff members for manager ${managerId}`);
      return staff;
      
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
      return [];
    }
  }

  /**
   * 店長配下のスタッフ一覧をリアルタイムで監視
   */
  subscribeToStaffUpdates(managerId: string, callback: (staff: User[]) => void): Unsubscribe {
    console.log('🔔 Setting up real-time staff subscription for manager:', managerId);
    
    const q = query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const staff: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        staff.push({
          uid: userData.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          managerId: userData.managerId,
          employmentType: userData.employmentType,
          skills: userData.skills || [],
          hourlyRate: userData.hourlyRate,
          maxHoursPerWeek: userData.maxHoursPerWeek,
          availability: userData.availability,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date()
        } as User);
      });
      
      // クライアント側で名前順にソート
      staff.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log(`📊 Real-time staff update: ${staff.length} members for manager ${managerId}`);
      callback(staff);
    }, (error) => {
      console.error('❌ Staff subscription error:', error);
      callback([]);
    });
  }

  /**
   * 特定のユーザーを取得
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const q = query(
        collection(db, 'users'),
        where('uid', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('👤 User not found:', userId);
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const userData = doc.data();
      
      return {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        managerId: userData.managerId,
        shopName: userData.shopName,
        shopAddress: userData.shopAddress,
        shopPhone: userData.shopPhone,
        shopEmail: userData.shopEmail,
        employmentType: userData.employmentType,
        skills: userData.skills || [],
        hourlyRate: userData.hourlyRate,
        maxHoursPerWeek: userData.maxHoursPerWeek,
        availability: userData.availability,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date()
      } as User;
      
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      throw error;
    }
  }

  /**
   * 全店長の一覧を取得
   */
  async getAllManagers(): Promise<User[]> {
    try {
      console.log('👔 Fetching all managers');
      
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'manager'),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const managers: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        managers.push({
          uid: userData.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          shopName: userData.shopName,
          shopAddress: userData.shopAddress,
          shopPhone: userData.shopPhone,
          shopEmail: userData.shopEmail,
          employmentType: userData.employmentType,
          skills: userData.skills || [],
          hourlyRate: userData.hourlyRate,
          createdAt: userData.createdAt?.toDate() || new Date(),
          updatedAt: userData.updatedAt?.toDate() || new Date()
        } as User);
      });
      
      console.log(`✅ Found ${managers.length} managers`);
      return managers;
      
    } catch (error) {
      console.error('❌ Error fetching managers:', error);
      throw error;
    }
  }

  /**
   * 店長とそのスタッフを一括で取得
   */
  async getManagerWithStaff(managerId: string): Promise<{ manager: User | null, staff: User[] }> {
    try {
      console.log('👥 Fetching manager with staff:', managerId);
      
      // 店長を取得
      const manager = await this.getUserById(managerId);
      
      if (!manager || manager.role !== 'manager') {
        return { manager: null, staff: [] };
      }
      
      // スタッフを取得
      const staff = await this.getStaffByManager(managerId);
      
      return { manager, staff };
      
    } catch (error) {
      console.error('❌ Error fetching manager with staff:', error);
      return { manager: null, staff: [] };
    }
  }

  /**
   * 全店長とそれぞれのスタッフを取得
   */
  async getAllManagersWithStaff(): Promise<Array<{ manager: User, staff: User[] }>> {
    try {
      console.log('🏢 Fetching all managers with their staff');
      
      // 全店長を取得
      const managers = await this.getAllManagers();
      
      // 各店長のスタッフを取得
      const managersWithStaff = await Promise.all(
        managers.map(async (manager) => {
          const staff = await this.getStaffByManager(manager.uid);
          return { manager, staff };
        })
      );
      
      console.log(`✅ Found ${managersWithStaff.length} managers with staff`);
      return managersWithStaff;
      
    } catch (error) {
      console.error('❌ Error fetching managers with staff:', error);
      return [];
    }
  }

  /**
   * 特定の店長の店舗情報を取得
   */
  getShopInfoByManager(manager: User): {
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    shopEmail?: string;
  } {
    return {
      shopName: manager.shopName,
      shopAddress: manager.shopAddress,
      shopPhone: manager.shopPhone,
      shopEmail: manager.shopEmail
    };
  }

  /**
   * 店長の統計情報を取得
   */
  async getManagerStats(managerId: string): Promise<{
    totalStaff: number;
    fullTimeStaff: number;
    partTimeStaff: number;
    contractStaff: number;
    averageHourlyRate: number;
    totalMaxHours: number;
  }> {
    try {
      const staff = await this.getStaffByManager(managerId);
      
      const stats = {
        totalStaff: staff.length,
        fullTimeStaff: staff.filter(s => s.employmentType === 'full-time').length,
        partTimeStaff: staff.filter(s => s.employmentType === 'part-time').length,
        contractStaff: staff.filter(s => s.employmentType === 'contract').length,
        averageHourlyRate: staff.length > 0 
          ? staff.reduce((sum, s) => sum + (s.hourlyRate || 0), 0) / staff.length 
          : 0,
        totalMaxHours: staff.reduce((sum, s) => sum + (s.maxHoursPerWeek || 0), 0)
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error calculating manager stats:', error);
      return {
        totalStaff: 0,
        fullTimeStaff: 0,
        partTimeStaff: 0,
        contractStaff: 0,
        averageHourlyRate: 0,
        totalMaxHours: 0
      };
    }
  }

  /**
   * ユーザー情報を更新
   */
  async updateUser(userId: string, updateData: Partial<User>): Promise<User | null> {
    try {
      console.log('📝 Updating user:', userId, updateData);
      
      // uidフィールドでドキュメントを検索
      const q = query(
        collection(db, 'users'),
        where('uid', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('❌ User not found for update:', userId);
        throw new Error('ユーザーが見つかりません');
      }
      
      const userDocRef = doc(db, 'users', querySnapshot.docs[0].id);
      
      // 更新データを準備（undefinedの値を除外）
      const cleanUpdateData: Record<string, unknown> = {};
      Object.keys(updateData).forEach(key => {
        const value = (updateData as Record<string, unknown>)[key];
        if (value !== undefined) {
          cleanUpdateData[key] = value;
        }
      });
      
      // タイムスタンプを追加
      cleanUpdateData.updatedAt = serverTimestamp();
      
      await updateDoc(userDocRef, cleanUpdateData);
      
      console.log('✅ User updated successfully:', userId);
      
      // 更新後のユーザー情報を取得して返す
      return await this.getUserById(userId);
      
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }

  /**
   * スタッフの詳細情報を更新
   */
  async updateStaffDetails(
    staffId: string, 
    details: {
      nameKana?: string;
      displayName?: string;
      position?: string;
      transportationCost?: number;
      fixedShift?: string;
      gender?: 'male' | 'female' | 'other' | 'not_specified';
      hourlyRate?: number;
      employmentType?: 'full-time' | 'part-time' | 'contract';
      skills?: string[];
      maxHoursPerWeek?: number;
    }
  ): Promise<User | null> {
    try {
      console.log('👤 Updating staff details:', staffId, details);
      
      return await this.updateUser(staffId, details);
      
    } catch (error) {
      console.error('❌ Error updating staff details:', error);
      throw error;
    }
  }

  /**
   * ユーザーを削除
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting user:', userId);
      
      // uidフィールドでドキュメントを検索
      const q = query(
        collection(db, 'users'),
        where('uid', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('❌ User not found for deletion:', userId);
        throw new Error('削除対象のユーザーが見つかりません');
      }
      
      const userDocRef = doc(db, 'users', querySnapshot.docs[0].id);
      
      await deleteDoc(userDocRef);
      
      console.log('✅ User deleted successfully:', userId);
      
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw error;
    }
  }
}

export const userService = new UserService();