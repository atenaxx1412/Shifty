import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
  BudgetCalculation, 
  ShiftExtended, 
  StaffCostItem,
  User,
  AttendanceSummary 
} from '@/types';

export class ExcelService {
  /**
   * シフトスケジュールをExcelファイルとしてエクスポート
   */
  exportShiftSchedule(shifts: ShiftExtended[], filename?: string): void {
    const wb = XLSX.utils.book_new();

    // シフト一覧シート
    const shiftData = shifts.map(shift => ({
      '日付': format(shift.date, 'yyyy/MM/dd (E)', { locale: ja }),
      'ステータス': this.getStatusLabel(shift.status),
      'スロット数': shift.slots.length,
      '必要スタッフ数': shift.metadata.totalRequiredStaff,
      '配置スタッフ数': shift.metadata.totalAssignedStaff,
      '推定コスト': `¥${shift.metadata.estimatedCost?.toLocaleString() || '0'}`,
      '複雑度': this.getComplexityLabel(shift.metadata.complexity),
      '作成者': shift.createdBy,
      '作成日時': format(shift.createdAt, 'yyyy/MM/dd HH:mm', { locale: ja })
    }));

    const shiftWs = XLSX.utils.json_to_sheet(shiftData);
    XLSX.utils.book_append_sheet(wb, shiftWs, 'シフト一覧');

    // 詳細シート（各シフトのスロット情報）
    const detailData: any[] = [];
    shifts.forEach(shift => {
      shift.slots.forEach((slot, index) => {
        detailData.push({
          '日付': format(shift.date, 'yyyy/MM/dd (E)', { locale: ja }),
          'スロット番号': index + 1,
          '開始時間': slot.startTime,
          '終了時間': slot.endTime,
          '時間': `${slot.estimatedDuration / 60}時間`,
          '必要スタッフ数': slot.requiredStaff,
          '配置済みスタッフ数': slot.assignedStaff.length,
          '優先度': this.getPriorityLabel(slot.priority),
          '必要スキル': slot.requiredSkills?.join(', ') || '',
          'ポジション': slot.positions?.join(', ') || ''
        });
      });
    });

    if (detailData.length > 0) {
      const detailWs = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(wb, detailWs, 'スロット詳細');
    }

    const fileName = filename || `シフトスケジュール_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * 予算・財務データをExcelファイルとしてエクスポート
   */
  exportBudgetData(budgetCalculation: BudgetCalculation, filename?: string): void {
    const wb = XLSX.utils.book_new();

    // サマリーシート
    const summaryData = [
      { '項目': '対象期間', '値': budgetCalculation.period.name },
      { '項目': '総シフト数', '値': budgetCalculation.summary.totalShifts },
      { '項目': '総労働時間', '値': `${budgetCalculation.summary.totalHours.toFixed(1)}時間` },
      { '項目': '基本給合計', '値': `¥${budgetCalculation.summary.totalBaseCost.toLocaleString()}` },
      { '項目': '残業代合計', '値': `¥${budgetCalculation.summary.totalOvertimeCost.toLocaleString()}` },
      { '項目': '手当合計', '値': `¥${budgetCalculation.summary.totalBonusCost.toLocaleString()}` },
      { '項目': '税金・保険合計', '値': `¥${budgetCalculation.summary.totalTaxAndInsurance.toLocaleString()}` },
      { '項目': '総人件費', '値': `¥${budgetCalculation.summary.totalCost.toLocaleString()}` },
      ...(budgetCalculation.summary.budgetLimit ? [
        { '項目': '予算上限', '値': `¥${budgetCalculation.summary.budgetLimit.toLocaleString()}` },
        { '項目': '予算差額', '値': `¥${budgetCalculation.summary.budgetVariance.toLocaleString()}` },
        { '項目': '予算利用率', '値': `${((budgetCalculation.summary.totalCost / budgetCalculation.summary.budgetLimit) * 100).toFixed(1)}%` }
      ] : [])
    ];

    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, '予算サマリー');

    // スタッフ別コストシート
    const staffCostData = budgetCalculation.staffCosts.map(staff => ({
      'スタッフ名': staff.userName,
      '労働時間': `${staff.totalHours.toFixed(1)}時間`,
      '基本給': `¥${staff.basePay.toLocaleString()}`,
      '残業代': `¥${staff.overtimePay.toLocaleString()}`,
      '深夜手当': `¥${staff.nightShiftBonus.toLocaleString()}`,
      '休日手当': `¥${staff.holidayBonus.toLocaleString()}`,
      '支給総額': `¥${staff.grossPay.toLocaleString()}`,
      '社会保険': `¥${staff.socialInsurance.toLocaleString()}`,
      '税金': `¥${staff.tax.toLocaleString()}`,
      '総コスト': `¥${staff.totalCost.toLocaleString()}`,
      '平均時給': `¥${Math.round(staff.grossPay / staff.totalHours).toLocaleString()}`
    }));

    const staffWs = XLSX.utils.json_to_sheet(staffCostData);
    XLSX.utils.book_append_sheet(wb, staffWs, 'スタッフ別コスト');

    // 日別コストシート
    const dailyCostData = budgetCalculation.shifts.map(shift => ({
      '日付': format(shift.date, 'yyyy/MM/dd (E)', { locale: ja }),
      '日種別': this.getDayTypeLabel(shift.dayType),
      'スロット数': shift.slots.length,
      '日計': `¥${shift.dailyTotal.toLocaleString()}`
    }));

    const dailyWs = XLSX.utils.json_to_sheet(dailyCostData);
    XLSX.utils.book_append_sheet(wb, dailyWs, '日別コスト');

    // 計算設定シート
    const assumptionsData = [
      { '設定項目': '残業倍率', '値': `${budgetCalculation.assumptions.overtimeMultiplier}倍` },
      { '設定項目': '深夜手当', '値': `¥${budgetCalculation.assumptions.nightShiftBonus}/時間` },
      { '設定項目': '休日手当', '値': `¥${budgetCalculation.assumptions.holidayBonus}/時間` },
      { '設定項目': '社会保険料率', '値': `${(budgetCalculation.assumptions.socialInsuranceRate * 100).toFixed(1)}%` },
      { '設定項目': '税率', '値': `${(budgetCalculation.assumptions.taxRate * 100).toFixed(1)}%` }
    ];

    const assumptionsWs = XLSX.utils.json_to_sheet(assumptionsData);
    XLSX.utils.book_append_sheet(wb, assumptionsWs, '計算設定');

    const fileName = filename || `予算データ_${budgetCalculation.period.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * スタッフ統計データをExcelファイルとしてエクスポート
   */
  exportStaffStatistics(
    staff: User[], 
    attendanceSummaries: AttendanceSummary[], 
    budgetCalculation?: BudgetCalculation,
    filename?: string
  ): void {
    const wb = XLSX.utils.book_new();

    // スタッフ基本情報シート
    const staffData = staff.map(member => ({
      'スタッフID': member.uid,
      'スタッフ名': member.name,
      'メールアドレス': member.email,
      '雇用形態': this.getEmploymentTypeLabel(member.employmentType),
      '時給': `¥${member.hourlyRate?.toLocaleString() || '未設定'}`,
      '週最大労働時間': `${member.maxHoursPerWeek || '未設定'}時間`,
      'スキル': member.skills?.join(', ') || '',
      '登録日': format(member.createdAt, 'yyyy/MM/dd', { locale: ja })
    }));

    const staffWs = XLSX.utils.json_to_sheet(staffData);
    XLSX.utils.book_append_sheet(wb, staffWs, 'スタッフ基本情報');

    // 出勤実績サマリーシート
    if (attendanceSummaries.length > 0) {
      const attendanceData = attendanceSummaries.map(summary => {
        const staffMember = staff.find(s => s.uid === summary.userId);
        return {
          'スタッフ名': staffMember?.name || '不明',
          '期間開始': format(summary.period.start, 'yyyy/MM/dd', { locale: ja }),
          '期間終了': format(summary.period.end, 'yyyy/MM/dd', { locale: ja }),
          '出勤日数': summary.totalWorkDays,
          '総労働時間': `${Math.round(summary.totalWorkTime / 60)}時間${summary.totalWorkTime % 60}分`,
          '残業時間': `${Math.round(summary.totalOvertimeMinutes / 60)}時間${summary.totalOvertimeMinutes % 60}分`,
          '平均労働時間': `${summary.averageWorkTimePerDay.toFixed(1)}時間`,
          '出勤率': `${summary.attendanceRate.toFixed(1)}%`,
          '遅刻回数': summary.lateCount,
          '早退回数': summary.earlyLeaveCount
        };
      });

      const attendanceWs = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, attendanceWs, '出勤実績');
    }

    // 予算データがある場合はコスト分析シートを追加
    if (budgetCalculation) {
      const costAnalysisData = budgetCalculation.staffCosts.map(staffCost => {
        const staffMember = staff.find(s => s.uid === staffCost.userId);
        const attendance = attendanceSummaries.find(a => a.userId === staffCost.userId);
        
        return {
          'スタッフ名': staffCost.userName,
          '設定時給': `¥${staffMember?.hourlyRate?.toLocaleString() || '未設定'}`,
          '実働時間': `${staffCost.totalHours.toFixed(1)}時間`,
          '時間コスト効率': staffMember?.hourlyRate ? 
            `¥${Math.round(staffCost.totalCost / staffCost.totalHours).toLocaleString()}/時間` : '計算不可',
          '基本給比率': `${((staffCost.basePay / staffCost.totalCost) * 100).toFixed(1)}%`,
          '残業代比率': `${((staffCost.overtimePay / staffCost.totalCost) * 100).toFixed(1)}%`,
          '手当比率': `${(((staffCost.nightShiftBonus + staffCost.holidayBonus) / staffCost.totalCost) * 100).toFixed(1)}%`,
          '出勤率': attendance ? `${attendance.attendanceRate.toFixed(1)}%` : '未集計',
          '総コスト': `¥${staffCost.totalCost.toLocaleString()}`
        };
      });

      const costWs = XLSX.utils.json_to_sheet(costAnalysisData);
      XLSX.utils.book_append_sheet(wb, costWs, 'コスト分析');
    }

    const fileName = filename || `スタッフ統計_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * 複合レポート（全データ統合）をExcelファイルとしてエクスポート
   */
  exportComprehensiveReport(
    shifts: ShiftExtended[],
    budgetCalculation: BudgetCalculation,
    staff: User[],
    attendanceSummaries?: AttendanceSummary[],
    filename?: string
  ): void {
    const wb = XLSX.utils.book_new();

    // エグゼクティブサマリー
    const executiveSummary = [
      { '項目': '対象期間', '値': budgetCalculation.period.name, '備考': '' },
      { '項目': '総シフト数', '値': shifts.length, '備考': `公開済み: ${shifts.filter(s => s.status === 'published').length}件` },
      { '項目': '総スタッフ数', '値': staff.length, '備考': `アクティブスタッフ: ${staff.length}名` },
      { '項目': '総労働時間', '値': `${budgetCalculation.summary.totalHours.toFixed(1)}時間`, '備考': '' },
      { '項目': '総人件費', '値': `¥${budgetCalculation.summary.totalCost.toLocaleString()}`, '備考': '' },
      ...(budgetCalculation.summary.budgetLimit ? [
        { '項目': '予算利用率', '値': `${((budgetCalculation.summary.totalCost / budgetCalculation.summary.budgetLimit) * 100).toFixed(1)}%`, '備考': budgetCalculation.summary.budgetVariance >= 0 ? '予算内' : '予算超過' }
      ] : []),
      { '項目': '平均時給', '値': `¥${Math.round(budgetCalculation.summary.totalBaseCost / budgetCalculation.summary.totalHours).toLocaleString()}`, '備考': '' },
      { '項目': '残業比率', '値': `${((budgetCalculation.summary.totalOvertimeCost / budgetCalculation.summary.totalCost) * 100).toFixed(1)}%`, '備考': '' }
    ];

    const summaryWs = XLSX.utils.json_to_sheet(executiveSummary);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'エグゼクティブサマリー');

    // 他のシートを追加（既存メソッドを活用）
    this.addShiftDataToWorkbook(wb, shifts);
    this.addBudgetDataToWorkbook(wb, budgetCalculation);
    this.addStaffDataToWorkbook(wb, staff, attendanceSummaries);

    const fileName = filename || `総合レポート_${budgetCalculation.period.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ヘルパーメソッド
  private addShiftDataToWorkbook(wb: XLSX.WorkBook, shifts: ShiftExtended[]): void {
    const shiftData = shifts.map(shift => ({
      '日付': format(shift.date, 'yyyy/MM/dd (E)', { locale: ja }),
      'ステータス': this.getStatusLabel(shift.status),
      '必要スタッフ': shift.metadata.totalRequiredStaff,
      '配置スタッフ': shift.metadata.totalAssignedStaff,
      '配置率': `${((shift.metadata.totalAssignedStaff / shift.metadata.totalRequiredStaff) * 100).toFixed(1)}%`,
      '推定コスト': `¥${shift.metadata.estimatedCost?.toLocaleString() || '0'}`
    }));
    
    const ws = XLSX.utils.json_to_sheet(shiftData);
    XLSX.utils.book_append_sheet(wb, ws, 'シフト概要');
  }

  private addBudgetDataToWorkbook(wb: XLSX.WorkBook, budgetCalculation: BudgetCalculation): void {
    const staffCosts = budgetCalculation.staffCosts.map(staff => ({
      'スタッフ名': staff.userName,
      '労働時間': staff.totalHours.toFixed(1),
      '総コスト': staff.totalCost.toLocaleString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(staffCosts);
    XLSX.utils.book_append_sheet(wb, ws, '予算概要');
  }

  private addStaffDataToWorkbook(wb: XLSX.WorkBook, staff: User[], attendanceSummaries?: AttendanceSummary[]): void {
    const staffOverview = staff.map(member => ({
      'スタッフ名': member.name,
      '雇用形態': this.getEmploymentTypeLabel(member.employmentType),
      '時給': member.hourlyRate ? `¥${member.hourlyRate.toLocaleString()}` : '未設定',
      'スキル数': member.skills?.length || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(staffOverview);
    XLSX.utils.book_append_sheet(wb, ws, 'スタッフ概要');
  }

  // ラベル変換メソッド
  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: '下書き',
      published: '公開済み',
      completed: '完了'
    };
    return labels[status] || status;
  }

  private getComplexityLabel(complexity: string): string {
    const labels: Record<string, string> = {
      simple: 'シンプル',
      moderate: '標準',
      complex: '複雑'
    };
    return labels[complexity] || complexity;
  }

  private getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '緊急'
    };
    return labels[priority] || priority;
  }

  private getDayTypeLabel(dayType: string): string {
    const labels: Record<string, string> = {
      weekday: '平日',
      weekend: '休日',
      holiday: '祝日'
    };
    return labels[dayType] || dayType;
  }

  private getEmploymentTypeLabel(employmentType?: string): string {
    const labels: Record<string, string> = {
      'full-time': '正社員',
      'part-time': 'アルバイト',
      'contract': '契約社員'
    };
    return labels[employmentType || ''] || '未設定';
  }

  /**
   * 直感的なシフト表をExcelファイルとしてエクスポート
   * スタッフ×日付のマトリックス形式
   */
  exportShiftTable(
    shifts: ShiftExtended[], 
    staff: User[], 
    startDate: Date, 
    endDate: Date,
    format: 'daily' | 'weekly' | 'monthly',
    filename?: string
  ): void {
    const wb = XLSX.utils.book_new();

    // 日付範囲を生成
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // シフト表データを構築
    const tableData: any[] = [];
    
    // ヘッダー行
    const header = ['スタッフ名', ...dates.map(date => 
      this.formatDateForTable(date, format)
    )];
    tableData.push(header);

    // スタッフごとの行
    staff.forEach(staffMember => {
      const row = [staffMember.name];
      
      dates.forEach(date => {
        const dayShifts = this.getStaffShiftsForDate(shifts, staffMember.uid, date);
        let cellValue = '';
        
        if (dayShifts.length > 0) {
          // シフトが複数ある場合は改行で区切る
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s => 
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}-${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join('\n');
        } else {
          cellValue = '';
        }
        
        row.push(cellValue);
      });
      
      tableData.push(row);
    });

    // ワークシートを作成
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    
    // スタイリング
    this.styleShiftTable(ws, dates.length + 1, staff.length + 1);
    
    XLSX.utils.book_append_sheet(wb, ws, 'シフト表');

    // サマリーシートも追加
    this.addSummarySheet(wb, shifts, staff, startDate, endDate);

    const fileName = filename || this.generateShiftTableFilename(startDate, endDate, format);
    XLSX.writeFile(wb, fileName);
  }

  private formatDateForTable(date: Date, format: 'daily' | 'weekly' | 'monthly'): string {
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    
    switch (format) {
      case 'daily':
        return `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;
      case 'weekly':
        return `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;
      case 'monthly':
        return `${date.getDate()}`;
      default:
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  }

  private getStaffShiftsForDate(shifts: ShiftExtended[], staffId: string, date: Date): ShiftExtended[] {
    return shifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      const isSameDay = shiftDate.toDateString() === date.toDateString();
      const hasStaffAssigned = shift.slots.some(slot => 
        slot.assignedStaff?.includes(staffId)
      );
      return isSameDay && hasStaffAssigned;
    });
  }

  private styleShiftTable(ws: XLSX.WorkSheet, cols: number, rows: number): void {
    const range = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: cols - 1, r: rows - 1 } });
    ws['!ref'] = range;

    // 列幅を設定
    const colWidths = [{ wch: 15 }]; // スタッフ名列
    for (let i = 1; i < cols; i++) {
      colWidths.push({ wch: 12 }); // 日付列
    }
    ws['!cols'] = colWidths;

    // 行の高さを設定
    const rowHeights: any[] = [];
    for (let i = 0; i < rows; i++) {
      rowHeights.push({ hpt: i === 0 ? 25 : 20 }); // ヘッダーは高く
    }
    ws['!rows'] = rowHeights;
  }

  private addSummarySheet(wb: XLSX.WorkBook, shifts: ShiftExtended[], staff: User[], startDate: Date, endDate: Date): void {
    const summaryData = [
      ['項目', '値'],
      ['対象期間', `${this.formatDate(startDate)} ～ ${this.formatDate(endDate)}`],
      ['対象スタッフ数', staff.length],
      ['総シフト数', shifts.length],
      ['公開済みシフト', shifts.filter(s => s.status === 'published').length],
      ['下書きシフト', shifts.filter(s => s.status === 'draft').length],
      ['', ''],
      ['スタッフ別シフト数', ''],
      ...staff.map(s => [
        s.name, 
        shifts.filter(shift => 
          shift.slots.some(slot => slot.assignedStaff?.includes(s.uid))
        ).length
      ])
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'サマリー');
  }

  private generateShiftTableFilename(startDate: Date, endDate: Date, format: 'daily' | 'weekly' | 'monthly'): string {
    const startStr = this.formatDateForFilename(startDate);
    const endStr = this.formatDateForFilename(endDate);
    
    const formatLabels = {
      daily: '日別',
      weekly: '週別', 
      monthly: '月別'
    };
    
    return `シフト表_${startStr}-${endStr}_${formatLabels[format]}.xlsx`;
  }

  private formatDate(date: Date): string {
    return format(date, 'yyyy年M月d日', { locale: ja });
  }

  private formatDateForFilename(date: Date): string {
    return format(date, 'yyyyMMdd');
  }
}

export const excelService = new ExcelService();