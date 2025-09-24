'use client';

import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRoles,
  allowedRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  // すべてのHooksを最初に呼び出す（条件付きリターンの前）
  const { currentUser, loading, isAuthorized } = useAuth();
  const router = useRouter();

  // useEffectも最初に定義
  useEffect(() => {
    if (!loading && !currentUser) {
      console.log('🚫 Unauthorized access - redirecting to login');
      router.replace(redirectTo);
      return;
    }

    // 権限チェック（requiredRoles または allowedRoles のどちらかを使用）
    const rolesToCheck = requiredRoles || allowedRoles;
    if (!loading && currentUser && rolesToCheck && !isAuthorized(rolesToCheck)) {
      console.log('🚫 Insufficient permissions - redirecting based on role');

      // ユーザーの役割に基づいて適切なページにリダイレクト
      switch (currentUser.role) {
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
          router.replace('/login');
      }
      return;
    }
  }, [loading, currentUser, requiredRoles, allowedRoles, isAuthorized, router, redirectTo]);

  // loading中はローディング画面を表示
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">認証情報を確認中...</p>
        </div>
      </div>
    );
  }

  // 認証済みかつ権限がある場合のみ子コンポーネントを表示
  if (!currentUser || (requiredRoles && !isAuthorized(requiredRoles)) || (allowedRoles && !isAuthorized(allowedRoles))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">アクセス権限を確認中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}