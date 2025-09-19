/**
 * ユーザー削除通知システム
 * Firebase無料版の制限を考慮した効率的な削除通知機能
 */

const DELETED_USERS_KEY = 'deleted_users';

interface DeletedUser {
  uid: string;
  timestamp: number;
}

/**
 * 削除されたユーザーのUIDをlocalStorageに記録
 */
export function notifyUserDeletion(uid: string): void {
  try {
    const deletedUsers = getDeletedUsers();
    const newDeletedUser: DeletedUser = {
      uid,
      timestamp: Date.now()
    };

    // 重複チェック
    const existingIndex = deletedUsers.findIndex(user => user.uid === uid);
    if (existingIndex >= 0) {
      deletedUsers[existingIndex] = newDeletedUser;
    } else {
      deletedUsers.push(newDeletedUser);
    }

    // 7日以上古い記録は削除（ストレージ容量節約）
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filteredUsers = deletedUsers.filter(user => user.timestamp > sevenDaysAgo);

    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(filteredUsers));

    // 他のタブに通知するためのstorageイベントを発火
    window.dispatchEvent(new StorageEvent('storage', {
      key: DELETED_USERS_KEY,
      newValue: JSON.stringify(filteredUsers),
      storageArea: localStorage
    }));

    console.log(`🗑️ Notified user deletion: ${uid}`);
  } catch (error) {
    console.error('Error notifying user deletion:', error);
  }
}

/**
 * 削除されたユーザーリストを取得
 */
export function getDeletedUsers(): DeletedUser[] {
  try {
    const stored = localStorage.getItem(DELETED_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting deleted users:', error);
    return [];
  }
}

/**
 * 指定されたUIDのユーザーが削除されているかチェック
 */
export function isUserDeleted(uid: string): boolean {
  const deletedUsers = getDeletedUsers();
  return deletedUsers.some(user => user.uid === uid);
}

/**
 * 削除されたユーザーの記録をクリア
 */
export function clearDeletedUser(uid: string): void {
  try {
    const deletedUsers = getDeletedUsers();
    const filteredUsers = deletedUsers.filter(user => user.uid !== uid);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(filteredUsers));
    console.log(`🧹 Cleared deleted user record: ${uid}`);
  } catch (error) {
    console.error('Error clearing deleted user:', error);
  }
}

/**
 * 削除通知リスナーを設定
 * 他のタブでユーザーが削除された時の通知を受け取る
 */
export function setupDeletionListener(callback: (uid: string) => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === DELETED_USERS_KEY && event.newValue) {
      try {
        const newDeletedUsers: DeletedUser[] = JSON.parse(event.newValue);
        const currentDeletedUsers = getDeletedUsers();

        // 新しく追加された削除ユーザーを検出
        const newDeletions = newDeletedUsers.filter(newUser =>
          !currentDeletedUsers.some(currentUser => currentUser.uid === newUser.uid)
        );

        newDeletions.forEach(deletedUser => {
          callback(deletedUser.uid);
        });
      } catch (error) {
        console.error('Error processing deletion notification:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}