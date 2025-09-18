'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { 
  TrendingUp, 
  Banknote, 
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  Target,
  BarChart3,
  PieChart,
  ArrowLeft
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { budgetService } from '@/lib/budgetService';
import { ShiftManagementService } from '@/lib/shiftService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BudgetCalculation, User } from '@/types';
import BudgetDetailsModal from '@/components/budget/BudgetDetailsModal';

export default function ManagerBudgetPage() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [budgetData, setBudgetData] = useState<BudgetCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [budgetLimit] = useState(1000000); // 100万円のデフォルト予算
  // const [, setBudgetLimit] = useState(1000000); // 予算設定機能用（将来実装予定）

  // 月の開始・終了日
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // 予算データを取得
  const fetchBudgetData = async () => {
    if (!currentUser?.shopId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('💰 Fetching budget data for shopId:', currentUser.shopId, 'period:', monthStart, 'to', monthEnd);
      
      // ShiftManagementServiceのインスタンスを取得
      const shiftService = ShiftManagementService.getInstance();
      
      // 1. 期間のシフトデータを取得
      const shifts = await shiftService.getShiftsByShop(currentUser.shopId, monthStart, monthEnd);
      console.log('📅 Retrieved shifts:', shifts.length);
      
      // 2. 店舗のスタッフデータを取得
      const usersRef = collection(db, 'users');
      const staffQuery = query(usersRef, where('shopId', '==', currentUser.shopId));
      const staffSnapshot = await getDocs(staffQuery);
      
      const staff = staffSnapshot.docs.map(doc => ({
        uid: doc.data().uid,
        userId: doc.data().userId || doc.id,
        password: doc.data().password || '',
        name: doc.data().name,
        role: doc.data().role,
        shopId: doc.data().shopId,
        hourlyRate: doc.data().hourlyRate || 1000,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        ...doc.data()
      })) as User[];
      
      console.log('👥 Retrieved staff:', staff.length);
      
      if (shifts.length === 0 || staff.length === 0) {
        console.warn('⚠️ No shifts or staff found for budget calculation');
        setBudgetData(null);
        setError('シフトまたはスタッフデータがありません。データを追加してください。');
        return;
      }
      
      // 3. BudgetServiceを使って実際の予算計算を実行
      const budgetCalculation = await budgetService.calculateBudgetForPeriod(
        currentUser.shopId,
        shifts,
        staff,
        monthStart,
        monthEnd,
        undefined, // budgetTemplate
        budgetLimit
      );
      
      console.log('✅ Budget calculation completed:', budgetCalculation);
      setBudgetData(budgetCalculation);
    } catch (err) {
      setError('予算データの取得に失敗しました');
      console.error('Budget fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, [selectedDate, budgetLimit, currentUser]);

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subMonths(selectedDate, 1));
    } else {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

  // 今月に戻る
  const goToCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  // 予算使用率の色
  const getBudgetUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading && !budgetData) {
    return (
      <ProtectedRoute requiredRoles={['root', 'manager']}>
        <div className="h-screen overflow-hidden bg-gray-50">
          <AppHeader title="予算管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-blue-600">予算データを読み込み中...</p>
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="予算管理" />
        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

          {/* Month Navigation */}
          <div className="flex items-center justify-between bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <h2 className="text-lg font-semibold text-blue-900">
                {format(selectedDate, 'yyyy年M月', { locale: ja })}
              </h2>
              
              <button
                onClick={() => changeMonth('next')}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>
            
            <button
              onClick={goToCurrentMonth}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              今月
            </button>
          </div>

          {budgetData && (
            <>
              {/* Budget Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">月間予算</p>
                      <p className="text-2xl font-bold text-blue-600">
                        ¥{(budgetData.summary.budgetLimit || budgetLimit).toLocaleString()}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">実際使用額</p>
                      <p className="text-2xl font-bold text-green-600">
                        ¥{budgetData.summary.totalCost.toLocaleString()}
                      </p>
                    </div>
                    <Banknote className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2">
                    <span className={`text-sm font-medium ${getBudgetUsageColor(((budgetData.summary.totalCost / (budgetData.summary.budgetLimit || budgetLimit)) * 100))}`}>
                      {((budgetData.summary.totalCost / (budgetData.summary.budgetLimit || budgetLimit)) * 100).toFixed(1)}% 使用
                    </span>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">予想総額</p>
                      <p className="text-2xl font-bold text-orange-600">
                        ¥{budgetData.summary.totalCost.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-500" />
                  </div>
                  {budgetData.projectedOverrun > 0 && (
                    <div className="mt-2 flex items-center space-x-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm font-medium text-red-600">
                        予算超過予想: ¥{budgetData.projectedOverrun.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">残り予算</p>
                      <p className="text-2xl font-bold text-purple-600">
                        ¥{(budgetData.summary.budgetVariance >= 0 ? budgetData.summary.budgetVariance : 0).toLocaleString()}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">総シフト数</p>
                      <p className="text-2xl font-bold text-blue-900">{budgetData.summary.totalShifts}コマ</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">総労働時間</p>
                      <p className="text-2xl font-bold text-green-900">{budgetData.summary.totalHours.toFixed(0)}時間</p>
                    </div>
                    <Clock className="h-8 w-8 text-green-500" />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">平均時給</p>
                      <p className="text-2xl font-bold text-purple-900">¥{Math.round(budgetData.summary.totalBaseCost / budgetData.summary.totalHours).toLocaleString()}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Cost Categories */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-blue-900">コスト内訳</h3>
                  <button
                    onClick={() => setShowDetailsModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PieChart className="h-4 w-4" />
                    <span>詳細分析</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    ['regularHours', budgetData.summary.totalBaseCost, '基本給'],
                    ['overtimeHours', budgetData.summary.totalOvertimeCost, '残業代'],
                    ['bonuses', budgetData.summary.totalBonusCost, '各種手当'],
                    ['taxAndInsurance', budgetData.summary.totalTaxAndInsurance, '税金・保険']
                  ].map(([category, amount, label]) => {
                    const percentage = (Number(amount) / budgetData.summary.totalCost) * 100;
                    
                    return (
                      <div key={category} className="p-4 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700">
                            {label}
                          </span>
                          <span className="text-sm text-blue-500">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-lg font-bold text-blue-900">
                          ¥{amount.toLocaleString()}
                        </p>
                        <div className="mt-2 bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 rounded-full h-2" 
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Risk Factors */}
              {false && ( // 現在はRisk Factorsは実装されていない
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">リスク要因</h3>
                  <div className="space-y-3">
                    {([] as { factor: string; description: string; estimatedCost: number }[]).map((risk, index) => (
                      <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-red-800">{risk.factor}</h4>
                            <p className="text-sm text-red-700 mt-1">{risk.description}</p>
                            <p className="text-sm font-medium text-red-800 mt-2">
                              予想追加コスト: ¥{risk.estimatedCost.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {false && ( // 現在は推奨事項は実装されていない
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">改善提案</h3>
                  <div className="space-y-3">
                    {[].map((rec, index) => (
                      <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-green-800">{rec.title}</h4>
                            <p className="text-sm text-green-700 mt-1">{rec.description}</p>
                            <p className="text-sm font-medium text-green-800 mt-2">
                              予想削減額: ¥{rec.estimatedSavings.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div>
                  <p className="text-red-800 font-medium">エラーが発生しました</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Budget Details Modal */}
          {showDetailsModal && budgetData && (
            <BudgetDetailsModal
              isOpen={showDetailsModal}
              budgetCalculation={budgetData}
              onClose={() => setShowDetailsModal(false)}
            />
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}