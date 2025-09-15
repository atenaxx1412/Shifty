import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'auth' | 'user' | 'system' | 'data' | 'security';

export interface SystemLog {
  logId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  category: LogCategory;
  level: LogLevel;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private sessionId: string;
  
  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientInfo() {
    if (typeof window === 'undefined') {
      return { ipAddress: 'server', userAgent: 'server' };
    }
    
    return {
      ipAddress: 'client', // In production, this would be captured server-side
      userAgent: navigator.userAgent,
    };
  }

  async log(logData: Omit<SystemLog, 'timestamp' | 'sessionId' | 'ipAddress' | 'userAgent'>): Promise<void> {
    try {
      const clientInfo = this.getClientInfo();
      
      const fullLogData: SystemLog = {
        ...logData,
        timestamp: new Date(),
        sessionId: this.sessionId,
        ...clientInfo,
      };

      // Remove undefined fields before sending to Firestore
      const sanitizedLogData = Object.fromEntries(
        Object.entries({
          ...fullLogData,
          timestamp: serverTimestamp(),
        }).filter(([_, value]) => value !== undefined)
      );

      // Log to Firestore
      await addDoc(collection(db, 'system_logs'), sanitizedLogData);

      // Also log to console for development
      const logMethod = this.getConsoleMethod(logData.level);
      logMethod(`🔍 [${logData.category.toUpperCase()}] ${logData.action}`, fullLogData);

    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Fallback: store in localStorage for later retry
      this.storeLogLocally(logData);
    }
  }

  private getConsoleMethod(level: LogLevel) {
    switch (level) {
      case 'error':
      case 'critical':
        return console.error;
      case 'warn':
        return console.warn;
      default:
        return console.log;
    }
  }

  private storeLogLocally(logData: any) {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('pending_logs') || '[]');
      existingLogs.push({
        ...logData,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId,
      });
      localStorage.setItem('pending_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store log locally:', error);
    }
  }

  // Authentication logs
  async logAuth(action: string, userId?: string, userName?: string, userRole?: string, success: boolean = true, errorMessage?: string) {
    await this.log({
      userId,
      userName,
      userRole,
      category: 'auth',
      level: success ? 'info' : 'warn',
      action,
      success,
      errorMessage,
    });
  }

  // User management logs
  async logUserAction(action: string, userId: string, userName: string, userRole: string, targetUserId?: string, targetUserName?: string, details?: Record<string, unknown>) {
    await this.log({
      userId,
      userName,
      userRole,
      category: 'user',
      level: 'info',
      action,
      resource: targetUserId ? `user:${targetUserId}` : undefined,
      details: {
        targetUserName,
        ...details,
      },
      success: true,
    });
  }

  // System logs
  async logSystem(action: string, level: LogLevel = 'info', details?: Record<string, unknown>) {
    await this.log({
      category: 'system',
      level,
      action,
      details,
      success: level !== 'error' && level !== 'critical',
    });
  }

  // Data modification logs
  async logDataChange(action: string, userId: string, userName: string, userRole: string, resource: string, details?: Record<string, unknown>) {
    await this.log({
      userId,
      userName,
      userRole,
      category: 'data',
      level: 'info',
      action,
      resource,
      details,
      success: true,
    });
  }

  // Security logs
  async logSecurity(action: string, level: LogLevel, userId?: string, userName?: string, details?: Record<string, unknown>) {
    await this.log({
      userId,
      userName,
      category: 'security',
      level,
      action,
      details,
      success: level === 'info',
    });
  }

  // Session management
  renewSession() {
    this.sessionId = this.generateSessionId();
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions
export const logAuth = auditLogger.logAuth.bind(auditLogger);
export const logUserAction = auditLogger.logUserAction.bind(auditLogger);
export const logSystem = auditLogger.logSystem.bind(auditLogger);
export const logDataChange = auditLogger.logDataChange.bind(auditLogger);
export const logSecurity = auditLogger.logSecurity.bind(auditLogger);