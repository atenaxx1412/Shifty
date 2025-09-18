'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppHeader from '@/components/layout/AppHeader';
import { collection, getDocs, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Activity,
  Shield,
  Trash2
} from 'lucide-react';
import GradientHeader from '@/components/ui/GradientHeader';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useSystemLogs } from '@/hooks/useFirebaseData';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: 'system' | 'user' | 'security' | 'data' | 'auth';
  action: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  resource?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
  sessionId?: string;
}

export default function LogsPage() {
  const { currentUser } = useAuth();
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Use the custom hook for system logs
  const { data: logs, loading, refresh: refreshLogs } = useSystemLogs(levelFilter, categoryFilter, 100);

  // Initialize filtered logs when logs data changes
  useEffect(() => {
    setFilteredLogs(logs.map(log => {
      const logData = log as any;
      return {
        id: logData.id,
        timestamp: logData.timestamp?.toDate ? logData.timestamp.toDate() : new Date(logData.timestamp),
        level: logData.level || 'info',
        category: logData.category || 'system',
        action: logData.action || 'Unknown Action',
        userId: logData.userId,
        userName: logData.userName,
        userRole: logData.userRole,
        resource: logData.resource,
        details: logData.details,
        success: logData.success ?? true,
        errorMessage: logData.errorMessage,
        ipAddress: logData.ipAddress,
        sessionId: logData.sessionId
      } as LogEntry;
    }));
  }, [logs]);

  // Delete log entry
  const handleDeleteLog = async (logId: string, action: string) => {
    if (!confirm(`「${action}」のログを削除してもよろしいですか？`)) return;

    try {
      await deleteDoc(doc(db, 'system_logs', logId));
      
      // Remove from local state
      // Refresh logs after deletion
      refreshLogs();
      setFilteredLogs(updatedLogs.filter(log => {
        let matches = true;
        
        if (searchTerm) {
          matches = matches && (
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.errorMessage?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        if (levelFilter !== 'all') {
          matches = matches && log.level === levelFilter;
        }
        
        if (categoryFilter !== 'all') {
          matches = matches && log.category === categoryFilter;
        }
        
        return matches;
      }));
      
      // Log the deletion action
      if (currentUser) {
        console.log(`Log deleted: ${action} by ${currentUser.name}`);
      }
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('ログの削除に失敗しました');
    }
  };

  // Filter logs based on search and filters
  useEffect(() => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.errorMessage?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => log.category === categoryFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter, categoryFilter]);

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'warn': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-50 text-red-800 border-red-200';
      case 'critical': return 'bg-red-100 text-red-900 border-red-300';
    }
  };

  const getCategoryIcon = (category: LogEntry['category']) => {
    switch (category) {
      case 'system': return <Activity className="h-4 w-4 text-gray-500" />;
      case 'user': return <User className="h-4 w-4 text-blue-500" />;
      case 'security': return <Shield className="h-4 w-4 text-red-500" />;
      case 'data': return <FileText className="h-4 w-4 text-green-500" />;
      case 'auth': return <Shield className="h-4 w-4 text-purple-500" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const logStats = [
    {
      label: '総ログ数',
      value: logs.length,
      icon: FileText,
      gradient: 'from-gray-600 to-slate-700'
    },
    {
      label: '情報',
      value: logs.filter(l => (l as any).level === 'info').length,
      icon: Info,
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      label: '警告',
      value: logs.filter(l => (l as any).level === 'warn').length,
      icon: AlertTriangle,
      gradient: 'from-yellow-500 to-yellow-600'
    },
    {
      label: 'エラー',
      value: logs.filter(l => (l as any).level === 'error').length,
      icon: XCircle,
      gradient: 'from-red-500 to-red-600'
    },
    {
      label: '重大',
      value: logs.filter(l => (l as any).level === 'critical').length,
      icon: XCircle,
      gradient: 'from-red-600 to-red-700'
    }
  ];

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['root']}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <AppHeader title="ログ管理" />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-64">
              <LoadingSpinner text="ログデータを読み込み中..." size="lg" />
            </div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['root']}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <AppHeader title="ログ管理" />
        
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Header */}
            <GradientHeader
              title="ログ管理"
              subtitle="システムログとエラー監視・アクティビティ追跡"
              icon={FileText}
              gradient="from-gray-600 to-slate-700"
              iconBackground="from-gray-800 to-gray-900"
              actions={
                <div className="flex space-x-2">
                  <button
                    onClick={refreshLogs}
                    className="inline-flex items-center px-4 py-2 bg-gray-800/50 text-white rounded-lg hover:bg-gray-700/50 transition-all duration-200"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    更新
                  </button>
                  <button className="inline-flex items-center px-4 py-2 bg-gray-800/50 text-white rounded-lg hover:bg-gray-700/50 transition-all duration-200">
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </button>
                </div>
              }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {logStats.map((stat, index) => (
                <StatCard
                  key={index}
                  label={stat.label}
                  value={stat.value}
                  icon={stat.icon}
                  gradient={stat.gradient}
                  size="sm"
                  className="text-center"
                />
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ログメッセージまたはユーザー名で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全てのレベル</option>
                    <option value="info">情報</option>
                    <option value="warn">警告</option>
                    <option value="error">エラー</option>
                    <option value="critical">重大</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全てのカテゴリ</option>
                    <option value="system">システム</option>
                    <option value="user">ユーザー</option>
                    <option value="auth">認証</option>
                    <option value="security">セキュリティ</option>
                    <option value="data">データ</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Log Entries */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  ログエントリ ({filteredLogs.length}件)
                </h3>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex items-center space-x-2">
                          {getLevelIcon(log.level)}
                          {getCategoryIcon(log.category)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getLevelColor(log.level)}`}>
                              {log.level}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{log.category}</span>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDate(log.timestamp)}
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-900 mb-2">{log.action}</p>
                          
                          {log.errorMessage && (
                            <p className="text-sm text-red-600 mb-2">エラー: {log.errorMessage}</p>
                          )}
                          
                          {log.resource && (
                            <p className="text-xs text-gray-600 mb-2">リソース: {log.resource}</p>
                          )}
                          
                          {log.userName && (
                            <div className="flex items-center text-xs text-gray-600 mb-2">
                              <User className="h-3 w-3 mr-1" />
                              <span>{log.userName}</span>
                              {log.userId && <span className="ml-1">({log.userId})</span>}
                            </div>
                          )}
                          
                          {log.details && (
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">詳細: </span>
                              {(() => {
                                try {
                                  if (typeof log.details === 'object' && log.details !== null) {
                                    return Object.entries(log.details).map(([key, value]) => {
                                      let displayValue;
                                      try {
                                        if (value === null) {
                                          displayValue = 'null';
                                        } else if (value === undefined) {
                                          displayValue = 'undefined';
                                        } else if (typeof value === 'object') {
                                          displayValue = JSON.stringify(value, null, 0);
                                        } else {
                                          displayValue = String(value);
                                        }
                                      } catch (e) {
                                        displayValue = '[オブジェクト]';
                                      }
                                      
                                      return (
                                        <span key={key} className="mr-3">
                                          {String(key)}: {displayValue}
                                        </span>
                                      );
                                    });
                                  } else {
                                    return <span>詳細データなし</span>;
                                  }
                                } catch (error) {
                                  return <span>詳細表示エラー</span>;
                                }
                              })()}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleDeleteLog(log.id, log.action)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="このログを削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredLogs.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">ログが見つかりません</h3>
                  <p className="text-gray-500">検索条件を変更してください</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}