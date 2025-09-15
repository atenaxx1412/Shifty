'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { 
  Calendar,
  Plus,
  Search,
  Users,
  Clock,
  CheckCircle,
  Edit,
  Eye,
  Trash2,
  RefreshCw,
  UserCheck,
  CalendarDays,
  TrendingUp,
  Banknote,
  Calculator,
  PieChart,
  Download
} from 'lucide-react';
import { ShiftExtended, ShiftRequestEnhanced, BudgetCalculation, User } from '@/types';
import { shiftService } from '@/lib/shiftService';
import { budgetService } from '@/lib/budgetService';
import { excelService } from '@/lib/excelService';
import { userService } from '@/lib/userService';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import ShiftCreateModal from '@/components/shifts/ShiftCreateModal';
import BudgetDetailsModal from '@/components/budget/BudgetDetailsModal';

interface ShiftStats {
  totalShifts: number;
  publishedShifts: number;
  draftShifts: number;
  pendingRequests: number;
  totalStaffHours: number;
  estimatedCost: number;
}

export default function ManagerShiftsPage() {
  const { currentUser } = useAuth();
  
  // すべてのフックを条件分岐の前に配置
  const [shifts, setShifts] = useState<ShiftExtended[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<ShiftExtended[]>([]);
  const [shiftRequests, setShiftRequests] = useState<ShiftRequestEnhanced[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<ShiftStats>({
    totalShifts: 0,
    publishedShifts: 0,
    draftShifts: 0,
    pendingRequests: 0,
    totalStaffHours: 0,
    estimatedCost: 0
  });
  const [budgetCalculation, setBudgetCalculation] = useState<BudgetCalculation | null>(null);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // すべての関数定義（useEffectの前に定義）
  const fetchStaff = async () => {
    if (!currentUser) return;
    try {
      setStaffLoading(true);
      const fetchedStaff = await userService.getStaffByManager(currentUser.uid);
      setStaff(fetchedStaff);
      console.log('✅ Staff fetched successfully:', fetchedStaff.length, 'members');
    } catch (error) {
      console.error('❌ Error fetching staff:', error);
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleShiftUpdates = (updatedShifts: ShiftExtended[]) => {
    setShifts(updatedShifts);
    updateStats(updatedShifts);
  };

  const updateStats = (shiftsData: ShiftExtended[]) => {
    const stats: ShiftStats = {
      totalShifts: shiftsData.length,
      publishedShifts: shiftsData.filter(s => s.status === 'published').length,
      draftShifts: shiftsData.filter(s => s.status === 'draft').length,
      pendingRequests: shiftRequests.filter(r => r.status === 'pending').length,
      totalStaffHours: shiftsData.reduce((total, shift) => {
        return total + shift.slots.reduce((slotTotal, slot) => {
          const duration = calculateSlotDuration(slot.startTime, slot.endTime);
          return slotTotal + (duration / 60) * slot.requiredStaff;
        }, 0);
      }, 0),
      estimatedCost: shiftsData.reduce((total, shift) => 
        total + (shift.metadata.estimatedCost || 0), 0)
    };
    setStats(stats);
  };

  const calculateSlotDuration = (startTime: string, endTime: string): number => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
  };

  const fetchShifts = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const weekStart = startOfWeek(selectedWeek, { locale: ja });
      const weekEnd = endOfWeek(selectedWeek, { locale: ja });
      
      const fetchedShifts = await shiftService.getShiftsByShop(
        currentUser.uid,
        weekStart,
        addWeeks(weekEnd, 4) // 4週間分取得
      );
      
      setShifts(fetchedShifts);
      updateStats(fetchedShifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftRequests = async () => {
    try {
      if (staff.length === 0) {
        console.log('ℹ️ Staff data not loaded yet, skipping shift requests fetch');
        return;
      }

      console.log('📋 Fetching shift requests for all staff members...');
      const allRequests: ShiftRequestEnhanced[] = [];

      // 各スタッフのシフトリクエストを取得
      for (const staffMember of staff) {
        try {
          const userRequests = await shiftService.getShiftRequestsByUser(staffMember.uid);
          allRequests.push(...userRequests);
        } catch (error) {
          console.error(`❌ Error fetching requests for ${staffMember.name}:`, error);
        }
      }

      // 最新のリクエストを上位に表示
      allRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setShiftRequests(allRequests);
      console.log(`✅ Fetched ${allRequests.length} shift requests from ${staff.length} staff members`);
      
    } catch (error) {
      console.error('❌ Error fetching shift requests:', error);
      setShiftRequests([]);
    }
  };

  const applyFilters = () => {
    let filtered = shifts;

    // ステータスフィルター
    if (filterStatus !== 'all') {
      filtered = filtered.filter(shift => shift.status === filterStatus);
    }

    // 検索フィルター
    if (searchTerm) {
      filtered = filtered.filter(shift =>
        shift.shiftId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        format(shift.date, 'yyyy-MM-dd').includes(searchTerm)
      );
    }

    // 週フィルター
    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedWeek, { locale: ja });
      const weekEnd = endOfWeek(selectedWeek, { locale: ja });
      filtered = filtered.filter(shift =>
        shift.date >= weekStart && shift.date <= weekEnd
      );
    }

    setFilteredShifts(filtered);
  };

  // すべてのuseEffectフック（条件分岐の前に配置）
  useEffect(() => {
    if (!currentUser) return;
    
    fetchShifts();
    fetchStaff();
    
    // リアルタイム同期を開始
    const unsubscribe = shiftService.subscribeToShiftUpdates(
      currentUser.uid,
      handleShiftUpdates
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // スタッフデータが読み込まれたらシフトリクエストを取得
  useEffect(() => {
    if (staff.length > 0) {
      fetchShiftRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.length]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, filterStatus, searchTerm, selectedWeek]);

  // 予算計算を初期読み込み時に実行（シフトとスタッフデータが両方揃った時）
  useEffect(() => {
    if (shifts.length > 0 && staff.length > 0) {
      calculateBudget();
    }
  }, [shifts.length, staff.length]);

  // 早期returnは全てのフックの後に配置
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleCreateShift = () => {
    setShowCreateModal(true);
  };

  // 週まとめ作成（平日5日分）
  const handleCreateWeeklyShift = async () => {
    
    const confirmed = window.confirm('週まとめシフト（月～金曜日）を作成しますか？');
    if (!confirmed) return;

    setLoading(true);
    try {
      console.log('📅 Creating weekly shifts...');
      
      const weekStart = startOfWeek(selectedWeek, { locale: ja });
      const weekDays = [];
      
      // 月曜日から金曜日まで（5日間）
      for (let i = 1; i <= 5; i++) {
        const day = addDays(weekStart, i);
        weekDays.push(day);
      }
      
      // 基本シフトテンプレート
      const basicShiftTemplate = {
        slots: [
          {
            slotId: `slot_${Date.now()}_morning`,
            startTime: '09:00',
            endTime: '15:00',
            requiredStaff: 3,
            assignedStaff: [],
            requiredSkills: ['接客', 'レジ'],
            priority: 'medium' as const,
            estimatedDuration: 360
          },
          {
            slotId: `slot_${Date.now()}_afternoon`,
            startTime: '15:00',
            endTime: '21:00',
            requiredStaff: 3,
            assignedStaff: [],
            requiredSkills: ['フロア', '清掃'],
            priority: 'medium' as const,
            estimatedDuration: 360
          }
        ]
      };
      
      // 5日分のシフトを作成
      const createdShifts = [];
      for (const day of weekDays) {
        const shiftData = {
          managerId: currentUser.uid,
          date: day,
          slots: basicShiftTemplate.slots.map((slot, index) => ({
            ...slot,
            slotId: `slot_${day.getTime()}_${index}`
          }))
        };
        
        const shift = await shiftService.createShift(shiftData, currentUser);
        createdShifts.push(shift);
        console.log(`✅ Created shift for ${format(day, 'MM/dd', { locale: ja })}:`, shift.shiftId);
      }
      
      console.log('🎉 Weekly shifts creation completed:', createdShifts.length);
      alert(`週まとめシフト（${createdShifts.length}日分）を作成しました`);
      
      // リストを更新
      fetchShifts();
      
    } catch (error) {
      console.error('❌ Failed to create weekly shifts:', error);
      alert('週まとめシフトの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 月まとめ作成
  const handleCreateMonthlyShift = async () => {
    
    const monthName = format(selectedWeek, 'yyyy年M月', { locale: ja });
    const confirmed = window.confirm(`${monthName}の月まとめシフトを作成しますか？（土日祖日除く）`);
    if (!confirmed) return;

    setLoading(true);
    try {
      console.log('📅 Creating monthly shifts...');
      
      // 月の初日と末日を取得
      const monthStart = new Date(selectedWeek.getFullYear(), selectedWeek.getMonth(), 1);
      const monthEnd = new Date(selectedWeek.getFullYear(), selectedWeek.getMonth() + 1, 0);
      
      const workDays = [];
      for (let day = new Date(monthStart); day <= monthEnd; day.setDate(day.getDate() + 1)) {
        const dayOfWeek = day.getDay();
        // 土曜日(6)と日曜日(0)を除く
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workDays.push(new Date(day));
        }
      }
      
      // 基本シフトテンプレート
      const basicShiftTemplate = {
        slots: [
          {
            slotId: `slot_monthly_morning`,
            startTime: '09:00',
            endTime: '15:00',
            requiredStaff: 3,
            assignedStaff: [],
            requiredSkills: ['接客', 'レジ'],
            priority: 'medium' as const,
            estimatedDuration: 360
          },
          {
            slotId: `slot_monthly_afternoon`,
            startTime: '15:00',
            endTime: '21:00',
            requiredStaff: 3,
            assignedStaff: [],
            requiredSkills: ['フロア', '清掃'],
            priority: 'medium' as const,
            estimatedDuration: 360
          }
        ]
      };
      
      // 全営業日のシフトを作成
      const createdShifts = [];
      for (const day of workDays) {
        const shiftData = {
          managerId: currentUser.uid,
          date: day,
          slots: basicShiftTemplate.slots.map((slot, index) => ({
            ...slot,
            slotId: `slot_${day.getTime()}_${index}`
          }))
        };
        
        const shift = await shiftService.createShift(shiftData, currentUser);
        createdShifts.push(shift);
        console.log(`✅ Created shift for ${format(day, 'MM/dd', { locale: ja })}:`, shift.shiftId);
        
        // APIへの負荷を軽減するための少しの待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('🎉 Monthly shifts creation completed:', createdShifts.length);
      alert(`${monthName}の月まとめシフト（${createdShifts.length}日分）を作成しました`);
      
      // リストを更新
      fetchShifts();
      
    } catch (error) {
      console.error('❌ Failed to create monthly shifts:', error);
      alert('月まとめシフトの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleShiftCreated = (shiftId: string) => {
    console.log('✅ Shift created successfully:', shiftId);
    setShowCreateModal(false);
    // リアルタイム同期により自動的にシフトリストが更新される
    
    // 予算再計算
    if (budgetCalculation) {
      calculateBudget();
    }
  };

  // 予算計算を実行
  const calculateBudget = async () => {
    if (budgetLoading) return;

    setBudgetLoading(true);
    try {
      // 今月および来月のシフトを取得
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
      
      const monthlyShifts = await shiftService.getShiftsByShop(
        currentUser.uid,
        nextMonth,
        monthEnd
      );

      // スタッフデータがロード済みかチェック
      if (staff.length === 0) {
        console.log('⚠️ Staff data not loaded yet, skipping budget calculation');
        return;
      }

      // 予算計算を実行
      const budget = await budgetService.calculateBudgetForPeriod(
        currentUser.uid,
        monthlyShifts,
        staff,
        nextMonth,
        monthEnd,
        undefined, // テンプレートは使用しない
        500000 // 予算上限 50万円
      );

      setBudgetCalculation(budget);
      console.log('💰 Budget calculation completed:', budget.summary);

    } catch (error) {
      console.error('❌ Error calculating budget:', error);
    } finally {
      setBudgetLoading(false);
    }
  };

  // シフトスケジュールをExcelエクスポート
  const handleExportShifts = () => {
    try {
      excelService.exportShiftSchedule(filteredShifts);
      console.log('✅ Shift schedule exported to Excel successfully');
    } catch (error) {
      console.error('❌ Failed to export shift schedule:', error);
    }
  };

  // 総合レポートをExcelエクスポート
  const handleExportComprehensive = () => {
    if (!budgetCalculation) {
      console.warn('予算データがありません');
      return;
    }

    if (staff.length === 0) {
      console.warn('スタッフデータがロードされていません');
      return;
    }

    try {
      excelService.exportComprehensiveReport(filteredShifts, budgetCalculation, staff);
      console.log('✅ Comprehensive report exported to Excel successfully');
    } catch (error) {
      console.error('❌ Failed to export comprehensive report:', error);
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleApproveShift = async (shiftId: string) => {
    
    try {
      await shiftService.approveShift(shiftId, currentUser);
      // UI更新はリアルタイム同期で自動更新される
    } catch (error) {
      console.error('Error approving shift:', error);
    }
  };

  const handleDeleteShift = async (shift: ShiftExtended) => {
    
    const confirmed = window.confirm(
      `${format(shift.date, 'MM月dd日（E）', { locale: ja })}のシフトを削除しますか？\n\n` +
      `この操作は取り消せません。`
    );
    
    if (!confirmed) return;

    try {
      await shiftService.deleteShift(shift.id!, currentUser);
      console.log(`✅ Shift deleted: ${shift.shiftId}`);
      // UI更新はリアルタイム同期で自動更新される
    } catch (error: unknown) {
      console.error('Error deleting shift:', error);
      alert(`削除に失敗しました: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      published: 'bg-green-100 text-green-800 border-green-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const labels = {
      draft: '下書き',
      published: '公開済み',
      completed: '完了'
    };

    const icons = {
      draft: <Edit className="h-3 w-3" />,
      published: <CheckCircle className="h-3 w-3" />,
      completed: <UserCheck className="h-3 w-3" />
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {icons[status as keyof typeof icons]}
        <span className="ml-1">{labels[status as keyof typeof labels]}</span>
      </span>
    );
  };

  const getComplexityBadge = (complexity: 'simple' | 'moderate' | 'complex') => {
    const styles = {
      simple: 'bg-blue-100 text-blue-800',
      moderate: 'bg-orange-100 text-orange-800',
      complex: 'bg-red-100 text-red-800'
    };

    const labels = {
      simple: 'シンプル',
      moderate: '標準',
      complex: '複雑'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[complexity]}`}>
        {labels[complexity]}
      </span>
    );
  };

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="シフト管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">総シフト</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalShifts}</p>
                  </div>
                  <CalendarDays className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">総労働時間</p>
                    <p className="text-2xl font-bold text-purple-600">{Math.round(stats.totalStaffHours)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">人件費予算</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      ¥{budgetCalculation ? budgetCalculation.summary.totalCost.toLocaleString() : stats.estimatedCost.toLocaleString()}
                    </p>
                    {budgetCalculation && budgetCalculation.summary.budgetLimit && (
                      <p className={`text-xs mt-1 ${
                        budgetCalculation.summary.budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        予算{budgetCalculation.summary.budgetVariance >= 0 ? '内' : '超過'} ¥{Math.abs(budgetCalculation.summary.budgetVariance).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Banknote className="h-8 w-8 text-indigo-500" />
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
              <div className="space-y-4">
                {/* Search and Filter Row */}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Week Navigation */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                      <span className="text-sm font-medium whitespace-nowrap">
                        {format(startOfWeek(selectedWeek, { locale: ja }), 'MM/dd', { locale: ja })} - {format(endOfWeek(selectedWeek, { locale: ja }), 'MM/dd', { locale: ja })}
                      </span>
                      <button
                        onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="シフトID・日付で検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Status Filter */}
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as 'all' | 'draft' | 'published' | 'completed')}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">全てのステータス</option>
                      <option value="draft">下書き</option>
                      <option value="published">公開済み</option>
                      <option value="completed">完了</option>
                    </select>
                  </div>
                  
                  {/* System Actions */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={fetchShifts}
                      className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">更新</span>
                    </button>
                    
                    <a
                      href="/manager/shifts/calendar"
                      className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">カレンダー</span>
                    </a>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Shift Creation Group */}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">シフト作成</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <button
                        onClick={handleCreateShift}
                        className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <span className="text-sm font-medium">日ごと</span>
                      </button>
                      
                      <button
                        onClick={() => handleCreateWeeklyShift()}
                        className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <span className="text-sm font-medium">週まとめ</span>
                      </button>
                      
                      <button
                        onClick={() => handleCreateMonthlyShift()}
                        className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <span className="text-sm font-medium">月まとめ</span>
                      </button>
                    </div>
                  </div>

                  {/* Management Actions Group */}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">管理・分析</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowBudgetDetails(true)}
                        disabled={budgetLoading}
                        className="flex items-center justify-center px-4 py-2 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        <span>{budgetLoading ? '計算中...' : '予算詳細'}</span>
                      </button>
                      
                      <button
                        onClick={calculateBudget}
                        disabled={budgetLoading}
                        className="flex items-center justify-center px-4 py-2 text-gray-600 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        <span>予算更新</span>
                      </button>
                    </div>
                  </div>

                  {/* Export Actions Group */}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">エクスポート</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleExportShifts}
                        className="flex items-center justify-center px-4 py-2 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        <span>シフト出力</span>
                      </button>

                      <button
                        onClick={handleExportComprehensive}
                        disabled={!budgetCalculation}
                        className="flex items-center justify-center px-4 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <PieChart className="h-4 w-4 mr-2" />
                        <span>総合レポート</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shifts List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  シフト一覧 ({filteredShifts.length}件)
                </h3>
              </div>
              
              {loading ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">読み込み中...</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredShifts.map((shift) => (
                    <div key={shift.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-semibold text-gray-900">
                                {format(shift.date, 'MM月dd日（E）', { locale: ja })}
                              </h4>
                              {getStatusBadge(shift.status)}
                              {getComplexityBadge(shift.metadata.complexity)}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                {shift.metadata.totalRequiredStaff}名必要 / {shift.metadata.totalAssignedStaff}名配置
                              </span>
                              <span className="flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {shift.slots.length}スロット
                              </span>
                              <span className="flex items-center">
                                <Banknote className="h-4 w-4 mr-1" />
                                ¥{shift.metadata.estimatedCost?.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {shift.status === 'draft' && (
                            <button
                              onClick={() => handleApproveShift(shift.id!)}
                              className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              承認・公開
                            </button>
                          )}
                          
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteShift(shift)}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!loading && filteredShifts.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <CalendarDays className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">シフトが見つかりません</h3>
                  <p className="mt-1 text-sm text-gray-500">新しいシフトを作成してください</p>
                  <button
                    onClick={handleCreateShift}
                    className="mt-4 flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    シフト作成
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
        
        {/* シフト作成モーダル */}
        {showCreateModal && (
          <ShiftCreateModal
            isOpen={showCreateModal}
            onClose={handleCloseCreateModal}
            onSuccess={handleShiftCreated}
          />
        )}

        {/* 予算詳細モーダル */}
        <BudgetDetailsModal
          isOpen={showBudgetDetails}
          onClose={() => setShowBudgetDetails(false)}
          budgetCalculation={budgetCalculation}
        />
        </div>
      </ProtectedRoute>
    );
}