'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { 
  Users, 
  UserCheck,
  User,
  Search, 
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Mail,
  Shield,
  Activity,
  Building,
  Phone,
  MapPin,
  Trash2,
  X
} from 'lucide-react';
import { collection, getDocs, query, where, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User as UserType } from '@/types';
import { logUserAction, logDataChange } from '@/lib/auditLogger';

interface ManagerWithStaff {
  manager: UserType;
  staff: UserType[];
  isExpanded: boolean;
}

export default function ManagersPage() {
  const { currentUser } = useAuth();
  const [managersData, setManagersData] = useState<ManagerWithStaff[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateManagerModal, setShowCreateManagerModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');

  const [managerFormData, setManagerFormData] = useState({
    name: '',
    loginId: '',
    password: ''
  });

  const [staffFormData, setStaffFormData] = useState({
    name: '',
    loginId: '',
    password: '',
    managerId: ''
  });

  const [availableSkills] = useState([
    'レジ操作', 'キッチン', '接客', '清掃', '在庫管理', 
    'シフト管理', '新人研修', '売上分析', 'POS操作', '電話対応'
  ]);

  // Fetch all users and organize by manager
  const fetchManagersAndStaff = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as UserType[];

      setAllUsers(users);

      // Get managers
      const managers = users.filter(user => user.role === 'manager');
      
      // Organize staff by manager
      const managersWithStaff: ManagerWithStaff[] = managers.map(manager => {
        const staff = users.filter(user => user.role === 'staff' && user.managerId === manager.uid);
        return {
          manager,
          staff,
          isExpanded: false
        };
      });

      setManagersData(managersWithStaff);
    } catch (error) {
      console.error('Error fetching managers and staff:', error);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagersAndStaff();
  }, []);

  // Toggle manager expansion
  const toggleManagerExpansion = (managerId: string) => {
    setManagersData(prev => prev.map(item => 
      item.manager.uid === managerId 
        ? { ...item, isExpanded: !item.isExpanded }
        : item
    ));
  };

  // Create new manager
  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('🔥 Creating manager with simplified form');
      console.log('🆔 Login ID:', managerFormData.loginId);
      
      let userId: string;
      
      // Generate unique user ID for custom authentication
      userId = `manager_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 Generated internal ID:', userId);

      // Create user document in Firestore with minimal required fields
      await addDoc(collection(db, 'users'), {
        uid: userId,
        userId: managerFormData.loginId, // Use provided loginId
        password: managerFormData.password,
        name: managerFormData.name,
        role: 'manager',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Log the action
      if (currentUser) {
        await logUserAction(
          'Manager Account Created',
          currentUser.uid,
          currentUser.name,
          currentUser.role,
          userId,
          managerFormData.name,
          {
            loginId: managerFormData.loginId,
            role: 'manager'
          }
        );
      }

      // Reset form
      setManagerFormData({
        name: '',
        loginId: '',
        password: ''
      });
      
      setShowCreateManagerModal(false);
      await fetchManagersAndStaff();
      
    } catch (error: any) {
      console.error('❌ Error creating manager:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      const errorMessage = `店長アカウントの作成に失敗しました: ${error.message}`;
      
      alert(errorMessage);
    }
  };

  // Create new staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('🔥 Creating staff with custom auth system');
      console.log('🆔 Login ID:', staffFormData.loginId);
      
      let userId: string;
      
      // Generate unique user ID for custom authentication
      userId = `staff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 Generated internal ID:', userId);
      
      await addDoc(collection(db, 'users'), {
        uid: userId,
        userId: staffFormData.loginId,
        password: staffFormData.password,
        name: staffFormData.name,
        role: 'staff',
        managerId: staffFormData.managerId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Log the action
      if (currentUser) {
        await logUserAction(
          'Staff Account Created',
          currentUser.uid,
          currentUser.name,
          currentUser.role,
          userId,
          staffFormData.name,
          {
            loginId: staffFormData.loginId,
            managerId: staffFormData.managerId,
            role: 'staff'
          }
        );
      }

      // Reset form
      setStaffFormData({
        name: '',
        loginId: '',
        password: '',
        managerId: ''
      });
      
      setShowCreateStaffModal(false);
      await fetchManagersAndStaff();
      
    } catch (error: any) {
      console.error('❌ Error creating staff:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      const errorMessage = `スタッフアカウントの作成に失敗しました: ${error.message}`;
      
      alert(errorMessage);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userType: 'manager' | 'staff') => {
    if (!confirm(`この${userType === 'manager' ? '店長' : 'スタッフ'}を削除してもよろしいですか？`)) return;

    try {
      // Find user in Firestore and delete
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
      
      if (!usersSnapshot.empty) {
        await deleteDoc(usersSnapshot.docs[0].ref);
        
        // Log the action
        if (currentUser) {
          await logUserAction(
            `${userType === 'manager' ? 'Manager' : 'Staff'} Deleted`,
            currentUser.uid,
            currentUser.name,
            currentUser.role,
            userId,
            'Deleted User',
            { userType }
          );
        }
        
        await fetchManagersAndStaff();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('ユーザーの削除に失敗しました');
    }
  };

  // Filter managers based on search term
  const filteredManagers = managersData.filter(item =>
    item.manager.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.manager.userId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalManagers: managersData.length,
    totalStaff: managersData.reduce((sum, item) => sum + item.staff.length, 0),
    totalUsers: managersData.length + managersData.reduce((sum, item) => sum + item.staff.length, 0)
  };

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="店長・スタッフ管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg">
                    <UserCheck className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-slate-800">店長・スタッフ管理</h1>
                    <p className="text-slate-600 mt-2 text-lg">
                      店長アカウントの作成と、各店長配下のスタッフ管理
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowCreateManagerModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    新規店長
                  </button>
                  <button 
                    onClick={fetchManagersAndStaff}
                    className="inline-flex items-center px-4 py-2.5 bg-slate-700/50 backdrop-blur-sm text-white rounded-xl hover:bg-slate-600/50 transition-all duration-200 border border-slate-600/30"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    更新
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">店長数</p>
                    <p className="text-3xl font-bold text-teal-600">{stats.totalManagers}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">スタッフ数</p>
                    <p className="text-3xl font-bold text-emerald-600">{stats.totalStaff}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">総ユーザー数</p>
                    <p className="text-3xl font-bold text-slate-800">{stats.totalUsers}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="店長名、ログインIDで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 bg-slate-50/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white transition-all w-full text-slate-900"
                />
              </div>
            </div>

            {/* Managers List */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">店長・スタッフ一覧</h3>
                <p className="text-sm text-gray-500 mt-1">{filteredManagers.length}人の店長が表示されています</p>
              </div>
              
              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">読み込み中...</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {filteredManagers.map((item) => (
                    <div key={item.manager.uid} className="border-b border-slate-200/30 last:border-b-0">
                      {/* Manager Row */}
                      <div className="bg-slate-50/80 backdrop-blur-sm p-6 hover:bg-white/90 transition-all duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => toggleManagerExpansion(item.manager.uid)}
                              className="p-2 hover:bg-slate-200/50 rounded-lg transition-colors"
                            >
                              {item.isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-slate-600" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-slate-600" />
                              )}
                            </button>
                            
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg">
                              <span className="text-white font-semibold text-lg">
                                {item.manager.name?.charAt(0) || 'M'}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-semibold text-slate-900">{item.manager.name}</h3>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 shadow-sm">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  店長
                                </span>
                              </div>
                              <div className="flex items-center space-x-6 text-sm text-slate-600">
                                <div className="flex items-center">
                                  <Shield className="h-4 w-4 mr-1" />
                                  <span>ID: {item.manager.userId}</span>
                                </div>
                                <div className="flex items-center">
                                  <Building className="h-4 w-4 mr-1" />
                                  <span>{item.manager.shopName || '店舗情報未設定'}</span>
                                </div>
                                <div className="flex items-center">
                                  <Users className="h-4 w-4 mr-1" />
                                  <span>{item.staff.length}人のスタッフ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedManagerId(item.manager.uid);
                                setStaffFormData({ ...staffFormData, managerId: item.manager.uid });
                                setShowCreateStaffModal(true);
                              }}
                              className="p-2.5 text-teal-600 hover:text-teal-700 bg-teal-50/80 hover:bg-teal-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-teal-200/50"
                              title="スタッフを追加"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(item.manager.uid, 'manager')}
                              className="p-2.5 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-rose-200/50"
                              title="店長を削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Staff List */}
                      {item.isExpanded && (
                        <div className="bg-white/70 backdrop-blur-sm">
                          {item.staff.length > 0 ? (
                            <div className="space-y-0">
                              {item.staff.map((staff) => (
                                <div key={staff.uid} className="px-6 py-4 border-b border-slate-200/30 last:border-b-0 ml-16">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                                        <span className="text-white font-semibold">
                                          {staff.name?.charAt(0) || 'S'}
                                        </span>
                                      </div>
                                      <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                          <h4 className="text-base font-medium text-slate-900">{staff.name}</h4>
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <Users className="h-3 w-3 mr-1" />
                                            スタッフ
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                                          <span>ID: {staff.userId}</span>
                                          <span>時給: ¥{staff.hourlyRate || '未設定'}</span>
                                          <span>{staff.employmentType || '未設定'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <button
                                      onClick={() => handleDeleteUser(staff.uid, 'staff')}
                                      className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-rose-200/50"
                                      title="スタッフを削除"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="px-6 py-8 text-center ml-16">
                              <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                              <p className="text-slate-500">スタッフが登録されていません</p>
                              <button
                                onClick={() => {
                                  setSelectedManagerId(item.manager.uid);
                                  setStaffFormData({ ...staffFormData, managerId: item.manager.uid });
                                  setShowCreateStaffModal(true);
                                }}
                                className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                              >
                                最初のスタッフを追加する
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {!loading && filteredManagers.length === 0 && (
                <div className="bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200/50 p-12 text-center">
                  <div className="p-4 bg-slate-100/80 rounded-full inline-block mb-4">
                    <UserCheck className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">店長が見つかりません</h3>
                  <p className="text-slate-500 mb-4">検索条件を変更するか、新しい店長を作成してください</p>
                  <button
                    onClick={() => setShowCreateManagerModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    最初の店長を作成
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Manager Modal */}
      {showCreateManagerModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">新規店長作成</h2>
              </div>
              <button
                onClick={() => setShowCreateManagerModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">店長名 *</label>
                  <input
                    type="text"
                    value={managerFormData.name}
                    onChange={(e) => setManagerFormData({ ...managerFormData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="田中太郎"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ログインID *</label>
                  <input
                    type="text"
                    value={managerFormData.loginId}
                    onChange={(e) => setManagerFormData({ ...managerFormData, loginId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="tanaka_shop01"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">店長がログイン時に使用するIDです</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">パスワード *</label>
                  <input
                    type="password"
                    value={managerFormData.password}
                    onChange={(e) => setManagerFormData({ ...managerFormData, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="6文字以上のパスワード"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/50">
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-blue-100 rounded-full mt-1">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">店舗情報について</p>
                    <p className="text-xs text-slate-600">店舗名、住所、電話番号などの詳細情報は、店長がログイン後に設定できます。まずは基本的なアカウント情報のみで作成を進めてください。</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateManagerModal(false)}
                  className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all duration-200 shadow-lg"
                >
                  店長を作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Staff Modal */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">新規スタッフ作成</h2>
              </div>
              <button
                onClick={() => setShowCreateStaffModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">スタッフ名 *</label>
                  <input
                    type="text"
                    value={staffFormData.name}
                    onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ログインID *</label>
                  <input
                    type="text"
                    value={staffFormData.loginId}
                    onChange={(e) => setStaffFormData({ ...staffFormData, loginId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="sato_staff01"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">スタッフがログイン時に使用するIDです</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">パスワード *</label>
                  <input
                    type="password"
                    value={staffFormData.password}
                    onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    placeholder="6文字以上のパスワード"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/50">
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-emerald-100 rounded-full mt-1">
                    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">スタッフ詳細について</p>
                    <p className="text-xs text-slate-600">時給、勤務時間、スキルなどの詳細情報は、店長が後で管理画面から設定できます。まずは基本的なアカウント情報のみで作成を進めてください。</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg"
                >
                  スタッフを作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}