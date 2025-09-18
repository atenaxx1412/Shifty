# Shifty データベースアーキテクチャ

## 概要

ShiftyシステムはGoogle Firebase Firestoreをメインデータベースとして使用し、シフト管理・スタッフ管理・予算管理を統合した包括的なワークフォース管理システムです。

### アーキテクチャの特徴

- **NoSQL設計**: Firestoreのドキュメント指向データベースを活用
- **役割ベースアクセス制御**: Root/Manager/Staffによる階層型権限管理
- **リアルタイムデータ同期**: onSnapshot APIによる即座の状態反映
- **型安全性**: TypeScriptによる厳密な型定義とランタイム安全性
- **分散データ設計**: 店舗別データ分離とクロス店舗統計のバランス
- **最適化されたクエリ**: 複合インデックスとクエリパフォーマンス最適化

## データベース設定

### Firebase設定 (`src/lib/firebase.ts`)

```typescript
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const db = getFirestore(app);
```

### 必須インデックス設定

**パフォーマンス最適化のために以下の複合インデックスが必要:**

1. **shifts コレクション**
   - `['managerId', 'date', '__name__']`
   - 目的: 週次統計クエリ最適化

2. **shiftRequests コレクション**
   - `['managerId', 'status', '__name__']`
   - 目的: 承認待ちリクエスト高速取得

3. **budgetCalculations コレクション**
   - `['managerId', 'period.start', 'period.end', '__name__']`
   - 目的: 期間別予算計算

## コレクション設計

### 1. users コレクション

**主要用途**: 全ユーザー（Root/Manager/Staff）の情報管理

```typescript
interface User {
  uid: string;                    // Firestore document ID
  userId: string;                 // ログイン用ID
  password: string;               // ハッシュ化パスワード
  name: string;                   // 氏名
  role: 'root' | 'manager' | 'staff';
  managerId?: string;             // Staff用：所属店長のUID

  // Manager固有
  shopName?: string;              // 店舗名
  shopAddress?: string;           // 住所
  shopPhone?: string;             // 電話番号
  shopEmail?: string;             // 店舗メール

  // Staff固有
  hourlyRate?: number;            // 時給
  maxHoursPerWeek?: number;       // 週最大労働時間
  skills?: string[];              // スキル配列
  employmentType?: string;        // 雇用形態
  availability?: object;          // 勤務可能時間

  createdAt: Date;
  updatedAt: Date;
}
```

**アクセスパターン:**
- Root: 全ユーザーアクセス可能
- Manager: `where('managerId', '==', currentUser.uid)` で自店舗スタッフのみ
- Staff: 自分のドキュメントのみ

### 2. shifts コレクション

**主要用途**: シフトスケジュール管理

```typescript
interface Shift {
  shiftId: string;                // ドキュメントID
  managerId: string;              // 作成店長のUID
  date: Date;                     // シフト日付
  slots: ShiftSlot[];             // 時間スロット配列
  status: 'draft' | 'published' | 'completed';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ShiftSlot {
  slotId: string;
  startTime: string;              // "09:00"
  endTime: string;                // "17:00"
  requiredStaff: number;          // 必要人数
  assignedStaff: string[];        // 割り当てスタッフUID配列
  positions?: string[];           // 職種
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

**重要なクエリパターン:**
```typescript
// 週次統計取得
const weeklyShiftsQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', managerId)
  // JavaScript側で日付フィルタリング（インデックス最適化）
);

// 店長の全シフト
const managerShiftsQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', managerId),
  orderBy('date', 'desc')
);
```

### 3. shiftRequests コレクション

**主要用途**: スタッフからのシフト希望・変更申請

```typescript
interface ShiftRequest {
  requestId: string;
  userId: string;                 // 申請スタッフ
  managerId: string;              // 承認者（店長）
  shiftId?: string;               // 関連シフト
  date: Date;
  preference: 'preferred' | 'available' | 'unavailable';
  timeSlots?: { start: string; end: string }[];
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}
```

### 4. shiftExchanges コレクション

**主要用途**: スタッフ間のシフト交換管理

```typescript
interface ShiftExchange {
  exchangeId: string;
  fromUserId: string;             // 交換元スタッフ
  toUserId?: string;              // 交換先スタッフ
  managerId: string;              // 承認者
  shiftId: string;
  shiftSlotId: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 5. budgetCalculations コレクション

**主要用途**: 人件費計算と予算管理

```typescript
interface BudgetCalculation {
  calculationId: string;
  managerId: string;
  period: {
    start: Date;
    end: Date;
    name: string;                 // "2025年3月"
  };
  summary: {
    totalShifts: number;
    totalHours: number;
    totalBaseCost: number;
    totalOvertimeCost: number;
    totalBonusCost: number;
    totalCost: number;
    budgetLimit?: number;
    budgetVariance: number;
  };
  assumptions: {
    baseHourlyRate: Record<string, number>;
    overtimeMultiplier: number;
    nightShiftBonus: number;
    holidayBonus: number;
    socialInsuranceRate: number;
    taxRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 6. activityLogs コレクション

**主要用途**: システム監査ログ（Root用）

```typescript
interface ActivityLog {
  logId: string;
  userId?: string;                // 操作者（匿名の場合null）
  userName?: string;
  userRole?: UserRole;
  action: string;                 // "Login", "Create Shift", etc.
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}
```

### 7. systemSettings コレクション

**主要用途**: システム全体設定（Root管理）

```typescript
interface SystemSettings {
  settingId: string;
  category: string;               // "security", "notification", etc.
  key: string;
  value: unknown;
  description: string;
  editableBy: UserRole[];
  lastModifiedBy: string;
  lastModifiedAt: Date;
}
```

## データアクセス制御パターン

### 役割ベースアクセス制御（RBAC）

**Root ユーザー**
- 全コレクション・全ドキュメントへの読み取り・書き込み権限
- システム設定・監査ログの管理
- 全店舗の統計とレポート生成

**Manager ユーザー**
- 自店舗データのみアクセス（`managerId` でフィルタリング）
- 自店舗スタッフの管理
- 自店舗シフト・予算の管理

**Staff ユーザー**
- 自分のユーザー情報のみ編集可能
- 自分に関連するシフト・リクエストの読み取り
- シフト希望・交換申請の作成

### アクセス制御実装例

```typescript
// 権限チェック関数
const isAuthorized = (requiredRoles: UserRole[]) => {
  if (currentUser.role === 'root') return true; // Root is superuser
  return requiredRoles.includes(currentUser.role);
};

// Manager用データアクセス
const getManagerData = async (managerId: string) => {
  // 自店舗スタッフ
  const staffQuery = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff')
  );

  // 自店舗シフト
  const shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  );

  return Promise.all([
    getDocs(staffQuery),
    getDocs(shiftsQuery)
  ]);
};
```

## クエリ最適化戦略

### 1. 複合インデックス戦略

**重要な複合インデックス:**
- `shifts`: `['managerId', 'date']` - 日付範囲クエリ用
- `users`: `['managerId', 'role']` - スタッフ一覧用
- `shiftRequests`: `['managerId', 'status']` - 承認待ち取得用

### 2. JavaScript側フィルタリング

**Firestoreインデックス制限を回避:**
```typescript
// ✅ 効率的: managerId単独でクエリ → JavaScript側で日付フィルタ
const shiftsQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', managerId)
);

const allShifts = await getDocs(shiftsQuery);
const thisWeekShifts = allShifts.docs.filter(doc => {
  const shiftDate = doc.data().date.toDate();
  return shiftDate >= weekStart && shiftDate <= weekEnd;
});
```

### 3. バッチクエリとキャッシュ

**並列データ取得:**
```typescript
const [staffStats, shiftStats, approvalStats, budgetStats] = await Promise.all([
  getStaffCount(managerId),
  getWeeklyShiftsStats(managerId),
  getPendingApprovalsStats(managerId),
  getMonthlyBudgetStats(managerId)
]);
```

## パフォーマンス監視とメトリクス

### 1. クエリパフォーマンス指標

- **平均クエリ時間**: < 200ms
- **複合クエリ成功率**: > 99%
- **リアルタイム更新遅延**: < 100ms
- **同時接続数**: 最大100店舗

### 2. ボトルネック識別

```typescript
// パフォーマンス計測
console.time('query-performance');
const result = await getDocs(complexQuery);
console.timeEnd('query-performance');
console.log(`Query returned ${result.size} documents`);
```

### 3. エラーハンドリングとフォールバック

```typescript
try {
  const liveData = await getDocs(primaryQuery);
  return processLiveData(liveData);
} catch (error) {
  console.error('Primary query failed:', error);
  // フォールバック値を返す
  return getDefaultStats();
}
```

## セキュリティとコンプライアンス

### 1. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && (
        resource.data.role == 'root' ||
        resource.data.uid == request.auth.uid ||
        (resource.data.role == 'staff' && resource.data.managerId == request.auth.uid)
      );
    }

    // Shifts collection
    match /shifts/{shiftId} {
      allow read, write: if request.auth != null && (
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'root' ||
        resource.data.managerId == request.auth.uid
      );
    }
  }
}
```

### 2. データ暗号化

- **保存時暗号化**: Firestore標準のAES-256暗号化
- **転送時暗号化**: HTTPS/TLS 1.3
- **パスワードハッシュ化**: bcrypt with salt rounds

### 3. 監査ログ

```typescript
const logActivity = async (action: string, userId: string, details: object) => {
  await addDoc(collection(db, 'activityLogs'), {
    userId,
    action,
    details,
    timestamp: serverTimestamp(),
    ipAddress: getClientIP(),
    userAgent: navigator.userAgent
  });
};
```

## 障害対応とディザスタリカバリ

### 1. データバックアップ戦略

- **自動バックアップ**: Firebase標準バックアップ（日次）
- **ポイントインタイム復旧**: 最大35日間
- **クロスリージョンレプリケーション**: アジア太平洋リージョン

### 2. 障害監視

```typescript
// 接続状態監視
const monitorConnection = () => {
  const unsubscribe = onSnapshot(
    doc(db, 'system', 'health'),
    { includeMetadataChanges: true },
    (doc) => {
      if (doc.metadata.fromCache) {
        console.warn('🔴 Offline mode - using cached data');
        showOfflineIndicator();
      } else {
        console.log('🟢 Online mode - live data');
        hideOfflineIndicator();
      }
    }
  );
};
```

### 3. 復旧手順

1. **サービス停止検知** → 自動フェイルオーバー
2. **データ整合性チェック** → 不整合データの修復
3. **ユーザー通知** → システム状態の透明性確保
4. **段階的復旧** → 優先度の高い機能から順次復旧

---

**最終更新**: 2025年9月18日
**バージョン**: v2.0
**担当**: システムアーキテクチャチーム