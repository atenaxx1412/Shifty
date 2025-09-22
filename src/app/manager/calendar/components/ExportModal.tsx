'use client';

import { useState } from 'react';

interface ExportModalProps {
  showModal: boolean;
  onClose: () => void;
  onExport: (layout: 'daily' | 'weekly' | 'monthly', format: 'excel' | 'pdf') => void;
}

export default function ExportModal({
  showModal,
  onClose,
  onExport
}: ExportModalProps) {
  const [selectedLayout, setSelectedLayout] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf' | null>(null);

  if (!showModal) return null;

  const handleFormatSelect = (format: 'excel' | 'pdf') => {
    setSelectedFormat(format);
  };

  const handleConfirmExport = () => {
    if (selectedFormat) {
      onExport(selectedLayout, selectedFormat);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-lg border border-white/20 shadow-2xl rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            フォーマットの選択
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          下のレイアウトパターンから選択してください。
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* 日パターン */}
          <button
            onClick={() => setSelectedLayout('daily')}
            className={`p-3 border-2 rounded-lg transition-colors text-center group ${
              selectedLayout === 'daily'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <div className="w-12 h-8 bg-blue-100 rounded border-2 border-blue-300 flex items-center justify-center mx-auto mb-2">
              <div className="grid grid-cols-4 gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 h-0.5 bg-blue-400 rounded-full"
                  ></div>
                ))}
              </div>
            </div>
            <div className="font-medium text-gray-900">日ごと</div>
          </button>
          {/* 週パターン */}
          <button
            onClick={() => setSelectedLayout('weekly')}
            className={`p-3 border-2 rounded-lg transition-colors text-center group ${
              selectedLayout === 'weekly'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <div className="w-12 h-8 bg-green-100 rounded border-2 border-green-300 flex items-center justify-center mx-auto mb-2">
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 h-0.5 bg-green-400 rounded-full"
                  ></div>
                ))}
              </div>
            </div>
            <div className="font-medium text-gray-900">週まとめ</div>
          </button>
          {/* 月パターン */}
          <button
            onClick={() => setSelectedLayout('monthly')}
            className={`p-3 border-2 rounded-lg transition-colors text-center group ${
              selectedLayout === 'monthly'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <div className={`w-12 h-8 rounded border-2 flex items-center justify-center mx-auto mb-2 ${
              selectedLayout === 'monthly'
                ? 'bg-blue-200 border-blue-400'
                : 'bg-blue-100 border-blue-300'
            }`}>
              <div className="grid grid-cols-6 gap-0.5">
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-0.5 h-0.5 rounded-full ${
                      selectedLayout === 'monthly' ? 'bg-blue-500' : 'bg-blue-400'
                    }`}
                  ></div>
                ))}
              </div>
            </div>
            <div className="font-medium text-gray-900">月まとめ</div>
          </button>
        </div>

        {/* 出力形式選択セクション */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-3">
            出力形式を選択
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Excel出力 */}
            <button
              onClick={() => handleFormatSelect('excel')}
              className={`p-3 border-2 rounded-lg transition-colors text-center group ${
                selectedFormat === 'excel'
                  ? 'border-green-400 bg-green-50'
                  : 'border-green-200 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              <div className="w-12 h-8 bg-green-100 rounded border-2 border-green-300 flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-6 h-6 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
              </div>
              <div className="font-medium text-gray-900">Excel出力</div>
              <div className="text-xs text-gray-500 mt-1">データ編集用</div>
            </button>

            {/* PDF出力 */}
            <button
              onClick={() => handleFormatSelect('pdf')}
              className={`p-3 border-2 rounded-lg transition-colors text-center group ${
                selectedFormat === 'pdf'
                  ? 'border-red-400 bg-red-50'
                  : 'border-red-200 hover:border-red-400 hover:bg-red-50'
              }`}
            >
              <div className="w-12 h-8 bg-red-100 rounded border-2 border-red-300 flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                  />
                </svg>
              </div>
              <div className="font-medium text-gray-900">PDF出力</div>
              <div className="text-xs text-gray-500 mt-1">印刷・配布用</div>
            </button>
          </div>
        </div>

        {/* 確定ボタンセクション */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleConfirmExport}
            disabled={!selectedFormat}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              selectedFormat
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {selectedFormat
              ? `${selectedLayout === 'daily' ? '日ごと' : selectedLayout === 'weekly' ? '週まとめ' : '月まとめ'}の${selectedFormat === 'excel' ? 'Excel' : 'PDF'}出力を実行`
              : '出力形式を選択してください'
            }
          </button>
        </div>
      </div>
    </div>
  );
}