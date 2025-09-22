import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";

export function getMonthDates(selectedDate: Date): Date[] {
  const startDate = startOfMonth(selectedDate);
  const endDate = endOfMonth(selectedDate);
  return eachDayOfInterval({ start: startDate, end: endDate });
}

export function getWeekDates(selectedDate: Date): Date[] {
  const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: startDate, end: endDate });
}

export function getDayRange(selectedDate: Date, range: number = 7): Date[] {
  const startDate = subDays(selectedDate, Math.floor(range / 2));
  const endDate = addDays(selectedDate, Math.floor(range / 2));
  return eachDayOfInterval({ start: startDate, end: endDate });
}

export function formatDateForDisplay(date: Date): string {
  return format(date, "yyyy年M月d日", { locale: ja });
}

export function formatDateForInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatTimeForDisplay(time: string): string {
  return time;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return format(date1, "yyyy-MM-dd") === format(date2, "yyyy-MM-dd");
}

export function getDayOfWeek(date: Date): string {
  return format(date, "E", { locale: ja });
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}