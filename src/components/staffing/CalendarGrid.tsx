'use client';

import { useState } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { DailyStaffRequirement } from '@/types/staffingTemplate';

interface CalendarGridProps {
  month: string; // YYYY-MM format
  dailyRequirements: DailyStaffRequirement[];
  onDateClick: (date: string) => void;
  onDateHover?: (date: string | null) => void;
}

export default function CalendarGrid({
  month,
  dailyRequirements,
  onDateClick,
  onDateHover
}: CalendarGridProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Parse month string to Date object
  const [year, monthNum] = month.split('-').map(Number);
  const monthDate = new Date(year, monthNum - 1, 1);

  // Calculate calendar data
  const daysInMonth = getDaysInMonth(monthDate);
  const startDay = getDay(startOfMonth(monthDate)); // 0 = Sunday, 1 = Monday, etc.
  const monthName = format(monthDate, 'yyyy年M月');

  // Create requirement lookup map for quick access
  const requirementMap = dailyRequirements.reduce((acc, req) => {
    acc[req.date] = req.requiredStaff;
    return acc;
  }, {} as Record<string, number>);

  // Generate calendar dates
  const calendarDates = [];

  // Add empty cells for days before month starts (adjust for Monday start)
  const adjustedStartDay = startDay === 0 ? 6 : startDay - 1; // Convert Sunday=0 to Sunday=6
  for (let i = 0; i < adjustedStartDay; i++) {
    calendarDates.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    calendarDates.push({
      day,
      dateString,
      requiredStaff: requirementMap[dateString] || 0,
      isWeekend: false // Will be calculated based on position
    });
  }

  const handleDateClick = (dateString: string) => {
    onDateClick(dateString);
  };

  const handleDateHover = (dateString: string | null) => {
    setHoveredDate(dateString);
    onDateHover?.(dateString);
  };

  const weekdays = ['月', '火', '水', '木', '金', '土', '日'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{monthName}</h2>
        <p className="text-sm text-gray-500 mt-1">
          日付をクリックして必要人数を設定
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday Headers */}
        {weekdays.map((weekday, index) => (
          <div
            key={weekday}
            className={`p-3 text-center text-sm font-medium ${
              index === 5 ? 'text-blue-600' : index === 6 ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {weekday}
          </div>
        ))}

        {/* Calendar Dates */}
        {calendarDates.map((dateInfo, index) => {
          if (!dateInfo) {
            return <div key={index} className="p-3"></div>;
          }

          const isSaturday = (index % 7) === 5;
          const isSunday = (index % 7) === 6;
          const isWeekday = (index % 7) < 5;
          const isHovered = hoveredDate === dateInfo.dateString;
          const hasRequirement = dateInfo.requiredStaff > 0;

          // Define background colors based on day type
          let bgClasses = '';
          let textColorClass = '';

          if (hasRequirement) {
            bgClasses = 'bg-blue-100 border-blue-400';
            textColorClass = 'text-blue-900';
          } else if (isSaturday) {
            bgClasses = 'bg-blue-50 border-blue-200 hover:bg-blue-100';
            textColorClass = 'text-blue-700';
          } else if (isSunday) {
            bgClasses = 'bg-red-50 border-red-200 hover:bg-red-100';
            textColorClass = 'text-red-700';
          } else {
            bgClasses = 'bg-gray-50 border-gray-200 hover:bg-blue-50';
            textColorClass = 'text-gray-900';
          }

          return (
            <div
              key={dateInfo.dateString}
              onClick={() => handleDateClick(dateInfo.dateString)}
              onMouseEnter={() => handleDateHover(dateInfo.dateString)}
              onMouseLeave={() => handleDateHover(null)}
              className={`
                p-3 min-h-[60px] border rounded-lg cursor-pointer transition-all duration-200
                flex flex-col items-center justify-center text-center relative
                ${bgClasses}
                ${isHovered ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
              `}
            >
              <div className={`text-sm font-medium ${textColorClass}`}>
                {dateInfo.day}
              </div>

              {hasRequirement && (
                <div className="mt-1">
                  <div className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {dateInfo.requiredStaff}人
                  </div>
                </div>
              )}

              {/* Hover tooltip */}
              {isHovered && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                  {hasRequirement
                    ? `${dateInfo.requiredStaff}人必要`
                    : 'クリックして設定'
                  }
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
          <span className="text-gray-600">平日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
          <span className="text-gray-600">土曜日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
          <span className="text-gray-600">日曜日</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-400 rounded"></div>
          <span className="text-gray-600">設定済み</span>
        </div>
      </div>
    </div>
  );
}