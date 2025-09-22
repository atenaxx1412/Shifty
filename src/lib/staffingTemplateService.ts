import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface DailyStaffingRequirement {
  morning: number;
  afternoon: number;
  evening: number;
}

export interface WeeklyStaffingRequirement {
  monday: DailyStaffingRequirement;
  tuesday: DailyStaffingRequirement;
  wednesday: DailyStaffingRequirement;
  thursday: DailyStaffingRequirement;
  friday: DailyStaffingRequirement;
  saturday: DailyStaffingRequirement;
  sunday: DailyStaffingRequirement;
}

export interface SpecialDateRequirement {
  [date: string]: DailyStaffingRequirement; // 'YYYY-MM-DD': requirement
}

export interface StaffingTemplate {
  id?: string;
  managerId: string;
  month: string; // 'YYYY-MM' format
  weeklyRequirements: WeeklyStaffingRequirement;
  specialDates: SpecialDateRequirement;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StaffingAnalysis {
  requiredStaff: number;
  currentStaff: number;
  shortage: number;
  date: string;
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

export class StaffingTemplateService {

  /**
   * 新しい人員テンプレートを作成
   */
  static async createTemplate(template: Omit<StaffingTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = doc(collection(db, 'staffingTemplates'));
      const now = Timestamp.now();

      const newTemplate: StaffingTemplate = {
        ...template,
        id: docRef.id,
        createdAt: now,
        updatedAt: now
      };

      await setDoc(docRef, newTemplate);
      console.log('✅ Staffing template created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating staffing template:', error);
      throw error;
    }
  }

  /**
   * 人員テンプレートを更新
   */
  static async updateTemplate(templateId: string, updates: Partial<StaffingTemplate>): Promise<void> {
    try {
      const docRef = doc(db, 'staffingTemplates', templateId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now()
      };

      await setDoc(docRef, updateData, { merge: true });
      console.log('✅ Staffing template updated:', templateId);
    } catch (error) {
      console.error('❌ Error updating staffing template:', error);
      throw error;
    }
  }

  /**
   * 指定した月の人員テンプレートを取得
   */
  static async getTemplateByMonth(managerId: string, month: string): Promise<StaffingTemplate | null> {
    try {
      const q = query(
        collection(db, 'staffingTemplates'),
        where('managerId', '==', managerId),
        where('month', '==', month)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as StaffingTemplate;
    } catch (error) {
      console.error('❌ Error getting staffing template:', error);
      return null;
    }
  }

  /**
   * 店長の全ての人員テンプレートを取得
   */
  static async getManagerTemplates(managerId: string): Promise<StaffingTemplate[]> {
    try {
      const q = query(
        collection(db, 'staffingTemplates'),
        where('managerId', '==', managerId)
      );

      const snapshot = await getDocs(q);
      const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffingTemplate));

      // クライアント側で月順にソート
      return templates.sort((a, b) => b.month.localeCompare(a.month));
    } catch (error) {
      console.error('❌ Error getting manager templates:', error);
      return [];
    }
  }

  /**
   * 特定の日付の必要人数を計算
   */
  static getRequiredStaffForDate(template: StaffingTemplate, date: Date): DailyStaffingRequirement {
    const dateString = date.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // 特別な日付の設定がある場合は優先
    if (template.specialDates[dateString]) {
      return template.specialDates[dateString];
    }

    // 通常の曜日別設定を使用
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof WeeklyStaffingRequirement;

    return template.weeklyRequirements[dayName];
  }

  /**
   * シフトと比較して人員不足を分析
   */
  static async analyzeStaffingShortage(
    managerId: string,
    month: string,
    existingShifts: any[]
  ): Promise<StaffingAnalysis[]> {
    try {
      const template = await this.getTemplateByMonth(managerId, month);
      if (!template) {
        return [];
      }

      const analyses: StaffingAnalysis[] = [];
      const [year, monthNum] = month.split('-').map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthNum - 1, day);
        const dateString = date.toISOString().split('T')[0];
        const required = this.getRequiredStaffForDate(template, date);

        // 既存シフトから実際の人数を計算
        const dayShifts = existingShifts.filter(shift => {
          const shiftDate = shift.date?.toDate?.()?.toISOString().split('T')[0] || shift.date;
          return shiftDate === dateString;
        });

        const actualStaff = {
          morning: 0,
          afternoon: 0,
          evening: 0
        };

        dayShifts.forEach(shift => {
          if (shift.slots && Array.isArray(shift.slots)) {
            shift.slots.forEach((slot: any) => {
              if (slot.timeSlot === 'morning') actualStaff.morning++;
              else if (slot.timeSlot === 'afternoon') actualStaff.afternoon++;
              else if (slot.timeSlot === 'evening') actualStaff.evening++;
            });
          }
        });

        // 人員不足分析を追加
        (['morning', 'afternoon', 'evening'] as const).forEach(timeSlot => {
          const shortage = required[timeSlot] - actualStaff[timeSlot];
          if (shortage > 0) {
            analyses.push({
              requiredStaff: required[timeSlot],
              currentStaff: actualStaff[timeSlot],
              shortage,
              date: dateString,
              timeSlot
            });
          }
        });
      }

      return analyses;
    } catch (error) {
      console.error('❌ Error analyzing staffing shortage:', error);
      return [];
    }
  }

  /**
   * デフォルトのテンプレートを生成
   */
  static createDefaultTemplate(managerId: string, month: string): Omit<StaffingTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    const defaultDaily: DailyStaffingRequirement = {
      morning: 2,
      afternoon: 3,
      evening: 2
    };

    const weeklyRequirements: WeeklyStaffingRequirement = {
      monday: defaultDaily,
      tuesday: defaultDaily,
      wednesday: defaultDaily,
      thursday: defaultDaily,
      friday: { morning: 3, afternoon: 4, evening: 3 }, // 金曜日は少し多め
      saturday: { morning: 3, afternoon: 4, evening: 3 }, // 土曜日は少し多め
      sunday: { morning: 2, afternoon: 3, evening: 2 }
    };

    return {
      managerId,
      month,
      weeklyRequirements,
      specialDates: {},
      notes: '基本的な人員配置テンプレートです。必要に応じて調整してください。'
    };
  }
}