'use client';

import { Wifi, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-200 rounded-full mb-4">
            <Wifi className="h-8 w-8 text-gray-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">オフラインです</h1>
          <p className="text-gray-600">
            インターネット接続を確認して、再度お試しください。
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            再読み込み
          </button>

          <div className="text-sm text-gray-500">
            <p>このページはオフラインでも表示されています。</p>
            <p className="mt-1">接続が復旧したら、自動的に最新の情報に更新されます。</p>
          </div>
        </div>
      </div>
    </div>
  );
}