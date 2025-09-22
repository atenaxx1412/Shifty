// Integration utilities for staffing template with shift creation

import { LocalStaffingTemplateService } from '@/lib/localStaffingTemplate';
import { format, parseISO, isSameWeek, startOfWeek, endOfWeek } from 'date-fns';

export interface StaffShortageInfo {
  date: string;
  requiredStaff: number;
  assignedStaff: number;
  shortage: number;
  isShortage: boolean;
  isCritical: boolean; // shortage >= 50% of required
  isWarning: boolean;  // shortage >= 25% of required
}

export interface WeekShortageInfo {
  weekStart: string;
  weekEnd: string;
  totalRequired: number;
  totalAssigned: number;
  totalShortage: number;
  criticalDays: number;
  warningDays: number;
  shortageRate: number; // percentage
  dailyShortages: StaffShortageInfo[];
}

export class StaffingTemplateIntegration {
  // Get shortage information for a specific date
  static getDateShortageInfo(
    managerId: string,
    date: string,
    assignedStaff: number = 0
  ): StaffShortageInfo | null {
    const dateObj = parseISO(date);
    const month = format(dateObj, 'yyyy-MM');

    const requiredStaff = LocalStaffingTemplateService.getDailyRequirement(
      managerId,
      month,
      date
    );

    if (requiredStaff === 0) {
      return null; // No template set for this date
    }

    const shortage = Math.max(0, requiredStaff - assignedStaff);
    const shortageRate = requiredStaff > 0 ? (shortage / requiredStaff) : 0;

    return {
      date,
      requiredStaff,
      assignedStaff,
      shortage,
      isShortage: shortage > 0,
      isCritical: shortageRate >= 0.5,
      isWarning: shortageRate >= 0.25 && shortageRate < 0.5
    };
  }

  // Get shortage information for a week
  static getWeekShortageInfo(
    managerId: string,
    weekDate: string, // Any date within the week
    assignedStaffByDate: Record<string, number> = {}
  ): WeekShortageInfo {
    const dateObj = parseISO(weekDate);
    const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(dateObj, { weekStartsOn: 1 });

    const dailyShortages: StaffShortageInfo[] = [];
    let totalRequired = 0;
    let totalAssigned = 0;
    let totalShortage = 0;
    let criticalDays = 0;
    let warningDays = 0;

    // Check each day of the week
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      const dateString = format(currentDate, 'yyyy-MM-dd');

      const assignedForDate = assignedStaffByDate[dateString] || 0;
      const shortageInfo = this.getDateShortageInfo(managerId, dateString, assignedForDate);

      if (shortageInfo) {
        dailyShortages.push(shortageInfo);
        totalRequired += shortageInfo.requiredStaff;
        totalAssigned += shortageInfo.assignedStaff;
        totalShortage += shortageInfo.shortage;

        if (shortageInfo.isCritical) criticalDays++;
        else if (shortageInfo.isWarning) warningDays++;
      }
    }

    const shortageRate = totalRequired > 0 ? (totalShortage / totalRequired) * 100 : 0;

    return {
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      totalRequired,
      totalAssigned,
      totalShortage,
      criticalDays,
      warningDays,
      shortageRate: Math.round(shortageRate * 100) / 100,
      dailyShortages
    };
  }

  // Get shortage information for an entire month
  static getMonthShortageInfo(
    managerId: string,
    month: string, // YYYY-MM format
    assignedStaffByDate: Record<string, number> = {}
  ): {
    month: string;
    totalRequired: number;
    totalAssigned: number;
    totalShortage: number;
    criticalDays: number;
    warningDays: number;
    shortageRate: number;
    weeklyBreakdown: WeekShortageInfo[];
  } {
    const template = LocalStaffingTemplateService.getTemplate(managerId, month);

    if (!template) {
      return {
        month,
        totalRequired: 0,
        totalAssigned: 0,
        totalShortage: 0,
        criticalDays: 0,
        warningDays: 0,
        shortageRate: 0,
        weeklyBreakdown: []
      };
    }

    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0); // Last day of month

    const weeklyBreakdown: WeekShortageInfo[] = [];
    let totalRequired = 0;
    let totalAssigned = 0;
    let totalShortage = 0;
    let criticalDays = 0;
    let warningDays = 0;

    // Get weekly breakdowns for the month
    const processedWeeks = new Set<string>();

    for (const requirement of template.dailyRequirements) {
      const reqDate = parseISO(requirement.date);

      if (reqDate >= monthStart && reqDate <= monthEnd) {
        const weekKey = format(startOfWeek(reqDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

        if (!processedWeeks.has(weekKey)) {
          processedWeeks.add(weekKey);
          const weekInfo = this.getWeekShortageInfo(managerId, requirement.date, assignedStaffByDate);
          weeklyBreakdown.push(weekInfo);

          totalRequired += weekInfo.totalRequired;
          totalAssigned += weekInfo.totalAssigned;
          totalShortage += weekInfo.totalShortage;
          criticalDays += weekInfo.criticalDays;
          warningDays += weekInfo.warningDays;
        }
      }
    }

    const shortageRate = totalRequired > 0 ? (totalShortage / totalRequired) * 100 : 0;

    return {
      month,
      totalRequired,
      totalAssigned,
      totalShortage,
      criticalDays,
      warningDays,
      shortageRate: Math.round(shortageRate * 100) / 100,
      weeklyBreakdown
    };
  }

  // Generate warning messages for shift creation UI
  static generateShortageWarnings(shortageInfo: StaffShortageInfo[]): string[] {
    const warnings: string[] = [];

    const criticalShortages = shortageInfo.filter(info => info.isCritical);
    const warningShortages = shortageInfo.filter(info => info.isWarning);

    if (criticalShortages.length > 0) {
      warnings.push(
        `🚨 重要: ${criticalShortages.length}日で深刻な人数不足が予想されます`
      );
    }

    if (warningShortages.length > 0) {
      warnings.push(
        `⚠️ 注意: ${warningShortages.length}日で人数不足の可能性があります`
      );
    }

    // Specific date warnings
    criticalShortages.forEach(info => {
      const dateStr = format(parseISO(info.date), 'M月d日');
      warnings.push(
        `${dateStr}: ${info.shortage}人不足 (必要${info.requiredStaff}人、配置${info.assignedStaff}人)`
      );
    });

    return warnings;
  }

  // Check if a date has template requirements
  static hasTemplateForDate(managerId: string, date: string): boolean {
    const dateObj = parseISO(date);
    const month = format(dateObj, 'yyyy-MM');
    const requirement = LocalStaffingTemplateService.getDailyRequirement(managerId, month, date);
    return requirement > 0;
  }

  // Get all dates with template requirements for a month
  static getTemplatedDatesForMonth(managerId: string, month: string): string[] {
    const template = LocalStaffingTemplateService.getTemplate(managerId, month);
    return template ? template.dailyRequirements.map(req => req.date) : [];
  }

  // Calculate shortage statistics for dashboard/reporting
  static getShortageStatistics(
    managerId: string,
    month: string,
    assignedStaffByDate: Record<string, number> = {}
  ): {
    totalDaysWithTemplate: number;
    daysWithShortage: number;
    shortageRate: number;
    averageShortage: number;
    worstShortageDate: string | null;
    worstShortageAmount: number;
  } {
    const template = LocalStaffingTemplateService.getTemplate(managerId, month);

    if (!template || template.dailyRequirements.length === 0) {
      return {
        totalDaysWithTemplate: 0,
        daysWithShortage: 0,
        shortageRate: 0,
        averageShortage: 0,
        worstShortageDate: null,
        worstShortageAmount: 0
      };
    }

    let daysWithShortage = 0;
    let totalShortage = 0;
    let worstShortageDate: string | null = null;
    let worstShortageAmount = 0;

    for (const requirement of template.dailyRequirements) {
      const assignedForDate = assignedStaffByDate[requirement.date] || 0;
      const shortage = Math.max(0, requirement.requiredStaff - assignedForDate);

      if (shortage > 0) {
        daysWithShortage++;
        totalShortage += shortage;

        if (shortage > worstShortageAmount) {
          worstShortageAmount = shortage;
          worstShortageDate = requirement.date;
        }
      }
    }

    const totalDaysWithTemplate = template.dailyRequirements.length;
    const shortageRate = totalDaysWithTemplate > 0 ? (daysWithShortage / totalDaysWithTemplate) * 100 : 0;
    const averageShortage = daysWithShortage > 0 ? totalShortage / daysWithShortage : 0;

    return {
      totalDaysWithTemplate,
      daysWithShortage,
      shortageRate: Math.round(shortageRate * 100) / 100,
      averageShortage: Math.round(averageShortage * 100) / 100,
      worstShortageDate,
      worstShortageAmount
    };
  }
}