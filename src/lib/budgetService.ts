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
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  BudgetCalculation, 
  BudgetTemplate, 
  ShiftBudgetItem, 
  SlotBudgetItem,
  StaffAssignment,
  StaffCostItem,
  ShiftExtended, 
  User 
} from '@/types';
import { format, isWeekend, getDay } from 'date-fns';

class BudgetService {
  private readonly BUDGET_CALCULATIONS_COLLECTION = 'budgetCalculations';
  private readonly BUDGET_TEMPLATES_COLLECTION = 'budgetTemplates';

  // デフォルト設定
  private readonly DEFAULT_RATES = {
    baseHourlyRate: 1000, // デフォルト時給
    overtimeMultiplier: 1.25, // 残業倍率
    nightShiftBonus: 250, // 深夜手当（時間当たり）
    weekendBonus: 200, // 休日手当（時間当たり）
    holidayBonus: 300, // 祝日手当（時間当たり）
    socialInsuranceRate: 0.15, // 社会保険料率 15%
    taxRate: 0.10, // 所得税等 10%
  };

  /**
   * 期間のシフト予算を計算
   */
  async calculateBudgetForPeriod(
    shopId: string,
    shifts: ShiftExtended[],
    staff: User[],
    periodStart: Date,
    periodEnd: Date,
    budgetTemplate?: BudgetTemplate,
    budgetLimit?: number
  ): Promise<BudgetCalculation> {
    const calculationId = `${shopId}_${periodStart.getTime()}_${periodEnd.getTime()}`;
    
    // スタッフ時給マップを作成
    const staffRates = this.createStaffRatesMap(staff, budgetTemplate);
    
    // 計算設定を準備
    const assumptions = budgetTemplate ? {
      baseHourlyRate: budgetTemplate.staffRates,
      overtimeMultiplier: budgetTemplate.multipliers.overtime,
      nightShiftBonus: budgetTemplate.multipliers.nightShift,
      holidayBonus: budgetTemplate.multipliers.holiday,
      socialInsuranceRate: budgetTemplate.companyRates.socialInsurance,
      taxRate: budgetTemplate.companyRates.unemploymentInsurance,
    } : {
      baseHourlyRate: staffRates,
      overtimeMultiplier: this.DEFAULT_RATES.overtimeMultiplier,
      nightShiftBonus: this.DEFAULT_RATES.nightShiftBonus,
      holidayBonus: this.DEFAULT_RATES.holidayBonus,
      socialInsuranceRate: this.DEFAULT_RATES.socialInsuranceRate,
      taxRate: this.DEFAULT_RATES.taxRate,
    };

    // シフト別予算を計算
    const shiftBudgets: ShiftBudgetItem[] = [];
    const staffCostMap = new Map<string, StaffCostItem>();

    for (const shift of shifts) {
      const shiftBudget = await this.calculateShiftBudget(shift, staff, assumptions);
      shiftBudgets.push(shiftBudget);

      // スタッフ別コストを累積
      this.accumulateStaffCosts(shiftBudget, staffCostMap, assumptions);
    }

    // 最終的なスタッフコスト配列を作成
    const staffCosts = Array.from(staffCostMap.values());

    // サマリーを計算
    const summary = this.calculateSummary(shiftBudgets, staffCosts, budgetLimit);

    const budgetCalculation: BudgetCalculation = {
      calculationId,
      shopId,
      period: {
        start: periodStart,
        end: periodEnd,
        name: format(periodStart, 'yyyy年M月'),
      },
      shifts: shiftBudgets,
      staffCosts,
      summary,
      assumptions,
      createdBy: 'system', // 実際の実装では currentUser.uid
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Firestore に保存
    const calculationRef = doc(db, this.BUDGET_CALCULATIONS_COLLECTION, calculationId);
    await setDoc(calculationRef, {
      ...budgetCalculation,
      'period.start': Timestamp.fromDate(budgetCalculation.period.start),
      'period.end': Timestamp.fromDate(budgetCalculation.period.end),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log('💰 Budget calculation completed:', {
      calculationId,
      period: budgetCalculation.period.name,
      totalCost: summary.totalCost,
      totalHours: summary.totalHours,
      shiftsCount: shifts.length,
      staffCount: staffCosts.length,
    });

    return budgetCalculation;
  }

  /**
   * 単一シフトの予算を計算
   */
  private async calculateShiftBudget(
    shift: ShiftExtended,
    staff: User[],
    assumptions: any
  ): Promise<ShiftBudgetItem> {
    const dayType = this.getDayType(shift.date);
    const slots: SlotBudgetItem[] = [];
    let dailyTotal = 0;

    for (const slot of shift.slots) {
      const slotBudget = this.calculateSlotBudget(slot, staff, assumptions, dayType);
      slots.push(slotBudget);
      dailyTotal += slotBudget.slotTotal;
    }

    return {
      shiftId: shift.shiftId,
      date: shift.date,
      dayType,
      slots,
      dailyTotal,
    };
  }

  /**
   * 単一スロットの予算を計算
   */
  private calculateSlotBudget(
    slot: any,
    staff: User[],
    assumptions: any,
    dayType: 'weekday' | 'weekend' | 'holiday'
  ): SlotBudgetItem {
    const duration = this.calculateDuration(slot.startTime, slot.endTime);
    const isNightShift = this.isNightShift(slot.startTime, slot.endTime);
    const isOvertime = duration > 8 * 60; // 8時間を超える場合は残業扱い
    
    const assignedStaff: StaffAssignment[] = [];
    let slotTotal = 0;

    if (slot.assignedStaff && slot.assignedStaff.length > 0) {
      for (const staffId of slot.assignedStaff) {
        const staffMember = staff.find(s => s.uid === staffId);
        if (staffMember) {
          const assignment = this.calculateStaffAssignment(
            staffMember,
            duration,
            assumptions,
            isNightShift,
            isOvertime,
            dayType
          );
          assignedStaff.push(assignment);
          slotTotal += assignment.totalCost;
        }
      }
    }

    return {
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration,
      assignedStaff,
      slotTotal,
      isNightShift,
      isOvertime,
    };
  }

  /**
   * スタッフの配置コストを計算
   */
  private calculateStaffAssignment(
    staff: User,
    duration: number, // minutes
    assumptions: any,
    isNightShift: boolean,
    isOvertime: boolean,
    dayType: 'weekday' | 'weekend' | 'holiday'
  ): StaffAssignment {
    const hours = duration / 60;
    const hourlyRate = assumptions.baseHourlyRate[staff.uid] || this.DEFAULT_RATES.baseHourlyRate;
    
    let baseCost = hours * hourlyRate;
    let overtimeCost = 0;
    let bonuses = 0;

    // 残業代計算
    if (isOvertime) {
      const overtimeHours = Math.max(0, hours - 8);
      const regularHours = hours - overtimeHours;
      baseCost = regularHours * hourlyRate;
      overtimeCost = overtimeHours * hourlyRate * assumptions.overtimeMultiplier;
    }

    // 深夜手当
    if (isNightShift) {
      bonuses += hours * assumptions.nightShiftBonus;
    }

    // 休日・祝日手当
    if (dayType === 'weekend') {
      bonuses += hours * this.DEFAULT_RATES.weekendBonus;
    } else if (dayType === 'holiday') {
      bonuses += hours * assumptions.holidayBonus;
    }

    const totalCost = baseCost + overtimeCost + bonuses;

    return {
      userId: staff.uid,
      userName: staff.name,
      hourlyRate,
      baseCost,
      overtimeCost,
      bonuses,
      totalCost,
      workDuration: duration,
    };
  }

  /**
   * スタッフ別コストを累積
   */
  private accumulateStaffCosts(
    shiftBudget: ShiftBudgetItem,
    staffCostMap: Map<string, StaffCostItem>,
    assumptions: any
  ): void {
    for (const slot of shiftBudget.slots) {
      for (const assignment of slot.assignedStaff) {
        const existing = staffCostMap.get(assignment.userId);
        const hours = assignment.workDuration / 60;

        if (existing) {
          existing.totalHours += hours;
          existing.basePay += assignment.baseCost;
          existing.overtimePay += assignment.overtimeCost;
          existing.nightShiftBonus += (slot.isNightShift ? assignment.bonuses : 0);
          existing.holidayBonus += (!slot.isNightShift ? assignment.bonuses : 0);
          existing.grossPay = existing.basePay + existing.overtimePay + existing.nightShiftBonus + existing.holidayBonus;
          existing.socialInsurance = existing.grossPay * assumptions.socialInsuranceRate;
          existing.tax = existing.grossPay * assumptions.taxRate;
          existing.totalCost = existing.grossPay + existing.socialInsurance + existing.tax;
        } else {
          const grossPay = assignment.baseCost + assignment.overtimeCost + assignment.bonuses;
          const socialInsurance = grossPay * assumptions.socialInsuranceRate;
          const tax = grossPay * assumptions.taxRate;

          staffCostMap.set(assignment.userId, {
            userId: assignment.userId,
            userName: assignment.userName,
            totalHours: hours,
            basePay: assignment.baseCost,
            overtimePay: assignment.overtimeCost,
            nightShiftBonus: slot.isNightShift ? assignment.bonuses : 0,
            holidayBonus: !slot.isNightShift ? assignment.bonuses : 0,
            grossPay,
            socialInsurance,
            tax,
            totalCost: grossPay + socialInsurance + tax,
          });
        }
      }
    }
  }

  /**
   * サマリーを計算
   */
  private calculateSummary(
    shifts: ShiftBudgetItem[],
    staffCosts: StaffCostItem[],
    budgetLimit?: number
  ) {
    const totalShifts = shifts.length;
    const totalHours = staffCosts.reduce((sum, staff) => sum + staff.totalHours, 0);
    const totalBaseCost = staffCosts.reduce((sum, staff) => sum + staff.basePay, 0);
    const totalOvertimeCost = staffCosts.reduce((sum, staff) => sum + staff.overtimePay, 0);
    const totalBonusCost = staffCosts.reduce((sum, staff) => sum + staff.nightShiftBonus + staff.holidayBonus, 0);
    const totalTaxAndInsurance = staffCosts.reduce((sum, staff) => sum + staff.socialInsurance + staff.tax, 0);
    const totalCost = staffCosts.reduce((sum, staff) => sum + staff.totalCost, 0);
    const budgetVariance = budgetLimit ? budgetLimit - totalCost : 0;

    return {
      totalShifts,
      totalHours,
      totalBaseCost,
      totalOvertimeCost,
      totalBonusCost,
      totalTaxAndInsurance,
      totalCost,
      budgetLimit,
      budgetVariance,
    };
  }

  /**
   * 過去の予算計算を取得
   */
  async getBudgetCalculations(shopId: string, limitCount: number = 10): Promise<BudgetCalculation[]> {
    const calculationsRef = collection(db, this.BUDGET_CALCULATIONS_COLLECTION);
    
    const q = query(
      calculationsRef,
      where('shopId', '==', shopId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        calculationId: data.calculationId,
        shopId: data.shopId,
        period: {
          start: data.period.start.toDate(),
          end: data.period.end.toDate(),
          name: data.period.name,
        },
        shifts: data.shifts,
        staffCosts: data.staffCosts,
        summary: data.summary,
        assumptions: data.assumptions,
        createdBy: data.createdBy,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as BudgetCalculation;
    });
  }

  // ========== UTILITY METHODS ==========

  private createStaffRatesMap(staff: User[], template?: BudgetTemplate): Record<string, number> {
    const rates: Record<string, number> = {};
    
    for (const staffMember of staff) {
      if (template && template.staffRates[staffMember.uid]) {
        rates[staffMember.uid] = template.staffRates[staffMember.uid];
      } else if (staffMember.hourlyRate) {
        rates[staffMember.uid] = staffMember.hourlyRate;
      } else {
        rates[staffMember.uid] = this.DEFAULT_RATES.baseHourlyRate;
      }
    }
    
    return rates;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  }

  private isNightShift(startTime: string, endTime: string): boolean {
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    // 22時以降または6時以前を深夜とする
    return startHour >= 22 || endHour <= 6;
  }

  private getDayType(date: Date): 'weekday' | 'weekend' | 'holiday' {
    if (isWeekend(date)) {
      return 'weekend';
    }
    
    // 祝日判定は簡略化 (実際の実装では祝日カレンダーAPIを使用)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 代表的な祝日のみチェック
    const holidays = [
      [1, 1], // 元日
      [5, 3], // 憲法記念日
      [5, 4], // みどりの日
      [5, 5], // こどもの日
      [12, 25], // クリスマス（仮）
    ];
    
    if (holidays.some(([m, d]) => m === month && d === day)) {
      return 'holiday';
    }
    
    return 'weekday';
  }
}

export const budgetService = new BudgetService();