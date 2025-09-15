'use client';

import { useState, useEffect } from 'react';
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

interface UserWithId extends User {
  id: string;
}

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithId[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [editingUser, setEditingUser] = useState<UserWithId | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch all users from Firestore
  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserWithId[];
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search and role
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

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

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
      }

      await fetchUsers();
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

  const userStats = {
    total: users.length,
    root: users.filter(u => u.role === 'root').length,
    manager: users.filter(u => u.role === 'manager').length,
    staff: users.filter(u => u.role === 'staff').length
  };

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="ユーザー管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg">
                    <Users className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-800">ユーザー管理</h1>
                    <p className="text-slate-600 mt-2 text-lg">
                      システムユーザーの管理・権限設定・アクセス制御
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button 
                    onClick={fetchUsers}
                    className="inline-flex items-center px-4 py-2.5 bg-slate-700/50 backdrop-blur-sm text-white rounded-xl hover:bg-slate-600/50 transition-all duration-200 border border-slate-600/30"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    更新
                  </button>
                  <div className="bg-slate-100/80 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-300/50">
                    <p className="text-sm text-slate-700">
                      新規ユーザーの追加は
                      <span className="font-bold text-teal-700 mx-1">店舗別アカウント管理</span>
                      から行ってください
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">総ユーザー数</p>
                    <p className="text-3xl font-bold text-slate-900">{userStats.total}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">システム管理者</p>
                    <p className="text-3xl font-bold text-rose-600">{userStats.root}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">店長</p>
                    <p className="text-3xl font-bold text-amber-600">{userStats.manager}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">スタッフ</p>
                    <p className="text-3xl font-bold text-emerald-600">{userStats.staff}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="名前またはメールで検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 bg-slate-50/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white transition-all w-full text-slate-900"
                    />
                  </div>
                  
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                      className="pl-10 pr-8 py-2.5 bg-slate-50/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white transition-all appearance-none text-slate-900"
                    >
                      <option value="all">全ての役割</option>
                      <option value="root">システム管理者</option>
                      <option value="manager">店長</option>
                      <option value="staff">スタッフ</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">ユーザー一覧</h3>
                <p className="text-sm text-gray-500 mt-1">{filteredUsers.length}人のユーザーが表示されています</p>
              </div>
              
              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">読み込み中...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200/50 p-6 hover:bg-white/90 transition-all duration-200 shadow-sm hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg">
                              <span className="text-white font-semibold text-lg">
                                {user.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className="text-lg font-semibold text-slate-900 truncate">{user.name || 'No Name'}</h3>
                              {getRoleBadge(user.role)}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-600">
                              <div className="flex items-center">
                                <Mail className="h-4 w-4 mr-1" />
                                <span>{user.email}</span>
                              </div>
                              <div className="flex items-center">
                                <Building className="h-4 w-4 mr-1" />
                                <span>{user.shopId || '未割り当て'}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '未記録'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setEditingUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-2.5 text-teal-600 hover:text-teal-700 bg-teal-50/80 hover:bg-teal-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-teal-200/50"
                            title="ユーザーを編集"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {user.role !== 'root' && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2.5 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-rose-200/50"
                              title="ユーザーを削除"
                            >
                              <Trash2 className="h-4 w-4" />
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