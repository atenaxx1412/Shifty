'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  Edit,
  Mail,
  Calendar,
  Clock,
  UserCheck,
  Badge
} from 'lucide-react';
import { User, UserRole } from '@/types';
import { userService } from '@/lib/userService';
import { ManagerDataService } from '@/lib/managerDataService';

export default function ManagerStaffPage() {
  const { currentUser } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'created'>('name');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ManagerDataServiceを使用して最適化されたスタッフデータを取得
  useEffect(() => {
    const fetchStaff = async () => {
      if (!currentUser?.uid) return;

      setLoading(true);
      setError(null);

      try {
        console.log('👥 Fetching optimized staff data for manager UID:', currentUser.uid);

        // ManagerDataServiceを使用してキャッシュ付きでスタッフを取得
        const staffData = await ManagerDataService.getOptimizedStaffData(currentUser.uid);

        console.log('✅ Retrieved staff from ManagerDataService:', staffData.length, 'members');
        console.log('📊 Staff data:', staffData);

        setStaff(staffData);

      } catch (err) {
        console.error('❌ Failed to fetch staff data:', err);
        setError('スタッフデータの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [currentUser?.uid]);

  // フィルターとソート機能
  const filteredStaff = staff
    .filter(member => {
      const matchesRole = filterRole === 'all' || member.role === filterRole;
      return matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'role':
          return a.role.localeCompare(b.role);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'root': return 'システム管理者';
      case 'manager': return 'マネージャー';
      case 'staff': return 'スタッフ';
      default: return '不明';
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'root': return 'bg-red-600 text-white';
      case 'manager': return 'bg-blue-600 text-white';
      case 'staff': return 'bg-green-600 text-white';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getEmploymentTypeLabel = (type?: string) => {
    switch (type) {
      case 'full-time': return '正社員';
      case 'part-time': return 'アルバイト';
      case 'contract': return '契約社員';
      default: return '未設定';
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '未設定';

    try {
      // Firestoreのタイムスタンプオブジェクトの場合
      if (date && typeof date === 'object' && 'toDate' in date) {
        return new Intl.DateTimeFormat('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(date.toDate());
      }

      // Dateオブジェクトまたは文字列の場合
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return '不正な日付';
      }

      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Date formatting error:', error);
      return '日付エラー';
    }
  };

  // スタッフ編集機能
  const handleEditStaff = (staff: User) => {
    setEditingStaff(staff);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingStaff(null);
    setEditLoading(false);
  };

  const handleSaveStaff = async (updatedData: Partial<User>) => {
    if (!editingStaff || !currentUser?.uid) return;

    setEditLoading(true);
    try {
      await userService.updateStaffDetails(editingStaff.uid, updatedData);

      // キャッシュを無効化
      ManagerDataService.invalidateCache('staff', currentUser.uid);

      // スタッフリストを更新
      setStaff(prevStaff =>
        prevStaff.map(s =>
          s.uid === editingStaff.uid
            ? { ...s, ...updatedData, updatedAt: new Date() }
            : s
        )
      );

      alert('スタッフ情報を更新しました');
      handleCloseEditModal();
    } catch (error) {
      console.error('Error updating staff:', error);
      alert('更新に失敗しました');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root', 'manager']}>
        <div className="h-screen overflow-hidden bg-gray-50">
          <AppHeader title="スタッフ管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">スタッフデータを読み込み中...</p>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute allowedRoles={['root', 'manager']}>
        <div className="h-screen overflow-hidden bg-gray-50">
          <AppHeader title="スタッフ管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <p className="text-red-800 font-medium">エラーが発生しました</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    再読み込み
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="スタッフ管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

          {/* Modern Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">マネージャー</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {staff.filter(s => s.role === 'manager').length}名
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-2xl">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">スタッフ</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {staff.filter(s => s.role === 'staff').length}名
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-2xl">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">平均時給</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ¥{staff.length > 0 ? Math.round(staff.reduce((sum, s) => sum + (s.hourlyRate || 0), 0) / staff.length).toLocaleString() : '0'}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-2xl">
                  <Badge className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">総労働時間</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {staff.reduce((sum, s) => sum + (s.maxHoursPerWeek || 0), 0)}/週
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-2xl">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>


          {/* Modern Staff List */}
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100/80">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  スタッフ一覧 <span className="text-gray-600">({filteredStaff.length}名)</span>
                </h3>
                <div className="flex gap-2">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as 'all' | UserRole)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="all">全ての役職</option>
                    <option value="staff">スタッフ</option>
                    <option value="manager">マネージャー</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'role' | 'created')}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="name">名前順</option>
                    <option value="role">役職順</option>
                    <option value="created">登録日順</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Mobile-friendly card layout for small screens */}
            <div className="block md:hidden">
              {filteredStaff.map((member) => (
                <div key={member.uid} className="p-4 border-b border-gray-100/50 last:border-b-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <span className="text-base font-medium text-white">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                        <div className="text-xs text-gray-500">{member.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditStaff(member)}
                      className="p-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">役職：</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ml-1 ${getRoleBadgeColor(member.role)}`}>
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">時給：</span>
                      <span className="text-gray-900 font-medium">
                        {member.hourlyRate ? `¥${member.hourlyRate.toLocaleString()}` : '未設定'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      スタッフ
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      役職
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      雇用形態
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      時給
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      週労働時間
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      スキル
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      登録日
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50">
                  {filteredStaff.map((member) => (
                    <tr key={member.uid} className="hover:bg-gray-50/50 transition-colors duration-150">
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                            <span className="text-base font-medium text-white">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">{member.name}</div>
                            <div className="text-sm text-gray-500 flex items-center mt-0.5">
                              <Mail className="h-3.5 w-3.5 mr-1.5" />
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                          {getRoleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {getEmploymentTypeLabel(member.employmentType)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-900 font-semibold">
                        {member.hourlyRate ? `¥${member.hourlyRate.toLocaleString()}` : <span className="text-gray-400">未設定</span>}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-700">
                        {member.maxHoursPerWeek ? `${member.maxHoursPerWeek}時間` : <span className="text-gray-400">未設定</span>}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {member.skills?.slice(0, 2).map((skill, index) => (
                            <span key={index} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                              {skill}
                            </span>
                          ))}
                          {(member.skills?.length || 0) > 2 && (
                            <span className="text-xs text-gray-500 px-1 py-1">+{(member.skills?.length || 0) - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(member.createdAt)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <button
                          onClick={() => handleEditStaff(member)}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 transition-all duration-150 shadow-sm hover:shadow-md"
                        >
                          <Edit className="h-4 w-4 mr-1.5" />
                          編集
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Modal */}
          {showEditModal && editingStaff && (
            <div className="fixed inset-0 bg-gray-500/20 backdrop-blur-md flex items-center justify-center z-50">
              <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">スタッフ情報編集</h2>
                  <button
                    onClick={handleCloseEditModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <StaffEditForm 
                  staff={editingStaff}
                  onSave={handleSaveStaff}
                  onCancel={handleCloseEditModal}
                  loading={editLoading}
                />
              </div>
            </div>
          )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

// スタッフ編集フォームコンポーネント
function StaffEditForm({
  staff,
  onSave,
  onCancel,
  loading
}: {
  staff: User;
  onSave: (data: Partial<User>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: staff.name || '',
    nameKana: staff.nameKana || '',
    displayName: staff.displayName || '',
    position: staff.position || '',
    hourlyRate: staff.hourlyRate || 1000,
    transportationCost: staff.transportationCost || '',
    fixedShift: staff.fixedShift || '',
    gender: staff.gender || 'not_specified'
  });

  const handleChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 更新データを準備（空文字列はundefinedに変換）
    const updateData: Partial<User> = {};
    
    if (formData.name.trim()) updateData.name = formData.name.trim();
    if (formData.nameKana.trim()) updateData.nameKana = formData.nameKana.trim();
    if (formData.displayName.trim()) updateData.displayName = formData.displayName.trim();
    if (formData.position.trim()) updateData.position = formData.position.trim();
    if (formData.hourlyRate) updateData.hourlyRate = Number(formData.hourlyRate);
    if (formData.transportationCost) updateData.transportationCost = Number(formData.transportationCost);
    if (formData.fixedShift.trim()) updateData.fixedShift = formData.fixedShift.trim();
    if (formData.gender !== 'not_specified') updateData.gender = formData.gender as 'male' | 'female' | 'other' | 'not_specified';

    onSave(updateData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 氏名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            氏名
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="山田 太郎"
          />
        </div>

        {/* フリガナ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            フリガナ <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <input
            type="text"
            value={formData.nameKana}
            onChange={(e) => handleChange('nameKana', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="ヤマダ タロウ"
          />
        </div>

        {/* 表記名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            表記名 <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="太郎"
          />
        </div>

        {/* 役職 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            役職・職種 <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <input
            type="text"
            value={formData.position}
            onChange={(e) => handleChange('position', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="接客スタッフ"
          />
        </div>

        {/* 時給 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            時給 <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
            <input
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => handleChange('hourlyRate', e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-gray-500 focus:border-gray-500"
              placeholder="1000"
              min="0"
            />
          </div>
        </div>

        {/* 交通費 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            交通費（日当） <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
            <input
              type="number"
              value={formData.transportationCost}
              onChange={(e) => handleChange('transportationCost', e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-gray-500 focus:border-gray-500"
              placeholder="500"
              min="0"
            />
          </div>
        </div>

        {/* 性別 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            性別 <span className="text-gray-500 text-xs">(任意)</span>
          </label>
          <select
            value={formData.gender}
            onChange={(e) => handleChange('gender', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="not_specified">選択しない</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
        </div>
      </div>

      {/* 固定シフト（全幅） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          固定シフト <span className="text-gray-500 text-xs">(任意)</span>
        </label>
        <textarea
          value={formData.fixedShift}
          onChange={(e) => handleChange('fixedShift', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-gray-500 focus:border-gray-500"
          placeholder="月水金 9:00-17:00"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          例：月水金 9:00-17:00、平日のみ、土日祝日休み など
        </p>
      </div>

      {/* ボタン */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
        >
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          )}
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
}