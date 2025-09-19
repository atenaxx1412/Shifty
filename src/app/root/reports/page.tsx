'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { fetchOptimizedReportData, ReportData as ServiceReportData } from '@/services/reportsDataService';
import { useDataCacheEnhanced } from '@/hooks/useDataCacheEnhanced';
import { format } from 'date-fns';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Building,
  Banknote,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  PieChart,
  LineChart
} from 'lucide-react';
import GradientHeader from '@/components/ui/GradientHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Using ReportData from service
type ReportData = ServiceReportData;

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const [reportPeriod, setReportPeriod] = useState('monthly');

  // 改良版キャッシュ対応のデータ取得 (上書き問題修正版)
  const {
    data: reportData,
    loading,
    error,
    refresh,
    lastUpdated,
    isFromCache,
    invalidateAfterUpdate,
    cacheVersion
  } = useDataCacheEnhanced<ReportData>({
    key: 'reports-data',
    fetchFunction: fetchOptimizedReportData,
    ttl: 24 * 60 * 60 * 1000, // 24時間
    autoInvalidateOnUpdate: true,
    initialData: {
      totalRevenue: 0,
      totalProfit: 0,
      totalUsers: 0,
      totalManagers: 0,
      totalShifts: 0,
      monthlyGrowth: 0,
      monthlyProfitGrowth: 0,
      userGrowth: 0,
      revenueByManager: [],
      usersByRole: [],
      monthlyTrends: []
    }
  });

  // 改良版キャッシュステータスの確認
  const getCacheStatusText = () => {
    if (isFromCache && lastUpdated) {
      const hours = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60));
      return `キャッシュデータ v${cacheVersion} (${hours}時間前に取得)`;
    }
    return '最新データ';
  };

  // データ更新後のキャッシュ無効化関数(デバッグ用)
  const handleDataUpdate = () => {
    console.log('🔄 Simulating data update - invalidating cache...');
    invalidateAfterUpdate();
  };
  
  // reportPeriod変更時はキャッシュを保持（期間切り替えでFirebaseクエリ不要）
  useEffect(() => {
    console.log(`📊 Reports page: ${reportPeriod} period selected, using cached data`);
  }, [reportPeriod]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <AppHeader title="全体レポート" />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-64">
              <LoadingSpinner text="レポートデータを読み込み中..." size="lg" />
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="全体レポート" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <GradientHeader
              title="全体レポート"
              subtitle={`全店舗の統合分析・売上推移・運営効率レポート • ${getCacheStatusText()}`}
              icon={BarChart3}
              gradient="from-indigo-600 to-purple-700"
              iconBackground="from-white/20 to-white/30"
              textColor="text-white"
              actions={
                <div className="flex items-center space-x-4">
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                    className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg border border-white border-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 [&>option]:text-gray-900 [&>option]:bg-white"
                  >
                    <option value="weekly">週次</option>
                    <option value="monthly">月次</option>
                    <option value="quarterly">四半期</option>
                  </select>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => refresh()}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200 disabled:opacity-50 text-sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? '更新中' : '手動更新'}
                    </button>
                    <button
                      onClick={handleDataUpdate}
                      disabled={loading}
                      className="inline-flex items-center px-3 py-2 bg-orange-500 bg-opacity-80 text-white rounded-lg hover:bg-opacity-90 transition-all duration-200 disabled:opacity-50 text-sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      データ更新テスト
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      印刷
                    </button>
                  </div>
                </div>
              }
            />

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <StatCard
                label="総売上"
                value={formatCurrency(reportData.totalRevenue)}
                unit="前月比"
                icon={Banknote}
                gradient="from-green-500 to-emerald-600"
                change={formatPercentage(reportData.monthlyGrowth)}
                trend={reportData.monthlyGrowth >= 0 ? 'up' : 'down'}
                size="md"
              />
              <StatCard
                label="総ユーザー数"
                value={reportData.totalUsers}
                unit="名"
                icon={Users}
                gradient="from-blue-500 to-blue-600"
                change={formatPercentage(reportData.userGrowth)}
                trend={reportData.userGrowth >= 0 ? 'up' : 'down'}
                size="md"
              />
              <StatCard
                label="運営店舗数"
                value={reportData.totalManagers}
                unit="店舗"
                icon={Building}
                gradient="from-purple-500 to-purple-600"
                change="マネージャー管理"
                trend="neutral"
                size="md"
              />
              <StatCard
                label="総利益"
                value={formatCurrency(reportData.totalProfit)}
                unit="スタッフ×150円×25日"
                icon={Banknote}
                gradient="from-yellow-500 to-orange-600"
                change={formatPercentage(reportData.monthlyProfitGrowth)}
                trend={reportData.monthlyProfitGrowth >= 0 ? 'up' : 'down'}
                size="md"
              />
              <StatCard
                label="総シフト数"
                value={reportData.totalShifts}
                unit="今月実行"
                icon={Activity}
                gradient="from-orange-500 to-red-600"
                trend="neutral"
                size="md"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Revenue and Profit by Manager */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                    <PieChart className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">店舗別売上・利益</h2>
                </div>
                
                <div className="space-y-4">
                  {reportData.revenueByManager.map((manager, index) => {
                    const percentage = reportData.totalRevenue > 0 ? (manager.revenue / reportData.totalRevenue) * 100 : 0;
                    return (
                      <div key={index} className="border-b border-gray-100 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{manager.manager}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-900 font-medium">売上: {formatCurrency(manager.revenue)}</div>
                            <div className="text-sm text-green-600 font-medium">利益: {formatCurrency(manager.profit)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>売上</span>
                              <span>{percentage.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>利益</span>
                              <span>{formatCurrency(manager.profit)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${reportData.totalProfit > 0 ? (manager.profit / reportData.totalProfit) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Users by Role */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">役職別ユーザー数</h2>
                </div>
                
                <div className="space-y-4">
                  {reportData.usersByRole.map((role, index) => {
                    const percentage = (role.count / reportData.totalUsers) * 100;
                    const colors = [
                      'from-blue-400 to-blue-500',
                      'from-purple-400 to-purple-500',
                      'from-red-400 to-red-500'
                    ];
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{role.role}</span>
                          <span className="text-sm text-gray-600">{role.count}名</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-gradient-to-r ${colors[index]} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-xs text-gray-500">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <LineChart className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">月次推移</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">月</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">売上</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">利益</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">ユーザー数</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">売上成長率</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">利益成長率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyTrends.map((trend, index) => {
                      const prevRevenue = index > 0 ? reportData.monthlyTrends[index - 1].revenue : trend.revenue;
                      const growthRate = index > 0 ? ((trend.revenue - prevRevenue) / prevRevenue) * 100 : 0;
                      
                      return (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-900">{trend.month}</td>
                          <td className="py-3 px-4 text-right text-gray-900">{formatCurrency(trend.revenue)}</td>
                          <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(trend.profit)}</td>
                          <td className="py-3 px-4 text-right text-gray-900">{trend.users}名</td>
                          <td className={`py-3 px-4 text-right font-medium ${
                            growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {index > 0 ? formatPercentage(growthRate) : '-'}
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${
                            index > 0 && reportData.monthlyTrends[index - 1].profit > 0 ? 
                              (((trend.profit - reportData.monthlyTrends[index - 1].profit) / reportData.monthlyTrends[index - 1].profit) * 100 >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-500'
                          }`}>
                            {index > 0 && reportData.monthlyTrends[index - 1].profit > 0 ? 
                              formatPercentage(((trend.profit - reportData.monthlyTrends[index - 1].profit) / reportData.monthlyTrends[index - 1].profit) * 100) : '-'
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}