'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit,
  Trash2,
  UserCheck,
  ShieldCheck,
  Building,
  Clock,
  Activity,
  ChevronDown,
  User as UserIcon,
  Mail
} from 'lucide-react';
import { collection, getDocs, doc, deleteDoc, addDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';
import { logUserAction, logDataChange } from '@/lib/auditLogger';
import { notifyUserDeletion } from '@/utils/userDeletionNotifier';
import StatCard from '@/components/ui/StatCard';
import GradientHeader from '@/components/ui/GradientHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useDataSharing } from '@/contexts/DataSharingContext';
import { fetchOptimizedUsersData } from '@/services/usersDataService';

interface UserWithId extends User {
  id: string;
}

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [filteredUsers, setFilteredUsers] = useState<UserWithId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [editingUser, setEditingUser] = useState<UserWithId | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // スワイプ機能用の状態
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 共有データシステムを使用
  const { sharedData, isDataFresh } = useDataSharing();

  // 共有データからusersデータを取得、なければフォールバック
  const [users, setUsers] = useState<UserWithId[]>([]);

  // データの初期化と更新処理
  useEffect(() => {
    const loadUsersData = async () => {
      if (sharedData?.usersData && isDataFresh(30)) {
        console.log('📋 Using cached users data from shared context');
        setUsers(sharedData.usersData);
        setLoading(false);
        return;
      }

      // フォールバック: 共有データがない場合は直接取得
      console.log('🔄 Fallback: fetching users data directly');
      setLoading(true);
      try {
        const freshData = await fetchOptimizedUsersData();
        setUsers(freshData);
      } catch (error) {
        console.error('❌ Error fetching users data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUsersData();
  }, [sharedData, isDataFresh]);

  // データ更新用の関数
  const refreshUsers = async () => {
    console.log('🔄 Manual refresh users data');
    setLoading(true);
    try {
      const freshData = await fetchOptimizedUsersData();
      setUsers(freshData);
    } catch (error) {
      console.error('❌ Error refreshing users data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize filtered users when users data changes
  useEffect(() => {
    setFilteredUsers(users);
  }, [users]);

  // Filter and sort users based on search and role
  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Sort by newest first (using updatedAt, createdAt, or id as fallback)
    filtered = filtered.sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || a.id;
      const bTime = b.updatedAt || b.createdAt || b.id;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  // スワイプハンドラー
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY) return;

    const touch = e.touches[0];
    const diffX = touchStartX - touch.clientX;
    const diffY = touchStartY - touch.clientY;

    // 垂直スクロールを優先（縦の動きが横の動きより大きい場合）
    if (Math.abs(diffY) > Math.abs(diffX)) {
      return;
    }

    // 横スワイプの場合、ページスクロールを防ぐ
    if (Math.abs(diffX) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX || !touchStartY || isAnimating) return;

    const touch = e.changedTouches[0];
    const diffX = touchStartX - touch.clientX;
    const diffY = touchStartY - touch.clientY;

    // 垂直スクロールを優先
    if (Math.abs(diffY) > Math.abs(diffX)) {
      setTouchStartX(null);
      setTouchStartY(null);
      return;
    }

    const minSwipeDistance = 50;

    if (Math.abs(diffX) > minSwipeDistance) {
      setIsAnimating(true);

      if (diffX > 0) {
        // 左スワイプ - 次のページ
        window.history.pushState(null, '', '/root/database');
        window.location.href = '/root/database';
      } else {
        // 右スワイプ - 前のページ
        window.history.pushState(null, '', '/root');
        window.location.href = '/root';
      }

      setTimeout(() => {
        setIsAnimating(false);
      }, 300);
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('このユーザーを削除してもよろしいですか？')) return;

    // Find the user to get their info for logging
    const userToDelete = users.find(user => user.id === userId);

    try {
      // Delete from users collection
      await deleteDoc(doc(db, 'users', userId));
      
      // Delete from login collection
      const loginQuery = query(collection(db, 'login'), where('uid', '==', userToDelete?.uid));
      const loginSnapshot = await getDocs(loginQuery);
      if (!loginSnapshot.empty) {
        const loginDoc = loginSnapshot.docs[0];
        await deleteDoc(doc(db, 'login', loginDoc.id));
      }

      // Log user deletion
      if (currentUser && userToDelete) {
        await logUserAction(
          'User Deleted',
          currentUser.uid,
          currentUser.name,
          currentUser.role,
          userToDelete.uid,
          userToDelete.name,
          {
            email: userToDelete.email,
            role: userToDelete.role,
            shopId: userToDelete.shopId,
          }
        );
        
        await logDataChange(
          'User Removed from Database',
          currentUser.uid,
          currentUser.name,
          currentUser.role,
          `user:${userToDelete.uid}`,
          { action: 'delete', targetUser: userToDelete.name }
        );

        // 削除されたユーザーに対して自動ログアウト通知を送信
        if (userToDelete.uid) {
          notifyUserDeletion(userToDelete.uid);
        }
      }

      await refreshUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('ユーザーの削除に失敗しました');
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'root': return <ShieldCheck className="h-4 w-4 text-rose-600" />;
      case 'manager': return <UserCheck className="h-4 w-4 text-amber-600" />;
      case 'staff': return <Users className="h-4 w-4 text-emerald-600" />;
      default: return <Users className="h-4 w-4 text-slate-600" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      root: 'bg-rose-100 text-rose-800 border-rose-200',
      manager: 'bg-amber-100 text-amber-800 border-amber-200',
      staff: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };

    const labels = {
      root: 'システム管理者',
      manager: '店長',
      staff: 'スタッフ'
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[role]} shadow-sm`}>
        {getRoleIcon(role)}
        <span className="ml-1.5">{labels[role]}</span>
      </span>
    );
  };

  const userStats = [
    {
      label: '総ユーザー数',
      value: users.length,
      unit: '人',
      icon: Users,
      gradient: 'from-slate-600 to-slate-700'
    },
    {
      label: 'システム管理者',
      value: users.filter(u => u.role === 'root').length,
      unit: '人',
      icon: ShieldCheck,
      gradient: 'from-rose-500 to-pink-600'
    },
    {
      label: '店長',
      value: users.filter(u => u.role === 'manager').length,
      unit: '人',
      icon: UserCheck,
      gradient: 'from-amber-500 to-orange-500'
    },
    {
      label: 'スタッフ',
      value: users.filter(u => u.role === 'staff').length,
      unit: '人',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-600'
    }
  ];

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gray-50">
        <AppHeader title="ユーザー管理" />

        <main
          ref={containerRef}
          className="px-4 sm:px-6 lg:px-8 py-4"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: isAnimating ? 'translateX(-20px)' : 'translateX(0)',
            transition: isAnimating ? 'transform 0.3s ease-out' : 'none'
          }}
        >
          <div className="max-w-7xl mx-auto space-y-4">

            {/* Header with integrated search and filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-2 sm:p-4">
              <div className="space-y-4 sm:space-y-4">
                {/* Title and basic info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-0 sm:space-y-0">
                  <div className="flex items-center justify-between w-full sm:w-auto py-1">
                    <div className="flex items-center space-x-3">
                      <Users className="h-6 w-6 text-gray-700" />
                      <div>
                        <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
                        <p className="text-sm text-gray-500 hidden sm:block">システムユーザーの管理・権限設定・アクセス制御</p>
                      </div>
                    </div>

                    {/* Update button - Mobile only (right side) */}
                    <button
                      onClick={refreshUsers}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm whitespace-nowrap sm:hidden"
                    >
                      <Activity className="h-4 w-4 mr-1.5" />
                      更新
                    </button>
                  </div>

                  {/* Controls row - Desktop only */}
                  <div className="hidden sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                    {/* Search input */}
                    <div className="relative flex-1 sm:flex-none sm:w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="名前またはメールで検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all w-full text-gray-900 text-sm"
                      />
                    </div>

                    {/* Role filter */}
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                        className="pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all appearance-none text-gray-900 text-sm min-w-[140px]"
                      >
                        <option value="all">全ての役割</option>
                        <option value="root">システム管理者</option>
                        <option value="manager">店長</option>
                        <option value="staff">スタッフ</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>

                    {/* Update button - Desktop */}
                    <button
                      onClick={refreshUsers}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm whitespace-nowrap"
                    >
                      <Activity className="h-4 w-4 mr-1.5" />
                      更新
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {userStats.map((stat, index) => (
                <StatCard
                  key={index}
                  label={stat.label}
                  value={stat.value}
                  unit={stat.unit}
                  icon={stat.icon}
                  gradient={stat.gradient}
                  size="sm"
                />
              ))}
            </div>


            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">ユーザー一覧</h3>
                <p className="text-xs text-gray-500 mt-0.5">{Math.min(filteredUsers.length, 5)}人 / {filteredUsers.length}人のユーザーが表示されています</p>
              </div>

              {loading ? (
                <div className="px-4 py-8">
                  <LoadingSpinner text="ユーザーデータを読み込み中..." size="md" />
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1.5 p-2">
                  {filteredUsers.slice(0, 5).map((user) => (
                    <div key={user.id} className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 hover:bg-gray-100 transition-all duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-lg bg-gray-600 flex items-center justify-center">
                              <span className="text-white font-medium text-xs">
                                {user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2.5 mb-0.5">
                              <h3 className="text-xs font-semibold text-gray-900 truncate">{user.name || 'No Name'}</h3>
                              {getRoleBadge(user.role)}
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                              <div className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                <span className="text-xs">{user.email}</span>
                              </div>
                              <div className="flex items-center">
                                <Building className="h-3 w-3 mr-1" />
                                <span className="text-xs">{user.shopId || '未割り当て'}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                <span className="text-xs">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '未記録'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-teal-600 hover:text-teal-700 bg-teal-50/80 hover:bg-teal-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-teal-200/50"
                            title="ユーザーを編集"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          {user.role !== 'root' && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-rose-200/50"
                              title="ユーザーを削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!loading && filteredUsers.length === 0 && (
                <div className="bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200/50 p-12 text-center">
                  <div className="p-4 bg-slate-100/80 rounded-full inline-block mb-4">
                    <Users className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">ユーザーが見つかりません</h3>
                  <p className="text-slate-500">検索条件を変更してください</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

    </ProtectedRoute>
  );
}