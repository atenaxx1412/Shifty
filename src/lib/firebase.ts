import { initializeApp } from "firebase/app";
import { getFirestore, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

// Realtime listener types
export type RealtimeCallback<T = any> = (data: T) => void;
export type UnsubscribeFunction = () => void;

// Realtime data interfaces
export interface SystemLogData {
  id: string;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
  userId?: string;
}

export interface InquiryData {
  id: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string;
}

export interface BudgetCalculationData {
  id: string;
  period: string; // YYYY-MM format
  totalBudget: number;
  actualSpent: number;
  remainingBudget: number;
  categories: {
    labor: number;
    operations: number;
    marketing: number;
    overhead: number;
  };
  lastUpdated: Date;
}

export interface ShiftRequestData {
  id: string;
  userId: string;
  managerUserId: string;
  period: string; // YYYY-MM format
  shifts: {
    date: string;
    startTime: string;
    endTime: string;
    status: 'requested' | 'approved' | 'rejected' | 'pending';
    notes?: string;
  }[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

// Debug configuration
console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasAll: Object.values(firebaseConfig).every(v => v && v !== 'undefined')
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);

// Initialize Firebase Messaging (only in browser environment)
let messaging: any = null;
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

// Realtime data listeners
export const createSystemLogsListener = (callback: RealtimeCallback<SystemLogData[]>): UnsubscribeFunction => {
  const q = query(
    collection(db, 'system_logs'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    })) as SystemLogData[];
    callback(logs);
  });
};

export const createInquiriesListener = (callback: RealtimeCallback<InquiryData[]>): UnsubscribeFunction => {
  const q = query(
    collection(db, 'inquiries'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const inquiries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as InquiryData[];
    callback(inquiries);
  });
};

export const createBudgetCalculationsListener = (callback: RealtimeCallback<BudgetCalculationData[]>): UnsubscribeFunction => {
  const q = query(
    collection(db, 'budgetCalculations'),
    orderBy('lastUpdated', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const budgets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lastUpdated: doc.data().lastUpdated?.toDate() || new Date()
    })) as BudgetCalculationData[];
    callback(budgets);
  });
};

export const createShiftRequestsListener = (callback: RealtimeCallback<ShiftRequestData[]>): UnsubscribeFunction => {
  const q = query(
    collection(db, 'monthly_shift_requests'),
    orderBy('submittedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate(),
      reviewedAt: doc.data().reviewedAt?.toDate()
    })) as ShiftRequestData[];
    callback(requests);
  });
};

// Realtime statistics helper
export const createRealtimeStatsAggregator = (callbacks: {
  onSystemHealth?: (health: 'healthy' | 'warning' | 'critical') => void;
  onInquiriesCount?: (count: number) => void;
  onPendingShiftRequests?: (count: number) => void;
  onBudgetStatus?: (status: { totalBudget: number; actualSpent: number; variance: number }) => void;
}) => {
  const unsubscribers: UnsubscribeFunction[] = [];

  // System logs health monitoring
  if (callbacks.onSystemHealth) {
    const logsUnsubscribe = createSystemLogsListener((logs) => {
      const recentErrors = logs.filter(log =>
        log.level === 'error' &&
        new Date().getTime() - log.timestamp.getTime() < 5 * 60 * 1000 // last 5 minutes
      ).length;

      const recentWarnings = logs.filter(log =>
        log.level === 'warning' &&
        new Date().getTime() - log.timestamp.getTime() < 15 * 60 * 1000 // last 15 minutes
      ).length;

      let health: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (recentErrors > 5) health = 'critical';
      else if (recentErrors > 2 || recentWarnings > 10) health = 'warning';

      callbacks.onSystemHealth!(health);
    });
    unsubscribers.push(logsUnsubscribe);
  }

  // Inquiries count monitoring
  if (callbacks.onInquiriesCount) {
    const inquiriesUnsubscribe = createInquiriesListener((inquiries) => {
      const pendingCount = inquiries.filter(inquiry =>
        inquiry.status === 'pending' || inquiry.status === 'in_progress'
      ).length;
      callbacks.onInquiriesCount!(pendingCount);
    });
    unsubscribers.push(inquiriesUnsubscribe);
  }

  // Shift requests monitoring
  if (callbacks.onPendingShiftRequests) {
    const shiftsUnsubscribe = createShiftRequestsListener((requests) => {
      const pendingCount = requests.filter(request => request.status === 'submitted').length;
      callbacks.onPendingShiftRequests!(pendingCount);
    });
    unsubscribers.push(shiftsUnsubscribe);
  }

  // Budget status monitoring
  if (callbacks.onBudgetStatus) {
    const budgetUnsubscribe = createBudgetCalculationsListener((budgets) => {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const currentBudget = budgets.find(b => b.period === currentMonth);
      if (currentBudget) {
        callbacks.onBudgetStatus!({
          totalBudget: currentBudget.totalBudget,
          actualSpent: currentBudget.actualSpent,
          variance: ((currentBudget.actualSpent - currentBudget.totalBudget) / currentBudget.totalBudget) * 100
        });
      }
    });
    unsubscribers.push(budgetUnsubscribe);
  }

  // Return function to unsubscribe all listeners
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
};

export { messaging };
export default app;