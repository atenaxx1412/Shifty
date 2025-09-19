'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { fetchOptimizedDatabaseStats, DatabaseStats as ServiceDatabaseStats } from '@/services/databaseDataService';
import { useDataCache } from '@/hooks/useDataCache';
import {
  Database,
  Server,
  HardDrive,
  Activity,
  Shield,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Zap,
  Archive,
  FileText
} from 'lucide-react';
import GradientHeader from '@/components/ui/GradientHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Using DatabaseStats from service
type DatabaseStats = ServiceDatabaseStats;

interface BackupRecord {
  id: string;
  timestamp: Date;
  size: number;
  status: 'completed' | 'failed' | 'in_progress';
  collections: string[];
}

export default function DatabasePage() {
  const { currentUser } = useAuth();

  // キャッシュ対応のデータ取得 (1日1回自動更新)
  const {
    data: stats,
    loading,
    error,
    refresh,
    lastUpdated,
    isFromCache
  } = useDataCache<DatabaseStats>({
    key: 'database-stats',
    fetchFunction: fetchOptimizedDatabaseStats,
    ttl: 24 * 60 * 60 * 1000, // 24時間
    initialData: {
      totalCollections: 0,
      totalDocuments: 0,
      storageUsed: 0,
      storageLimit: 1024,
      lastBackup: new Date(),
      systemHealth: 'healthy',
      collectionDetails: []
    }
  });

  const [backups, setBackups] = useState<BackupRecord[]>([]);

  // キャッシュステータスの確認
  const getCacheStatusText = () => {
    if (isFromCache && lastUpdated) {
      const hours = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60));
      return `キャッシュデータ (${hours}時間前に取得)`;
    }
    return '最新データ';
  };

  // レガシー関数を削除（useDataCacheで置き換え）

  // データは useDataCache で自動管理されるため、useEffect は不要

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-emerald-600 bg-emerald-100 border-emerald-200';
      case 'warning': return 'text-amber-600 bg-amber-100 border-amber-200';
      case 'critical': return 'text-rose-600 bg-rose-100 border-rose-200';
      default: return 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'critical': return <AlertTriangle className="h-5 w-5" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const getHealthText = (health: string) => {
    switch (health) {
      case 'healthy': return '正常';
      case 'warning': return '警告';
      case 'critical': return '緊急';
      default: return '不明';
    }
  };


  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <AppHeader title="データベース管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-64">
              <LoadingSpinner text="データベース情報を読み込み中..." size="lg" />
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="h-screen overflow-hidden bg-gray-50">
        <AppHeader title="データベース管理" />

        <main className="px-4 sm:px-6 lg:px-8 py-4 h-[calc(100vh-4rem)]">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="h-6 w-6 text-gray-700" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">データベース管理</h1>
                    <p className="text-sm text-gray-500">Firestore データベースの監視・バックアップ・最適化 • {getCacheStatusText()}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <div className={`w-2 h-2 rounded-full ${getHealthColor(stats.systemHealth)}`}></div>
                    <span className={`text-sm font-medium ${getHealthColor(stats.systemHealth).replace('bg-', 'text-').replace('-500', '-600')}`}>
                      {getHealthText(stats.systemHealth)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => refresh()}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? '更新中' : '手動更新'}
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                label="コレクション数"
                value={stats.totalCollections}
                unit="個"
                icon={Archive}
                gradient="from-slate-600 to-slate-700"
                change="アクティブ"
                trend="neutral"
                size="md"
              />
              <StatCard
                label="総ドキュメント数"
                value={stats.totalDocuments}
                unit="件"
                icon={FileText}
                gradient="from-teal-500 to-cyan-600"
                change="全コレクション"
                trend="neutral"
                size="md"
              />
              <StatCard
                label="ストレージ使用量"
                value={`${stats.storageUsed}MB`}
                unit={`/ ${stats.storageLimit}MB (${((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}%)`}
                icon={HardDrive}
                gradient="from-emerald-500 to-teal-600"
                trend={stats.storageUsed / stats.storageLimit > 0.8 ? 'up' : 'neutral'}
                size="md"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Collection Details */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <Database className="h-5 w-5 text-gray-700" />
                  <h2 className="text-base font-semibold text-gray-900">コレクション詳細</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stats.collectionDetails.map((collection, index) => {
                    const colors = [
                      'bg-blue-50 border-blue-200 text-blue-600',
                      'bg-green-50 border-green-200 text-green-600',
                      'bg-purple-50 border-purple-200 text-purple-600',
                      'bg-orange-50 border-orange-200 text-orange-600',
                      'bg-indigo-50 border-indigo-200 text-indigo-600',
                      'bg-pink-50 border-pink-200 text-pink-600'
                    ];
                    const colorClass = colors[index % colors.length];

                    return (
                      <div key={collection.name} className={`p-3 rounded-lg border ${colorClass.split(' ')[0]} ${colorClass.split(' ')[1]}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{collection.name}</p>
                            <p className="text-xs text-gray-500">{collection.documentCount}件のドキュメント</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${colorClass.split(' ')[2]}`}>{collection.status}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <Activity className="h-5 w-5 text-gray-700" />
                  <h2 className="text-base font-semibold text-gray-900">システム状態</h2>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">Firestore接続</span>
                        <p className="text-xs text-slate-500">データベース接続状態</p>
                      </div>
                    </div>
                    <span className="text-sm text-green-700 font-bold">正常</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">認証システム</span>
                        <p className="text-xs text-slate-500">ユーザー認証状態</p>
                      </div>
                    </div>
                    <span className="text-sm text-blue-700 font-bold">正常</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">データ整合性</span>
                        <p className="text-xs text-slate-500">データベース整合性</p>
                      </div>
                    </div>
                    <span className="text-sm text-purple-700 font-bold">良好</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 grid grid-cols-1 gap-4">
                  <button
                    onClick={() => refresh()}
                    disabled={loading}
                    className="flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium">{loading ? 'データベース統計を更新中' : 'データベース統計を更新'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}