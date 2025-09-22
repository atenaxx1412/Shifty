// Local storage service for staffing templates

import { MonthlyStaffingTemplate, DailyStaffRequirement } from '@/types/staffingTemplate';

const STORAGE_KEY = 'shifty_staffing_templates';

export class LocalStaffingTemplateService {
  // Get all templates from local storage
  static getAllTemplates(): MonthlyStaffingTemplate[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading templates from localStorage:', error);
      return [];
    }
  }

  // Get template for specific manager and month
  static getTemplate(managerId: string, month: string): MonthlyStaffingTemplate | null {
    const templates = this.getAllTemplates();
    return templates.find(t => t.managerId === managerId && t.month === month) || null;
  }

  // Save or update template
  static saveTemplate(template: MonthlyStaffingTemplate): MonthlyStaffingTemplate {
    const templates = this.getAllTemplates();
    const now = new Date();

    // Check if template already exists
    const existingIndex = templates.findIndex(
      t => t.managerId === template.managerId && t.month === template.month
    );

    const templateToSave: MonthlyStaffingTemplate = {
      ...template,
      id: template.id || this.generateId(),
      updatedAt: now,
      createdAt: template.createdAt || now
    };

    if (existingIndex >= 0) {
      // Update existing template
      templates[existingIndex] = templateToSave;
    } else {
      // Add new template
      templates.push(templateToSave);
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('Error saving template to localStorage:', error);
      throw new Error('テンプレートの保存に失敗しました');
    }

    return templateToSave;
  }

  // Update daily requirement for a specific date
  static updateDailyRequirement(
    managerId: string,
    month: string,
    date: string,
    requiredStaff: number
  ): MonthlyStaffingTemplate {
    let template = this.getTemplate(managerId, month);

    if (!template) {
      // Create new template if it doesn't exist
      template = {
        managerId,
        month,
        dailyRequirements: [],
        notes: ''
      };
    }

    // Update or add the daily requirement
    const existingReqIndex = template.dailyRequirements.findIndex(
      req => req.date === date
    );

    if (requiredStaff === 0) {
      // Remove requirement if set to 0
      if (existingReqIndex >= 0) {
        template.dailyRequirements.splice(existingReqIndex, 1);
      }
    } else {
      // Update or add requirement
      const requirement: DailyStaffRequirement = { date, requiredStaff };

      if (existingReqIndex >= 0) {
        template.dailyRequirements[existingReqIndex] = requirement;
      } else {
        template.dailyRequirements.push(requirement);
      }
    }

    // Sort requirements by date
    template.dailyRequirements.sort((a, b) => a.date.localeCompare(b.date));

    return this.saveTemplate(template);
  }

  // Delete template
  static deleteTemplate(managerId: string, month: string): boolean {
    const templates = this.getAllTemplates();
    const filteredTemplates = templates.filter(
      t => !(t.managerId === managerId && t.month === month)
    );

    if (filteredTemplates.length === templates.length) {
      return false; // Template not found
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTemplates));
      return true;
    } catch (error) {
      console.error('Error deleting template from localStorage:', error);
      return false;
    }
  }

  // Get requirement for specific date
  static getDailyRequirement(managerId: string, month: string, date: string): number {
    const template = this.getTemplate(managerId, month);
    if (!template) return 0;

    const requirement = template.dailyRequirements.find(req => req.date === date);
    return requirement ? requirement.requiredStaff : 0;
  }

  // Get all requirements for a month as a map
  static getMonthRequirements(managerId: string, month: string): Record<string, number> {
    const template = this.getTemplate(managerId, month);
    if (!template) return {};

    return template.dailyRequirements.reduce((acc, req) => {
      acc[req.date] = req.requiredStaff;
      return acc;
    }, {} as Record<string, number>);
  }

  // Clear all templates (for testing/development)
  static clearAllTemplates(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  // Generate simple ID
  private static generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export templates as JSON (for backup)
  static exportTemplates(): string {
    const templates = this.getAllTemplates();
    return JSON.stringify(templates, null, 2);
  }

  // Import templates from JSON (for restore)
  static importTemplates(jsonData: string): boolean {
    try {
      const templates = JSON.parse(jsonData) as MonthlyStaffingTemplate[];

      // Validate structure
      if (!Array.isArray(templates)) {
        throw new Error('Invalid template data format');
      }

      // Validate each template
      templates.forEach(template => {
        if (!template.managerId || !template.month || !Array.isArray(template.dailyRequirements)) {
          throw new Error('Invalid template structure');
        }
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      return true;
    } catch (error) {
      console.error('Error importing templates:', error);
      return false;
    }
  }

  // Get statistics about templates
  static getStats(managerId: string): {
    totalTemplates: number;
    totalDaysWithRequirements: number;
    averageRequiredStaff: number;
  } {
    const templates = this.getAllTemplates().filter(t => t.managerId === managerId);

    const totalTemplates = templates.length;
    const allRequirements = templates.flatMap(t => t.dailyRequirements);
    const totalDaysWithRequirements = allRequirements.length;
    const averageRequiredStaff = totalDaysWithRequirements > 0
      ? allRequirements.reduce((sum, req) => sum + req.requiredStaff, 0) / totalDaysWithRequirements
      : 0;

    return {
      totalTemplates,
      totalDaysWithRequirements,
      averageRequiredStaff: Math.round(averageRequiredStaff * 100) / 100
    };
  }
}