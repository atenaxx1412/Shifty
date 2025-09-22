// 新しいシンプルなスタッフィングテンプレート型定義

export interface DailyStaffRequirement {
  date: string; // YYYY-MM-DD format
  requiredStaff: number;
}

export interface MonthlyStaffingTemplate {
  id?: string;
  managerId: string;
  month: string; // YYYY-MM format
  dailyRequirements: DailyStaffRequirement[];
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StaffingTemplateContextType {
  currentTemplate: MonthlyStaffingTemplate | null;
  loading: boolean;
  saving: boolean;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  updateDailyRequirement: (date: string, requiredStaff: number) => void;
  saveTemplate: () => Promise<void>;
  loadTemplate: (month: string) => Promise<void>;
}