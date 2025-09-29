'use client';

import { useState, useEffect } from 'react';
import {
  createSystemLogsListener,
  createRealtimeStatsAggregator,
  SystemLogData
} from '@/lib/firebase';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Zap,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  errorCount: number;
  warningCount: number;
  lastError?: SystemLogData;
  uptime: string;
}

export default function SystemMonitoring() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    errorCount: 0,
    warningCount: 0,
    uptime: '0h 0m'
  });
  const [recentLogs, setRecentLogs] = useState<SystemLogData[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // システムログのリアルタイムリスナー
    const logsUnsubscribe = createSystemLogsListener((logs) => {
      setRecentLogs(logs.slice(0, 10)); // 最新10件
      setIsLoading(false);

      // システム健康状態の計算
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentErrors = logs.filter(log =>
        log.level === 'error' && log.timestamp > last24Hours
      );
      const recentWarnings = logs.filter(log =>
        log.level === 'warning' && log.timestamp > last24Hours
      );

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (recentErrors.length > 10) status = 'critical';
      else if (recentErrors.length > 3 || recentWarnings.length > 20) status = 'warning';

      setSystemHealth({
        status,
        errorCount: recentErrors.length,
        warningCount: recentWarnings.length,
        lastError: recentErrors[0],
        uptime: calculateUptime(logs)
      });
    });

    return () => {
      logsUnsubscribe();
    };
  }, []);

  const calculateUptime = (logs: SystemLogData[]): string => {
    const now = new Date();
    const lastCriticalError = logs.find(log =>
      log.level === 'error' && log.message.includes('system')
    );

    if (!lastCriticalError) {
      return '24h+'; // 最近の重大エラーなし
    }

    const uptimeMs = now.getTime() - lastCriticalError.timestamp.getTime();
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  const getStatusIcon = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (systemHealth.status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Server className="h-6 w-6 text-gray-400 animate-pulse" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">システム監視</h3>
            <p className="text-sm text-gray-500">データ読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Server className="h-6 w-6 text-gray-700" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">システム監視</h3>
              <p className="text-sm text-gray-500">
                リアルタイム システムヘルス状況
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <EyeOff className="h-5 w-5 text-gray-500" />
            ) : (
              <Eye className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* System Status */}
          <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">システム状態</p>
                <p className="text-lg font-semibold capitalize">
                  {systemHealth.status === 'healthy' && '正常'}
                  {systemHealth.status === 'warning' && '注意'}
                  {systemHealth.status === 'critical' && '危険'}
                </p>
              </div>
              {getStatusIcon()}
            </div>
          </div>

          {/* Error Count */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">エラー数 (24h)</p>
                <p className="text-lg font-semibold text-gray-900">
                  {systemHealth.errorCount}
                </p>
              </div>
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
          </div>

          {/* Warning Count */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">警告数 (24h)</p>
                <p className="text-lg font-semibold text-gray-900">
                  {systemHealth.warningCount}
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
          </div>

          {/* Uptime */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">稼働時間</p>
                <p className="text-lg font-semibold text-gray-900">
                  {systemHealth.uptime}
                </p>
              </div>
              <Activity className="h-5 w-5 text-green-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs - Expandable */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="p-6">
            <h4 className="text-md font-semibold text-gray-900 mb-4">
              最新ログ ({recentLogs.length}件)
            </h4>

            {recentLogs.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                  >
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.message}
                        </p>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      {log.source && (
                        <p className="text-xs text-gray-500 mt-1">
                          ソース: {log.source}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">ログが見つかりません</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}