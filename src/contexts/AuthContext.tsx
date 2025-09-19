'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import SessionWarning from '@/components/auth/SessionWarning';
import { logAuth, logSecurity } from '@/lib/auditLogger';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (userId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthorized: (requiredRole?: UserRole[]) => boolean;
  updateActivity: () => void;
  sessionTimeRemaining: number;
  isSessionExpiringSoon: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Custom login verification using userId
const verifyLoginFromFirestore = async (userId: string, password: string): Promise<User | null> => {
  try {
    console.log('🔍 Attempting login for userId:', userId);
    
    // Check user credentials directly in users collection
    const userQuery = query(
      collection(db, 'users'),
      where('userId', '==', userId),
      where('password', '==', password)
    );
    
    const userSnapshot = await getDocs(userQuery);
    console.log('📋 User query results:', userSnapshot.size);
    
    if (userSnapshot.empty) {
      console.log('❌ No matching user credentials found');
      return null; // Invalid credentials
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    console.log('✅ User data found:', userData);
    
    return {
      uid: userData.uid,
      userId: userData.userId,
      password: userData.password,
      name: userData.name,
      role: userData.role,
      managerId: userData.managerId,
      shopName: userData.shopName,
      shopAddress: userData.shopAddress,
      shopPhone: userData.shopPhone,
      shopEmail: userData.shopEmail,
      employmentType: userData.employmentType,
      skills: userData.skills,
      hourlyRate: userData.hourlyRate,
      maxHoursPerWeek: userData.maxHoursPerWeek,
      availability: userData.availability,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date(),
    } as User;
  } catch (error) {
    console.error('🚨 Login verification error:', error);
    return null;
  }
};


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // 初期状態をtrueに変更
  const [lastActivity, setLastActivity] = useState<number>(0); // Hydration safe
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(30 * 60 * 1000); // 30 minutes in ms
  const [isSessionExpiringSoon, setIsSessionExpiringSoon] = useState<boolean>(false);
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME = 5 * 60 * 1000; // 5 minutes warning

  // Enhanced session restoration on mount
  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = localStorage?.getItem('currentUser');
      
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          console.log('🔄 Restoring session for user:', user.name);
          
          setCurrentUser(user);
          
          // Set auth cookie for middleware
          document.cookie = `auth-token=${user.uid}; path=/; max-age=86400`; // 1 day
          
          console.log('✅ Session restored successfully:', {
            userId: user.uid,
            userRole: user.role,
          });
        } catch (error) {
          console.error('❌ Failed to restore session:', error);
          // Clear corrupted data
          localStorage.removeItem('currentUser');
          localStorage.removeItem('lastActivity');
        }
      } else {
        console.log('ℹ️ No stored session found');
      }
      
      // セッション復元処理完了後にloadingをfalseに
      setLoading(false);
    };
    
    restoreSession();
  }, []);

  // Auto-logout functionality
  const handleAutoLogout = useCallback(async () => {
    console.log('🔒 Auto-logout: Session expired due to inactivity');
    
    // Log auto-logout before clearing user data
    if (currentUser) {
      await logAuth('Auto Logout', currentUser.uid, currentUser.name, currentUser.role, true, 'Session expired due to inactivity');
      await logSecurity('Session Timeout', 'info', currentUser.uid, currentUser.name, { reason: 'Inactivity timeout' });
    }
    
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('lastActivity');
      document.cookie = 'auth-token=; path=/; max-age=0';
    }
    clearAllTimers();
    router.replace('/login?reason=session-expired');
  }, [router, currentUser]);

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    setSessionTimeRemaining(SESSION_TIMEOUT);
    setIsSessionExpiringSoon(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('lastActivity', now.toString());
    }

    // Clear existing timers
    clearAllTimers();

    // Set new inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      handleAutoLogout();
    }, SESSION_TIMEOUT);

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      setIsSessionExpiringSoon(true);
      console.log('⚠️ Session expiring soon - 5 minutes remaining');

      // Start countdown
      const startTime = Date.now();
      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = WARNING_TIME - elapsed;

        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current!);
          handleAutoLogout();
        } else {
          setSessionTimeRemaining(remaining);
        }
      }, 1000);
    }, SESSION_TIMEOUT - WARNING_TIME);
  }, [SESSION_TIMEOUT, WARNING_TIME]); // 依存関係を最小限に

  // Activity tracking effect
  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const activityListener = () => {
      updateActivity();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, activityListener, true);
    });

    // Check for stored last activity and validate session
    const storedLastActivity = localStorage?.getItem('lastActivity');
    if (storedLastActivity) {
      const lastActivityTime = parseInt(storedLastActivity);
      const timeSinceLastActivity = Date.now() - lastActivityTime;

      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        console.log('🕐 Session timeout detected, logging out user');
        handleAutoLogout();
        return;
      } else {
        updateActivity();
      }
    } else {
      updateActivity();
    }

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, activityListener, true);
      });
      clearAllTimers();
    };
  }, [currentUser, SESSION_TIMEOUT]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (userId: string, password: string) => {
    setLoading(true);
    
    try {
      console.log('🔍 Login attempt for userId:', userId);
      
      // Verify credentials against Firestore users collection
      const user = await verifyLoginFromFirestore(userId, password);
      
      if (!user) {
        // Log failed login attempt
        await logAuth('Login Failed', undefined, undefined, undefined, false, 'Invalid credentials');
        await logSecurity('Failed Login Attempt', 'warn', undefined, userId, { userId, reason: 'Invalid credentials' });
        throw new Error('Invalid credentials');
      }

      // Log successful login
      await logAuth('Login Success', user.uid, user.name, user.role, true, undefined);

      // Set user and store in localStorage for persistence
      setCurrentUser(user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentUser', JSON.stringify(user));
        // Set authentication cookie for middleware
        document.cookie = `auth-token=${user.uid}; path=/; max-age=86400`;
      }

      // Add a short delay for smoother transition
      await new Promise(resolve => setTimeout(resolve, 300));

      // ロール別ルーティング - router.replace()でhistory stackを汚染しない
      switch (user.role) {
        case 'root':
          router.replace('/root');
          break;
        case 'manager':
          router.replace('/manager');
          break;
        case 'staff':
          router.replace('/staff');
          break;
        default:
          router.replace('/dashboard');
      }
    } catch (error) {
      // Log any unexpected errors
      if (error instanceof Error && error.message !== 'Invalid credentials') {
        await logAuth('Login Error', undefined, undefined, undefined, false, error.message);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };


  const signOut = async () => {
    console.log('🚪 Manual logout initiated');
    
    // Log logout before clearing user data
    if (currentUser) {
      await logAuth('Manual Logout', currentUser.uid, currentUser.name, currentUser.role, true);
    }
    
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('lastActivity');
      // Remove authentication cookie
      document.cookie = 'auth-token=; path=/; max-age=0';
    }
    clearAllTimers();
    setIsSessionExpiringSoon(false);
    setSessionTimeRemaining(SESSION_TIMEOUT);
    router.replace('/login');
  };

  const isAuthorized = (requiredRoles?: UserRole[]) => {
    if (!currentUser) return false;
    if (!requiredRoles || requiredRoles.length === 0) return true;
    
    // Root has access to everything
    if (currentUser.role === 'root') return true;
    
    return requiredRoles.includes(currentUser.role);
  };

  const value = {
    currentUser,
    loading,
    signIn,
    signOut,
    isAuthorized,
    updateActivity,
    sessionTimeRemaining,
    isSessionExpiringSoon,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionWarning />
    </AuthContext.Provider>
  );
}