export type CalendarViewType = "month" | "week" | "day" | "grid";

export type LayoutMode = "standard" | "compact" | "wide";

export interface CalendarConfig {
  view: CalendarViewType;
  layout: LayoutMode;
  showWeekends: boolean;
  startOfWeek: number; // 0 = Sunday, 1 = Monday
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  description?: string;
}

export interface TimeSlot {
  start: string; // HH:mm format
  end: string;   // HH:mm format
  duration: number; // minutes
}

export interface CalendarCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
}

export interface CalendarWeek {
  weekNumber: number;
  days: CalendarCell[];
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarWeek[];
}

export interface CalendarNavigation {
  current: Date;
  previous: () => void;
  next: () => void;
  goToDate: (date: Date) => void;
  goToToday: () => void;
}