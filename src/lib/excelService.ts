import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
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
          // シフトが複数ある場合はカンマで区切る（完成図に合わせて）
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s =>
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}〜${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join(', ');
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
        return `${date.getMonth() + 1}/${date.getDate()} (${dayOfWeek})`;
      case 'weekly':
        return `${date.getMonth() + 1}/${date.getDate()} (${dayOfWeek})`;
      case 'monthly':
        return `${date.getMonth() + 1}/${date.getDate()} (${dayOfWeek})`;
      default:
        return `${date.getMonth() + 1}/${date.getDate()} (${dayOfWeek})`;
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
    // ワークシートの範囲を明示的に設定
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

    // 全セルにスタイルを適用（強制適用版）
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });

        // セルを確実に初期化
        if (!ws[cellAddress]) {
          ws[cellAddress] = {
            t: 's',
            v: '',
            s: {}
          };
        }

        // スタイルオブジェクトを確実に初期化
        if (!ws[cellAddress].s) {
          ws[cellAddress].s = {};
        }

        // スタイルを強制的に設定
        ws[cellAddress].s = {
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };

        // ヘッダー行の追加スタイル
        if (r === 0) {
          ws[cellAddress].s.fill = {
            patternType: 'solid',
            fgColor: { rgb: 'F0F0F0' }
          };
          ws[cellAddress].s.font = {
            bold: true,
            color: { rgb: '000000' }
          };
        }
      }
    }

    console.log('🎨 Shift table styling completed for', rows, 'rows x', cols, 'cols');
  }

  private styleMonthlyTable(ws: XLSX.WorkSheet, cols: number, rows: number): void {
    // ワークシートの範囲を明示的に設定
    const range = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: cols - 1, r: rows - 1 } });
    ws['!ref'] = range;

    // 列幅を設定
    const colWidths = [{ wch: 18 }]; // 日付列
    for (let i = 1; i < cols; i++) {
      colWidths.push({ wch: 15 }); // スタッフ名列
    }
    ws['!cols'] = colWidths;

    // 行の高さを設定
    const rowHeights: any[] = [];
    for (let i = 0; i < rows; i++) {
      rowHeights.push({ hpt: i === 0 ? 25 : 20 }); // ヘッダーは高く
    }
    ws['!rows'] = rowHeights;

    // 全セルにスタイルを適用（空セル対応版）
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });

        // セルを確実に初期化（空白でも表示されるように）
        if (!ws[cellAddress]) {
          ws[cellAddress] = {
            t: 's',
            v: ' ',  // 空白文字を設定
            s: {}
          };
        }

        // 既存のセルの値が完全に空の場合も空白文字を設定
        if (!ws[cellAddress].v && ws[cellAddress].v !== 0) {
          ws[cellAddress].v = ' ';
          ws[cellAddress].t = 's';
        }

        // スタイルオブジェクトを確実に初期化
        if (!ws[cellAddress].s) {
          ws[cellAddress].s = {};
        }

        // スタイルを強制的に設定
        ws[cellAddress].s = {
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };

        // ヘッダー行の追加スタイル
        if (r === 0) {
          ws[cellAddress].s.fill = {
            patternType: 'solid',
            fgColor: { rgb: 'F0F0F0' }
          };
          ws[cellAddress].s.font = {
            bold: true,
            color: { rgb: '000000' }
          };
        }
      }
    }

    console.log('🎨 Monthly table styling completed for', rows, 'rows x', cols, 'cols');
  }

  private styleMonthlyTableFromB2(ws: XLSX.WorkSheet, cols: number, rows: number): void {
    // 🎨 STEP 1: 大きな範囲を全て白で塗りつぶし（Excelの塗りつぶし機能）
    const expandedCols = Math.max(cols + 10, 15); // 十分な余裕をもって範囲拡大
    const expandedRows = Math.max(rows + 10, 40); // 十分な余裕をもって範囲拡大

    for (let r = 0; r < expandedRows; r++) {
      for (let c = 0; c < expandedCols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 }); // B2から開始
        // セルを作成して白で塗りつぶし
        ws[cellAddress] = {
          t: 's',
          v: ' ', // 空白文字で確実にセル存在
          s: {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFFFFF' }  // 白で塗りつぶし
            },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            },
            alignment: { horizontal: 'center', vertical: 'center' },
            font: { color: { rgb: '000000' }, size: 11 }
          }
        };
      }
    }

    console.log(`🎨 白塗りつぶし完了: ${expandedRows}行 x ${expandedCols}列の範囲を白で塗りつぶしました`);

    // B2から開始する範囲でワークシートの範囲を設定
    const range = XLSX.utils.encode_range({ s: { c: 1, r: 1 }, e: { c: expandedCols, r: expandedRows } });
    ws['!ref'] = range;

    // 列幅を設定（B列から開始）
    const colWidths = [
      undefined, // A列（空）
      { wch: 18 }, // B列: 日付列
      ...Array.from({ length: expandedCols - 1 }, () => ({ wch: 15 })) // C列以降: スタッフ名列
    ];
    ws['!cols'] = colWidths;

    // 行の高さを設定
    const rowHeights: any[] = [];
    for (let i = 0; i <= expandedRows + 1; i++) {
      rowHeights.push({ hpt: 20 }); // 全行同じ高さ
    }
    ws['!rows'] = rowHeights;

    // 全セルにスタイルを適用（B2から開始）
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 }); // B2から開始するため+1

        // 🎨 強制的に全セルを白い背景で初期化（より確実な方法）
        ws[cellAddress] = {
          t: 's',
          v: '\u00A0', // 改行しないスペース文字で確実に表示
          s: {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFFFFF' },
              bgColor: { rgb: 'FFFFFF' }  // 背景色も明示的に設定
            },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            font: {
              color: { rgb: '000000' },
              size: 11
            }
          }
        };

        // 特別なスタイル設定
        if (r === 0) {
          // タイトル行のスタイル（背景は白のまま、フォントだけ変更）
          ws[cellAddress].s.font = {
            bold: true,
            size: 12,
            color: { rgb: '000000' }
          };
        } else if (r === 2) {
          // ヘッダー行のスタイル（スタッフ名行も背景は白）
          ws[cellAddress].s.font = {
            bold: true,
            size: 11,
            color: { rgb: '000000' }
          };
        }
      }
    }

    console.log('🎨 Monthly table styling (B2 origin) completed with clear borders and white background');
  }

  private styleWeeklyTableFromB2(ws: XLSX.WorkSheet, cols: number, rows: number): void {
    // 🎨 STEP 1: 大きな範囲を全て白で塗りつぶし（Excelの塗りつぶし機能）
    const expandedCols = Math.max(cols + 10, 35); // 日付列が多いので十分な余裕
    const expandedRows = Math.max(rows + 10, 15); // 十分な余裕をもって範囲拡大

    for (let r = 0; r < expandedRows; r++) {
      for (let c = 0; c < expandedCols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 }); // B2から開始
        // セルを作成して白で塗りつぶし
        ws[cellAddress] = {
          t: 's',
          v: ' ', // 空白文字で確実にセル存在
          s: {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFFFFF' }  // 白で塗りつぶし
            },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            },
            alignment: { horizontal: 'center', vertical: 'center' },
            font: { color: { rgb: '000000' }, size: 11 }
          }
        };
      }
    }

    console.log(`🎨 白塗りつぶし完了: ${expandedRows}行 x ${expandedCols}列の範囲を白で塗りつぶしました`);

    // B2から開始する範囲でワークシートの範囲を設定
    const range = XLSX.utils.encode_range({ s: { c: 1, r: 1 }, e: { c: expandedCols, r: expandedRows } });
    ws['!ref'] = range;

    // 列幅を設定（B列から開始、日付列が多いので狭く設定）
    const colWidths = [
      { wch: 12 }, // B列: スタッフ名列
      ...Array.from({ length: expandedCols - 1 }, () => ({ wch: 10 })) // C列以降: 日付列
    ];
    ws['!cols'] = colWidths;

    // 行の高さを設定
    const rowHeights: any[] = [];
    for (let i = 0; i < expandedRows + 2; i++) {
      rowHeights.push({ hpt: i === 2 ? 25 : 20 }); // ヘッダー行は高く
    }
    ws['!rows'] = rowHeights;

    // 全セルにスタイルを適用（B2から開始）
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 }); // B2から開始するため+1

        // 🎨 強制的に全セルを白い背景で初期化（より確実な方法）
        ws[cellAddress] = {
          t: 's',
          v: '\u00A0', // 改行しないスペース文字で確実に表示
          s: {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'FFFFFF' },
              bgColor: { rgb: 'FFFFFF' }  // 背景色も明示的に設定
            },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            font: {
              color: { rgb: '000000' },
              size: 11
            }
          }
        };

        // 特別なスタイル設定
        if (r === 0) {
          // タイトル行のスタイル
          ws[cellAddress].s.fill = {
            patternType: 'solid',
            fgColor: { rgb: 'FFFFFF' }  // 真っ白
          };
          ws[cellAddress].s.font = {
            bold: true,
            size: 12,
            color: { rgb: '000000' }
          };
          ws[cellAddress].s.alignment = {
            horizontal: 'center',
            vertical: 'center'
          };
        } else if (r === 2) {
          // ヘッダー行（日付行）のスタイル
          ws[cellAddress].s.fill = {
            patternType: 'solid',
            fgColor: { rgb: 'FFFFFF' }  // 真っ白
          };
          ws[cellAddress].s.font = {
            bold: true,
            color: { rgb: '000000' },
            size: 8  // 日付は小さく
          };
        } else if (r === rows - 1) {
          // 最終行（作成者情報）のスタイル
          ws[cellAddress].s.fill = {
            patternType: 'solid',
            fgColor: { rgb: 'FFFFFF' }  // 真っ白
          };
          ws[cellAddress].s.font = {
            size: 8,
            color: { rgb: '666666' }
          };
          ws[cellAddress].s.alignment = {
            horizontal: 'right',
            vertical: 'center'
          };
        } else if (r >= 3 && r <= rows - 3) {
          // スタッフデータ行のスタイル
          if (c === 0) {
            // スタッフ名列
            ws[cellAddress].s.fill = {
              patternType: 'solid',
              fgColor: { rgb: 'FFFFFF' }  // 真っ白
            };
            ws[cellAddress].s.font = {
              bold: true,
              color: { rgb: '000000' }
            };
            ws[cellAddress].s.alignment = {
              horizontal: 'center',
              vertical: 'center'
            };
          }
        }
      }
    }

    console.log('🎨 Weekly table styling (B2 origin) completed for', rows, 'rows x', cols, 'cols');
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

  /**
   * 月別シフトスケジュールをExcelファイルとしてエクスポート（縦レイアウト）- ExcelJS版
   * 日付が縦軸、スタッフが横軸の月版完成図に準拠
   */
  async exportMonthlyScheduleExcelJS(
    shifts: ShiftExtended[],
    staff: User[],
    selectedDate: Date,
    filename?: string
  ): Promise<void> {
    console.log('📊 Starting monthly schedule export with ExcelJS...');
    console.log('📅 Selected date:', selectedDate);
    console.log('👥 Staff count:', staff.length);
    console.log('📋 Shifts count:', shifts.length);

    const workbook = new ExcelJS.Workbook();

    // ワークブック設定
    workbook.creator = 'Shifty';
    workbook.lastModifiedBy = 'Shifty';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('シフト表', {
      properties: {
        tabColor: { argb: 'FFFFFFFF' },
        defaultRowHeight: 15,
        defaultColWidth: 12
      }
    });

    const startDate = startOfMonth(selectedDate);
    const endDate = endOfMonth(selectedDate);

    // 日付範囲を生成
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // 🎨 STEP 1: まずシート全体を白で塗りつぶし（A1:Z100の大きな範囲）
    console.log('🎨 Filling entire sheet with white background...');
    for (let r = 1; r <= 100; r++) {
      for (let c = 1; c <= 26; c++) {
        const cell = worksheet.getCell(r, c);
        cell.value = '';
        cell.style = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          }
        };
      }
    }

    // 🎨 STEP 2: お手本通りの構造でデータを配置（B2から開始）
    console.log('🎨 Building monthly data structure...');

    // 1行目（B2）: タイトル行（期間表示）- 年月のみ表示
    const titleCell = worksheet.getCell(2, 2);
    titleCell.value = `${format(startDate, 'yyyy/M', { locale: ja })}のシフト`;
    titleCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
      border: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
    };

    // 2行目（B3）: ヘッダー行（名前とスタッフ名）
    const headerStartRow = 3;
    const dateHeaderCell = worksheet.getCell(headerStartRow, 2);
    dateHeaderCell.value = '名前';
    dateHeaderCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
      border: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
    };

    // スタッフ名をヘッダーに配置
    staff.forEach((staffMember, index) => {
      const headerCell = worksheet.getCell(headerStartRow, 3 + index);
      headerCell.value = staffMember.name;
      headerCell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
      };
    });

    // 4行目以降: 日付ごとの行
    dates.forEach((date, dateIndex) => {
      const rowIndex = headerStartRow + 1 + dateIndex;
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;

      // 日付列
      const dateCell = worksheet.getCell(rowIndex, 2);
      dateCell.value = dateStr;
      dateCell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        font: { color: { argb: 'FF000000' }, size: 8 }
      };

      // スタッフごとのシフト情報
      staff.forEach((staffMember, staffIndex) => {
        const dataCell = worksheet.getCell(rowIndex, 3 + staffIndex);

        const dayShifts = this.getStaffShiftsForDate(shifts, staffMember.uid, date);
        let cellValue = '';

        if (dayShifts.length > 0) {
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s =>
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}〜${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join(', ');
        }

        dataCell.value = cellValue || '';
        dataCell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
          border: {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'medium', color: { argb: 'FF000000' } }
          },
          alignment: { horizontal: 'center', vertical: 'middle' },
          font: { color: { argb: 'FF000000' }, size: 11 }
        };
      });
    });

    // 列幅と行高さ設定
    worksheet.getColumn(2).width = 18; // 日付列
    for (let i = 0; i < staff.length; i++) {
      worksheet.getColumn(3 + i).width = 15; // スタッフ列
    }

    // 個別の行高さ設定（よりコンパクトに）
    const totalRows = headerStartRow + dates.length + 3; // タイトル + ヘッダー + 日付行 + 底部3行
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      if (r <= 3) {
        // タイトル・ヘッダー行は少し高く
        row.height = 18;
      } else {
        // データ行はコンパクトに
        row.height = 14;
      }
    }

    // ファイル保存
    const fileName = filename || `月別シフト表_${format(selectedDate, 'yyyy年MM月', { locale: ja })}.xlsx`;
    console.log('💾 Saving file:', fileName);

    const buffer = await workbook.xlsx.writeBuffer();

    // ブラウザでダウンロード
    if (typeof window !== 'undefined') {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }

    console.log('✅ Monthly schedule export completed successfully with ExcelJS');
  }

  /**
   * 週別シフトスケジュールをExcelファイルとしてエクスポート（横レイアウト）- ExcelJS版
   * スタッフが縦軸、日付が横軸の週版完成図に準拠
   */
  async exportWeeklyScheduleExcelJS(
    shifts: ShiftExtended[],
    staff: User[],
    selectedDate: Date,
    filename?: string
  ): Promise<void> {
    console.log('📊 Starting weekly schedule export with ExcelJS...');
    console.log('📅 Selected date:', selectedDate);
    console.log('👥 Staff count:', staff.length);
    console.log('📋 Shifts count:', shifts.length);

    const workbook = new ExcelJS.Workbook();

    // ワークブック設定
    workbook.creator = 'Shifty';
    workbook.lastModifiedBy = 'Shifty';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('シフト表', {
      properties: {
        tabColor: { argb: 'FFFFFFFF' },
        defaultRowHeight: 15,
        defaultColWidth: 10
      }
    });

    const startDate = startOfMonth(selectedDate);
    const endDate = endOfMonth(selectedDate);

    // 日付範囲を生成（月全体）
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // 🎨 STEP 1: まずシート全体を白で塗りつぶし（A1:AF100の大きな範囲）
    console.log('🎨 Filling entire sheet with white background...');
    for (let r = 1; r <= 100; r++) {
      for (let c = 1; c <= 32; c++) { // AFまで（週別は横に長い）
        const cell = worksheet.getCell(r, c);
        cell.value = '';
        cell.style = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          }
        };
      }
    }

    // 🎨 STEP 2: お手本通りの構造でデータを配置（B2から開始）
    console.log('🎨 Building weekly data structure...');

    // 1行目（B2）: タイトル行（期間表示）- 年月のみ表示
    const titleCell = worksheet.getCell(2, 2);
    titleCell.value = `${format(startDate, 'yyyy/M', { locale: ja })}のシフト`;
    titleCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
      border: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
    };

    // 2行目（B3）: ヘッダー行（名前と日付）
    const headerStartRow = 3;
    const staffHeaderCell = worksheet.getCell(headerStartRow, 2);
    staffHeaderCell.value = '名前';
    staffHeaderCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
      border: {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } }
      },
      alignment: { horizontal: 'center', vertical: 'middle' },
      font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
    };

    // 日付をヘッダーに配置
    dates.forEach((date, index) => {
      const headerCell = worksheet.getCell(headerStartRow, 3 + index);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
      headerCell.value = dateStr;
      headerCell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        font: { bold: true, color: { argb: 'FF000000' }, size: 8 }
      };
    });

    // 4行目以降: スタッフごとの行
    staff.forEach((staffMember, staffIndex) => {
      const rowIndex = headerStartRow + 1 + staffIndex;

      // スタッフ名列
      const staffCell = worksheet.getCell(rowIndex, 2);
      staffCell.value = staffMember.name;
      staffCell.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        },
        alignment: { horizontal: 'center', vertical: 'middle' },
        font: { bold: true, color: { argb: 'FF000000' }, size: 11 }
      };

      // 日付ごとのシフト情報
      dates.forEach((date, dateIndex) => {
        const dataCell = worksheet.getCell(rowIndex, 3 + dateIndex);

        const dayShifts = this.getStaffShiftsForDate(shifts, staffMember.uid, date);
        let cellValue = '';

        if (dayShifts.length > 0) {
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s =>
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}〜${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join(', ');
        }

        dataCell.value = cellValue || '';
        dataCell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
          border: {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'medium', color: { argb: 'FF000000' } }
          },
          alignment: { horizontal: 'center', vertical: 'middle' },
          font: { color: { argb: 'FF000000' }, size: 11 }
        };
      });
    });

    // 底部の行全体に格子を適用
    const bottomStartRow = headerStartRow + staff.length + 1;

    // 最後から2行目: 空行（全列に格子適用）
    for (let c = 0; c < dates.length + 1; c++) {
      const emptyCell1 = worksheet.getCell(bottomStartRow, 2 + c);
      emptyCell1.value = '';
      emptyCell1.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        }
      };
    }

    // 最後から1行目: 空行（全列に格子適用）
    for (let c = 0; c < dates.length + 1; c++) {
      const emptyCell2 = worksheet.getCell(bottomStartRow + 1, 2 + c);
      emptyCell2.value = '';
      emptyCell2.style = {
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: {
          top: { style: 'medium', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'medium', color: { argb: 'FF000000' } }
        }
      };
    }

    // 最後の行: 作成者情報（全列に格子適用）
    for (let c = 0; c < dates.length + 1; c++) {
      const creatorCell = worksheet.getCell(bottomStartRow + 2, 2 + c);
      if (c === dates.length - 1) {
        // 最後の列に作成者情報
        creatorCell.value = `${format(new Date(), 'yyyy年M月d日 HH:mm', { locale: ja })}「Shifty」から作成`;
        creatorCell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
          border: {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'medium', color: { argb: 'FF000000' } }
          },
          alignment: { horizontal: 'right', vertical: 'middle' },
          font: { color: { argb: 'FF666666' }, size: 8 }
        };
      } else {
        // 他の列は空
        creatorCell.value = '';
        creatorCell.style = {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
          border: {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'medium', color: { argb: 'FF000000' } }
          }
        };
      }
    }

    // 列幅と行高さ設定
    worksheet.getColumn(2).width = 12; // スタッフ名列
    for (let i = 0; i < dates.length; i++) {
      worksheet.getColumn(3 + i).width = 10; // 日付列
    }

    // 個別の行高さ設定（よりコンパクトに）
    const totalRows = headerStartRow + staff.length + 3; // タイトル + ヘッダー + スタッフ行 + 底部3行
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r);
      if (r <= 3) {
        // タイトル・ヘッダー行は少し高く
        row.height = 18;
      } else {
        // データ行はコンパクトに
        row.height = 14;
      }
    }

    // ファイル保存
    const fileName = filename || `週別シフト表_${format(selectedDate, 'yyyy年MM月', { locale: ja })}.xlsx`;
    console.log('💾 Saving file:', fileName);

    const buffer = await workbook.xlsx.writeBuffer();

    // ブラウザでダウンロード
    if (typeof window !== 'undefined') {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }

    console.log('✅ Weekly schedule export completed successfully with ExcelJS');
  }

  /**
   * シート設定テスト用: 白塗りつぶし + 格子の確認用
   */
  testSheetSettings(): void {
    console.log('🧪 Testing sheet settings - white fill and grid...');

    const wb = XLSX.utils.book_new();
    const ws: XLSX.WorkSheet = {};

    // 🎨 ワークブック全体を白背景に設定
    wb.Props = {
      Title: 'シート設定テスト',
      Subject: '白塗りつぶし確認',
      Author: 'Shifty',
      CreatedDate: new Date()
    };

    // 🎨 大きな範囲を白で塗りつぶし + 格子
    const testRows = 30;
    const testCols = 15;

    console.log(`🎨 Creating ${testRows}x${testCols} white filled grid...`);

    // 最初に全範囲を空白セルで埋める
    for (let r = 0; r < testRows; r++) {
      for (let c = 0; c < testCols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 });
        ws[cellAddress] = { t: 's', v: '\u00A0', s: {} }; // Non-breaking space
      }
    }

    for (let r = 0; r < testRows; r++) {
      for (let c = 0; c < testCols; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r: r + 1, c: c + 1 }); // B2から開始

        // テストデータ（全セルにデータを入れて確実に背景色適用）
        let cellValue = '';
        if (r === 0 && c === 0) cellValue = '🎨 白塗りつぶしテスト';
        else if (r === 1 && c === 0) cellValue = '📋 格子罫線テスト';
        else if (r === 2 && c === 0) cellValue = `${r+1}行目`;
        else if (r < 5 && c < 5) cellValue = `${r+1}-${c+1}`;
        else if ((r + c) % 2 === 0) cellValue = '■'; // 市松模様でテスト
        else cellValue = '□'; // 白塗りつぶし確認用

        // セルにデータと完全なスタイルを設定
        ws[cellAddress] = {
          t: 's',
          v: cellValue,
          s: {
            fill: {
              patternType: 'solid',
              fgColor: { indexed: 64 },  // Excel色インデックス64=白
              bgColor: { indexed: 64 }   // 背景色もインデックス指定
            },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            },
            font: {
              color: { rgb: '000000' },
              size: 11
            }
          }
        };

        // タイトル行は太字
        if (r === 0) {
          ws[cellAddress].s.font = {
            bold: true,
            color: { rgb: '000000' },
            size: 12
          };
        }
      }
    }

    // ワークシートの範囲設定
    const endCell = XLSX.utils.encode_cell({ r: testRows, c: testCols });
    ws['!ref'] = `B2:${endCell}`;

    // ワークシート全体の背景色設定
    ws['!background'] = { color: 'FFFFFF' };
    ws['!tabColor'] = { rgb: 'FFFFFF' };

    // 列幅設定
    const colWidths = Array.from({ length: testCols }, () => ({ wch: 12 }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'シート設定テスト');

    const fileName = `シート設定テスト_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    console.log('💾 Saving test file:', fileName);
    XLSX.writeFile(wb, fileName);
    console.log('✅ Sheet settings test file created successfully!');
  }

  /**
   * ExcelJSでシート設定テスト: 確実な白塗りつぶし + 格子
   */
  async testSheetSettingsWithExcelJS(): Promise<void> {
    console.log('🧪 Testing sheet settings with ExcelJS - guaranteed white fill and grid...');

    const workbook = new ExcelJS.Workbook();

    // ワークブック設定
    workbook.creator = 'Shifty';
    workbook.lastModifiedBy = 'Shifty';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();

    const worksheet = workbook.addWorksheet('シート設定テスト', {
      properties: {
        tabColor: { argb: 'FFFFFFFF' },
        defaultRowHeight: 20,
        defaultColWidth: 12
      }
    });

    // 🎨 大きな範囲を白で塗りつぶし + 格子
    const testRows = 30;
    const testCols = 15;

    console.log(`🎨 Creating ${testRows}x${testCols} white filled grid with ExcelJS...`);

    // 🎨 STEP 1: まずシート全体を白で塗りつぶし（A1:Z100の大きな範囲）
    const fullSheetRows = 100;
    const fullSheetCols = 26; // A-Z列

    console.log(`🎨 First: Filling entire sheet A1:Z${fullSheetRows} with white background...`);

    for (let r = 1; r <= fullSheetRows; r++) {
      for (let c = 1; c <= fullSheetCols; c++) {
        const cell = worksheet.getCell(r, c);
        cell.value = ''; // 空白
        cell.style = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }  // 白で塗りつぶし
          }
        };
      }
    }

    console.log(`✅ Sheet background filled with white: ${fullSheetRows}x${fullSheetCols} cells`);

    // 🎨 STEP 2: テストデータ範囲に格子を追加（B2から開始）
    console.log(`🎨 Adding grid to test data area: ${testRows}x${testCols}...`);

    for (let r = 1; r <= testRows; r++) {
      for (let c = 1; c <= testCols; c++) {
        const cell = worksheet.getCell(r + 1, c + 1); // B2から開始

        // テストデータ
        let cellValue = '';
        if (r === 1 && c === 1) cellValue = '🎨 ExcelJS白塗りつぶしテスト';
        else if (r === 2 && c === 1) cellValue = '📋 ExcelJS格子罫線テスト';
        else if (r === 3 && c === 1) cellValue = `${r}行目`;
        else if (r <= 5 && c <= 5) cellValue = `${r}-${c}`;
        else if ((r + c) % 2 === 0) cellValue = '■';
        else cellValue = '□';

        cell.value = cellValue;

        // 🎨 確実な白塗りつぶし + 格子
        cell.style = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }  // 確実な白塗りつぶし
          },
          border: {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'medium', color: { argb: 'FF000000' } }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'middle'
          },
          font: {
            color: { argb: 'FF000000' },
            size: 11
          }
        };

        // タイトル行は太字
        if (r === 1) {
          cell.font = {
            bold: true,
            color: { argb: 'FF000000' },
            size: 12
          };
        }
      }
    }

    // 列幅設定
    for (let c = 1; c <= testCols; c++) {
      worksheet.getColumn(c + 1).width = 12;
    }

    // ファイル保存
    const fileName = `ExcelJS設定テスト_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    console.log('💾 Saving ExcelJS test file:', fileName);

    const buffer = await workbook.xlsx.writeBuffer();

    // ブラウザでダウンロード
    if (typeof window !== 'undefined') {
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }

    console.log('✅ ExcelJS sheet settings test file created successfully!');
  }

  /**
   * 月別シフトスケジュールをPDFファイルとしてエクスポート（HTMLテーブル → PDF）
   */
  async exportMonthlySchedulePDF(
    shifts: ShiftExtended[],
    staff: User[],
    selectedDate: Date,
    filename?: string
  ): Promise<void> {
    console.log('📊 Starting monthly PDF export with HTML-to-PDF approach...');

    const startDate = startOfMonth(selectedDate);
    const endDate = endOfMonth(selectedDate);

    // 日付範囲を生成
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // HTMLテーブルを作成
    const tableHtml = this.createMonthlyHTMLTable(dates, staff, shifts, selectedDate);

    // HTMLをPDFに変換
    await this.convertHTMLToPDF(tableHtml, filename || `月別シフト表_${format(selectedDate, 'yyyy年MM月', { locale: ja })}.pdf`);

    console.log('✅ Monthly PDF export completed successfully');
  }

  /**
   * 週別シフトスケジュールをPDFファイルとしてエクスポート（HTMLテーブル → PDF）
   */
  async exportWeeklySchedulePDF(
    shifts: ShiftExtended[],
    staff: User[],
    selectedDate: Date,
    filename?: string
  ): Promise<void> {
    console.log('📊 Starting weekly PDF export with HTML-to-PDF approach...');

    const startDate = startOfMonth(selectedDate);
    const endDate = endOfMonth(selectedDate);

    // 日付範囲を生成（月全体）
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // HTMLテーブルを作成
    const tableHtml = this.createWeeklyHTMLTable(dates, staff, shifts, selectedDate);

    // HTMLをPDFに変換
    await this.convertHTMLToPDF(tableHtml, filename || `週別シフト表_${format(selectedDate, 'yyyy年MM月', { locale: ja })}.pdf`, true);

    console.log('✅ Weekly PDF export completed successfully');
  }

  /**
   * 月別HTMLテーブルを作成（ExcelJSと同じ見た目）
   */
  private createMonthlyHTMLTable(
    dates: Date[],
    staff: User[],
    shifts: ShiftExtended[],
    selectedDate: Date
  ): string {
    const startDate = startOfMonth(selectedDate);
    const title = `${format(startDate, 'yyyy/M', { locale: ja })}のシフト`;

    let html = `
      <div style="background: white; padding: 20px; font-family: Arial, sans-serif;">
        <table style="
          border-collapse: collapse;
          background: white;
          font-size: 10pt;
          margin: 0 auto;
        ">
          <tr>
            <td colspan="${staff.length + 1}" style="
              border: 2px solid black;
              background: white;
              text-align: center;
              font-weight: bold;
              padding: 16px;
              font-size: 12pt;
              height: 50px;
            ">${title}</td>
          </tr>
          <tr>
            <td style="
              border: 2px solid black;
              background: white;
              text-align: center;
              font-weight: bold;
              padding: 14px;
              font-size: 10pt;
              width: 120px;
              height: 45px;
            ">名前</td>
    `;

    // スタッフ名ヘッダー
    staff.forEach(staffMember => {
      html += `
        <td style="
          border: 2px solid black;
          background: white;
          text-align: center;
          font-weight: bold;
          padding: 14px;
          font-size: 10pt;
          width: 100px;
          height: 45px;
        ">${staffMember.name}</td>
      `;
    });

    html += '</tr>';

    // 日付ごとの行
    dates.forEach(date => {
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;

      html += `
        <tr>
          <td style="
            border: 2px solid black;
            background: white;
            text-align: center;
            padding: 12px;
            font-size: 10pt;
            height: 40px;
          ">${dateStr}</td>
      `;

      staff.forEach(staffMember => {
        const dayShifts = this.getStaffShiftsForDate(shifts, staffMember.uid, date);
        let cellValue = '';

        if (dayShifts.length > 0) {
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s =>
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}〜${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join(',');
        }

        html += `
          <td style="
            border: 2px solid black;
            background: white;
            text-align: center;
            padding: 12px;
            font-size: 10pt;
            height: 40px;
          ">${cellValue}</td>
        `;
      });

      html += '</tr>';
    });

    html += `
        </table>
      </div>
    `;

    return html;
  }

  /**
   * 週別HTMLテーブルを作成（ExcelJSと同じ見た目）
   */
  private createWeeklyHTMLTable(
    dates: Date[],
    staff: User[],
    shifts: ShiftExtended[],
    selectedDate: Date
  ): string {
    const startDate = startOfMonth(selectedDate);
    const title = `${format(startDate, 'yyyy/M', { locale: ja })}のシフト`;

    let html = `
      <div style="background: white; padding: 20px; font-family: Arial, sans-serif;">
        <table style="
          border-collapse: collapse;
          background: white;
          font-size: 10pt;
          margin: 0 auto;
        ">
          <tr>
            <td colspan="${dates.length + 1}" style="
              border: 2px solid black;
              background: white;
              text-align: center;
              font-weight: bold;
              padding: 16px;
              font-size: 12pt;
              height: 50px;
            ">${title}</td>
          </tr>
          <tr>
            <td style="
              border: 2px solid black;
              background: white;
              text-align: center;
              font-weight: bold;
              padding: 14px;
              font-size: 10pt;
              width: 80px;
              height: 45px;
            ">名前</td>
    `;

    // 日付ヘッダー
    dates.forEach(date => {
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})`;
      html += `
        <td style="
          border: 2px solid black;
          background: white;
          text-align: center;
          font-weight: bold;
          padding: 10px 8px;
          font-size: 9pt;
          width: 60px;
          height: 45px;
        ">${dateStr}</td>
      `;
    });

    html += '</tr>';

    // スタッフごとの行
    staff.forEach(staffMember => {
      html += `
        <tr>
          <td style="
            border: 2px solid black;
            background: white;
            text-align: center;
            font-weight: bold;
            padding: 12px;
            font-size: 10pt;
            height: 40px;
          ">${staffMember.name}</td>
      `;

      dates.forEach(date => {
        const dayShifts = this.getStaffShiftsForDate(shifts, staffMember.uid, date);
        let cellValue = '';

        if (dayShifts.length > 0) {
          cellValue = dayShifts.map(shift => {
            const slot = shift.slots.find(s =>
              s.assignedStaff?.includes(staffMember.uid)
            );
            if (slot) {
              return `${slot.startTime}〜${slot.endTime}`;
            }
            return '';
          }).filter(Boolean).join(',');
        }

        html += `
          <td style="
            border: 2px solid black;
            background: white;
            text-align: center;
            padding: 10px 6px;
            font-size: 9pt;
            height: 40px;
          ">${cellValue}</td>
        `;
      });

      html += '</tr>';
    });

    html += `
        </table>
      </div>
    `;

    return html;
  }

  /**
   * HTMLテーブルをPDFに変換（テーブルサイズ自動フィット版）
   */
  private async convertHTMLToPDF(htmlContent: string, filename: string, isLandscape: boolean = false): Promise<void> {
    try {
      // 一時的なdiv要素を作成してテーブルのサイズを測定
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.visibility = 'hidden';
      document.body.appendChild(tempDiv);

      // テーブル要素のサイズを取得
      const table = tempDiv.querySelector('table');
      if (!table) {
        document.body.removeChild(tempDiv);
        throw new Error('Table not found in HTML content');
      }

      // スタイルを適用してテーブルのサイズを測定
      table.style.cssText = 'border-collapse: collapse; font-size: 14px;';
      const cells = table.querySelectorAll('td, th');
      cells.forEach((cell: any) => {
        cell.style.cssText = 'border: 2px solid black; padding: 10px; text-align: center; white-space: nowrap;';
      });

      // テーブルの実際のサイズを取得
      const tableRect = table.getBoundingClientRect();
      const tableWidth = Math.max(800, Math.ceil(tableRect.width || table.offsetWidth) + 100);
      const tableHeight = Math.max(600, Math.ceil(tableRect.height || table.offsetHeight) + 100);

      // tempDivを削除
      document.body.removeChild(tempDiv);

      // テーブルサイズに最適化されたiframe要素を作成
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = `${tableWidth}px`;
      iframe.style.height = `${tableHeight}px`;
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      // iframeの完全なHTMLドキュメントを作成
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('iframe document not accessible');
      }

      // テーブルにフィットしたHTMLドキュメントを作成（縦方向拡張版）
      const isolatedHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Helvetica', 'Arial', sans-serif !important;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 20px !important;
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
            }
            table {
              border-collapse: collapse !important;
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 auto !important;
              width: auto !important;
            }
            td, th {
              border: 2px solid #000000 !important;
              background: #ffffff !important;
              color: #000000 !important;
              padding: 20px 15px !important;  /* 上下パディングを増加 */
              text-align: center !important;
              font-size: 15px !important;  /* フォントサイズを少し大きく */
              vertical-align: middle !important;
              white-space: nowrap !important;
              min-height: 50px !important;  /* 最小高さを設定 */
              height: auto !important;
            }
            tr {
              min-height: 50px !important;  /* 行の最小高さ */
            }
            tr:first-child td {
              font-weight: bold !important;
              font-size: 18px !important;  /* タイトル行を大きく */
              padding: 25px 15px !important;  /* タイトル行のパディング増加 */
            }
            tr:nth-child(2) td {
              font-weight: bold !important;
              background-color: #f0f0f0 !important;
              padding: 20px 15px !important;
            }
            /* 各行に十分な高さを確保 */
            tr:not(:first-child):not(:nth-child(2)) td {
              padding: 18px 15px !important;
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(isolatedHTML);
      iframeDoc.close();

      // レンダリングを待つ
      await new Promise(resolve => setTimeout(resolve, 300));

      // テーブルの実際のサイズを再度取得
      const iframeTable = iframeDoc.querySelector('table');
      if (!iframeTable) {
        throw new Error('Table not found in iframe');
      }

      const actualWidth = iframeTable.offsetWidth + 40; // パディング込み
      const actualHeight = iframeTable.offsetHeight + 40;

      // html2canvasでテーブル部分だけキャンバスに変換
      const canvas = await html2canvas(iframeDoc.body, {
        backgroundColor: '#ffffff',
        scale: 2, // 高解像度
        useCORS: true,
        allowTaint: false,
        width: actualWidth,
        height: actualHeight,
        windowWidth: actualWidth,
        windowHeight: actualHeight
      });

      // iframe要素を削除
      document.body.removeChild(iframe);

      // PDFを作成
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      // A4フル活用のサイズ計算（縦方向優先）
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginX = 8; // 横マージン（8mm）
      const marginY = 5; // 縦マージン（5mm）- より少なく

      // 利用可能領域（縦方向を最大限活用）
      const availableWidth = pdfWidth - (marginX * 2);
      const availableHeight = pdfHeight - (marginY * 2);

      // キャンバスのアスペクト比
      const canvasAspectRatio = canvas.height / canvas.width;

      let imgWidth, imgHeight;

      // 縦方向を優先してフィット（A4縦向きの最大活用）
      // まず高さを最大にしてみる
      imgHeight = availableHeight;
      imgWidth = imgHeight / canvasAspectRatio;

      // 幅がオーバーする場合は幅基準に調整
      if (imgWidth > availableWidth) {
        imgWidth = availableWidth;
        imgHeight = imgWidth * canvasAspectRatio;

        // それでも高さが余る場合は、縦をもう少し使う
        if (imgHeight < availableHeight * 0.9) {
          const scaleFactor = Math.min(
            availableHeight / imgHeight,
            1.2 // 最大120%まで拡大
          );
          imgHeight = imgHeight * scaleFactor;
          imgWidth = imgWidth * scaleFactor;

          // 再度幅チェック
          if (imgWidth > availableWidth) {
            imgWidth = availableWidth;
            imgHeight = imgWidth * canvasAspectRatio;
          }
        }
      }

      // 上部配置（中央寄せ）
      const x = (pdfWidth - imgWidth) / 2;
      const y = marginY; // 上部から開始（最小マージン）

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(filename);

      console.log('✅ PDF generated successfully with full A4 utilization:', filename);

    } catch (error) {
      console.error('❌ PDF conversion error:', error);
      throw error;
    }
  }
}

export const excelService = new ExcelService();