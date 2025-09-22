import { ShiftExtended } from "@/types/shift";
import { User } from "@/types/auth";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { getMonthDates, getWeekDates, getDayRange } from "./dateUtils";
import { getStaffShiftsForDate } from "./shiftUtils";

export type ExportFormat = 'daily' | 'weekly' | 'monthly' | 'pdf';

export interface ExportData {
  title: string;
  dates: Date[];
  shifts: ShiftExtended[];
  staff: User[];
}

export function prepareExportData(
  format: ExportFormat,
  selectedDate: Date,
  shifts: ShiftExtended[],
  staff: User[]
): ExportData {
  let dates: Date[];
  let title: string;

  switch (format) {
    case 'daily':
      dates = [selectedDate];
      title = `${format(selectedDate, "yyyy年M月d日", { locale: ja })}のシフト表`;
      break;
    case 'weekly':
      dates = getWeekDates(selectedDate);
      title = `${format(selectedDate, "yyyy年M月", { locale: ja })} 週間シフト表`;
      break;
    case 'monthly':
      dates = getMonthDates(selectedDate);
      title = `${format(selectedDate, "yyyy年M月", { locale: ja })}のシフト表`;
      break;
    case 'pdf':
      dates = getMonthDates(selectedDate);
      title = `${format(selectedDate, "yyyy年M月", { locale: ja })}のシフト表 (PDF版)`;
      break;
    default:
      dates = getMonthDates(selectedDate);
      title = `${format(selectedDate, "yyyy年M月", { locale: ja })}のシフト表`;
  }

  return {
    title,
    dates,
    shifts,
    staff
  };
}

export function generateCSVData(exportData: ExportData): string {
  const { title, dates, shifts, staff } = exportData;

  let csv = `${title}\n\n`;

  // Header row
  csv += "日付,曜日," + staff.map(s => s.name).join(",") + "\n";

  // Data rows
  dates.forEach(date => {
    const dayOfWeek = format(date, "E", { locale: ja });
    const staffShifts = getStaffShiftsForDate(shifts, date);

    const row = [
      format(date, "M/d"),
      dayOfWeek,
      ...staff.map(staffMember => {
        const myShifts = staffShifts.get(staffMember.uid) || [];
        return myShifts.length > 0
          ? myShifts.map(shift => `${shift.startTime}-${shift.endTime}`).join(" / ")
          : "休み";
      })
    ];

    csv += row.join(",") + "\n";
  });

  return csv;
}

export function generateExcelData(exportData: ExportData): any[][] {
  const { title, dates, shifts, staff } = exportData;

  const data: any[][] = [];

  // Title row
  data.push([title]);
  data.push([]); // Empty row

  // Header row
  data.push(["日付", "曜日", ...staff.map(s => s.name)]);

  // Data rows
  dates.forEach(date => {
    const dayOfWeek = format(date, "E", { locale: ja });
    const staffShifts = getStaffShiftsForDate(shifts, date);

    const row = [
      format(date, "M/d"),
      dayOfWeek,
      ...staff.map(staffMember => {
        const myShifts = staffShifts.get(staffMember.uid) || [];
        return myShifts.length > 0
          ? myShifts.map(shift => `${shift.startTime}-${shift.endTime}`).join(" / ")
          : "休み";
      })
    ];

    data.push(row);
  });

  return data;
}

export function downloadCSV(data: string, filename: string) {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function generatePDFData(exportData: ExportData): any {
  const { title, dates, shifts, staff } = exportData;

  const tableData = [];

  // Header
  tableData.push(["日付", "曜日", ...staff.map(s => s.name)]);

  // Rows
  dates.forEach(date => {
    const dayOfWeek = format(date, "E", { locale: ja });
    const staffShifts = getStaffShiftsForDate(shifts, date);

    const row = [
      format(date, "M/d"),
      dayOfWeek,
      ...staff.map(staffMember => {
        const myShifts = staffShifts.get(staffMember.uid) || [];
        return myShifts.length > 0
          ? myShifts.map(shift => `${shift.startTime}-${shift.endTime}`).join("\n")
          : "休み";
      })
    ];

    tableData.push(row);
  });

  return {
    title,
    tableData,
    pageSize: 'A4',
    orientation: 'landscape'
  };
}