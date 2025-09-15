'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ShiftExtended, ShiftSlot, User } from '@/types';

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftExtended | null;
  slot: ShiftSlot | null;
  staff: User | null;
  onSave: (slotId: string, updatedSlot: Partial<ShiftSlot>) => Promise<void>;
  onDelete: (slotId: string) => Promise<void>;
}

export default function ShiftDetailModal({
  isOpen,
  onClose,
  shift,
  slot,
  staff,
  onSave,
  onDelete
}: ShiftDetailModalProps) {
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    breakStartTime: '',
    breakEndTime: '',
    positions: '' as string,
    businessContent: ''
  });
  const [loading, setLoading] = useState(false);

  // モーダルが開かれた時にデータを初期化
  useEffect(() => {
    if (isOpen && slot) {
      setFormData({
        startTime: slot.startTime || '',
        endTime: slot.endTime || '',
        breakStartTime: '',
        breakEndTime: '',
        positions: slot.positions?.join(', ') || '',
        businessContent: ''
      });
    }
  }, [isOpen, slot]);

  if (!isOpen || !shift || !slot || !staff) {
    return null;
  }

  // 時間選択のオプションを生成
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeStr);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleSave = async () => {
    if (!slot) return;
    
    setLoading(true);
    try {
      await onSave(slot.slotId, {
        startTime: formData.startTime,
        endTime: formData.endTime,
        positions: formData.positions.split(',').map(p => p.trim()).filter(Boolean)
      });
      onClose();
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!slot) return;
    
    if (!confirm('このシフトを削除してもよろしいですか？')) {
      return;
    }

    setLoading(true);
    try {
      await onDelete(slot.slotId);
      onClose();
    } catch (error) {
      console.error('Error deleting shift:', error);
      alert('削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/30 w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-lg font-semibold">シフト詳細</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* スタッフ名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              スタッフ名
            </label>
            <input
              type="text"
              value={staff.name}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>

          {/* 日付 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日付
            </label>
            <input
              type="text"
              value={new Date(shift.date).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                weekday: 'short'
              })}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>

          {/* 勤務時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              勤務時間
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">時</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <span className="text-gray-500">〜</span>
              <select
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">時</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 休憩時間 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              休憩時間
            </label>
            <div className="flex items-center space-x-2">
              <select
                value={formData.breakStartTime}
                onChange={(e) => setFormData(prev => ({ ...prev, breakStartTime: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">時</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
              <span className="text-gray-500">〜</span>
              <select
                value={formData.breakEndTime}
                onChange={(e) => setFormData(prev => ({ ...prev, breakEndTime: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">時</option>
                {timeOptions.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 業務内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              業務内容 <span className="text-blue-500">ℹ</span>
            </label>
            <textarea
              value={formData.businessContent}
              onChange={(e) => setFormData(prev => ({ ...prev, businessContent: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="業務内容を入力してください"
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex justify-between p-4 border-t border-white/20 bg-white/40">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
            disabled={loading}
          >
            削除する
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600/90 text-white rounded-lg hover:bg-blue-700/90 transition-colors disabled:opacity-50 backdrop-blur-sm"
            disabled={loading || !formData.startTime || !formData.endTime}
          >
            {loading ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}