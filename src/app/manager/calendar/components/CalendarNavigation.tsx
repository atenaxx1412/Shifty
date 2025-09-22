'use client';

import { format, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDaysInMonth, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

type CalendarViewType = "day" | "week" | "halfMonth" | "month";
type LayoutMode = "grid" | "traditional";

interface CalendarNavigationProps {
  selectedDate: Date;
  calendarView: CalendarViewType;
  layoutMode: LayoutMode;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarViewType, layout: LayoutMode) => void;
}

export default function CalendarNavigation({
  selectedDate,
  calendarView,
  layoutMode,
  onDateChange,
  onViewChange
}: CalendarNavigationProps) {

  // カレンダー表示形式に応じた日付範囲を計算
  const getDateRange = () => {
    switch (calendarView) {
      case "day":
        return {
          start: selectedDate,
          end: selectedDate,
          dates: [selectedDate],
        };
      case "week":
        const weekStart = startOfWeek(selectedDate, {
          locale: ja,
          weekStartsOn: 1,
        });
        const weekEnd = endOfWeek(selectedDate, {
          locale: ja,
          weekStartsOn: 1,
        });
        const weekDates = [];
        let currentDate = weekStart;
        while (currentDate <= weekEnd) {
          weekDates.push(currentDate);
          currentDate = addDays(currentDate, 1);
        }
        return {
          start: weekStart,
          end: weekEnd,
          dates: weekDates,
        };
      case "halfMonth":
        const isFirstHalf = selectedDate.getDate() <= 15;
        const halfMonthStart = isFirstHalf
          ? startOfMonth(selectedDate)
          : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 16);
        const halfMonthEnd = isFirstHalf
          ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 15)
          : endOfMonth(selectedDate);
        const halfMonthDates = [];
        let halfDate = halfMonthStart;
        while (halfDate <= halfMonthEnd) {
          halfMonthDates.push(halfDate);
          halfDate = addDays(halfDate, 1);
        }
        return {
          start: halfMonthStart,
          end: halfMonthEnd,
          dates: halfMonthDates,
        };
      case "month":
      default:
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const daysInMonth = getDaysInMonth(selectedDate);
        const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
          addDays(monthStart, i)
        );
        return {
          start: monthStart,
          end: monthEnd,
          dates: monthDates,
        };
    }
  };

  const dateRange = getDateRange();

  // 日付範囲の表示フォーマット
  const getDateRangeLabel = () => {
    switch (calendarView) {
      case "day":
        return format(selectedDate, "yyyy年 M月d日(E)", { locale: ja });
      case "week":
        return `${format(dateRange.start, "yyyy年 M月d日", {
          locale: ja,
        })}〜${format(dateRange.end, "M月d日", { locale: ja })}`;
      case "halfMonth":
        return `${format(dateRange.start, "yyyy年 M月d日", {
          locale: ja,
        })}〜${format(dateRange.end, "M月d日", { locale: ja })}`;
      case "month":
      default:
        return `${format(dateRange.start, "yyyy年 M月d日(E)", {
          locale: ja,
        })}〜${format(dateRange.end, "M月d日(E)", { locale: ja })}`;
    }
  };

  // 前の期間に移動
  const handlePrevious = () => {
    switch (calendarView) {
      case "day":
        onDateChange(addDays(selectedDate, -1));
        break;
      case "week":
        onDateChange(addDays(selectedDate, -7));
        break;
      case "halfMonth":
        const isFirstHalf = selectedDate.getDate() <= 15;
        if (isFirstHalf) {
          // 前月の後半に移動
          const prevMonth = subMonths(selectedDate, 1);
          onDateChange(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 16));
        } else {
          // 今月の前半に移動
          onDateChange(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
        }
        break;
      case "month":
      default:
        onDateChange(subMonths(selectedDate, 1));
        break;
    }
  };

  // 次の期間に移動
  const handleNext = () => {
    switch (calendarView) {
      case "day":
        onDateChange(addDays(selectedDate, 1));
        break;
      case "week":
        onDateChange(addDays(selectedDate, 7));
        break;
      case "halfMonth":
        const isFirstHalf = selectedDate.getDate() <= 15;
        if (isFirstHalf) {
          // 今月の後半に移動
          onDateChange(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 16));
        } else {
          // 次月の前半に移動
          const nextMonth = addMonths(selectedDate, 1);
          onDateChange(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
        }
        break;
      case "month":
      default:
        onDateChange(addMonths(selectedDate, 1));
        break;
    }
  };

  // 今日に戻る
  const handleToday = () => {
    onDateChange(new Date());
  };

  // 表示形式を変更
  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "calendar") {
      onViewChange("month", "traditional");
    } else {
      onViewChange(value as CalendarViewType, "grid");
    }
  };

  // 現在の表示形式の値を取得
  const getSelectValue = () => {
    if (calendarView === "month" && layoutMode === "traditional") {
      return "calendar";
    }
    return calendarView;
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-2">
      <div className="flex items-center space-x-4">
        {/* 日付範囲表示 */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            {getDateRangeLabel()}
          </h2>
        </div>

        {/* ナビゲーションボタン */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handlePrevious}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="前の期間"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="次の期間"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
            title={calendarView === "month" ? "今月に戻る" : "今日に戻る"}
          >
            戻る
          </button>
        </div>
      </div>

      <div className="flex items-center">
        {/* 表示形式切り替えドロップダウン */}
        <div className="relative">
          <select
            value={getSelectValue()}
            onChange={handleViewChange}
            className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer appearance-none pr-6 text-sm"
          >
            <option value="day">日</option>
            <option value="week">週</option>
            <option value="halfMonth">半月</option>
            <option value="month">月</option>
            <option value="calendar">カレンダー</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}