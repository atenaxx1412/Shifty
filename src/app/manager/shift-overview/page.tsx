'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import {
  Eye,
  Calendar,
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  BarChart3,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { ManagerDataService, ShiftOverviewData, WeeklyShiftData, ProblemArea } from '@/lib/managerDataService';


export default function ShiftOverviewPage() {
  const { currentUser } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [shiftData, setShiftData] = useState<ShiftOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 月次人件費データ
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const loadShiftData = async () => {
    if (!currentUser?.uid) return;

    setLoading(true);
    setBudgetLoading(true);
    try {
      console.log('🔄 Loading shift overview data for:', selectedMonth);

      // シフト概要データと月次人件費を並行取得
      const [overviewData, dashboardData] = await Promise.all([
        ManagerDataService.getOptimizedShiftOverview(currentUser.uid, selectedMonth),
        ManagerDataService.getOptimizedDashboardData(currentUser.uid)
      ]);

      setShiftData(overviewData);
      setMonthlyBudget(dashboardData.monthlyBudget);

    } catch (error) {
      console.error('Error loading shift overview:', error);
      setShiftData(null);
      setMonthlyBudget(0);
    } finally {
      setLoading(false);
      setBudgetLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadShiftData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadShiftData();
  }, [currentUser?.uid, selectedMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedMonth + '-01');
    if (direction === 'prev') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    setSelectedMonth(`${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`);
  };

  const formatMonthDisplay = (monthString: string) => {
    const date = new Date(monthString + '-01');
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getIssueIcon = (issue: 'understaffed' | 'overstaffed' | 'empty') => {
    switch (issue) {
      case 'empty': return <AlertTriangle className="h-4 w-4" />;
      case 'understaffed': return <Users className="h-4 w-4" />;
      case 'overstaffed': return <TrendingUp className="h-4 w-4" />;
    }
  };

  return (
    <ProtectedRoute requiredRoles={['root', 'manager']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="シフト状況確認" />

        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-teal-500 p-3 rounded-full text-white">
                    <Eye className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">シフト状況確認</h1>
                    <p className="text-sm text-gray-500 mt-1">
                      全月のシフト割り振り状況を確認・管理できます
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <Link
                    href="/manager/calendar"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>シフト作成</span>
                  </Link>

                  <button
                    onClick={refreshData}
                    disabled={refreshing}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Month Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">対象月選択</h2>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-900 min-w-[120px] text-center">
                      {formatMonthDisplay(selectedMonth)}
                    </span>
                  </div>

                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin h-8 w-8 border-b-2 border-teal-600 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-500">シフトデータを読み込み中...</p>
              </div>
            ) : shiftData ? (
              <>
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">総シフト数</p>
                        <p className="text-2xl font-bold text-gray-900">{shiftData.totalShifts}</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">割り当て済み</p>
                        <p className="text-2xl font-bold text-green-600">{shiftData.filledShifts}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">空きシフト</p>
                        <p className="text-2xl font-bold text-red-600">{shiftData.emptyShifts}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">今月の人件費</p>
                        <p className="text-2xl font-bold text-teal-600">
                          {budgetLoading ? '計算中...' : `¥${monthlyBudget.toLocaleString()}`}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-teal-600" />
                    </div>
                  </div>
                </div>

                {/* Weekly Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">週別詳細</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-500">週</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-500">期間</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-500">総枠数</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-500">割当済み</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-500">充足率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftData.weeklyBreakdown.map((week) => (
                          <tr key={week.weekNumber} className="border-b border-gray-100">
                            <td className="py-3 px-4 font-medium">第{week.weekNumber}週</td>
                            <td className="py-3 px-4 text-gray-600">
                              {new Date(week.startDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} -
                              {new Date(week.endDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-4">{week.totalSlots}</td>
                            <td className="py-3 px-4">{week.filledSlots}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                week.fillRate >= 80
                                  ? 'bg-green-100 text-green-800'
                                  : week.fillRate >= 60
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {week.fillRate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Problem Areas */}
                {shiftData.problemAreas.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">要注意箇所</h3>
                    <div className="space-y-3">
                      {shiftData.problemAreas.map((problem, index) => (
                        <div key={index} className={`border rounded-lg p-4 ${getSeverityColor(problem.severity)}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {getIssueIcon(problem.issue)}
                              <div>
                                <p className="font-medium">
                                  {new Date(problem.date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} {problem.timeSlot}
                                </p>
                                <p className="text-sm opacity-75">
                                  必要: {problem.requiredStaff}名 / 現在: {problem.currentStaff}名
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-white bg-opacity-50">
                              {problem.severity === 'high' ? '緊急' : problem.severity === 'medium' ? '注意' : '軽微'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">選択した月のシフトデータが見つかりません</p>
              </div>
            )}

          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}