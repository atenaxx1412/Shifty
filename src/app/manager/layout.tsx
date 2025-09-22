'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ManagerDataProvider } from '@/contexts/ManagerDataContext';

interface ManagerLayoutProps {
  children: React.ReactNode;
}

/**
 * 店長機能共通レイアウト
 * - ManagerDataProviderを提供
 * - 全/manager配下のページで統一されたデータ管理
 * - Firebase最適化の基盤
 */
export default function ManagerLayout({ children }: ManagerLayoutProps) {
  const { currentUser } = useAuth();

  // フォールバック用のマネージャー情報（開発・テスト用）
  const fallbackManager = {
    uid: "test-manager-001",
    email: "manager@shifty.com",
    name: "テスト店長",
    role: "manager" as const
  };

  // 認証済みまたはフォールバック情報を使用
  const managerUser = currentUser || fallbackManager;

  return (
    <ManagerDataProvider
      managerId={managerUser.uid}
      autoLoad={true}
    >
      {children}
    </ManagerDataProvider>
  );
}