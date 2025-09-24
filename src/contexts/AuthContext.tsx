'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { logAuth, logSecurity } from '@/lib/auditLogger';
import { isUserDeleted, clearDeletedUser, setupDeletionListener } from '@/utils/userDeletionNotifier';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signIn: (userId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthorized: (requiredRole?: UserRole[]) => boolean;
  checkUserExists: () => Promise<void>;
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

  // Check if user still exists in database
  const checkUserExists = useCallback(async () => {
    if (!currentUser) return;

    try {
      // まずlocalStorageの削除リストをチェック（Firebase読み込み回数削減）
      if (isUserDeleted(currentUser.uid)) {
        console.log('🔒 User found in deletion list - account has been deleted');

        // Log the forced logout
        await logAuth('Forced Logout', currentUser.uid, currentUser.name, currentUser.role, true, 'User account deleted by administrator');
        await logSecurity('Account Deletion', 'warn', currentUser.uid, currentUser.name, { reason: 'User account deleted' });

        // Clear user session and deletion record
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('lastActivity');
          document.cookie = 'auth-token=; path=/; max-age=0';
        }
        clearDeletedUser(currentUser.uid);

        // Redirect to login with message
        router.replace('/login?reason=account-deleted');
        return;
      }

      // Firebase読み込み頻度を下げるため、一定の確率でのみデータベースチェック実行
      const shouldCheckDatabase = Math.random() < 0.1; // 10%の確率
      if (!shouldCheckDatabase) return;

      // Check if user still exists in the database
      const userQuery = query(
        collection(db, 'users'),
        where('uid', '==', currentUser.uid)
      );

      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        // User has been deleted from database
        console.log('🔒 User account has been deleted (database check)');

        // Log the forced logout
        await logAuth('Forced Logout', currentUser.uid, currentUser.name, currentUser.role, true, 'User account deleted by administrator');
        await logSecurity('Account Deletion', 'warn', currentUser.uid, currentUser.name, { reason: 'User account deleted' });

        // Clear user session
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('lastActivity');
          document.cookie = 'auth-token=; path=/; max-age=0';
        }

        // Redirect to login with message
        router.replace('/login?reason=account-deleted');
      }
    } catch (error) {
      console.error('Error checking user existence:', error);
      // Don't logout on error to avoid disrupting legitimate sessions
    }
  }, [currentUser, router]);



  // Check user existence on navigation/focus and setup deletion listener
  useEffect(() => {
    if (!currentUser) return;

    // Check user existence when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUserExists();
      }
    };

    // Check on route changes
    const handleRouteChange = () => {
      checkUserExists();
    };

    // Handle deletion notifications from other tabs
    const handleUserDeletion = (deletedUid: string) => {
      if (currentUser.uid === deletedUid) {
        console.log('🔒 Current user has been deleted in another tab');
        checkUserExists(); // This will trigger the logout process
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('popstate', handleRouteChange);

    // Setup deletion listener
    const removeDeletionListener = setupDeletionListener(handleUserDeletion);

    // Initial check
    checkUserExists();

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('popstate', handleRouteChange);
      removeDeletionListener();
    };
  }, [currentUser, checkUserExists]);

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

      // State更新を確実に適用するため短時間待機
      await new Promise(resolve => setTimeout(resolve, 100));

      // ロール別ルーティング - router.push()でより確実なナビゲーション
      switch (user.role) {
        case 'root':
          console.log('🔄 Redirecting to root dashboard');
          router.push('/root');
          break;
        case 'manager':
          console.log('🔄 Redirecting to manager dashboard');
          router.push('/manager');
          break;
        case 'staff':
          console.log('🔄 Redirecting to staff dashboard');
          router.push('/staff');
          break;
        default:
          console.log('🔄 Redirecting to default dashboard');
          router.push('/dashboard');
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
    checkUserExists,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}