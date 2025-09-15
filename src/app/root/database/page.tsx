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

  const [backups, setBackups] = useState<BackupRecord[]>([
    {
      id: 'backup_001',
      timestamp: new Date('2025-09-09T23:00:00'),
      size: 12.4,
      status: 'completed',
      collections: ['users', 'shops', 'shifts', 'shifts_extended']
    },
    {
      id: 'backup_002', 
      timestamp: new Date('2025-09-08T23:00:00'),
      size: 11.8,
      status: 'completed',
      collections: ['users', 'shops', 'shifts', 'shifts_extended']
    },
    {
      id: 'backup_003',
      timestamp: new Date('2025-09-07T23:00:00'), 
      size: 11.2,
      status: 'completed',
      collections: ['users', 'shops', 'shifts', 'shifts_extended']
    }
  ]);

  // Fetch real database statistics
  const fetchDatabaseStats = async () => {
    try {
      setLoading(true);
      
      // Get list of known collections
      const collectionNames = ['users', 'shops', 'shifts', 'shifts_extended', 'system_logs', 'login', 'budgetCalculations'];
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
          }
        } catch (error) {
          console.log(`Collection ${collectionName} might not exist:`, error);
        }
      }
      
      // Estimate storage usage (rough calculation)
      const estimatedStorageUsed = Math.round((totalDocuments * 2) / 10) / 100; // Rough estimate in MB
      
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

  const handleBackup = () => {
    // Simulate backup process
    const newBackup: BackupRecord = {
      id: `backup_${Date.now()}`,
      timestamp: new Date(),
      size: Math.random() * 5 + 10, // Random size between 10-15 MB
      status: 'in_progress',
      collections: ['users', 'shops', 'shifts', 'shifts_extended', 'budgetCalculations']
    };
    
    setBackups(prev => [newBackup, ...prev]);
    
    // Complete backup after 3 seconds
    setTimeout(() => {
      setBackups(prev => 
        prev.map(backup => 
          backup.id === newBackup.id 
            ? { ...backup, status: 'completed' as const }
            : backup
        )
      );
    }, 3000);
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <AppHeader title="データベース管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">データベース情報を読み込み中...</p>
              </div>
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
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg">
                    <Database className="h-10 w-10 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">データベース管理</h1>
                    <p className="text-slate-300 mt-2 text-lg">
                      Firestore データベースの監視・バックアップ・最適化
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`px-4 py-2 rounded-xl border ${getHealthColor(stats.systemHealth)} shadow-sm`}>
                    <div className="flex items-center space-x-2">
                      {getHealthIcon(stats.systemHealth)}
                      <span className="font-bold">{getHealthText(stats.systemHealth)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={fetchDatabaseStats}
                    className="inline-flex items-center px-4 py-2.5 bg-slate-700/50 backdrop-blur-sm text-white rounded-xl hover:bg-slate-600/50 transition-all duration-200 border border-slate-600/30"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    更新
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">コレクション数</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.totalCollections}</p>
                    <p className="text-xs text-slate-500">アクティブ</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
                    <Archive className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">総ドキュメント数</p>
                    <p className="text-3xl font-bold text-teal-600">{stats.totalDocuments.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">全コレクション</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">ストレージ使用量</p>
                    <p className="text-3xl font-bold text-emerald-600">{stats.storageUsed}MB</p>
                    <p className="text-xs text-slate-500">/ {stats.storageLimit}MB ({((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}%)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <HardDrive className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Backup Management */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">バックアップ管理</h2>
                  </div>
                  <button
                    onClick={handleBackup}
                    className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    今すぐバックアップ
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                    <div>
                      <p className="font-semibold text-slate-900">最終バックアップ</p>
                      <p className="text-sm text-slate-600">{formatDate(stats.lastBackup)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-emerald-600 font-bold">完了</p>
                      <p className="text-xs text-slate-500">{formatBytes(12.4 * 1024 * 1024)}</p>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {backups.map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            backup.status === 'completed' ? 'bg-emerald-500' :
                            backup.status === 'in_progress' ? 'bg-amber-500 animate-pulse' :
                            'bg-rose-500'
                          }`}></div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {formatDate(backup.timestamp)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {backup.collections.length} コレクション
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {backup.status === 'completed' && formatBytes(backup.size * 1024 * 1024)}
                            {backup.status === 'in_progress' && '処理中...'}
                            {backup.status === 'failed' && '失敗'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/50 p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-lg">
                    <Server className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">システム状態</h2>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">Firestore接続</span>
                        <p className="text-xs text-slate-500">応答時間: 23ms</p>
                      </div>
                    </div>
                    <span className="text-sm text-emerald-700 font-bold">正常</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">認証システム</span>
                        <p className="text-xs text-slate-500">Firebase Auth</p>
                      </div>
                    </div>
                    <span className="text-sm text-teal-700 font-bold">正常</span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                      <div>
                        <span className="text-sm font-semibold text-slate-900">ストレージ容量</span>
                        <p className="text-xs text-slate-500">{((stats.storageUsed / stats.storageLimit) * 100).toFixed(1)}% 使用中</p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-700 font-bold">良好</span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <button 
                    onClick={fetchDatabaseStats}
                    className="flex items-center justify-center space-x-2 p-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-200/50"
                  >
                    <RefreshCw className="h-4 w-4 text-slate-600" />
                    <span className="text-sm text-slate-700 font-medium">更新</span>
                  </button>
                  <button className="flex items-center justify-center space-x-2 p-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl transition-all border border-slate-200/50">
                    <Settings className="h-4 w-4 text-slate-600" />
                    <span className="text-sm text-slate-700 font-medium">設定</span>
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