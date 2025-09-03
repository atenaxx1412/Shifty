import { create } from 'zustand';
import { User, Shop, Shift, ShiftRequest, Notification } from '@/types';

interface AppState {
  // User state
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  
  // Shop state
  currentShop: Shop | null;
  setCurrentShop: (shop: Shop | null) => void;
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
  
  // Shift state
  shifts: Shift[];
  setShifts: (shifts: Shift[]) => void;
  addShift: (shift: Shift) => void;
  updateShift: (shiftId: string, updates: Partial<Shift>) => void;
  
  // Shift requests
  shiftRequests: ShiftRequest[];
  setShiftRequests: (requests: ShiftRequest[]) => void;
  addShiftRequest: (request: ShiftRequest) => void;
  
  // Notifications
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (notificationId: string) => void;
  unreadCount: number;
  
  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // User state
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  
  // Shop state
  currentShop: null,
  setCurrentShop: (shop) => set({ currentShop: shop }),
  shops: [],
  setShops: (shops) => set({ shops }),
  
  // Shift state
  shifts: [],
  setShifts: (shifts) => set({ shifts }),
  addShift: (shift) => set((state) => ({ shifts: [...state.shifts, shift] })),
  updateShift: (shiftId, updates) => set((state) => ({
    shifts: state.shifts.map((shift) =>
      shift.shiftId === shiftId ? { ...shift, ...updates } : shift
    ),
  })),
  
  // Shift requests
  shiftRequests: [],
  setShiftRequests: (requests) => set({ shiftRequests: requests }),
  addShiftRequest: (request) => set((state) => ({ 
    shiftRequests: [...state.shiftRequests, request] 
  })),
  
  // Notifications
  notifications: [],
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter(n => !n.read).length
  }),
  addNotification: (notification) => set((state) => ({ 
    notifications: [...state.notifications, notification],
    unreadCount: state.unreadCount + (!notification.read ? 1 : 0)
  })),
  markNotificationAsRead: (notificationId) => set((state) => {
    const notifications = state.notifications.map((n) =>
      n.notificationId === notificationId ? { ...n, read: true } : n
    );
    return {
      notifications,
      unreadCount: notifications.filter(n => !n.read).length
    };
  }),
  unreadCount: 0,
  
  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));