'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Shield, 
  LogOut, 
  User, 
  Bell, 
  Menu,
  Home,
  Users,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { SystemNotificationService, SystemNotification } from '@/lib/systemNotificationService';

interface AppHeaderProps {
  title?: string;
  showSidebar?: boolean;
}

export default function AppHeader({ title = 'Dashboard', showSidebar = true }: AppHeaderProps) {
  const router = useRouter();
  const { currentUser } = useAuth();

  // デバッグ: 現在のユーザー情報をログ出力
  console.log('🔍 AppHeader - currentUser:', {
    uid: currentUser?.uid,
    name: currentUser?.name,
    email: currentUser?.email,
    role: currentUser?.role,
    userId: currentUser?.userId,
    shopName: currentUser?.shopName
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const handleSignOut = async () => {
    // 認証なしの場合はログインページに移動のみ
    router.push('/login');
  };

  // rootユーザーの場合のみシステム通知を購読
  useEffect(() => {
    if (currentUser?.role === 'root') {
      // 通知データを購読
      const unsubscribeNotifications = SystemNotificationService.subscribeToNotifications(
        (fetchedNotifications) => {
          setNotifications(fetchedNotifications);
          setNotificationsLoading(false);
        },
        5
      );

      // 未読数を購読
      const unsubscribeUnreadCount = SystemNotificationService.subscribeToUnreadCount(
        (count) => {
          setUnreadCount(count);
        }
      );

      return () => {
        unsubscribeNotifications();
        unsubscribeUnreadCount();
      };
    } else {
      setNotificationsLoading(false);
    }
  }, [currentUser?.role]);

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (!notification.read) {
      await SystemNotificationService.markAsRead(notification.id);
    }
  };

  const getRoleColor = (role: string | undefined) => {
    switch (role) {
      case 'root':
        return 'bg-gradient-to-r from-red-500 to-pink-500';
      case 'manager':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500';
      case 'staff':
        return 'bg-gradient-to-r from-green-500 to-emerald-500';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case 'root':
        return 'システム管理者';
      case 'manager':
        return '店長';
      case 'staff':
        return 'スタッフ';
      default:
        return 'ユーザー';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <button
              onClick={() => router.push(`/${currentUser?.role}`)}
              className="flex items-center hover:opacity-80 transition-opacity duration-200 cursor-pointer"
            >
              <div className="flex items-center space-x-1">
                <Image
                  src="/images/logo-only-transparent.png"
                  alt="Shifty Logo"
                  width={56}
                  height={56}
                  className="w-12 h-12 sm:w-14 sm:h-14"
                  quality={85}
                />
                <Image
                  src="/images/text-only.svg"
                  alt="Shifty Text"
                  width={120}
                  height={56}
                  className="h-12 w-auto sm:h-20 -ml-5"
                />
              </div>
            </button>
            
            {showSidebar && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-5 w-5 text-gray-600" />
              </button>
            )}
            
            <div className="flex items-center space-x-3">
              <div>


              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell className="h-5 w-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">システム通知</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-red-600 font-medium">{unreadCount}件の未読</span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-4 py-8 text-center">
                        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto"></div>
                        <p className="text-xs text-gray-500 mt-2">読み込み中...</p>
                      </div>
                    ) : notifications.length > 0 ? (
                      notifications.map((notification) => {
                        const style = SystemNotificationService.getNotificationStyle(notification.type, notification.priority);
                        return (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 ${
                              !notification.read ? 'bg-blue-50 border-l-blue-500' : 'border-l-transparent'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <span className="text-lg">{style.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {notification.title}
                                  </p>
                                  <span className="text-xs text-gray-400">
                                    {SystemNotificationService.getRelativeTime(notification.timestamp)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                                {notification.priority === 'critical' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-2">
                                    緊急
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">通知がありません</p>
                        <p className="text-xs text-gray-400 mt-1">システム通知が表示されます</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {currentUser?.name || currentUser?.userId || 'ユーザー'}
                    </p>
                    
                  </div>
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 ${getRoleColor(currentUser?.role)} rounded-full border-2 border-white`}></div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </div>
              </button>
              
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{currentUser?.name}</p>
                    
                    <div className="mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${getRoleColor(currentUser?.role)}`}>
                        {getRoleBadge(currentUser?.role)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="py-1">
                    <button
                      onClick={() => router.push(`/${currentUser?.role}/settings`)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>設定</span>
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>ログアウト</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && showSidebar && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-2 space-y-1">
            <button
              onClick={() => router.push(`/${currentUser?.role}`)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>ダッシュボード</span>
            </button>
            <button
              onClick={() => router.push(`/${currentUser?.role}/users`)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2"
            >
              <Users className="h-4 w-4" />
              <span>ユーザー管理</span>
            </button>
            <button
              onClick={() => router.push(`/${currentUser?.role}/settings`)}
              className="w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>設定</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}