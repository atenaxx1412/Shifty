# Root ルート データベース使用パターン

## 概要

`/root` ルートは Shifty システムの最高管理者（Root ユーザー）向けの機能群で、システム全体のデータベース操作とクロス店舗統計管理を担当します。

### 主要特徴

- **全権限アクセス**: 全コレクション・全ドキュメントへの読み取り・書き込み権限
- **店舗横断統計**: 複数店舗のデータを集約した分析とレポート
- **システム監視**: データベース健全性・パフォーマンス・セキュリティの監視
- **監査ログ**: 全システム活動の記録と分析
- **メンテナンス操作**: バックアップ・復旧・データ整合性チェック

## ページ別データベース使用パターン

### 1. ダッシュボード (`/root/page.tsx`)

**目的**: システム全体の統計とリアルタイム監視

#### データ取得パターン

```typescript
// システム全体統計の並列取得
const [totalUsers, totalManagers, totalShifts, securityAlerts] = await Promise.all([
  getDocs(collection(db, 'users')),                    // 総ユーザー数
  getDocs(query(collection(db, 'users'),
    where('role', '==', 'manager'))),                  // 店長数
  getDocs(collection(db, 'shifts')),                   // 総シフト数
  getDocs(query(collection(db, 'activityLogs'),
    where('success', '==', false),
    orderBy('timestamp', 'desc'), limit(10)))          // セキュリティアラート
]);
```

#### リアルタイム監視

```typescript
// システム活動のリアルタイム監視
const unsubscribe = onSnapshot(
  query(collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(4)),
  (snapshot) => {
    const recentActivities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setRecentActivities(recentActivities);
  }
);
```

#### 統計計算

```typescript
// 店舗パフォーマンス分析
const calculateStorePerformance = async () => {
  const stores = await getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'manager')
  ));

  const storeStats = await Promise.all(
    stores.docs.map(async (storeDoc) => {
      const managerId = storeDoc.id;
      const [staffCount, shiftsCount, budgetSum] = await Promise.all([
        getDocs(query(collection(db, 'users'),
          where('managerId', '==', managerId),
          where('role', '==', 'staff'))),
        getDocs(query(collection(db, 'shifts'),
          where('managerId', '==', managerId))),
        getDocs(query(collection(db, 'budgetCalculations'),
          where('managerId', '==', managerId)))
      ]);

      return {
        storeId: managerId,
        storeName: storeDoc.data().shopName,
        staffCount: staffCount.size,
        shiftsCount: shiftsCount.size,
        totalBudget: budgetSum.docs.reduce((sum, doc) =>
          sum + (doc.data().summary?.totalCost || 0), 0)
      };
    })
  );

  return storeStats;
};
```

### 2. 店舗管理 (`/root/shops/page.tsx`)

**目的**: 全店舗（Manager）の管理とパフォーマンス分析

#### Manager データ管理

```typescript
// 全店長の詳細情報取得
const getAllManagers = async () => {
  const managersQuery = query(
    collection(db, 'users'),
    where('role', '==', 'manager'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(managersQuery);
  const managers = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const managerData = doc.data();

      // 各店長のスタッフ数を並列取得
      const staffQuery = query(
        collection(db, 'users'),
        where('managerId', '==', doc.id),
        where('role', '==', 'staff')
      );
      const staffSnapshot = await getDocs(staffQuery);

      return {
        ...managerData,
        uid: doc.id,
        staffCount: staffSnapshot.size,
        lastActive: managerData.updatedAt?.toDate() || new Date()
      };
    })
  );

  return managers;
};
```

#### 店舗作成・編集

```typescript
// 新規店長アカウント作成
const createManagerAccount = async (managerData: Partial<User>) => {
  const docRef = await addDoc(collection(db, 'users'), {
    ...managerData,
    role: 'manager',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 監査ログ記録
  await logActivity('Create Manager', currentUser.uid, {
    targetManagerId: docRef.id,
    shopName: managerData.shopName
  });

  return docRef.id;
};

// 店長情報更新
const updateManagerInfo = async (managerId: string, updateData: Partial<User>) => {
  await updateDoc(doc(db, 'users', managerId), {
    ...updateData,
    updatedAt: serverTimestamp()
  });

  await logActivity('Update Manager', currentUser.uid, {
    targetManagerId: managerId,
    updatedFields: Object.keys(updateData)
  });
};
```

### 3. ユーザー管理 (`/root/users/page.tsx`)

**目的**: 全ユーザーの一覧・編集・権限管理

#### 全ユーザー取得

```typescript
// 役割別ユーザー統計
const getUsersByRole = async () => {
  const [rootUsers, managerUsers, staffUsers] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'root'))),
    getDocs(query(collection(db, 'users'), where('role', '==', 'manager'))),
    getDocs(query(collection(db, 'users'), where('role', '==', 'staff')))
  ]);

  return {
    root: rootUsers.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    managers: managerUsers.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    staff: staffUsers.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
};
```

#### ユーザー権限変更

```typescript
// ユーザー役割変更
const changeUserRole = async (userId: string, newRole: UserRole, reason: string) => {
  const userDoc = await getDoc(doc(db, 'users', userId));
  const currentRole = userDoc.data()?.role;

  await updateDoc(doc(db, 'users', userId), {
    role: newRole,
    updatedAt: serverTimestamp()
  });

  // 重要な権限変更は監査ログに記録
  await logActivity('Role Change', currentUser.uid, {
    targetUserId: userId,
    previousRole: currentRole,
    newRole: newRole,
    reason: reason
  });
};
```

### 4. データベース管理 (`/root/database/page.tsx`)

**目的**: Firestore データベースの状態監視と管理

#### データベース統計取得

```typescript
// データベース統計の実取得
const fetchDatabaseStats = async () => {
  const collectionNames = ['users', 'activityLogs', 'shifts', 'systemSettings', 'budgetCalculations'];
  let totalDocuments = 0;
  let activeCollections = 0;

  // 各コレクションのドキュメント数カウント
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

  // ストレージ使用量の推定
  const estimatedStorageUsed = Math.round((totalDocuments * 0.5) / 10) / 100;

  return {
    totalCollections: activeCollections,
    totalDocuments: totalDocuments,
    storageUsed: estimatedStorageUsed,
    storageLimit: 1024,
    lastBackup: new Date(),
    systemHealth: determineSystemHealth(totalDocuments, activeCollections)
  };
};
```

#### データ整合性チェック

```typescript
// データ整合性検証
const verifyDataIntegrity = async () => {
  // 孤立したスタッフレコードチェック
  const staffUsers = await getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'staff')
  ));

  const orphanedStaff = [];

  for (const staffDoc of staffUsers.docs) {
    const staffData = staffDoc.data();
    if (staffData.managerId) {
      try {
        const managerDoc = await getDoc(doc(db, 'users', staffData.managerId));
        if (!managerDoc.exists() || managerDoc.data()?.role !== 'manager') {
          orphanedStaff.push({
            staffId: staffDoc.id,
            staffName: staffData.name,
            invalidManagerId: staffData.managerId
          });
        }
      } catch (error) {
        orphanedStaff.push({
          staffId: staffDoc.id,
          staffName: staffData.name,
          error: error.message
        });
      }
    }
  }

  return {
    orphanedStaff,
    totalStaffChecked: staffUsers.size,
    integrityIssues: orphanedStaff.length
  };
};
```

### 5. システムログ (`/root/logs/page.tsx`)

**目的**: 監査ログとセキュリティイベントの監視

#### ログクエリパターン

```typescript
// セキュリティログ取得
const getSecurityLogs = async (timeRange: 'today' | 'week' | 'month') => {
  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now);
      break;
    case 'month':
      startDate = startOfMonth(now);
      break;
  }

  const logsQuery = query(
    collection(db, 'activityLogs'),
    where('timestamp', '>=', Timestamp.fromDate(startDate)),
    where('action', 'in', ['Login Failed', 'Unauthorized Access', 'Role Change']),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  const snapshot = await getDocs(logsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate()
  }));
};
```

#### ログイン試行分析

```typescript
// 失敗ログイン分析
const analyzeFailedLogins = async () => {
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedLoginsQuery = query(
    collection(db, 'activityLogs'),
    where('timestamp', '>=', Timestamp.fromDate(last24Hours)),
    where('action', '==', 'Login Failed'),
    orderBy('timestamp', 'desc')
  );

  const snapshot = await getDocs(failedLoginsQuery);
  const failedAttempts = snapshot.docs.map(doc => doc.data());

  // IP別集計
  const ipAnalysis = failedAttempts.reduce((acc, attempt) => {
    const ip = attempt.ipAddress || 'unknown';
    acc[ip] = (acc[ip] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // 疑わしいIPアドレス（5回以上失敗）
  const suspiciousIPs = Object.entries(ipAnalysis)
    .filter(([_, count]) => count >= 5)
    .map(([ip, count]) => ({ ip, failedAttempts: count }));

  return {
    totalFailedAttempts: failedAttempts.length,
    suspiciousIPs,
    timeRange: '24時間'
  };
};
```

### 6. レポート生成 (`/root/reports/page.tsx`)

**目的**: システム全体のレポートと分析

#### クロス店舗分析

```typescript
// 全店舗パフォーマンスレポート
const generateStorePerformanceReport = async (period: 'week' | 'month' | 'quarter') => {
  const managers = await getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'manager')
  ));

  const storeReports = await Promise.all(
    managers.docs.map(async (managerDoc) => {
      const managerId = managerDoc.id;
      const managerData = managerDoc.data();

      // 期間別データ取得
      const [staffData, shiftsData, budgetData] = await Promise.all([
        getStoreStaffMetrics(managerId, period),
        getStoreShiftMetrics(managerId, period),
        getStoreBudgetMetrics(managerId, period)
      ]);

      return {
        storeId: managerId,
        storeName: managerData.shopName,
        storeAddress: managerData.shopAddress,
        metrics: {
          staff: staffData,
          shifts: shiftsData,
          budget: budgetData,
          efficiency: calculateStoreEfficiency(staffData, shiftsData, budgetData)
        }
      };
    })
  );

  return {
    period,
    generatedAt: new Date(),
    storeCount: storeReports.length,
    stores: storeReports,
    summary: calculateSystemSummary(storeReports)
  };
};
```

## セキュリティとアクセス制御

### 認証チェック

全 Root ページで必須の認証チェック:

```typescript
<ProtectedRoute allowedRoles={['root']}>
  {/* Root専用コンテンツ */}
</ProtectedRoute>
```

### 操作監査

重要な操作は必ず監査ログに記録:

```typescript
const logActivity = async (action: string, userId: string, details: object) => {
  await addDoc(collection(db, 'activityLogs'), {
    userId,
    userName: currentUser.name,
    userRole: currentUser.role,
    action,
    details,
    timestamp: serverTimestamp(),
    ipAddress: getClientIP(),
    userAgent: navigator.userAgent,
    success: true
  });
};
```

## パフォーマンス最適化

### 1. 並列クエリ実行

```typescript
// ✅ 効率的: 複数の独立したクエリを並列実行
const [usersData, shiftsData, logsData] = await Promise.all([
  getDocs(collection(db, 'users')),
  getDocs(collection(db, 'shifts')),
  getDocs(query(collection(db, 'activityLogs'),
    orderBy('timestamp', 'desc'), limit(10)))
]);
```

### 2. キャッシュとメモ化

```typescript
// システム統計のキャッシュ（5分間）
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedStats: SystemStats | null = null;
let cacheTimestamp = 0;

const getSystemStats = async (): Promise<SystemStats> => {
  const now = Date.now();

  if (cachedStats && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedStats;
  }

  cachedStats = await fetchFreshSystemStats();
  cacheTimestamp = now;
  return cachedStats;
};
```

### 3. リアルタイム接続管理

```typescript
// 不要な接続の自動切断
useEffect(() => {
  const unsubscribes: Unsubscribe[] = [];

  // 必要なリアルタイム接続のみ確立
  if (activeTab === 'dashboard') {
    unsubscribes.push(subscribeToSystemStats());
  }
  if (activeTab === 'logs') {
    unsubscribes.push(subscribeToSecurityLogs());
  }

  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
}, [activeTab]);
```

## エラーハンドリングとフォールバック

### 権限エラー処理

```typescript
const handleUnauthorizedAccess = (error: any) => {
  if (error.code === 'permission-denied') {
    logActivity('Unauthorized Access Attempt', currentUser.uid, {
      attemptedAction: error.message,
      timestamp: new Date()
    });

    // ユーザーを安全なページにリダイレクト
    router.push('/unauthorized');
  }
};
```

### データ取得失敗時のフォールバック

```typescript
const safeDataFetch = async <T>(
  fetchFunction: () => Promise<T>,
  fallbackData: T
): Promise<T> => {
  try {
    return await fetchFunction();
  } catch (error) {
    console.error('Data fetch failed, using fallback:', error);
    return fallbackData;
  }
};
```

---

**最終更新**: 2025年9月18日
**バージョン**: v2.0
**担当**: システム管理チーム