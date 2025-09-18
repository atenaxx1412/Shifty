'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

interface DatabaseStats {
  totalCollections: number;
  totalDocuments: number;
  storageUsed: number;
  storageLimit: number;
  lastBackup: Date;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface BackupRecord {
  id: string;
  timestamp: Date;
  size: number;
  status: 'completed' | 'failed' | 'in_progress';
  collections: string[];
}

export default function DatabasePage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DatabaseStats>({
    totalCollections: 0,
    totalDocuments: 0,
    storageUsed: 0, // MB
    storageLimit: 1024, // MB  
    lastBackup: new Date(),
    systemHealth: 'healthy'
  });

  const [backups, setBackups] = useState<BackupRecord[]>([]);

  // Fetch real database statistics
  const fetchDatabaseStats = async () => {
    try {
      setLoading(true);
      
      // Get list of known collections (based on actual Firebase collections)
      const collectionNames = ['users', 'activityLogs', 'shifts_extended', 'systemSettings', 'system_logs', 'budgetCalculations'];
      let totalDocuments = 0;
      let activeCollections = 0;
      
      // Count documents in each collection
      for (const collectionName of collectionNames) {
        try {
          const snapshot = await getDocs(collection(db, collectionName));
          const docCount = snapshot.size;
          if (docCount > 0) {
            activeCollections++;
            totalDocuments += docCount;
            console.log(`Collection ${collectionName}: ${docCount} documents`);
          }
        } catch (error) {
          console.log(`Collection ${collectionName} might not exist:`, error);
        }
      }
      
      // Estimate storage usage (rough calculation based on document count)
      const estimatedStorageUsed = Math.round((totalDocuments * 0.5) / 10) / 100; // More realistic estimate
      
      setStats({
        totalCollections: activeCollections,
        totalDocuments: totalDocuments,
        storageUsed: estimatedStorageUsed,
        storageLimit: 1024,
        lastBackup: new Date(),
        systemHealth: 'healthy'
      });
    } catch (error) {
      console.error('Error fetching database stats:', error);
      setStats({
        totalCollections: 0,
        totalDocuments: 0,
        storageUsed: 0,
        storageLimit: 1024,
        lastBackup: new Date(),
        systemHealth: 'warning'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="データベース管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <GradientHeader
              title="データベース管理"
              subtitle="Firestore データベースの監視・バックアップ・最適化"
              icon={Database}
              gradient="from-slate-800 to-slate-900"
              status={{
                label: getHealthText(stats.systemHealth),
                color: getHealthColor(stats.systemHealth),
                icon: getHealthIcon(stats.systemHealth) ? CheckCircle : AlertTriangle
              }}
              actions={
                <button
                  onClick={fetchDatabaseStats}
                  className="inline-flex items-center px-4 py-2.5 bg-slate-700/50 backdrop-blur-sm text-white rounded-xl hover:bg-slate-600/50 transition-all duration-200 border border-slate-600/30"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  更新
                </button>
              }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="grid grid-cols-1 gap-8">
              {/* Collection Details */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">コレクション詳細</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">users</p>
                        <p className="text-xs text-slate-500">ユーザー情報</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">アクティブ</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">shops</p>
                        <p className="text-xs text-slate-500">店舗情報</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-600">アクティブ</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">shifts</p>
                        <p className="text-xs text-slate-500">シフト管理</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-purple-600">アクティブ</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">システム状態</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
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
                    onClick={fetchDatabaseStats}
                    className="flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-sm font-medium">データベース統計を更新</span>
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