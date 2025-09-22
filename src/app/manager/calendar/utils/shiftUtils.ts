import { ShiftExtended } from "@/types/shift";
import { User } from "@/types/auth";
import { isSameDay } from "./dateUtils";

export function getShiftsForDate(shifts: ShiftExtended[], date: Date): ShiftExtended[] {
  return shifts.filter(shift => isSameDay(new Date(shift.date), date));
}

export function getStaffShiftsForDate(shifts: ShiftExtended[], date: Date): Map<string, ShiftExtended[]> {
  const staffShifts = new Map<string, ShiftExtended[]>();

  const dayShifts = getShiftsForDate(shifts, date);

  dayShifts.forEach(shift => {
    shift.timeSlots.forEach(slot => {
      slot.assignedStaffIds.forEach(staffId => {
        if (!staffShifts.has(staffId)) {
          staffShifts.set(staffId, []);
        }

        const shiftForStaff: ShiftExtended = {
          ...shift,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timeSlots: [slot]
        };

        staffShifts.get(staffId)!.push(shiftForStaff);
      });
    });
  });

  return staffShifts;
}

export function getStaffWorkHours(shifts: ShiftExtended[], staffId: string, startDate: Date, endDate: Date): number {
  let totalHours = 0;

  shifts.forEach(shift => {
    const shiftDate = new Date(shift.date);
    if (shiftDate >= startDate && shiftDate <= endDate) {
      shift.timeSlots.forEach(slot => {
        if (slot.assignedStaffIds.includes(staffId)) {
          const start = new Date(`2000-01-01T${slot.startTime}:00`);
          const end = new Date(`2000-01-01T${slot.endTime}:00`);
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          totalHours += hours;
        }
      });
    }
  });

  return totalHours;
}

export function calculateShiftDuration(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const breakHours = breakMinutes / 60;
  return Math.max(0, durationHours - breakHours);
}

export function validateShiftTime(startTime: string, endTime: string): string | null {
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);

  if (start >= end) {
    return "開始時間は終了時間より前に設定してください";
  }

  const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (duration > 24) {
    return "シフト時間は24時間以内に設定してください";
  }

  if (duration < 0.5) {
    return "シフト時間は30分以上に設定してください";
  }

  return null;
}

export function getAvailableStaff(staff: User[], shifts: ShiftExtended[], date: Date, startTime: string, endTime: string): User[] {
  const dateShifts = getShiftsForDate(shifts, date);
  const busyStaffIds = new Set<string>();

  dateShifts.forEach(shift => {
    shift.timeSlots.forEach(slot => {
      // Check for time overlap
      const slotStart = new Date(`2000-01-01T${slot.startTime}:00`);
      const slotEnd = new Date(`2000-01-01T${slot.endTime}:00`);
      const newStart = new Date(`2000-01-01T${startTime}:00`);
      const newEnd = new Date(`2000-01-01T${endTime}:00`);

      if (newStart < slotEnd && newEnd > slotStart) {
        slot.assignedStaffIds.forEach(staffId => busyStaffIds.add(staffId));
      }
    });
  });

  return staff.filter(member => !busyStaffIds.has(member.uid));
}

export function formatShiftTimeDisplay(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}