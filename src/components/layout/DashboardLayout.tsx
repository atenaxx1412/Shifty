'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import {
  Calendar,
  Users,
  Clock,
  FileText,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Home,
  TrendingUp,
  Shield,
  ArrowLeftRight,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { currentUser, signOut } = useAuth();
  const { sidebarOpen, setSidebarOpen, unreadCount } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getNavItems = () => {
    if (!currentUser) return [];

    const commonItems = [
      { icon: Home, label: 'ダッシュボード', href: '/dashboard' },
      { icon: Calendar, label: 'シフト', href: '/shifts' },
      { icon: Bell, label: '通知', href: '/notifications', badge: unreadCount },
    ];

    switch (currentUser.role) {
      case 'root':
        return [
          ...commonItems,
          { icon: Shield, label: '管理', href: '/admin' },
          { icon: Users, label: '店舗管理', href: '/admin/shops' },
          { icon: Users, label: 'ユーザー管理', href: '/admin/users' },
          { icon: TrendingUp, label: '分析', href: '/analytics' },
          { icon: FileText, label: 'レポート', href: '/reports' },
          { icon: Settings, label: '設定', href: '/settings' },
        ];
      case 'manager':
        return [
          ...commonItems,
          { icon: Users, label: 'スタッフ管理', href: '/staff' },
          { icon: Clock, label: 'シフト作成', href: '/shifts/create' },
          { icon: ArrowLeftRight, label: 'シフト交換', href: '/shifts/exchange' },
          { icon: FileText, label: 'レポート', href: '/reports' },
          { icon: Settings, label: '設定', href: '/settings' },
        ];
      case 'staff':
        return [
          ...commonItems,
          { icon: Clock, label: 'シフト希望', href: '/shifts/request' },
          { icon: ArrowLeftRight, label: 'シフト交換', href: '/shifts/exchange' },
          { icon: FileText, label: '勤務実績', href: '/timesheet' },
          { icon: Settings, label: '設定', href: '/settings' },
        ];
      default:
        return commonItems;
    }
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white shadow-md px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <span className="text-xl font-bold text-indigo-600">Shifty</span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="relative p-2">
              <Bell className="h-5 w-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:block fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transition-transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <span className="text-2xl font-bold text-indigo-600">Shifty</span>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {navItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className="flex items-center justify-between px-3 py-2 mb-1 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 && (
                <span className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-full">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center space-x-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {currentUser?.name || 'ユーザー'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {currentUser?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-gray-800 bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between h-16 px-6 border-b">
              <span className="text-2xl font-bold text-indigo-600">Shifty</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 px-3">
              {navItems.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className="flex items-center justify-between px-3 py-2 mb-1 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {currentUser?.name || 'ユーザー'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <LogOut className="h-4 w-4" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`lg:transition-all lg:duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        {/* Desktop header */}
        <div className="hidden lg:block bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-4">
              <button className="relative p-2">
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                {currentUser?.name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-6 pt-20 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}