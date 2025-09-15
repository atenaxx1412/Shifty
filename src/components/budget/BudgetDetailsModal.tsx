'use client';

import { 
  X,
  Banknote,
  Users,
  Clock,
  Calculator,
  TrendingUp,
  PieChart,
  Download,
  AlertTriangle,
  CheckCircle,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { BudgetCalculation } from '@/types';
import { excelService } from '@/lib/excelService';

interface BudgetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetCalculation: BudgetCalculation | null;
  onExportExcel?: () => void;
}

const handleExportExcel = (budgetCalculation: BudgetCalculation) => {
  try {
    excelService.exportBudgetData(budgetCalculation);
    console.log('✅ Budget data exported to Excel successfully');
  } catch (error) {
    console.error('❌ Failed to export budget data:', error);
  }
};

export default function BudgetDetailsModal({
  isOpen,
  onClose,
  budgetCalculation,
  onExportExcel
}: BudgetDetailsModalProps) {
  if (!isOpen || !budgetCalculation) return null;

  const { summary, staffCosts, shifts, period } = budgetCalculation;

  // 予算ステータスの判定
  const getBudgetStatus = () => {
    if (!summary.budgetLimit) return null;
    
    const utilizationRate = (summary.totalCost / summary.budgetLimit) * 100;
    
    if (utilizationRate <= 80) {
      return {
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: <CheckCircle className="h-4 w-4" />,
        text: '予算内',
        rate: utilizationRate.toFixed(1)
      };
    } else if (utilizationRate <= 100) {
      return {
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        icon: <AlertTriangle className="h-4 w-4" />,
        text: '要注意',
        rate: utilizationRate.toFixed(1)
      };
    } else {
      return {
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: <AlertTriangle className="h-4 w-4" />,
        text: '予算超過',
        rate: utilizationRate.toFixed(1)
      };
    }
  };

  const budgetStatus = getBudgetStatus();

  // スタッフコストランキング
  const topStaffCosts = [...staffCosts]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 5);

  // 日別コストの計算
  const dailyCosts = shifts.map(shift => ({
    date: shift.date,
    cost: shift.dailyTotal
  })).sort((a, b) => b.cost - a.cost).slice(0, 7);

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/80 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div>
            <h2 className="text-2xl font-bold">人件費予算詳細</h2>
            <p className="text-purple-100 mt-1">{period.name} の詳細分析</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleExportExcel(budgetCalculation)}
              className="flex items-center px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Excel出力
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">総人件費</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ¥{summary.totalCost.toLocaleString()}
                  </p>
                </div>
                <Banknote className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">総労働時間</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {summary.totalHours.toLocaleString()}h
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">平均時給</p>
                  <p className="text-2xl font-bold text-green-600">
                    ¥{Math.round(summary.totalBaseCost / summary.totalHours).toLocaleString()}
                  </p>
                </div>
                <Calculator className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">スタッフ数</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {staffCosts.length}人
                  </p>
                </div>
                <Users className="h-8 w-8 text-indigo-500" />
              </div>
            </div>
          </div>

          {/* Budget Status */}
          {budgetStatus && (
            <div className={`mt-4 p-4 rounded-lg border ${budgetStatus.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {budgetStatus.icon}
                  <span className="font-medium">{budgetStatus.text}</span>
                  <span className="text-sm">（{budgetStatus.rate}% 利用）</span>
                </div>
                <div className="text-sm">
                  予算: ¥{summary.budgetLimit?.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail Sections */}
        <div className="p-6 space-y-8">
          
          {/* Cost Breakdown */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <PieChart className="h-5 w-5 mr-2 text-purple-600" />
              コスト内訳
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">基本給</p>
                <p className="text-xl font-bold text-blue-900">
                  ¥{summary.totalBaseCost.toLocaleString()}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {((summary.totalBaseCost / summary.totalCost) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-orange-600 font-medium">残業代</p>
                <p className="text-xl font-bold text-orange-900">
                  ¥{summary.totalOvertimeCost.toLocaleString()}
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  {((summary.totalOvertimeCost / summary.totalCost) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">各種手当</p>
                <p className="text-xl font-bold text-green-900">
                  ¥{summary.totalBonusCost.toLocaleString()}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {((summary.totalBonusCost / summary.totalCost) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">税金・保険</p>
                <p className="text-xl font-bold text-purple-900">
                  ¥{summary.totalTaxAndInsurance.toLocaleString()}
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  {((summary.totalTaxAndInsurance / summary.totalCost) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Staff Costs */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
                スタッフ別コスト（上位5位）
              </h3>
              <div className="space-y-3">
                {topStaffCosts.map((staff, index) => (
                  <div key={staff.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-400' : 'bg-blue-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{staff.userName}</p>
                        <p className="text-sm text-gray-500">{staff.totalHours.toFixed(1)}h</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ¥{staff.totalCost.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        時給¥{Math.round(staff.grossPay / staff.totalHours).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Cost Ranking */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-green-600" />
                日別コスト（上位7日）
              </h3>
              <div className="space-y-3">
                {dailyCosts.map((daily, index) => (
                  <div key={daily.date.getTime()} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {format(daily.date, 'MM月dd日（E）', { locale: ja })}
                      </p>
                      <p className="text-sm text-gray-500">
                        #{index + 1}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        ¥{daily.cost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staff Details Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">スタッフ別詳細</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">スタッフ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">労働時間</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">基本給</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残業代</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手当</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">税金・保険</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総額</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffCosts.map((staff) => (
                    <tr key={staff.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{staff.userName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.totalHours.toFixed(1)}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{staff.basePay.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{staff.overtimePay.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{(staff.nightShiftBonus + staff.holidayBonus).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{(staff.socialInsurance + staff.tax).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        ¥{staff.totalCost.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}