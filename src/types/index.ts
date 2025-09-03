export type UserRole = 'root' | 'manager' | 'staff';

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  shopId?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract';
  skills?: string[];
  availability?: {
    [day: string]: {
      available: boolean;
      timeSlots?: { start: string; end: string }[];
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Shop {
  shopId: string;
  name: string;
  address?: string;
  managers: string[]; // User UIDs
  staff: string[]; // User UIDs
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  shiftId: string;
  shopId: string;
  date: Date;
  slots: ShiftSlot[];
  status: 'draft' | 'published' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftSlot {
  slotId: string;
  startTime: string;
  endTime: string;
  requiredStaff: number;
  assignedStaff: string[]; // User UIDs
  positions?: string[];
}

export interface ShiftRequest {
  requestId: string;
  userId: string;
  shiftId: string;
  date: Date;
  preference: 'preferred' | 'available' | 'unavailable';
  timeSlots?: { start: string; end: string }[];
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftExchange {
  exchangeId: string;
  fromUserId: string;
  toUserId?: string;
  shiftId: string;
  shiftSlotId: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  notificationId: string;
  userId: string;
  type: 'shift_assigned' | 'shift_changed' | 'exchange_request' | 'exchange_response' | 'reminder' | 'announcement';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}