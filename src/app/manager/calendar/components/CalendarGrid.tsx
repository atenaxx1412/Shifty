'use client';

import { format, isSameDay, startOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { User } from "@/types/auth";
import { ShiftExtended, ShiftSlot } from "@/types/calendar";
import { MonthlyShiftRequest, DayShiftRequest } from "@/types";
import { Plus, Edit, MessageCircle, AlertTriangle, CheckCircle, Star, ThumbsUp, X } from "lucide-react";
import { useState } from "react";

interface StaffTimeSettings {
  [staffId: string]: {
    startTime: string;
    endTime: string;
    positions: string;
    notes: string;
  };
}

interface DayStats {
  totalRequiredStaff: number;
  totalAssignedStaff: number;
  totalSlots: number;
  templateRequiredStaff: number;
  templateShortage: number;
  hasTemplateData: boolean;
  isCriticalShortage: boolean;
  isWarningShortage: boolean;
  templateShortageByTimeSlot: {
    morning: number;
    afternoon: number;
    evening: number;
  };
}

type CalendarViewType = "day" | "week" | "halfMonth" | "month";
type LayoutMode = "grid" | "traditional";

interface CalendarGridProps {
  calendarView: CalendarViewType;
  layoutMode: LayoutMode;
  selectedDate: Date;
  staff: User[];
  shifts: ShiftExtended[];
  shiftRequests: MonthlyShiftRequest[];
  loading: boolean;
  onCreateShift: (date?: Date, staff?: User) => void;
  onOpenShiftDetail: (shift: ShiftExtended, slot: ShiftSlot, staff: User) => void;
  onOpenStaffChat: (staffId: string, staffName: string, relatedShiftId?: string) => void;
  getDayStats: (date: Date) => DayStats;
  getStaffShiftsForDate: (date: Date) => Map<string, Array<{ shift: ShiftExtended; slot: ShiftSlot; }>>;
  getShiftsForDate: (date: Date) => ShiftExtended[];
}

interface CellSizes {
  cellWidth: string;
  cellHeight: string;
  padding: string;
  fontSize: string;
  iconSize: string;
  minCellWidth: number;
}

export default function CalendarGrid({
  calendarView,
  layoutMode,
  selectedDate,
  staff,
  shifts,
  shiftRequests,
  loading,
  onCreateShift,
  onOpenShiftDetail,
  onOpenStaffChat,
  getDayStats,
  getStaffShiftsForDate,
  getShiftsForDate
}: CalendarGridProps) {

  // 警告ダイアログの状態管理
  const [showUnavailableWarning, setShowUnavailableWarning] = useState(false);
  const [warningData, setWarningData] = useState<{
    date: Date | null;
    staff: User | null;
    dayRequest: DayShiftRequest | null;
  }>({ date: null, staff: null, dayRequest: null });

  // スタッフの日別シフト希望を取得するヘルパー関数
  const getStaffRequestForDate = (staffId: string, date: Date, targetMonth: string): DayShiftRequest | null => {
    // 対象月のシフト希望を見つける
    const monthlyRequest = shiftRequests.find(req =>
      req.staffId === staffId &&
      req.targetMonth === targetMonth &&
      (req.status === 'submitted' || req.status === 'approved')
    );

    if (!monthlyRequest || !monthlyRequest.dayRequests) {
      return null;
    }

    // 指定日のシフト希望を見つける
    const dayRequest = monthlyRequest.dayRequests.find(dayReq => {
      const reqDate = new Date(dayReq.date);
      return isSameDay(reqDate, date);
    });

    return dayRequest || null;
  };

  // 希望レベルに応じたスタイルを取得
  const getRequestStyle = (preference: string) => {
    switch (preference) {
      case 'preferred':
        return {
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-300',
          icon: null,
          label: '希'
        };
      case 'available':
        return {
          bgColor: 'bg-green-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-300',
          icon: <ThumbsUp className="h-3 w-3" />,
          label: '可'
        };
      case 'unavailable':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-400',
          icon: <X className="h-3 w-3 text-red-700" />,
          label: '不'
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-300',
          icon: null,
          label: ''
        };
    }
  };

  // シフト作成時の警告チェックとハンドリング
  const handleCreateShift = (date: Date, staff: User) => {
    const targetMonth = format(date, 'yyyy-MM');
    const dayRequest = getStaffRequestForDate(staff.uid, date, targetMonth);

    // 不可の希望がある場合は警告を表示
    if (dayRequest && dayRequest.preference === 'unavailable') {
      setWarningData({ date, staff, dayRequest });
      setShowUnavailableWarning(true);
    } else {
      // 通常のシフト作成
      onCreateShift(date, staff);
    }
  };

  // 警告後の続行処理
  const proceedWithShiftCreation = () => {
    if (warningData.date && warningData.staff) {
      onCreateShift(warningData.date, warningData.staff);
    }
    setShowUnavailableWarning(false);
    setWarningData({ date: null, staff: null, dayRequest: null });
  };

  // 警告のキャンセル処理
  const cancelShiftCreation = () => {
    setShowUnavailableWarning(false);
    setWarningData({ date: null, staff: null, dayRequest: null });
  };

  // 表示形式に応じたUIサイズクラスを取得
  const getCellSizeClasses = (): CellSizes => {
    switch (calendarView) {
      case "day":
        return {
          cellWidth: "w-40",
          cellHeight: "h-20",
          padding: "px-3 py-2",
          fontSize: "text-lg",
          iconSize: "h-5 w-5",
          minCellWidth: 160,
        };
      case "week":
        return {
          cellWidth: "w-32",
          cellHeight: "h-16",
          padding: "px-2 py-1",
          fontSize: "text-base",
          iconSize: "h-4 w-4",
          minCellWidth: 128,
        };
      case "halfMonth":
        return {
          cellWidth: "w-28",
          cellHeight: "h-14",
          padding: "px-2 py-1",
          fontSize: "text-sm",
          iconSize: "h-4 w-4",
          minCellWidth: 112,
        };
      case "month":
      default:
        return {
          cellWidth: "w-24",
          cellHeight: "h-12",
          padding: "px-1 py-1",
          fontSize: "text-xs",
          iconSize: "h-3 w-3",
          minCellWidth: 96,
        };
    }
  };

  const cellSizes = getCellSizeClasses();

  // カレンダー表示形式に応じた日付範囲を計算
  const getDateRange = () => {
    switch (calendarView) {
      case "day":
        return {
          start: startOfDay(selectedDate),
          end: startOfDay(selectedDate),
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
  const monthDates = dateRange.dates;

  // デバッグ情報を追加
  console.log('🔍 Calendar Debug Info:');
  console.log('  Selected Date:', selectedDate);
  console.log('  Calendar View:', calendarView);
  console.log('  Date Range:', dateRange);
  console.log('  Month Dates Count:', monthDates.length);
  console.log('  Month Dates:', monthDates.map(d => d.toDateString()));
  console.log('  Shifts:', shifts.map(s => ({
    id: s.shiftId,
    date: s.date instanceof Date ? s.date.toDateString() : new Date(s.date).toDateString()
  })));

  // 従来のカレンダー形式用の週を取得
  const getCalendarWeeks = () => {
    const weeks: Date[][] = [];
    const { start, end } = dateRange;
    const startDate = startOfWeek(start, { locale: ja, weekStartsOn: 1 }); // 月曜日始まり
    const endDate = endOfWeek(end, { locale: ja, weekStartsOn: 1 });

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">カレンダーを読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty State
  if (staff.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <div className="h-12 w-12 text-gray-400 mx-auto mb-4">👥</div>
        <p className="text-gray-500 text-lg">
          スタッフが登録されていません
        </p>
        <p className="text-gray-400 mt-2">
          スタッフを追加してからシフトを管理してください
        </p>
      </div>
    );
  }

  // Day View - 9時から23時まで時間軸
  if (calendarView === "day") {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex">
          {/* Fixed Staff Names Column */}
          <div
            className={`flex-shrink-0 w-48 border-r border-gray-300 ${
              selectedDate.getDay() === 0 ? "bg-red-50" : "bg-gray-50"
            }`}
          >
            <div className="h-12 px-3 py-2 font-medium text-gray-900 border-b border-gray-300 flex items-center">
              <span>スタッフ</span>
            </div>
            {staff.map((staffMember, staffIndex) => (
              <div
                key={staffMember.uid}
                className={`h-20 px-3 py-2 flex items-center ${
                  staffIndex < staff.length - 1
                    ? "border-b border-gray-300"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="font-medium text-gray-900">
                      {staffMember.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {staffMember.skills?.slice(0, 2).join(", ")}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onOpenStaffChat(staffMember.uid, staffMember.name)
                    }
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title={`${staffMember.name}さんとチャット`}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="min-w-max">
              {/* Time Headers (9:00-23:00) */}
              <div className="flex border-b border-gray-300">
                {Array.from({ length: 15 }, (_, i) => i + 9).map(
                  (hour) => (
                    <div
                      key={hour}
                      className={`w-20 h-12 px-2 py-1 text-center font-medium border-r border-gray-300 ${
                        selectedDate.getDay() === 0
                          ? "bg-red-50"
                          : "bg-gray-50"
                      }`}
                    >
                      <div className="text-sm">{hour}:00</div>
                    </div>
                  )
                )}
              </div>

              {/* Staff Time Grid */}
              {staff.map((staffMember, staffIndex) => {
                const dayShifts = getStaffShiftsForDate(selectedDate);
                const myShifts = dayShifts.get(staffMember.uid) || [];

                return (
                  <div key={staffMember.uid} className="flex">
                    {Array.from({ length: 15 }, (_, i) => i + 9).map(
                      (hour) => {
                        const shiftInHour = myShifts.find(
                          ({ slot }) => {
                            const start = parseInt(
                              slot.startTime.split(":")[0]
                            );
                            const end = parseInt(
                              slot.endTime.split(":")[0]
                            );
                            return start <= hour && hour < end;
                          }
                        );

                        return (
                          <div
                            key={hour}
                            className={`w-20 h-20 border-r border-gray-300 ${
                              staffIndex < staff.length - 1
                                ? "border-b"
                                : ""
                            } ${
                              shiftInHour
                                ? ""
                                : selectedDate.getDay() === 0
                                ? "bg-red-50"
                                : "bg-gray-50"
                            }`}
                          >
                            {shiftInHour && (
                              <div
                                className={`h-full p-1 cursor-pointer transition-colors ${
                                  shiftInHour.shift.status === "published"
                                    ? "bg-green-100 hover:bg-green-200"
                                    : "bg-yellow-100 hover:bg-yellow-200"
                                }`}
                                onClick={() =>
                                  onOpenShiftDetail(
                                    shiftInHour.shift,
                                    shiftInHour.slot,
                                    staffMember
                                  )
                                }
                              >
                                <div className="text-xs font-medium">
                                  {shiftInHour.slot.positions?.join(", ")}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid Layout Mode - スタッフ×日付グリッド
  if (layoutMode === "grid") {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex">
          {/* Fixed Staff Names Column */}
          <div className="flex-shrink-0 w-48 bg-gray-50 border-r border-gray-300">
            {/* Header */}
            <div
              className={`${cellSizes.cellHeight} ${cellSizes.padding} font-medium text-gray-900 border-b border-gray-300 flex items-center box-border`}
            >
              <span>スタッフ</span>
            </div>

            {/* Staff Rows */}
            {staff.map((staffMember, staffIndex) => (
              <div
                key={staffMember.uid}
                className={`${cellSizes.cellHeight} ${
                  cellSizes.padding
                } flex items-center box-border ${
                  staffIndex < staff.length - 1
                    ? "border-b border-gray-300"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    <div className="font-medium text-gray-900">
                      {staffMember.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {staffMember.skills?.slice(0, 2).join(", ")}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onOpenStaffChat(staffMember.uid, staffMember.name)
                    }
                    className={`${
                      calendarView === "month" ? "p-1" : "p-2"
                    } text-blue-600 hover:bg-blue-100 rounded-lg transition-colors`}
                    title={`${staffMember.name}さんとチャット`}
                  >
                    <MessageCircle className={cellSizes.iconSize} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable Dates Section */}
          <div
            className={`flex-1 ${
              calendarView === "week" ? "" : "overflow-x-auto"
            }`}
            id="calendar-scroll-container"
          >
            <div
              style={{
                minWidth:
                  calendarView === "week"
                    ? "100%"
                    : `${monthDates.length * cellSizes.minCellWidth}px`,
              }}
            >
              {/* Date Headers */}
              <div className="flex border-b border-gray-300">
                {monthDates.map((date) => {
                  const dayStats = getDayStats(date);
                  const isToday = isSameDay(date, new Date());
                  const dayOfWeek = format(date, "E", { locale: ja });
                  const dayOfWeekNum = date.getDay();

                  // スタイルクラスを決定
                  let bgClass = "bg-gray-50";
                  let textClass = "text-gray-900";
                  let borderClass = "border-r-gray-300";

                  if (isToday) {
                    bgClass = "bg-blue-100";
                    textClass = "text-blue-900";
                    borderClass = "border-r-blue-300";
                  } else if (dayOfWeekNum === 0) {
                    // 日曜日
                    bgClass = "bg-red-50";
                    textClass = "text-red-600";
                    borderClass = "border-r-red-300";
                  } else if (dayOfWeekNum === 6) {
                    // 土曜日
                    bgClass = "bg-blue-50";
                    textClass = "text-blue-600";
                    borderClass = "border-r-blue-300";
                  }

                  return (
                    <div
                      key={date.toISOString()}
                      className={`${
                        calendarView === "week"
                          ? "flex-1"
                          : cellSizes.cellWidth
                      } ${cellSizes.cellHeight} ${
                        cellSizes.padding
                      } text-center font-medium border-r border-gray-300 flex flex-col justify-center box-border ${bgClass} ${textClass} ${borderClass}`}
                    >
                      <div
                        className={`text-xs ${
                          dayOfWeekNum === 0 ? "text-red-600" : ""
                        }`}
                      >
                        {dayOfWeek}
                      </div>
                      <div className="text-sm font-bold">{format(date, "d")}</div>

                      {/* テンプレート基準の不足警告 */}
                      {dayStats.hasTemplateData && (
                        <div className="flex justify-center mt-1 space-x-1">
                          {dayStats.templateShortageByTimeSlot.morning > 0 && (
                            <span
                              className={`px-1 rounded text-xs ${
                                dayStats.templateShortageByTimeSlot.morning >= 2
                                  ? "bg-red-200 text-red-800"
                                  : "bg-yellow-200 text-yellow-800"
                              }`}
                            >
                              朝-{dayStats.templateShortageByTimeSlot.morning}
                            </span>
                          )}
                          {dayStats.templateShortageByTimeSlot.afternoon > 0 && (
                            <span
                              className={`px-1 rounded text-xs ${
                                dayStats.templateShortageByTimeSlot.afternoon >= 2
                                  ? "bg-red-200 text-red-800"
                                  : "bg-yellow-200 text-yellow-800"
                              }`}
                            >
                              昼-{dayStats.templateShortageByTimeSlot.afternoon}
                            </span>
                          )}
                          {dayStats.templateShortageByTimeSlot.evening > 0 && (
                            <span
                              className={`px-1 rounded text-xs ${
                                dayStats.templateShortageByTimeSlot.evening >= 2
                                  ? "bg-red-200 text-red-800"
                                  : "bg-yellow-200 text-yellow-800"
                              }`}
                            >
                              夜-{dayStats.templateShortageByTimeSlot.evening}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Staff Schedule Grid */}
              <div>
                {staff.map((staffMember, staffIndex) => (
                  <div key={staffMember.uid} className="flex">
                    {monthDates.map((date) => {
                      const staffShifts = getStaffShiftsForDate(date);
                      const myShifts = staffShifts.get(staffMember.uid) || [];
                      const isPast = date < startOfDay(new Date());
                      const isToday = isSameDay(date, new Date());
                      const dayOfWeekNum = date.getDay();

                      // セルの背景色と枠線色を決定
                      let cellBgClass = "";
                      let cellBorderClass = "border-r-gray-300";

                      if (isToday) {
                        cellBgClass = "bg-blue-100";
                        cellBorderClass = "border-r-blue-300";
                      } else if (dayOfWeekNum === 0) {
                        // 日曜日
                        cellBgClass = "bg-red-50";
                        cellBorderClass = "border-r-red-300";
                      } else if (dayOfWeekNum === 6) {
                        // 土曜日
                        cellBgClass = "bg-blue-50";
                        cellBorderClass = "border-r-blue-300";
                      } else if (isPast) {
                        cellBgClass = "bg-gray-50";
                      }

                      return (
                        <div
                          key={date.toISOString()}
                          className={`${
                            calendarView === "week"
                              ? "flex-1"
                              : cellSizes.cellWidth
                          } ${cellSizes.cellHeight} ${
                            cellSizes.padding
                          } border-r border-gray-300 flex items-center box-border ${
                            staffIndex < staff.length - 1
                              ? "border-b border-gray-300"
                              : ""
                          } ${cellBgClass} ${cellBorderClass}`}
                        >
                          <div className="w-full flex flex-col items-center justify-center space-y-1">
                            {myShifts.map(({ shift, slot }, index) => (
                              <div
                                key={`${shift.shiftId}-${slot.slotId}-${index}`}
                                className={`p-1 rounded text-xs border group relative cursor-pointer transition-colors ${
                                  shift.status === "published"
                                    ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                                    : "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200"
                                }`}
                                onClick={() =>
                                  onOpenShiftDetail(shift, slot, staffMember)
                                }
                                title={`${staffMember.name}さんのシフト詳細を編集`}
                              >
                                <div className="font-medium flex items-center justify-between">
                                  <span>
                                    {slot.startTime}-{slot.endTime}
                                  </span>
                                  <Edit
                                    className={`${cellSizes.iconSize} opacity-0 group-hover:opacity-100 transition-opacity`}
                                  />
                                </div>
                                {slot.positions && (
                                  <div className="text-gray-600 truncate">
                                    {slot.positions.join(", ")}
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* シフト希望表示 または シフト作成ボタン */}
                            {(() => {
                              const targetMonth = format(date, 'yyyy-MM');
                              const dayRequest = getStaffRequestForDate(staffMember.uid, date, targetMonth);

                              // シフト希望がある場合は希望情報を表示（クリック可能）
                              if (dayRequest) {
                                const style = getRequestStyle(dayRequest.preference);

                                return (
                                  <button
                                    onClick={() => onCreateShift(date, staffMember)}
                                    className={`${style.bgColor} ${style.textColor} ${style.borderColor} border rounded px-2 py-1 text-xs flex items-center justify-center gap-1 w-full hover:opacity-80 transition-opacity cursor-pointer`}
                                    title={`希望レベル: ${dayRequest.preference === 'preferred' ? '希望' : dayRequest.preference === 'available' ? '可能' : '不可'}${dayRequest.timeSlots && dayRequest.timeSlots.length > 0 ? ` (${dayRequest.timeSlots[0].start}-${dayRequest.timeSlots[0].end})` : ''} - クリックでシフト作成`}
                                  >
                                    {style.icon && style.icon}
                                    {dayRequest.timeSlots && dayRequest.timeSlots.length > 0 && (
                                      <span className="text-xs font-medium">
                                        {dayRequest.timeSlots[0].start}-{dayRequest.timeSlots[0].end}
                                      </span>
                                    )}
                                  </button>
                                );
                              }

                              // シフト希望がなく、既存シフトもなく、過去日でない場合は+ボタンを表示
                              if (myShifts.length === 0 && !isPast) {
                                return (
                                  <button
                                    onClick={() => onCreateShift(date, staffMember)}
                                    className={`w-full ${
                                      calendarView === "month" ? "h-6" : "h-8"
                                    } border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors flex items-center justify-center hover:bg-gray-50`}
                                    title={`${staffMember.name}さんのシフトを設定（直接反映）`}
                                  >
                                    <Plus className={cellSizes.iconSize} />
                                  </button>
                                );
                              }

                              return null;
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Traditional Calendar Layout - 週ごと表示
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Calendar Grid */}
      {getCalendarWeeks().map((week, weekIndex) => (
        <div
          key={weekIndex}
          className="border-b border-gray-200 last:border-b-0"
        >
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-300">
            {week.map((date, dayIndex) => {
              const dayOfWeekNum = date.getDay();
              const isToday = isSameDay(date, new Date());
              const dayShifts = getShiftsForDate(date);

              return (
                <div
                  key={dayIndex}
                  className={`min-h-[120px] p-2 border-r border-gray-200 last:border-r-0 ${
                    isToday
                      ? "bg-blue-100"
                      : dayOfWeekNum === 0
                      ? "bg-red-50"
                      : dayOfWeekNum === 6
                      ? "bg-blue-50"
                      : "bg-white"
                  }`}
                >
                  {/* Date Header */}
                  <div
                    className={`text-sm font-medium mb-2 ${
                      isToday
                        ? "text-blue-900"
                        : dayOfWeekNum === 0
                        ? "text-red-600"
                        : dayOfWeekNum === 6
                        ? "text-blue-600"
                        : "text-gray-900"
                    }`}
                  >
                    {format(date, "d")}
                    <span className="ml-1 text-xs">
                      {format(date, "E", { locale: ja })}
                    </span>
                  </div>

                  {/* テンプレート基準の不足警告（カレンダー形式） */}
                  {(() => {
                    const dayStats = getDayStats(date);
                    if (dayStats.hasTemplateData && dayStats.isCriticalShortage) {
                      return (
                        <div className="flex items-center justify-center space-x-1 text-xs text-red-700 bg-red-100 px-1 py-0.5 rounded mb-1">
                          <AlertTriangle className="h-2 w-2" />
                          <span>危険-{dayStats.templateShortage}</span>
                        </div>
                      );
                    } else if (
                      dayStats.hasTemplateData &&
                      dayStats.isWarningShortage
                    ) {
                      return (
                        <div className="flex items-center justify-center space-x-1 text-xs text-yellow-700 bg-yellow-100 px-1 py-0.5 rounded mb-1">
                          <AlertTriangle className="h-2 w-2" />
                          <span>注意-{dayStats.templateShortage}</span>
                        </div>
                      );
                    } else if (
                      dayStats.hasTemplateData &&
                      dayStats.templateShortage === 0
                    ) {
                      return (
                        <div className="flex items-center justify-center space-x-1 text-xs text-green-700 bg-green-100 px-1 py-0.5 rounded mb-1">
                          <CheckCircle className="h-2 w-2" />
                          <span>OK</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Shifts for this day */}
                  <div className="space-y-1">
                    {dayShifts.slice(0, 3).map((shift, shiftIndex) => (
                      <div key={`${shift.shiftId}-${shiftIndex}`} className="space-y-1">
                        {shift.slots.map((slot) => {
                          // 同じスロットに複数スタッフがいる場合は横並びに表示
                          const assignedStaffCount = slot.assignedStaff?.length || 0;
                          if (assignedStaffCount === 0) return null;

                          if (assignedStaffCount === 1) {
                            // 単一スタッフの場合は従来通り
                            const staffId = slot.assignedStaff![0];
                            const staffMember = staff.find((s) => s.uid === staffId);
                            if (!staffMember) return null;

                            return (
                              <div
                                key={`${shift.shiftId}-${slot.slotId}-${staffId}`}
                                className={`p-1 rounded text-xs cursor-pointer transition-colors ${
                                  shift.status === "published"
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                }`}
                                onClick={() =>
                                  onOpenShiftDetail(shift, slot, staffMember)
                                }
                                title={`${staffMember.name}: ${slot.startTime}-${slot.endTime}`}
                              >
                                <div className="font-medium truncate">
                                  {staffMember.name}
                                </div>
                                <div className="text-gray-600 truncate">
                                  {slot.startTime}-{slot.endTime}
                                </div>
                              </div>
                            );
                          } else {
                            // 複数スタッフの場合は横並び
                            return (
                              <div
                                key={`${shift.shiftId}-${slot.slotId}`}
                                className={`flex space-x-1 p-1 rounded text-xs ${
                                  shift.status === "published"
                                    ? "bg-green-100"
                                    : "bg-yellow-100"
                                }`}
                              >
                                {slot.assignedStaff?.map((staffId: string) => {
                                  const staffMember = staff.find((s) => s.uid === staffId);
                                  if (!staffMember) return null;

                                  return (
                                    <div
                                      key={staffId}
                                      className={`flex-1 p-1 rounded cursor-pointer transition-colors ${
                                        shift.status === "published"
                                          ? "bg-green-200 text-green-800 hover:bg-green-300"
                                          : "bg-yellow-200 text-yellow-800 hover:bg-yellow-300"
                                      }`}
                                      onClick={() =>
                                        onOpenShiftDetail(shift, slot, staffMember)
                                      }
                                      title={`${staffMember.name}: ${slot.startTime}-${slot.endTime}`}
                                    >
                                      <div className="font-medium truncate text-xs">
                                        {staffMember.name}
                                      </div>
                                      <div
                                        className="text-gray-600 truncate"
                                        style={{ fontSize: "10px" }}
                                      >
                                        {slot.startTime}-{slot.endTime}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                        })}
                      </div>
                    ))}

                    {dayShifts.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dayShifts.length - 3} more
                      </div>
                    )}

                    {/* Add shift button */}
                    {dayShifts.length === 0 && date >= startOfDay(new Date()) && (
                      <div className="flex justify-center items-center h-full">
                        <button
                          onClick={() => onCreateShift(date)}
                          className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full text-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center"
                          title="シフトを追加"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}