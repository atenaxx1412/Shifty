'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
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

interface ReportData {
  totalRevenue: number;
  totalUsers: number;
  totalShops: number;
  totalShifts: number;
  monthlyGrowth: number;
  userGrowth: number;
  revenueByShop: { shop: string; revenue: number }[];
  usersByRole: { role: string; count: number }[];
  monthlyTrends: { month: string; revenue: number; users: number }[];
}

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const [reportData, setReportData] = useState<ReportData>({
    totalRevenue: 15680000,
    totalUsers: 28,
    totalShops: 3,
    totalShifts: 156,
    monthlyGrowth: 12.5,
    userGrowth: 8.3,
    revenueByShop: [
      { shop: '渋谷本店', revenue: 7800000 },
      { shop: '新宿支店', revenue: 4200000 },
      { shop: '池袋支店', revenue: 3680000 }
    ],
    usersByRole: [
      { role: 'スタッフ', count: 20 },
      { role: 'マネージャー', count: 6 },
      { role: 'システム管理者', count: 2 }
    ],
    monthlyTrends: [
      { month: '5月', revenue: 14200000, users: 24 },
      { month: '6月', revenue: 14800000, users: 25 },
      { month: '7月', revenue: 15100000, users: 26 },
      { month: '8月', revenue: 15680000, users: 28 }
    ]
  });

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">レポートデータを読み込み中...</p>
              </div>
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
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white bg-opacity-20 rounded-2xl">
                    <BarChart3 className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">全体レポート</h1>
                    <p className="text-indigo-100 mt-2 text-lg">
                      全店舗の統合分析・売上推移・運営効率レポート
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <select
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value)}
                    className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg border border-white border-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  >
                    <option value="weekly" className="text-gray-900">週次</option>
                    <option value="monthly" className="text-gray-900">月次</option>
                    <option value="quarterly" className="text-gray-900">四半期</option>
                  </select>
                  <div className="flex space-x-2">
                    <button className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      更新
                    </button>
                    <button className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200">
                      <Download className="h-4 w-4 mr-2" />
                      PDF出力
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <Banknote className="h-6 w-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${
                    reportData.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {reportData.monthlyGrowth >= 0 ? 
                      <TrendingUp className="h-4 w-4" /> : 
                      <TrendingDown className="h-4 w-4" />
                    }
                    <span>{formatPercentage(reportData.monthlyGrowth)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">総売上</p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(reportData.totalRevenue)}</p>
                  <p className="text-xs text-gray-500 mt-1">前月比</p>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${
                    reportData.userGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {reportData.userGrowth >= 0 ? 
                      <TrendingUp className="h-4 w-4" /> : 
                      <TrendingDown className="h-4 w-4" />
                    }
                    <span>{formatPercentage(reportData.userGrowth)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">総ユーザー数</p>
                  <p className="text-3xl font-bold text-gray-900">{reportData.totalUsers}名</p>
                  <p className="text-xs text-gray-500 mt-1">前月比</p>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">運営店舗数</p>
                  <p className="text-3xl font-bold text-gray-900">{reportData.totalShops}店舗</p>
                  <p className="text-xs text-gray-500 mt-1">全て稼働中</p>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">総シフト数</p>
                  <p className="text-3xl font-bold text-gray-900">{reportData.totalShifts}</p>
                  <p className="text-xs text-gray-500 mt-1">今月実行</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Revenue by Shop */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                    <PieChart className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">店舗別売上</h2>
                </div>
                
                <div className="space-y-4">
                  {reportData.revenueByShop.map((shop, index) => {
                    const percentage = (shop.revenue / reportData.totalRevenue) * 100;
                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{shop.shop}</span>
                          <span className="text-sm text-gray-600">{formatCurrency(shop.revenue)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
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
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">ユーザー数</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">売上成長率</th>
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
                          <td className="py-3 px-4 text-right text-gray-900">{trend.users}名</td>
                          <td className={`py-3 px-4 text-right font-medium ${
                            growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {index > 0 ? formatPercentage(growthRate) : '-'}
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