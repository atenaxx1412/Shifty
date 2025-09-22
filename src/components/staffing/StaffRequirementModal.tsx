'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Users, Plus, Minus, X } from 'lucide-react';

interface StaffRequirementModalProps {
  isOpen: boolean;
  selectedDate: string | null; // YYYY-MM-DD format
  currentRequirement: number;
  onClose: () => void;
  onSave: (date: string, requiredStaff: number) => void;
}

export default function StaffRequirementModal({
  isOpen,
  selectedDate,
  currentRequirement,
  onClose,
  onSave
}: StaffRequirementModalProps) {
  const [requiredStaff, setRequiredStaff] = useState(currentRequirement);

  // Update local state when props change
  useEffect(() => {
    setRequiredStaff(currentRequirement);
  }, [currentRequirement, selectedDate]);

  if (!isOpen || !selectedDate) return null;

  // Parse date for display
  const dateObj = new Date(selectedDate + 'T00:00:00');
  const formattedDate = format(dateObj, 'M月d日(E)', { locale: {
    localize: {
      day: (n: number) => ['日', '月', '火', '水', '木', '金', '土'][n]
    }
  } });

  const handleStaffChange = (change: number) => {
    setRequiredStaff(Math.max(0, requiredStaff + change));
  };

  const handleSave = () => {
    onSave(selectedDate, requiredStaff);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const quickSetButtons = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white/95 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 w-full max-w-md transform transition-all duration-300 scale-100"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                必要人数設定
              </h3>
              <p className="text-sm text-gray-600">
                {formattedDate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Value Display */}
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {requiredStaff}人
          </div>
          <div className="text-sm text-gray-500">
            {requiredStaff === 0 ? '設定なし' : 'この日に必要な人数'}
          </div>
        </div>

        {/* Plus/Minus Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => handleStaffChange(-1)}
            disabled={requiredStaff <= 0}
            className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="h-5 w-5 text-gray-700" />
          </button>

          <div className="px-6 py-3 bg-blue-50 rounded-xl border border-blue-200">
            <span className="text-xl font-semibold text-blue-900">
              {requiredStaff}人
            </span>
          </div>

          <button
            onClick={() => handleStaffChange(1)}
            className="p-3 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
          >
            <Plus className="h-5 w-5 text-blue-700" />
          </button>
        </div>

        {/* Quick Set Buttons */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3 text-center">
            クイック設定
          </p>
          <div className="grid grid-cols-5 gap-2">
            {quickSetButtons.map((num) => (
              <button
                key={num}
                onClick={() => setRequiredStaff(num)}
                className={`
                  p-2 rounded-lg text-sm font-medium transition-colors
                  ${requiredStaff === num
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            設定
          </button>
        </div>

        {/* Additional Info */}
        {requiredStaff > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 text-center">
              この設定はシフト作成時に人数不足の警告に使用されます
            </p>
          </div>
        )}
      </div>
    </div>
  );
}