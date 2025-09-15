'use client';

import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  redirectTo?: string;
}

// 認証不要版 - 常に子コンポーネントを表示
export default function ProtectedRoute({
  children,
  requiredRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  // 認証機能を削除したため、常にアクセスを許可
  return <>{children}</>;
}