'use client';

import { Calendar, Users, UserPlus, AlertTriangle } from "lucide-react";

interface DayStats {
  totalRequiredStaff: number;
  totalAssignedStaff: number;
  totalSlots: number;
  templateRequiredStaff: number;
  templateShortage: number;
  shortage: number;
  hasTemplateData: boolean;
  isCriticalShortage: boolean;
  isWarningShortage: boolean;
  templateShortageByTimeSlot: {
    morning: number;
    afternoon: number;
    evening: number;
  };
}

interface MonthStatsData {
  totalSlots: number;
  totalRequired: number;
  totalAssigned: number;
  totalShortage: number;
  templateRequired: number;
  templateShortage: number;
  criticalDays: number;
  warningDays: number;
  templateDays: number;
}

interface MonthStatsProps {
  monthDates: Date[];
  getDayStats: (date: Date) => DayStats;
  loading?: boolean;
}

export default function MonthStats({
  monthDates,
  getDayStats,
  loading = false
}: MonthStatsProps) {

  // 月間統計の計算（テンプレート統合版）
  const monthStats: MonthStatsData = monthDates.reduce(
    (acc, date) => {
      const dayStats = getDayStats(date);
      return {
        totalSlots: acc.totalSlots + dayStats.totalSlots,
        totalRequired: acc.totalRequired + dayStats.totalRequiredStaff,
        totalAssigned: acc.totalAssigned + dayStats.totalAssignedStaff,
        totalShortage: acc.totalShortage + dayStats.shortage,
        // テンプレート関連統計
        templateRequired: acc.templateRequired + dayStats.templateRequiredStaff,
        templateShortage: acc.templateShortage + dayStats.templateShortage,
        criticalDays: acc.criticalDays + (dayStats.isCriticalShortage ? 1 : 0),
        warningDays: acc.warningDays + (dayStats.isWarningShortage ? 1 : 0),
        templateDays: acc.templateDays + (dayStats.hasTemplateData ? 1 : 0),
      };
    },
    {
      totalSlots: 0,
      totalRequired: 0,
      totalAssigned: 0,
      totalShortage: 0,
      templateRequired: 0,
      templateShortage: 0,
      criticalDays: 0,
      warningDays: 0,
      templateDays: 0,
    }
  );

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3 animate-pulse flex items-center justify-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-5 w-5 bg-gray-300 rounded"></div>
              <div>
                <div className="h-3 w-16 bg-gray-300 rounded mb-1"></div>
                <div className="h-4 w-8 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {/* 今月のシフト数 */}
      <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-[10px] text-blue-600 font-medium">
              今月のシフト数
            </p>
            <p className="text-sm font-bold text-blue-900">
              {monthStats.totalSlots}
            </p>
          </div>
        </div>
      </div>

      {/* 配置済み */}
      <div className="bg-green-50 rounded-lg p-3 flex items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          <Users className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-[10px] text-green-600 font-medium">
              配置済み
            </p>
            <p className="text-sm font-bold text-green-900">
              {monthStats.totalAssigned}
            </p>
          </div>
        </div>
      </div>

      {/* 必要人数 */}
      <div className="bg-yellow-50 rounded-lg p-3 flex items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          <UserPlus className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="text-[10px] text-yellow-600 font-medium">
              必要人数
            </p>
            <p className="text-sm font-bold text-yellow-900">
              {monthStats.templateRequired > 0
                ? monthStats.templateRequired
                : monthStats.totalRequired}
            </p>
          </div>
        </div>
      </div>

      {/* 人数不足 */}
      <div className="bg-red-50 rounded-lg p-3 flex items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-[10px] text-red-600 font-medium">
              人数不足
            </p>
            <p className="text-sm font-bold text-red-900">
              {monthStats.templateRequired > 0
                ? monthStats.templateShortage
                : monthStats.totalShortage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}