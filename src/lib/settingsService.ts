import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface SystemSettings {
  system: {
    maintenanceMode: boolean;
    autoBackup: boolean;
    backupFrequency: 'hourly' | 'daily' | 'weekly';
    systemTimezone: string;
    debugMode: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number;
    passwordExpiry: number;
    loginAttempts: number;
    ipWhitelist: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    systemAlerts: boolean;
    userActivity: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    language: 'ja' | 'en';
    timezone: string;
    dateFormat: string;
    currency: string;
  };
}

export const defaultSettings: SystemSettings = {
  system: {
    maintenanceMode: false,
    autoBackup: true,
    backupFrequency: 'daily',
    systemTimezone: 'Asia/Tokyo',
    debugMode: false
  },
  security: {
    twoFactorAuth: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    loginAttempts: 5,
    ipWhitelist: false
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    systemAlerts: true,
    userActivity: false
  },
  appearance: {
    theme: 'light',
    language: 'ja',
    timezone: 'Asia/Tokyo',
    dateFormat: 'YYYY/MM/DD',
    currency: 'JPY'
  }
};

export const SettingsService = {
  // システム設定を取得
  getSystemSettings: async (): Promise<SystemSettings> => {
    try {
      const settingsRef = doc(db, 'systemSettings', 'global');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        return settingsDoc.data() as SystemSettings;
      } else {
        // デフォルト設定を返す
        return defaultSettings;
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      return defaultSettings;
    }
  },

  // システム設定を保存
  saveSystemSettings: async (settings: SystemSettings): Promise<void> => {
    try {
      const settingsRef = doc(db, 'systemSettings', 'global');
      await setDoc(settingsRef, {
        ...settings,
        lastUpdated: serverTimestamp(),
        updatedBy: 'root' // TODO: 実際のユーザーIDを使用
      });
    } catch (error) {
      console.error('Error saving system settings:', error);
      throw error;
    }
  },

  // 特定のセクションのみ更新
  updateSettingsSection: async (
    section: keyof SystemSettings, 
    sectionData: Partial<SystemSettings[keyof SystemSettings]>
  ): Promise<void> => {
    try {
      const settingsRef = doc(db, 'systemSettings', 'global');
      await updateDoc(settingsRef, {
        [section]: sectionData,
        lastUpdated: serverTimestamp(),
        updatedBy: 'root'
      });
    } catch (error) {
      console.error('Error updating settings section:', error);
      throw error;
    }
  },

  // 設定をローカルストレージにバックアップ
  backupToLocalStorage: (settings: SystemSettings): void => {
    try {
      localStorage.setItem('systemSettings', JSON.stringify(settings));
      localStorage.setItem('systemSettingsBackupTime', new Date().toISOString());
    } catch (error) {
      console.error('Error backing up settings to localStorage:', error);
    }
  },

  // ローカルストレージから設定を復元
  restoreFromLocalStorage: (): SystemSettings | null => {
    try {
      const settingsStr = localStorage.getItem('systemSettings');
      if (settingsStr) {
        return JSON.parse(settingsStr) as SystemSettings;
      }
      return null;
    } catch (error) {
      console.error('Error restoring settings from localStorage:', error);
      return null;
    }
  },

  // 設定の検証
  validateSettings: (settings: SystemSettings): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // セッションタイムアウトの検証
    if (settings.security.sessionTimeout < 5 || settings.security.sessionTimeout > 1440) {
      errors.push('セッションタイムアウトは5分から1440分の間で設定してください');
    }

    // パスワード有効期限の検証
    if (settings.security.passwordExpiry < 30 || settings.security.passwordExpiry > 365) {
      errors.push('パスワード有効期限は30日から365日の間で設定してください');
    }

    // ログイン試行回数の検証
    if (settings.security.loginAttempts < 3 || settings.security.loginAttempts > 10) {
      errors.push('ログイン試行回数は3回から10回の間で設定してください');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  // メンテナンスモードの切り替え（特別処理）
  toggleMaintenanceMode: async (enabled: boolean): Promise<void> => {
    try {
      const settingsRef = doc(db, 'systemSettings', 'global');
      await updateDoc(settingsRef, {
        'system.maintenanceMode': enabled,
        'system.maintenanceModeChangedAt': serverTimestamp(),
        lastUpdated: serverTimestamp(),
        updatedBy: 'root'
      });

      // システム通知を作成
      if (enabled) {
        // メンテナンスモード開始の通知を作成
        // SystemNotificationService.createNotification() を使用
      }
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      throw error;
    }
  }
};