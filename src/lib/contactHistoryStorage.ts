export interface ContactHistoryEntry {
  id: string;
  timestamp: Date;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'resolved';
  category: string;
  priority: string;
  readAt?: Date;
  resolvedAt?: Date;
}

const STORAGE_KEY_PREFIX = 'contact_history_';

export class ContactHistoryStorage {
  /**
   * 送信履歴をローカルストレージに追加
   */
  static addToHistory(userId: string, entry: Omit<ContactHistoryEntry, 'id'>) {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      const existingHistory = this.getHistory(userId);

      const newEntry: ContactHistoryEntry = {
        ...entry,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(entry.timestamp)
      };

      const updatedHistory = [newEntry, ...existingHistory];

      // 最大100件まで保持
      if (updatedHistory.length > 100) {
        updatedHistory.splice(100);
      }

      localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
      console.log('📋 Added to contact history:', newEntry);

      return newEntry;
    } catch (error) {
      console.error('❌ Error adding to contact history:', error);
      return null;
    }
  }

  /**
   * 送信履歴をローカルストレージから取得
   */
  static getHistory(userId: string): ContactHistoryEntry[] {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return [];
      }

      const history = JSON.parse(stored) as ContactHistoryEntry[];

      // 日付文字列をDateオブジェクトに変換
      return history.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
        readAt: entry.readAt ? new Date(entry.readAt) : undefined,
        resolvedAt: entry.resolvedAt ? new Date(entry.resolvedAt) : undefined
      }));
    } catch (error) {
      console.error('❌ Error getting contact history:', error);
      return [];
    }
  }

  /**
   * 特定のエントリのステータスを更新
   */
  static updateStatus(userId: string, entryId: string, status: 'read' | 'resolved') {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      const history = this.getHistory(userId);

      const entryIndex = history.findIndex(entry => entry.id === entryId);
      if (entryIndex === -1) {
        return false;
      }

      const now = new Date();
      history[entryIndex].status = status;

      if (status === 'read') {
        history[entryIndex].readAt = now;
      } else if (status === 'resolved') {
        history[entryIndex].resolvedAt = now;
      }

      localStorage.setItem(storageKey, JSON.stringify(history));
      console.log(`📋 Updated status for ${entryId}: ${status}`);

      return true;
    } catch (error) {
      console.error('❌ Error updating contact history status:', error);
      return false;
    }
  }

  /**
   * 履歴を削除
   */
  static clearHistory(userId: string): boolean {
    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(storageKey);
      console.log('🗑️ Cleared contact history for user:', userId);
      return true;
    } catch (error) {
      console.error('❌ Error clearing contact history:', error);
      return false;
    }
  }

  /**
   * 統計情報を取得
   */
  static getStats(userId: string) {
    const history = this.getHistory(userId);

    return {
      total: history.length,
      unread: history.filter(h => h.status === 'unread').length,
      read: history.filter(h => h.status === 'read').length,
      resolved: history.filter(h => h.status === 'resolved').length,
      urgent: history.filter(h => h.priority === 'urgent').length
    };
  }
}