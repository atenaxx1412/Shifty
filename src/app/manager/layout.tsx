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
  const { currentUser, loading } = useAuth();

  // 認証情報の読み込み中は、ローディング画面を表示
  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">認証情報を確認中...</p>
        </div>
      </div>
    );
  }

  // 認証済みユーザーが確定してから ManagerDataProvider を初期化
  return (
    <ManagerDataProvider
      managerId={currentUser.uid}
      autoLoad={true}
    >
      {children}
    </ManagerDataProvider>
  );
}