# Firestore クエリ最適化とインデックス戦略

## 概要

Shifty システムでは、Firestore の制限を理解した上で、パフォーマンスとコストのバランスを取った最適化戦略を採用しています。複合インデックスの制限を回避し、JavaScript側フィルタリングと並列クエリを効果的に組み合わせることで、高速で効率的なデータアクセスを実現しています。

## Firestore の制限と対策

### 1. 複合インデックスの制限

**問題**: Firestore では `where` 句と `orderBy` の組み合わせに複合インデックスが必要

```typescript
// ❌ 複合インデックスが必要（コストが高い）
const expensiveQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', managerId),
  where('date', '>=', startDate),
  where('date', '<=', endDate),
  orderBy('date', 'desc')
);
```

**解決策**: 単一フィールドクエリ + JavaScript側フィルタリング

```typescript
// ✅ 単一フィールドクエリ（インデックス不要）
const optimizedQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', managerId)
);

const allShifts = await getDocs(optimizedQuery);

// JavaScript側で日付フィルタリング
const filteredShifts = allShifts.docs.filter(doc => {
  const shiftDate = doc.data().date?.toDate();
  return shiftDate && shiftDate >= startDate && shiftDate <= endDate;
});
```

### 2. 配列クエリの制限

**問題**: 配列内検索は `array-contains` のみで複雑な条件指定が困難

```typescript
// ❌ 複雑な配列クエリは不可能
// スタッフIDが特定のリストに含まれ、かつ日付条件も満たすシフト
```

**解決策**: 段階的クエリと結果の結合

```typescript
// ✅ 段階的アプローチ
const getShiftsForStaffList = async (staffIds: string[], dateRange: DateRange) => {
  // まず該当する全シフトを取得
  const allShifts = await getDocs(query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  ));

  // JavaScript側で複雑な条件をフィルタリング
  const matchingShifts = allShifts.docs.filter(doc => {
    const shiftData = doc.data();
    const shiftDate = shiftData.date?.toDate();

    // 日付条件チェック
    if (!isDateInRange(shiftDate, dateRange)) return false;

    // スタッフ配列との交差チェック
    return shiftData.slots?.some((slot: any) =>
      slot.assignedStaff?.some((assignedId: string) =>
        staffIds.includes(assignedId)
      )
    );
  });

  return matchingShifts;
};
```

## 必須インデックス設定

### 現在必要なインデックス

**1. shifts コレクション**

```javascript
// managerId による基本クエリ用
{
  collectionGroup: 'shifts',
  fields: [
    { fieldPath: 'managerId', order: 'ASCENDING' },
    { fieldPath: '__name__', order: 'ASCENDING' }
  ]
}
```

**2. shiftRequests コレクション**

```javascript
// 承認待ちリクエスト高速取得用
{
  collectionGroup: 'shiftRequests',
  fields: [
    { fieldPath: 'managerId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: '__name__', order: 'ASCENDING' }
  ]
}

// スタッフ別リクエスト履歴用
{
  collectionGroup: 'shiftRequests',
  fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
    { fieldPath: '__name__', order: 'ASCENDING' }
  ]
}
```

**3. users コレクション**

```javascript
// Manager配下のスタッフ取得用
{
  collectionGroup: 'users',
  fields: [
    { fieldPath: 'managerId', order: 'ASCENDING' },
    { fieldPath: 'role', order: 'ASCENDING' },
    { fieldPath: '__name__', order: 'ASCENDING' }
  ]
}
```

### インデックス作成の自動化

```typescript
// scripts/create-firestore-indexes.ts
const requiredIndexes = [
  {
    collection: 'shifts',
    fields: ['managerId', '__name__'],
    purpose: 'Manager shifts basic query'
  },
  {
    collection: 'shiftRequests',
    fields: ['managerId', 'status', '__name__'],
    purpose: 'Pending approvals query'
  },
  {
    collection: 'users',
    fields: ['managerId', 'role', '__name__'],
    purpose: 'Staff by manager query'
  }
];

// インデックス作成URLの自動生成
requiredIndexes.forEach(index => {
  console.log(`Create index for ${index.collection}:`);
  console.log(`Purpose: ${index.purpose}`);
  console.log(`URL: ${generateIndexCreationURL(index)}`);
});
```

## クエリ最適化パターン

### 1. 並列クエリ実行

**基本パターン**:

```typescript
// ✅ 効率的: 複数のクエリを並列実行
const getManagerDashboardData = async (managerId: string) => {
  const [staffData, shiftsData, requestsData, budgetData] = await Promise.all([
    // スタッフ数統計
    getDocs(query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    )),

    // シフト統計
    getDocs(query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    )),

    // 承認待ちリクエスト
    getDocs(query(
      collection(db, 'shiftRequests'),
      where('managerId', '==', managerId),
      where('status', '==', 'pending')
    )),

    // 最新予算計算
    getDocs(query(
      collection(db, 'budgetCalculations'),
      where('managerId', '==', managerId),
      orderBy('createdAt', 'desc'),
      limit(1)
    ))
  ]);

  return {
    staffCount: staffData.size,
    shiftsData: shiftsData.docs,
    pendingRequests: requestsData.size,
    latestBudget: budgetData.docs[0]?.data()
  };
};
```

### 2. JavaScript側フィルタリング戦略

**日付範囲フィルタリング**:

```typescript
// StatsService の最適化された週次統計
const getWeeklyShiftsStats = async (managerId: string) => {
  // 1. managerId のみでクエリ（単一フィールド、高速）
  const shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  );

  const allShifts = await getDocs(shiftsQuery);

  // 2. JavaScript側で日付フィルタリング
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { locale: ja });
  const thisWeekEnd = endOfWeek(now, { locale: ja });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: ja });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: ja });

  let currentWeekShifts = 0;
  let previousWeekShifts = 0;

  allShifts.forEach(doc => {
    const shiftData = doc.data();
    const shiftDate = shiftData.date?.toDate();

    if (shiftDate && shiftData.slots) {
      const slotsCount = shiftData.slots.length;

      if (isWithinInterval(shiftDate, { start: thisWeekStart, end: thisWeekEnd })) {
        currentWeekShifts += slotsCount;
      }

      if (isWithinInterval(shiftDate, { start: lastWeekStart, end: lastWeekEnd })) {
        previousWeekShifts += slotsCount;
      }
    }
  });

  return {
    current: currentWeekShifts,
    previous: previousWeekShifts,
    trend: calculateTrend(currentWeekShifts, previousWeekShifts)
  };
};
```

**複雑な条件フィルタリング**:

```typescript
// 予算計算での複雑な条件処理
const calculateMonthlyBudget = async (managerId: string) => {
  // 1. 基本データを並列取得
  const [staffSnapshot, shiftsSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    )),
    getDocs(query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    ))
  ]);

  // 2. スタッフ時給マップ構築
  const staffRates = new Map<string, number>();
  staffSnapshot.forEach(doc => {
    const staffData = doc.data();
    if (staffData.hourlyRate) {
      staffRates.set(doc.id, staffData.hourlyRate);
    }
  });

  // 3. JavaScript側で複雑な予算計算
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());
  let totalBudget = 0;

  shiftsSnapshot.forEach(doc => {
    const shiftData = doc.data();
    const shiftDate = shiftData.date?.toDate();

    // 日付条件チェック
    if (!shiftDate || !isWithinInterval(shiftDate, { start: monthStart, end: monthEnd })) {
      return;
    }

    // スロット別予算計算
    shiftData.slots?.forEach((slot: any) => {
      slot.assignedStaff?.forEach((staffId: string) => {
        const hourlyRate = staffRates.get(staffId) || 1000;
        const hours = calculateSlotDuration(slot.startTime, slot.endTime);
        const baseCost = hourlyRate * hours;

        // 深夜・休日手当の計算
        const multiplier = getBonusMultiplier(shiftDate, slot);
        const totalCost = baseCost * multiplier;

        totalBudget += totalCost;
      });
    });
  });

  return Math.round(totalBudget / 1000); // k円単位
};
```

### 3. キャッシュ戦略

**メモリキャッシュ**:

```typescript
// スタッフ情報のキャッシュ
class StaffCache {
  private static cache = new Map<string, {
    data: User[];
    timestamp: number;
  }>();

  private static CACHE_DURATION = 5 * 60 * 1000; // 5分

  static async getStaff(managerId: string): Promise<User[]> {
    const cached = this.cache.get(managerId);
    const now = Date.now();

    // キャッシュが有効な場合
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      console.log('🎯 Using cached staff data');
      return cached.data;
    }

    // 新しいデータを取得
    console.log('🔄 Fetching fresh staff data');
    const freshData = await UserService.getStaffByManager(managerId);

    // キャッシュに保存
    this.cache.set(managerId, {
      data: freshData,
      timestamp: now
    });

    return freshData;
  }

  static invalidate(managerId?: string) {
    if (managerId) {
      this.cache.delete(managerId);
    } else {
      this.cache.clear();
    }
  }
}
```

**セッションキャッシュ**:

```typescript
// React コンポーネントレベルのキャッシュ
const useCachedManagerStats = (managerId: string) => {
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  useEffect(() => {
    const now = Date.now();
    const CACHE_DURATION = 2 * 60 * 1000; // 2分

    // キャッシュが有効な場合はスキップ
    if (stats && (now - lastFetch) < CACHE_DURATION) {
      return;
    }

    // 新しい統計を取得
    const unsubscribe = StatsService.subscribeToManagerStats(
      managerId,
      (newStats) => {
        setStats(newStats);
        setLastFetch(Date.now());
      }
    );

    return () => unsubscribe();
  }, [managerId, stats, lastFetch]);

  return stats;
};
```

### 4. リアルタイム接続の最適化

**選択的リアルタイム監視**:

```typescript
// 必要最小限のリアルタイム接続
const useSmartRealTimeUpdates = (managerId: string, isVisible: boolean) => {
  const [unsubscribeFunctions, setUnsubscribeFunctions] = useState<(() => void)[]>([]);

  useEffect(() => {
    // ページが非表示の場合は接続しない
    if (!isVisible || !managerId) {
      return;
    }

    const unsubscribes: (() => void)[] = [];

    // 重要度の高いデータのみリアルタイム監視
    // 1. 承認待ちリクエスト（即座の対応が必要）
    const approvalUnsubscribe = onSnapshot(
      query(
        collection(db, 'shiftRequests'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending'),
        limit(10)
      ),
      (snapshot) => {
        const pendingCount = snapshot.size;
        updatePendingApprovals(pendingCount);
      }
    );
    unsubscribes.push(approvalUnsubscribe);

    // 2. システム通知（緊急度の高い情報）
    const notificationUnsubscribe = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', managerId),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      ),
      (snapshot) => {
        const unreadNotifications = snapshot.docs.map(doc => doc.data());
        updateNotifications(unreadNotifications);
      }
    );
    unsubscribes.push(notificationUnsubscribe);

    setUnsubscribeFunctions(unsubscribes);

    // クリーンアップ
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      setUnsubscribeFunctions([]);
    };
  }, [managerId, isVisible]);

  // ページ離脱時の強制クリーンアップ
  useEffect(() => {
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [unsubscribeFunctions]);
};
```

**バッチ更新**:

```typescript
// 複数の変更を一括処理
const batchUpdateShifts = async (updates: Array<{id: string, data: Partial<Shift>}>) => {
  const batch = writeBatch(db);

  updates.forEach(({ id, data }) => {
    const shiftRef = doc(db, 'shifts', id);
    batch.update(shiftRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  });

  // 一括コミット（ネットワーク呼び出し1回）
  await batch.commit();

  console.log(`✅ Batch updated ${updates.length} shifts`);
};
```

## パフォーマンス監視とメトリクス

### 1. クエリパフォーマンス計測

```typescript
// クエリ実行時間の計測
const measureQueryPerformance = async <T>(
  queryName: string,
  queryFunction: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();

  try {
    const result = await queryFunction();
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`📊 Query "${queryName}" completed in ${duration.toFixed(2)}ms`);

    // パフォーマンス閾値チェック
    if (duration > 1000) {
      console.warn(`⚠️ Slow query detected: ${queryName} (${duration.toFixed(2)}ms)`);
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.error(`❌ Query "${queryName}" failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
};

// 使用例
const getStaffData = async (managerId: string) => {
  return measureQueryPerformance(
    'getStaffByManager',
    () => UserService.getStaffByManager(managerId)
  );
};
```

### 2. ネットワーク最適化

```typescript
// Firestore 設定の最適化
const optimizeFirestoreSettings = () => {
  // オフライン永続化の有効化
  enableNetwork(db);

  // キャッシュサイズの設定
  const settings: FirestoreSettings = {
    cacheSizeBytes: 50 * 1024 * 1024, // 50MB
  };

  // 実験的機能の有効化
  if (typeof window !== 'undefined') {
    console.log('🔧 Firestore optimization enabled');
  }
};
```

### 3. エラー監視と自動復旧

```typescript
// クエリ失敗時の自動リトライ
const resilientQuery = async <T>(
  queryFunction: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFunction();
    } catch (error: any) {
      console.warn(`Query attempt ${attempt} failed:`, error.message);

      // 最後の試行でも失敗した場合はエラーを投げる
      if (attempt === maxRetries) {
        throw error;
      }

      // 指数バックオフでリトライ
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Unreachable');
};
```

## コスト最適化

### 1. 読み取り操作の最小化

```typescript
// 必要最小限のデータのみ取得
const getEssentialUserData = async (userId: string) => {
  // ✅ 必要なフィールドのみ取得
  const userDoc = await getDoc(doc(db, 'users', userId));

  if (!userDoc.exists()) {
    return null;
  }

  const userData = userDoc.data();

  // 必要な情報のみ抽出
  return {
    uid: userDoc.id,
    name: userData.name,
    role: userData.role,
    managerId: userData.managerId,
    // 大量のデータ（availability等）は必要時のみ取得
  };
};
```

### 2. 効率的なページネーション

```typescript
// カーソルベースのページネーション
const getPaginatedShifts = async (
  managerId: string,
  pageSize: number = 20,
  lastVisible?: DocumentSnapshot
) => {
  let shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId),
    orderBy('date', 'desc'),
    limit(pageSize)
  );

  // 次のページの場合
  if (lastVisible) {
    shiftsQuery = query(
      shiftsQuery,
      startAfter(lastVisible)
    );
  }

  const snapshot = await getDocs(shiftsQuery);

  return {
    shifts: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    lastVisible: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === pageSize
  };
};
```

---

**最終更新**: 2025年9月18日
**バージョン**: v2.0
**担当**: データベース最適化チーム