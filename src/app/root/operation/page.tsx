'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { useDataCache } from '@/hooks/useDataCache';
import {
  fetchOptimizedShopsData,
  fetchOptimizedShopsStats,
  ManagerWithStaff,
  ShopsStatsData
} from '@/services/shopsDataService';
import { useDataSharing } from '@/contexts/DataSharingContext';
import {
  Users,
  UserCheck,
  User,
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
  X,
  CheckCircle,
  XCircle,
  Clock,
  Eye
} from 'lucide-react';
import { collection, getDocs, query, where, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User as UserType } from '@/types';
import { logUserAction, logDataChange } from '@/lib/auditLogger';
import { slotManagementService } from '@/lib/slotManagementService';

interface ManagerWithStaff {
  manager: UserType;
  staff: UserType[];
  isExpanded: boolean;
  slots?: {
    totalSlots: number;
    usedSlots: number;
    availableSlots: number;
  };
}

export default function ManagersPage() {
  const { currentUser } = useAuth();
  const { sharedData, isDataFresh, updateSharedData } = useDataSharing();

  // 共有データが新鮮（5分以内）かチェック
  const useSharedDataForStats = isDataFresh(5);

  // 統計データ: 共有データが新鮮なら使用、そうでなければキャッシュから取得
  const {
    data: localStatsData,
    loading: statsLoading,
    refresh: refreshStats
  } = useDataCache<ShopsStatsData>({
    key: 'shopsStats',
    fetchFunction: fetchOptimizedShopsStats,
    initialData: {
      totalManagers: 0,
      totalStaff: 0,
      totalUsers: 0,
      averageStaffPerManager: 0,
      managersWithStaff: 0,
      managersWithoutStaff: 0
    }
  });

  // 詳細データ（店長・スタッフ一覧）は常にキャッシュから取得
  const {
    data: managersData,
    loading,
    error,
    refresh: refreshShopsData
  } = useDataCache<ManagerWithStaff[]>({
    key: 'shopsData',
    fetchFunction: fetchOptimizedShopsData,
    initialData: []
  });

  // 使用する統計データを決定（共有データ優先）
  const statsData = useSharedDataForStats && sharedData?.shopsStats
    ? sharedData.shopsStats
    : localStatsData;

  console.log('📊 Stats data source:', {
    useSharedData: useSharedDataForStats,
    sharedDataAge: sharedData?.lastUpdated ? Math.round((Date.now() - new Date(sharedData.lastUpdated).getTime()) / (1000 * 60)) + ' minutes' : 'N/A',
    source: useSharedDataForStats ? 'Root page data (shared)' : 'Local cache'
  });
  const [showCreateManagerModal, setShowCreateManagerModal] = useState(false);
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [showSlotRequestModal, setShowSlotRequestModal] = useState(false);
  const [showSlotApprovalModal, setShowSlotApprovalModal] = useState(false);
  const [showDirectSlotModal, setShowDirectSlotModal] = useState(false);
  const [slotRequests, setSlotRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
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

  const [slotRequestFormData, setSlotRequestFormData] = useState({
    managerId: '',
    requestedSlots: 1,
    reason: ''
  });

  const [directSlotFormData, setDirectSlotFormData] = useState({
    managerId: '',
    newSlots: 0
  });

  const [availableSkills] = useState([
    'レジ操作', 'キッチン', '接客', '清掃', '在庫管理', 
    'シフト管理', '新人研修', '売上分析', 'POS操作', '電話対応'
  ]);

  // ローカル状態でUI状態（展開/折りたたみ）を管理
  const [localManagersData, setLocalManagersData] = useState<ManagerWithStaff[]>([]);

  // managersDataが更新されたらローカル状態も同期（枠数情報も取得）
  useEffect(() => {
    if (managersData) {
      const fetchSlotsData = async () => {
        const managersWithSlots = await Promise.all(
          managersData.map(async (item) => {
            const slots = await slotManagementService.getManagerSlots(item.manager.uid);
            return {
              ...item,
              slots: {
                totalSlots: slots.totalSlots,
                usedSlots: slots.usedSlots,
                availableSlots: slots.availableSlots
              }
            };
          })
        );
        setLocalManagersData(managersWithSlots);
      };
      fetchSlotsData();
    }
  }, [managersData]);

  // 申請データを取得
  useEffect(() => {
    const fetchSlotRequests = async () => {
      try {
        const requests = await slotManagementService.getSlotRequests('pending');
        setSlotRequests(requests);
        console.log(`📋 Loaded ${requests.length} pending slot requests`);
      } catch (error) {
        console.error('❌ Error fetching slot requests:', error);
      }
    };

    fetchSlotRequests();
  }, []);

  // Toggle manager expansion
  const toggleManagerExpansion = (managerId: string) => {
    setLocalManagersData(prev => prev.map(item =>
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

      // Create user document in Firestore with all required fields
      await addDoc(collection(db, 'users'), {
        uid: userId,
        userId: managerFormData.loginId,
        name: managerFormData.name,
        password: managerFormData.password,
        role: 'manager',
        employmentType: 'full-time',
        availability: {},  // 空のマップを保持
        skills: [],
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

      // Initialize manager slots with default 0 slots
      await slotManagementService.initializeManagerSlots(userId, managerFormData.name, 0);
      console.log(`✅ Initialized slots for manager: ${userId}`);

      // Reset form
      setManagerFormData({
        name: '',
        loginId: '',
        password: ''
      });
      
      setShowCreateManagerModal(false);
      
      // Refresh all data without page reload
      await refreshShopsData();
      await refreshStats();
      
      console.log('✅ Data refreshed successfully');
      
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

      // 枠数制限チェック
      const selectedManager = localManagersData.find(m => m.manager.uid === staffFormData.managerId);
      if (!selectedManager) {
        throw new Error('選択された店長が見つかりません');
      }

      const managerSlots = selectedManager.slots || { totalSlots: 0, usedSlots: selectedManager.staff.length, availableSlots: Math.max(0, 0 - selectedManager.staff.length) };
      
      if (managerSlots.availableSlots <= 0) {
        throw new Error(`この店長の利用可能な枠数が不足しています。
現在の枠数: ${managerSlots.usedSlots}/${managerSlots.totalSlots}
新しいスタッフを追加するには枠追加申請を行ってください。`);
      }

      console.log(`✅ 枠数チェック完了 - 利用可能枠数: ${managerSlots.availableSlots}/${managerSlots.totalSlots}`);
      
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

      // 店長の使用済み枠数を更新
      await slotManagementService.updateUsedSlots(staffFormData.managerId);
      console.log(`✅ 店長 ${selectedManager.manager.name} の枠数を更新しました`);

      // Reset form
      setStaffFormData({
        name: '',
        loginId: '',
        password: '',
        managerId: ''
      });
      
      setShowCreateStaffModal(false);
      await refreshShopsData();
      await refreshStats();
      
    } catch (error: any) {
      console.error('❌ Error creating staff:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      const errorMessage = `スタッフアカウントの作成に失敗しました: ${error.message}`;
      
      alert(errorMessage);
    }
  };

  // Handle slot request
  const handleSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('🔥 Processing slot request:', slotRequestFormData);
      
      const selectedManager = localManagersData.find(m => m.manager.uid === slotRequestFormData.managerId);
      if (!selectedManager) {
        throw new Error('選択された店長が見つかりません');
      }

      const currentSlots = selectedManager.slots.totalSlots;

      // データベースに申請を保存
      const requestId = await slotManagementService.createSlotRequest({
        managerId: slotRequestFormData.managerId,
        managerName: selectedManager.manager.name,
        requestedBy: currentUser?.uid || 'unknown',
        requestedByName: currentUser?.name || '不明',
        requestedSlots: slotRequestFormData.requestedSlots,
        currentSlots: currentSlots,
        reason: slotRequestFormData.reason,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`✅ Created slot request with ID: ${requestId}`);
      
      alert(`枠追加申請を送信しました。
申請店長: ${selectedManager.manager.name}
現在枠数: ${currentSlots}枠
追加申請: +${slotRequestFormData.requestedSlots}枠
新枠数: ${currentSlots + slotRequestFormData.requestedSlots}枠

申請ID: ${requestId}
状況: 承認待ち`);

      // Reset form
      setSlotRequestFormData({
        managerId: '',
        requestedSlots: 1,
        reason: ''
      });
      
      setShowSlotRequestModal(false);
      
    } catch (error: any) {
      console.error('❌ Error processing slot request:', error);
      alert(`枠追加申請の処理に失敗しました: ${error.message}`);
    }
  };

  // Handle slot request approval
  // Handle direct slot setting (Root only)
  const handleDirectSlotSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      console.log('🔧 Processing direct slot setting:', directSlotFormData);
      
      const selectedManager = localManagersData.find(m => m.manager.uid === directSlotFormData.managerId);
      if (!selectedManager) {
        throw new Error('選択された店長が見つかりません');
      }

      if (!currentUser) {
        throw new Error('認証されていません');
      }

      const currentSlots = selectedManager.slots.totalSlots;
      
      // 新しい枠数が現在のスタッフ数より少ない場合は警告
      const currentStaffCount = selectedManager.staff.length;
      if (directSlotFormData.newSlots < currentStaffCount) {
        if (!confirm(`警告: 設定しようとしている枠数(${directSlotFormData.newSlots})が現在のスタッフ数(${currentStaffCount})より少なくなっています。続行しますか？`)) {
          return;
        }
      }

      // SlotManagementService の新機能を使用
      await slotManagementService.setManagerSlots(
        directSlotFormData.managerId,
        directSlotFormData.newSlots,
        currentUser.uid,
        currentUser.name,
        ''
      );

      console.log(`✅ Successfully set slots for ${selectedManager.manager.name}: ${currentSlots} → ${directSlotFormData.newSlots}`);
      
      alert(`${selectedManager.manager.name}の枠数を変更しました。
変更前: ${currentSlots}枠
変更後: ${directSlotFormData.newSlots}枠

現在のスタッフ数: ${currentStaffCount}人
利用可能枠数: ${directSlotFormData.newSlots - currentStaffCount}枠`);

      // Reset form
      setDirectSlotFormData({
        managerId: '',
        newSlots: 0
      });
      
      setShowDirectSlotModal(false);
      
      // データを再取得
      await refreshShopsData();
      
    } catch (error: any) {
      console.error('❌ Error setting slots directly:', error);
      alert(`枠数設定に失敗しました: ${error.message}`);
    }
  };
  const handleApproveRequest = async (requestId: string) => {
    try {
      if (!currentUser) {
        throw new Error('認証されていません');
      }

      await slotManagementService.approveSlotRequest(
        requestId,
        currentUser.uid,
        currentUser.name
      );

      // リストを更新
      const updatedRequests = await slotManagementService.getSlotRequests('pending');
      setSlotRequests(updatedRequests);

      // 店長データを再取得（枠数が変更されたため）
      await refreshShopsData();

      alert('枠追加申請を承認しました。店長の枠数が増加されました。');
      setShowSlotApprovalModal(false);
    } catch (error: any) {
      console.error('❌ Error approving request:', error);
      alert(`承認処理に失敗しました: ${error.message}`);
    }
  };

  // Handle slot request rejection
  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      if (!currentUser) {
        throw new Error('認証されていません');
      }

      await slotManagementService.rejectSlotRequest(
        requestId,
        currentUser.uid,
        reason
      );

      // リストを更新
      const updatedRequests = await slotManagementService.getSlotRequests('pending');
      setSlotRequests(updatedRequests);

      alert('枠追加申請を却下しました。');
      setShowSlotApprovalModal(false);
    } catch (error: any) {
      console.error('❌ Error rejecting request:', error);
      alert(`却下処理に失敗しました: ${error.message}`);
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

        // If deleting a manager, also delete their slot data
        if (userType === 'manager') {
          try {
            await slotManagementService.deleteManagerSlots(userId);
            console.log(`✅ Deleted manager slots for: ${userId}`);
          } catch (slotError) {
            console.error('❌ Error deleting manager slots:', slotError);
            // Continue with user deletion even if slot deletion fails
          }
        }

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

        await refreshShopsData();
        await refreshStats();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('ユーザーの削除に失敗しました');
    }
  };


  // 統計データは最適化されたキャッシュから取得

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="店長・スタッフ管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-4 lg:p-5 border border-white/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg lg:text-xl font-bold text-slate-800">店長・スタッフ管理</h1>
                    <p className="text-slate-600 mt-1 text-xs lg:text-sm hidden sm:block">
                      店長アカウントの作成と、各店長配下のスタッフ管理
                    </p>
                  </div>
                </div>
                <div className="flex flex-row space-x-2 lg:space-x-3">
                  <button
                    onClick={() => setShowCreateManagerModal(true)}
                    className="inline-flex items-center justify-center px-2 lg:px-4 py-1.5 lg:py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg lg:rounded-xl hover:from-teal-600 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
                  >
                    <Plus className="h-3 lg:h-4 w-3 lg:w-4 mr-1 lg:mr-2" />
                    <span className="text-xs lg:text-base">店長</span>
                  </button>
                  <button
                    onClick={() => setShowDirectSlotModal(true)}
                    className="inline-flex items-center justify-center px-2 lg:px-4 py-1.5 lg:py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg lg:rounded-xl hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
                  >
                    <Plus className="h-3 lg:h-4 w-3 lg:w-4 mr-1 lg:mr-2" />
                    <span className="text-xs lg:text-base">枠</span>
                  </button>
                  <button
                    onClick={() => setShowSlotApprovalModal(true)}
                    className="inline-flex items-center justify-center px-2 lg:px-4 py-1.5 lg:py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg lg:rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20 relative"
                  >
                    <Eye className="h-3 lg:h-4 w-3 lg:w-4 mr-1 lg:mr-2" />
                    <span className="text-xs lg:text-base">申請管理</span>
                    {slotRequests.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {slotRequests.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      refreshShopsData();
                      refreshStats();
                    }}
                    className="inline-flex items-center justify-center px-2 lg:px-3 py-1.5 lg:py-2 bg-slate-700/50 backdrop-blur-sm text-white rounded-lg lg:rounded-xl hover:bg-slate-600/50 transition-all duration-200 border border-slate-600/30"
                  >
                    <Activity className="h-3 lg:h-4 w-3 lg:w-4 mr-1 lg:mr-2" />
                    <span className="text-xs lg:text-base">更新</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-600">店長数</p>
                    <p className="text-2xl font-bold text-teal-600">{statsData.totalManagers}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
                    <UserCheck className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-600">スタッフ数</p>
                    <p className="text-2xl font-bold text-emerald-600">{statsData.totalStaff}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-600">総ユーザー数</p>
                    <p className="text-2xl font-bold text-slate-800">{statsData.totalUsers}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            </div>


            {/* Managers List */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">店長・スタッフ一覧</h3>
                <p className="text-xs text-gray-500 mt-1">{localManagersData.length}人の店長が表示されています</p>
              </div>
              
              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">読み込み中...</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {localManagersData.map((item) => (
                    <div key={item.manager.uid} className="border-b border-slate-200/30 last:border-b-0">
                      {/* Manager Row */}
                      <div className="bg-slate-50/80 backdrop-blur-sm p-4 hover:bg-white/90 transition-all duration-200">
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
                            
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg">
                              <span className="text-white font-semibold text-base">
                                {item.manager.name?.charAt(0) || 'M'}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="text-base font-semibold text-slate-900">{item.manager.name}</h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 shadow-sm">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  店長
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${
                                  item.slots.availableSlots === 0 ? 
                                    'bg-red-100 text-red-800 border-red-200' : 
                                    item.slots && item.slots.availableSlots < 2 ?
                                      'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                      'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                  <span className="font-bold">
                                    {item.slots.usedSlots}/{item.slots.totalSlots}枠
                                  </span>
                                </span>
                              </div>
                              <div className="space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-xs text-slate-600">
                                <div className="flex items-center">
                                  <Shield className="h-3 w-3 mr-1 text-slate-500" />
                                  <span>ID: {item.manager.userId}</span>
                                </div>
                                <div className="flex items-center">
                                  <Users className="h-3 w-3 mr-1 text-slate-500" />
                                  <span>{item.staff.length}人のスタッフ</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleDeleteUser(item.manager.uid, 'manager')}
                              className="p-2 text-rose-600 hover:text-rose-700 bg-rose-50/80 hover:bg-rose-100/80 backdrop-blur-sm rounded-lg transition-all duration-200 border border-rose-200/50"
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
                                        <div className="space-y-1 sm:space-y-0 sm:flex sm:items-center sm:space-x-4 text-xs text-slate-600">
                                          <div className="flex items-center">
                                            <Shield className="h-3 w-3 mr-1 text-slate-500" />
                                            <span>ID: {staff.userId}</span>
                                          </div>
                                          <div className="flex items-center">
                                            <span>時給: {staff.hourlyRate || '未設定'}</span>
                                          </div>
                                          <div className="flex items-center">
                                            <UserCheck className="h-3 w-3 mr-1 text-slate-500" />
                                            <span>{staff.employmentType || '未設定'}</span>
                                          </div>
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
                              <p className="mt-2 text-sm text-slate-400">ヘッダーの「新規スタッフ」ボタンから追加できます</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {!loading && localManagersData.length === 0 && (
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">所属店長 *</label>
                  <select
                    value={staffFormData.managerId}
                    onChange={(e) => setStaffFormData({ ...staffFormData, managerId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">店長を選択してください</option>
                    {localManagersData.map((manager) => (
                      <option key={manager.manager.uid} value={manager.manager.uid}>
                        {manager.manager.name} (ID: {manager.manager.userId})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">このスタッフが所属する店長を選択してください</p>
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
      {/* Slot Request Modal */}
      {showSlotRequestModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">枠追加申請</h2>
              </div>
              <button
                onClick={() => setShowSlotRequestModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSlotRequest} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">対象店長 *</label>
                  <select
                    value={slotRequestFormData.managerId}
                    onChange={(e) => setSlotRequestFormData({ ...slotRequestFormData, managerId: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">店長を選択してください</option>
                    {localManagersData.map((manager) => (
                      <option key={manager.manager.uid} value={manager.manager.uid}>
                        {manager.manager.name} (現在: {manager.slots.totalSlots}枠)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">追加枠数 *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={slotRequestFormData.requestedSlots}
                    onChange={(e) => setSlotRequestFormData({ ...slotRequestFormData, requestedSlots: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">申請理由 *</label>
                  <textarea
                    value={slotRequestFormData.reason}
                    onChange={(e) => setSlotRequestFormData({ ...slotRequestFormData, reason: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                    rows={4}
                    placeholder="枠追加が必要な理由を入力してください..."
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSlotRequestModal(false)}
                  className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg"
                >
                  申請する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}      {/* Direct Slot Setting Modal */}
      {showDirectSlotModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">枠設定</h2>
              </div>
              <button
                onClick={() => setShowDirectSlotModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleDirectSlotSetting} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">対象店長 *</label>
                  <select
                    value={directSlotFormData.managerId}
                    onChange={(e) => {
                      const selectedManager = localManagersData.find(m => m.manager.uid === e.target.value);
                      setDirectSlotFormData({ 
                        ...directSlotFormData, 
                        managerId: e.target.value,
                        newSlots: selectedManager.slots.totalSlots
                      });
                    }}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">店長を選択してください</option>
                    {localManagersData.map((manager) => (
                      <option key={manager.manager.uid} value={manager.manager.uid}>
                        {manager.manager.name} (現在: {manager.slots.totalSlots}枠, 使用中: {manager.staff.length}人)
                      </option>
                    ))}
                  </select>
                </div>

                {directSlotFormData.managerId && (
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/50">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center">
                        <div className="text-slate-600">現在枠数</div>
                        <div className="text-lg font-bold text-slate-900">
                          {(localManagersData.find(m => m.manager.uid === directSlotFormData.managerId)?.slots?.totalSlots || 0)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-600">使用中</div>
                        <div className="text-lg font-bold text-orange-600">
                          {localManagersData.find(m => m.manager.uid === directSlotFormData.managerId)?.staff.length || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-slate-600">空き枠</div>
                        <div className="text-lg font-bold text-emerald-600">
                          {(localManagersData.find(m => m.manager.uid === directSlotFormData.managerId)?.slots.availableSlots || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">新しい枠数 *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={directSlotFormData.newSlots}
                    onChange={(e) => setDirectSlotFormData({ ...directSlotFormData, newSlots: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">1〜50の範囲で設定してください</p>
                </div>
              </div>

              <div className="bg-orange-50/80 rounded-xl p-4 border border-orange-200/50">
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-orange-100 rounded-full mt-1">
                    <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-orange-700 mb-1">注意事項</p>
                    <p className="text-xs text-orange-600">枠数を現在のスタッフ数より少なくすることはできません。枠数変更は履歴として記録されます。</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDirectSlotModal(false)}
                  className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg"
                >
                  変更する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slot Approval Modal */}
      {showSlotApprovalModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">枠追加申請管理</h2>
                <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                  {slotRequests.length}件の申請
                </span>
              </div>
              <button
                onClick={() => setShowSlotApprovalModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {slotRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-slate-100/80 rounded-full inline-block mb-4">
                    <Eye className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">保留中の申請はありません</h3>
                  <p className="text-slate-500">すべての枠追加申請が処理済みです。</p>
                </div>
              ) : (
                slotRequests.map((request) => (
                  <div key={request.requestId} className="bg-slate-50/80 backdrop-blur-sm rounded-xl border border-slate-200/50 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg">
                            <span className="text-white font-semibold text-base">
                              {request.managerName?.charAt(0) || 'M'}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">{request.managerName || 'Unknown'}</h3>
                            <div className="flex items-center space-x-4 text-sm text-slate-600">
                              <span>申請ID: {request.requestId}</span>
                              <span>申請者: {request.requestedByName}</span>
                              <span>申請日: {new Date(request.createdAt).toLocaleDateString('ja-JP')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-white/80 rounded-lg p-4 border border-slate-200/50">
                            <p className="text-xs font-medium text-slate-600 mb-1">現在の枠数</p>
                            <p className="text-2xl font-bold text-slate-900">{request.currentSlots}枠</p>
                          </div>
                          <div className="bg-white/80 rounded-lg p-4 border border-slate-200/50">
                            <p className="text-xs font-medium text-slate-600 mb-1">追加希望枠数</p>
                            <p className="text-2xl font-bold text-orange-600">+{request.requestedSlots}枠</p>
                          </div>
                          <div className="bg-white/80 rounded-lg p-4 border border-slate-200/50">
                            <p className="text-xs font-medium text-slate-600 mb-1">変更後枠数</p>
                            <p className="text-2xl font-bold text-emerald-600">{request.currentSlots + request.requestedSlots}枠</p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-slate-700 mb-2">申請理由</p>
                          <div className="bg-white/80 rounded-lg p-3 border border-slate-200/50">
                            <p className="text-slate-800">{request.reason}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200/50">
                      <button
                        onClick={() => {
                          const reason = prompt('却下理由を入力してください:');
                          if (reason && reason.trim()) {
                            handleRejectRequest(request.requestId, reason.trim());
                          } else if (reason !== null) {
                            alert('却下理由を入力してください。');
                          }
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors border border-red-200"
                      >
                        <X className="h-4 w-4 mr-2 inline" />
                        却下
                      </button>
                      <button
                        onClick={() => handleApproveRequest(request.requestId)}
                        className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors border border-emerald-200"
                      >
                        <UserCheck className="h-4 w-4 mr-2 inline" />
                        承認
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={() => setShowSlotApprovalModal(false)}
                className="px-6 py-2.5 text-slate-600 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200/80 transition-all duration-200 border border-slate-300/50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}