# Shifty スタッフ側リアルタイム通信設計

## 概要

Shiftyシステムにおけるスタッフ側のリアルタイム通信とデータベース設計について詳述します。効率的で安全な双方向通信を実現し、スタッフの利便性向上とマネージャーとの円滑なコミュニケーションを支援します。

### 主要機能

- **リアルタイムシフト通知**: シフト公開・変更の即座通知
- **双方向チャット機能**: マネージャーとの1対1チャット
- **申請状況通知**: シフト申請・交換申請の承認/拒否結果
- **緊急連絡システム**: 重要なお知らせの優先配信
- **オフライン対応**: 接続復旧時の自動同期

---

## チャット機能データベース設計

### 8. simpleChatRooms コレクション

**主要用途**: マネージャー-スタッフ間の1対1チャットルーム管理

```typescript
interface SimpleChatRoom {
  id?: string;                    // Firestore自動生成ID
  managerId: string;              // マネージャーのUID
  staffId: string;                // スタッフのUID
  managerName: string;            // マネージャー表示名
  staffName: string;              // スタッフ表示名
  lastMessage?: {
    content: string;              // 最新メッセージ内容
    timestamp: Timestamp;         // 送信時刻
    senderId: string;             // 送信者UID
  };
  unreadCount: {
    [userId: string]: number;     // ユーザー別未読数
  };
  createdAt: Timestamp;           // ルーム作成日時
  updatedAt: Timestamp;           // 最終更新日時
}
```

**インデックス設定:**
```javascript
// 必須複合インデックス
['managerId', 'staffId']         // ルーム検索用
['managerId', 'updatedAt']       // マネージャー側ルーム一覧用
['staffId', 'updatedAt']         // スタッフ側ルーム一覧用
```

**アクセスパターン:**
```typescript
// マネージャー側：自分のルーム一覧
const managerRoomsQuery = query(
  collection(db, 'simpleChatRooms'),
  where('managerId', '==', currentUser.uid),
  orderBy('updatedAt', 'desc')
);

// スタッフ側：自分のルーム一覧
const staffRoomsQuery = query(
  collection(db, 'simpleChatRooms'),
  where('staffId', '==', currentUser.uid),
  orderBy('updatedAt', 'desc')
);
```

### 9. simpleChatMessages コレクション

**主要用途**: チャットメッセージの保存と履歴管理

```typescript
interface SimpleChatMessage {
  id?: string;                    // Firestore自動生成ID
  chatRoomId: string;             // 所属チャットルームID
  senderId: string;               // 送信者UID
  senderName: string;             // 送信者表示名
  senderRole: 'manager' | 'staff'; // 送信者役割
  content: string;                // メッセージ内容
  timestamp: Timestamp;           // 送信時刻
  read: boolean;                  // 既読状態

  // 拡張機能用（将来実装）
  messageType?: 'text' | 'image' | 'file' | 'system';
  attachments?: string[];         // 添付ファイルURL配列
  replyTo?: string;              // 返信先メッセージID
}
```

**インデックス設定:**
```javascript
// 必須複合インデックス
['chatRoomId', 'timestamp']      // 時系列メッセージ取得用
['chatRoomId', 'read', 'timestamp'] // 未読メッセージ検索用
```

**パフォーマンス最適化:**
```typescript
// 1.5ヶ月制限でメッセージ取得（メモリ効率化）
const getRecentMessages = (chatRoomId: string) => {
  const oneAndHalfMonthsAgo = new Date();
  oneAndHalfMonthsAgo.setMonth(oneAndHalfMonthsAgo.getMonth() - 1.5);

  return query(
    collection(db, 'simpleChatMessages'),
    where('chatRoomId', '==', chatRoomId),
    where('timestamp', '>=', Timestamp.fromDate(oneAndHalfMonthsAgo)),
    orderBy('timestamp', 'asc'),
    limit(100) // 最大100件
  );
};
```

---

## スタッフ側リアルタイム通信戦略

### 1. データ購読パターン

#### A. 基本データ購読

```typescript
interface StaffDataSubscriptionService {
  // 自分のユーザー情報変更通知
  subscribeToUserProfile(staffId: string, callback: (user: User) => void): Unsubscribe;

  // 自分のシフト更新通知
  subscribeToMyShifts(staffId: string, callback: (shifts: Shift[]) => void): Unsubscribe;

  // シフト申請状況通知
  subscribeToMyShiftRequests(staffId: string, callback: (requests: ShiftRequest[]) => void): Unsubscribe;

  // チャットルーム更新通知
  subscribeToMyChatRooms(staffId: string, callback: (rooms: SimpleChatRoom[]) => void): Unsubscribe;
}
```

#### B. 実装例

```typescript
export class StaffRealtimeService {

  /**
   * スタッフの包括的データ購読
   */
  static setupStaffSubscriptions(staffId: string) {
    const subscriptions: Unsubscribe[] = [];

    // 1. 自分のユーザー情報変更
    const userSubscription = onSnapshot(
      doc(db, 'users', staffId),
      (doc) => {
        if (doc.exists()) {
          const userData = doc.data() as User;
          StaffStore.updateUserProfile(userData);
          console.log('👤 Profile updated:', userData.name);
        }
      }
    );
    subscriptions.push(userSubscription);

    // 2. 自分のシフト更新
    const shiftsSubscription = onSnapshot(
      query(
        collection(db, 'shifts'),
        where('slots', 'array-contains-any', [{ assignedStaff: [staffId] }])
      ),
      (snapshot) => {
        const myShifts = snapshot.docs
          .map(doc => ({ shiftId: doc.id, ...doc.data() } as Shift))
          .filter(shift => shift.slots.some(slot =>
            slot.assignedStaff.includes(staffId)
          ));

        StaffStore.updateShifts(myShifts);
        console.log(`📅 My shifts updated: ${myShifts.length} shifts`);

        // 新しいシフト通知
        showShiftNotification(myShifts);
      }
    );
    subscriptions.push(shiftsSubscription);

    // 3. シフト申請状況
    const requestsSubscription = onSnapshot(
      query(
        collection(db, 'shiftRequests'),
        where('userId', '==', staffId),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const requests = snapshot.docs.map(doc =>
          ({ requestId: doc.id, ...doc.data() } as ShiftRequest)
        );

        StaffStore.updateShiftRequests(requests);

        // 承認/拒否通知
        requests.forEach(request => {
          if (request.status !== 'pending') {
            showRequestStatusNotification(request);
          }
        });
      }
    );
    subscriptions.push(requestsSubscription);

    // 4. チャットルーム更新
    const chatSubscription = onSnapshot(
      query(
        collection(db, 'simpleChatRooms'),
        where('staffId', '==', staffId),
        orderBy('updatedAt', 'desc')
      ),
      (snapshot) => {
        const chatRooms = snapshot.docs.map(doc =>
          ({ id: doc.id, ...doc.data() } as SimpleChatRoom)
        );

        StaffStore.updateChatRooms(chatRooms);

        // 新メッセージ通知
        chatRooms.forEach(room => {
          if (room.unreadCount[staffId] > 0) {
            showChatNotification(room);
          }
        });
      }
    );
    subscriptions.push(chatSubscription);

    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      console.log('🔌 Staff subscriptions cleaned up');
    };
  }
}
```

### 2. 通知システム

#### A. 通知タイプ定義

```typescript
interface StaffNotification {
  id: string;
  type: 'shift_assigned' | 'shift_changed' | 'request_approved' |
        'request_rejected' | 'chat_message' | 'urgent_notice';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Timestamp;
  actionUrl?: string;             // 通知タップ時の遷移先
}
```

#### B. 通知表示実装

```typescript
export class StaffNotificationService {

  /**
   * シフト通知の表示
   */
  static showShiftNotification(shifts: Shift[]) {
    const newShifts = shifts.filter(shift =>
      isNewShift(shift) && shift.status === 'published'
    );

    if (newShifts.length > 0) {
      showToast({
        type: 'info',
        title: '新しいシフトが公開されました',
        message: `${newShifts.length}件のシフトが追加されました`,
        duration: 5000,
        action: {
          label: '確認',
          onClick: () => navigateTo('/staff/shifts')
        }
      });
    }
  }

  /**
   * 申請結果通知
   */
  static showRequestStatusNotification(request: ShiftRequest) {
    const isApproved = request.status === 'approved';

    showToast({
      type: isApproved ? 'success' : 'warning',
      title: isApproved ? '申請が承認されました' : '申請が拒否されました',
      message: `${formatDate(request.date)}のシフト申請`,
      duration: 7000,
      action: {
        label: '詳細',
        onClick: () => navigateTo('/staff/requests')
      }
    });
  }

  /**
   * チャット通知
   */
  static showChatNotification(room: SimpleChatRoom) {
    if (room.lastMessage && room.lastMessage.senderId !== getCurrentStaffId()) {
      showToast({
        type: 'message',
        title: `${room.managerName}からメッセージ`,
        message: truncateMessage(room.lastMessage.content, 50),
        duration: 8000,
        action: {
          label: '返信',
          onClick: () => navigateTo(`/staff/chat/${room.id}`)
        }
      });
    }
  }
}
```

### 3. オフライン対応と同期戦略

#### A. 接続状態監視

```typescript
export class StaffConnectionService {

  static monitorConnection() {
    let isOnline = navigator.onLine;

    // ネットワーク状態変更監視
    window.addEventListener('online', () => {
      if (!isOnline) {
        isOnline = true;
        console.log('🟢 Connection restored - syncing data');
        this.syncOfflineData();
        showToast({
          type: 'success',
          title: 'オンラインに復帰しました',
          message: 'データを同期しています...'
        });
      }
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      console.log('🔴 Connection lost - entering offline mode');
      showToast({
        type: 'warning',
        title: 'オフラインモードです',
        message: '一部機能が制限されます'
      });
    });

    // Firestore接続状態も監視
    onSnapshot(
      doc(db, 'system', 'health'),
      { includeMetadataChanges: true },
      (doc) => {
        if (doc.metadata.fromCache && isOnline) {
          console.warn('⚠️ Using cached data despite being online');
          showConnectionWarning();
        }
      }
    );
  }

  /**
   * オフライン時のデータ同期
   */
  static async syncOfflineData() {
    try {
      // ローカルストレージから未送信データを取得
      const pendingActions = getStorageItem('pendingActions') || [];

      for (const action of pendingActions) {
        await this.executePendingAction(action);
      }

      // 同期完了後にローカルデータクリア
      removeStorageItem('pendingActions');
      console.log('✅ Offline data synced successfully');

    } catch (error) {
      console.error('❌ Failed to sync offline data:', error);
      showToast({
        type: 'error',
        title: '同期エラー',
        message: 'データの同期に失敗しました。再試行してください。'
      });
    }
  }
}
```

#### B. ローカルストレージ活用

```typescript
interface OfflineAction {
  id: string;
  type: 'send_message' | 'submit_request' | 'update_profile';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export class StaffOfflineService {

  /**
   * オフライン時のアクション保存
   */
  static saveOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) {
    const offlineAction: OfflineAction = {
      ...action,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    const pendingActions = getStorageItem('pendingActions') || [];
    pendingActions.push(offlineAction);
    setStorageItem('pendingActions', pendingActions);

    console.log('💾 Action saved for offline sync:', action.type);
  }

  /**
   * キャッシュされたデータの表示
   */
  static getCachedData<T>(key: string): T | null {
    const cached = getStorageItem(`cache_${key}`);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  static setCachedData<T>(key: string, data: T, ttlMinutes: number = 30) {
    const cacheData = {
      data,
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };
    setStorageItem(`cache_${key}`, cacheData);
  }
}
```

---

## セキュリティとアクセス制御

### 1. スタッフ側データアクセス制御

#### A. Firestore Security Rules（スタッフ用）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // スタッフは自分の情報のみアクセス可能
    match /users/{userId} {
      allow read, update: if request.auth != null && (
        request.auth.uid == userId ||
        // マネージャーは自分のスタッフ情報を読み取り可能
        (get(/databases/$(database)/documents/users/$(userId)).data.managerId == request.auth.uid)
      );
    }

    // シフトは関連するもののみ閲覧可能
    match /shifts/{shiftId} {
      allow read: if request.auth != null && (
        // マネージャーによる作成シフト
        resource.data.managerId == request.auth.uid ||
        // 自分が割り当てられているシフト
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'staff' &&
        request.auth.uid in resource.data.slots[].assignedStaff
      );
    }

    // シフト申請は自分のもののみ
    match /shiftRequests/{requestId} {
      allow read, create, update: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        // マネージャーは承認権限有り
        resource.data.managerId == request.auth.uid
      );
    }

    // チャットルームは参加者のみ
    match /simpleChatRooms/{roomId} {
      allow read, write: if request.auth != null && (
        resource.data.managerId == request.auth.uid ||
        resource.data.staffId == request.auth.uid
      );
    }

    // チャットメッセージは関連ルーム参加者のみ
    match /simpleChatMessages/{messageId} {
      allow read, create: if request.auth != null && (
        // チャットルームのアクセス権確認
        exists(/databases/$(database)/documents/simpleChatRooms/$(resource.data.chatRoomId)) &&
        (get(/databases/$(database)/documents/simpleChatRooms/$(resource.data.chatRoomId)).data.managerId == request.auth.uid ||
         get(/databases/$(database)/documents/simpleChatRooms/$(resource.data.chatRoomId)).data.staffId == request.auth.uid)
      );
    }
  }
}
```

#### B. アプリケーション層での権限チェック

```typescript
export class StaffAuthService {

  /**
   * スタッフの操作権限検証
   */
  static async validateStaffAccess(action: string, targetData: any): Promise<boolean> {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'staff') {
      return false;
    }

    switch (action) {
      case 'view_shift':
        return this.canViewShift(currentUser.uid, targetData);
      case 'submit_request':
        return this.canSubmitRequest(currentUser.uid, targetData);
      case 'send_message':
        return this.canSendMessage(currentUser.uid, targetData);
      default:
        return false;
    }
  }

  private static canViewShift(staffId: string, shift: Shift): boolean {
    return shift.slots.some(slot => slot.assignedStaff.includes(staffId));
  }

  private static canSubmitRequest(staffId: string, request: ShiftRequest): boolean {
    return request.userId === staffId;
  }

  private static canSendMessage(staffId: string, chatRoom: SimpleChatRoom): boolean {
    return chatRoom.staffId === staffId;
  }
}
```

### 2. データプライバシー保護

#### A. 個人情報の最小化

```typescript
// スタッフ向けに最小限の情報のみ返す
export const getStaffSafeUserInfo = (user: User): Partial<User> => ({
  uid: user.uid,
  name: user.name,
  displayName: user.displayName,
  position: user.position,
  // 時給等の機密情報は除外
});

// マネージャー情報も最小限に
export const getManagerSafeInfo = (manager: User): Partial<User> => ({
  uid: manager.uid,
  name: manager.name,
  shopName: manager.shopName,
  // 店舗住所・電話等の詳細は除外
});
```

#### B. ログ記録とモニタリング

```typescript
export class StaffAuditLogger {

  static async logStaffAction(
    staffId: string,
    action: string,
    details: Record<string, unknown>
  ) {
    // 個人情報をマスクしてログ記録
    const maskedDetails = maskSensitiveData(details);

    await addDoc(collection(db, 'staffActivityLogs'), {
      staffId,
      action,
      details: maskedDetails,
      timestamp: serverTimestamp(),
      ipAddress: await getHashedIP(), // IP は暗号化
      userAgent: hashUserAgent(navigator.userAgent)
    });
  }
}
```

---

## パフォーマンス最適化

### 1. スケーラビリティ考慮事項

#### A. 大量スタッフ対応

```typescript
// ページネーション付きスタッフ一覧（マネージャー用）
export const getPaginatedStaff = async (
  managerId: string,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
) => {
  let query = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff'),
    orderBy('name'),
    limit(pageSize)
  );

  if (lastDoc) {
    query = query(query, startAfter(lastDoc));
  }

  const snapshot = await getDocs(query);
  return {
    staff: snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)),
    lastDoc: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === pageSize
  };
};
```

#### B. リアルタイム接続の効率化

```typescript
export class StaffConnectionPool {
  private static connections = new Map<string, Unsubscribe>();

  /**
   * 接続プール管理で重複接続防止
   */
  static addConnection(key: string, unsubscribe: Unsubscribe) {
    // 既存接続があれば切断
    if (this.connections.has(key)) {
      this.connections.get(key)!();
    }
    this.connections.set(key, unsubscribe);
  }

  static removeConnection(key: string) {
    const unsubscribe = this.connections.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.connections.delete(key);
    }
  }

  static cleanupAllConnections() {
    this.connections.forEach(unsubscribe => unsubscribe());
    this.connections.clear();
    console.log('🧹 All staff connections cleaned up');
  }
}
```

### 2. キャッシュ戦略

#### A. スマートキャッシング

```typescript
export class StaffDataCache {
  private static cache = new Map<string, { data: any; expiry: number; }>();

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  static set<T>(key: string, data: T, ttlMinutes: number = 15) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    });
  }

  static invalidate(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

#### B. 段階的データ読み込み

```typescript
export class StaffDataLoader {

  /**
   * 優先度に基づく段階的データ読み込み
   */
  static async loadStaffDashboard(staffId: string) {
    // Phase 1: 即座に必要な基本データ
    const [userProfile, todayShifts] = await Promise.all([
      this.loadUserProfile(staffId),
      this.loadTodayShifts(staffId)
    ]);

    // UI更新
    updateStaffDashboard({ userProfile, todayShifts });

    // Phase 2: 重要だが即座でなくても良いデータ
    setTimeout(async () => {
      const [requests, chatRooms] = await Promise.all([
        this.loadShiftRequests(staffId),
        this.loadChatRooms(staffId)
      ]);
      updateStaffDashboard({ requests, chatRooms });
    }, 100);

    // Phase 3: 履歴やレポート等の補助データ
    setTimeout(async () => {
      const [shiftHistory, stats] = await Promise.all([
        this.loadShiftHistory(staffId),
        this.loadPersonalStats(staffId)
      ]);
      updateStaffDashboard({ shiftHistory, stats });
    }, 500);
  }
}
```

---

## 実装ガイドライン

### 1. スタッフアプリケーション構成

#### A. 推奨ページ構成

```
/staff
├── /dashboard          # ダッシュボード（今日のシフト・通知）
├── /shifts             # シフト一覧・詳細
├── /requests           # 申請履歴・新規申請
├── /chat              # チャット一覧・会話
├── /profile           # プロフィール・設定
└── /notifications     # 通知履歴
```

#### B. 状態管理（推奨：Context API）

```typescript
interface StaffContextType {
  // 基本データ
  user: User | null;
  shifts: Shift[];
  requests: ShiftRequest[];
  chatRooms: SimpleChatRoom[];

  // 状態管理
  loading: {
    shifts: boolean;
    requests: boolean;
    chat: boolean;
  };

  // エラー状態
  errors: {
    shifts: string | null;
    requests: string | null;
    chat: string | null;
  };

  // アクション
  actions: {
    refreshShifts: () => Promise<void>;
    submitRequest: (request: Partial<ShiftRequest>) => Promise<void>;
    sendMessage: (roomId: string, content: string) => Promise<void>;
  };
}
```

### 2. エラーハンドリング

#### A. ユーザーフレンドリーなエラー表示

```typescript
export class StaffErrorHandler {

  static handleFirestoreError(error: FirestoreError): string {
    switch (error.code) {
      case 'permission-denied':
        return 'この操作を行う権限がありません。管理者にお問い合わせください。';
      case 'unavailable':
        return 'サービスが一時的に利用できません。しばらく待ってから再試行してください。';
      case 'deadline-exceeded':
        return '通信がタイムアウトしました。インターネット接続を確認してください。';
      default:
        return '予期しないエラーが発生しました。時間をおいて再試行してください。';
    }
  }

  static showError(error: string) {
    showToast({
      type: 'error',
      title: 'エラー',
      message: error,
      duration: 8000,
      action: {
        label: '再試行',
        onClick: () => window.location.reload()
      }
    });
  }
}
```

### 3. テスト戦略

#### A. ユニットテスト例

```typescript
describe('StaffRealtimeService', () => {
  test('should subscribe to staff shifts correctly', async () => {
    const mockStaffId = 'test-staff-001';
    const mockCallback = jest.fn();

    const unsubscribe = StaffRealtimeService.subscribeToMyShifts(
      mockStaffId,
      mockCallback
    );

    // Firestoreモックでデータ変更をシミュレート
    await firestore.collection('shifts').add({
      managerId: 'test-manager-001',
      slots: [{ assignedStaff: [mockStaffId] }]
    });

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled();
    });

    unsubscribe();
  });
});
```

---

## メンテナンスとモニタリング

### 1. パフォーマンス監視

```typescript
export class StaffPerformanceMonitor {

  static trackRealtimeLatency() {
    const startTime = performance.now();

    return (eventType: string) => {
      const latency = performance.now() - startTime;
      console.log(`📊 ${eventType} latency: ${latency.toFixed(2)}ms`);

      // 閾値超過時のアラート
      if (latency > 1000) {
        console.warn(`⚠️ High latency detected: ${latency}ms for ${eventType}`);
      }
    };
  }

  static trackMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log('💾 Memory usage:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        allocated: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
      });
    }
  }
}
```

### 2. ログ収集

```typescript
export class StaffLogger {

  static info(message: string, data?: any) {
    console.log(`ℹ️ [STAFF] ${message}`, data);
    this.sendToAnalytics('info', message, data);
  }

  static warn(message: string, data?: any) {
    console.warn(`⚠️ [STAFF] ${message}`, data);
    this.sendToAnalytics('warn', message, data);
  }

  static error(message: string, error?: Error) {
    console.error(`❌ [STAFF] ${message}`, error);
    this.sendToAnalytics('error', message, { error: error?.message });
  }

  private static sendToAnalytics(level: string, message: string, data?: any) {
    // 実際の分析ツール（Google Analytics、Sentry等）に送信
    if (typeof gtag !== 'undefined') {
      gtag('event', 'staff_log', {
        level,
        message,
        data: JSON.stringify(data)
      });
    }
  }
}
```

---

## 将来拡張計画

### 1. 予定機能

- **プッシュ通知**: PWA対応とService Worker
- **音声メッセージ**: WebRTC APIを活用
- **ファイル共有**: Firebase Storageとの連携
- **多言語対応**: i18n国際化
- **ダークモード**: テーマ切り替え機能
- **オフライン完全対応**: IndexedDBとの同期

### 2. スケーラビリティ向上

- **地域別データ分散**: Multi-regionデプロイ
- **CDN活用**: 静的アセットの配信最適化
- **マイクロサービス化**: 機能別API分離
- **AI活用**: 自動シフト提案・最適化

---

**最終更新**: 2025年9月21日
**バージョン**: v1.0
**担当**: フロントエンド開発チーム

---

## 関連ドキュメント

- [Shifty データベースアーキテクチャ](./database-architecture.md)
- [マネージャー向けデータベース使用法](./manager-database-usage.md)
- [Firestore最適化ガイド](./firestore-optimization.md)