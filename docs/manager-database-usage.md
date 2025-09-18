# Manager ルート データベース使用パターン

## 概要

`/manager` ルートは店長（Manager）向けの機能群で、自店舗のスタッフ・シフト・予算管理に特化したデータベース操作パターンを提供します。

### 主要特徴

- **店舗分離**: `managerId` を基準とした厳格なデータアクセス制御
- **リアルタイム統計**: StatsService による高速統計計算とリアルタイム更新
- **効率的クエリ**: インデックス最適化とJavaScript側フィルタリングの併用
- **承認ワークフロー**: シフト希望・交換申請の承認管理
- **予算管理**: 人件費計算と予算監視の自動化

## データアクセス制御パターン

### managerId ベースフィルタリング

全てのManagerルートで適用される基本パターン:

```typescript
// Manager専用データアクセスの基本形
const getManagerData = async (managerId: string) => {
  // 自店舗スタッフのみ
  const staffQuery = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff')
  );

  // 自店舗シフトのみ
  const shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  );

  // 自店舗宛リクエストのみ
  const requestsQuery = query(
    collection(db, 'shiftRequests'),
    where('managerId', '==', managerId)
  );

  return Promise.all([
    getDocs(staffQuery),
    getDocs(shiftsQuery),
    getDocs(requestsQuery)
  ]);
};
```

### 権限チェック

```typescript
// Manager権限の検証
const isAuthorizedManager = (requiredRoles: UserRole[]) => {
  if (currentUser.role === 'root') return true; // Root is superuser
  return requiredRoles.includes(currentUser.role);
};

// Manager専用ルート保護
<ProtectedRoute requiredRoles={['root', 'manager']}>
  {/* Manager機能 */}
</ProtectedRoute>
```

## ページ別データベース使用パターン

### 1. Managerダッシュボード (`/manager/page.tsx`)

**目的**: 店舗の統計情報とリアルタイム監視

#### StatsService による高速統計

```typescript
// リアルタイム統計サブスクリプション
useEffect(() => {
  if (!currentUser?.uid || currentUser?.role !== 'manager') return;

  const unsubscribe = StatsService.subscribeToManagerStats(
    currentUser.uid, // managerId
    (stats: ManagerStats) => {
      setManagerStats(stats);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [currentUser?.uid, currentUser?.role]);
```

#### 統計データ構造

```typescript
interface ManagerStats {
  totalStaff: {
    current: number;        // 現在のスタッフ数
    previous: number;       // 前期比較値
    trend: string;          // "+2", "-1", "±0"
  };
  weeklyShifts: {
    current: number;        // 今週のシフト数
    previous: number;       // 先週比較
    trend: string;
  };
  pendingApprovals: {
    current: number;        // 承認待ち件数
    trend: 'new' | 'increased' | 'decreased' | 'same';
  };
  monthlyBudget: {
    current: number;        // 今月の人件費（k円）
    previous: number;       // 前月比較
    trend: string;          // "+15%", "-5%"
    percentage: number;
  };
}
```

### 2. シフト管理 (`/manager/shifts/page.tsx`)

**目的**: シフトの作成・編集・削除

#### シフト作成

```typescript
// 新規シフト作成
const createShift = async (shiftData: Partial<Shift>) => {
  const shiftDoc = await addDoc(collection(db, 'shifts'), {
    ...shiftData,
    managerId: currentUser.uid,
    status: 'draft',
    createdBy: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 監査ログ
  await logActivity('Create Shift', currentUser.uid, {
    shiftId: shiftDoc.id,
    date: shiftData.date,
    slotsCount: shiftData.slots?.length || 0
  });

  return shiftDoc.id;
};
```

#### 自店舗シフト取得

```typescript
// Manager作成シフトの一覧取得
const getManagerShifts = async (managerId: string, dateRange?: {start: Date, end: Date}) => {
  let shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId),
    orderBy('date', 'desc')
  );

  const snapshot = await getDocs(shiftsQuery);
  let shifts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: doc.data().date?.toDate()
  }));

  // JavaScript側で日付フィルタリング（Firestore制限回避）
  if (dateRange) {
    shifts = shifts.filter(shift =>
      shift.date >= dateRange.start && shift.date <= dateRange.end
    );
  }

  return shifts;
};
```

#### シフトスロット管理

```typescript
// シフトスロットの編集
const updateShiftSlots = async (shiftId: string, newSlots: ShiftSlot[]) => {
  await updateDoc(doc(db, 'shifts', shiftId), {
    slots: newSlots,
    updatedAt: serverTimestamp()
  });

  // スタッフ割り当て変更の通知
  const notificationPromises = newSlots.flatMap(slot =>
    slot.assignedStaff.map(staffId =>
      createNotification(staffId, {
        type: 'shift_assigned',
        title: 'シフト更新',
        message: `${slot.startTime}-${slot.endTime}のシフトが更新されました`,
        data: { shiftId, slotId: slot.slotId }
      })
    )
  );

  await Promise.all(notificationPromises);
};
```

### 3. スタッフ管理 (`/manager/staff/page.tsx`)

**目的**: 自店舗スタッフの雇用・管理・設定

#### スタッフ一覧取得

```typescript
// 自店舗スタッフ取得（UserService使用）
const getStaffList = async (managerId: string) => {
  const staffUsers = await UserService.getStaffByManager(managerId);

  // スタッフの追加情報を並列取得
  const staffWithDetails = await Promise.all(
    staffUsers.map(async (staff) => {
      // 最近のシフト参加回数
      const recentShiftsQuery = query(
        collection(db, 'shifts'),
        where('managerId', '==', managerId),
        where('slots', 'array-contains-any', [staff.uid])
      );

      const shiftsSnapshot = await getDocs(recentShiftsQuery);
      const shiftCount = shiftsSnapshot.size;

      // 承認待ちリクエスト数
      const pendingRequestsQuery = query(
        collection(db, 'shiftRequests'),
        where('userId', '==', staff.uid),
        where('status', '==', 'pending')
      );

      const requestsSnapshot = await getDocs(pendingRequestsQuery);
      const pendingRequests = requestsSnapshot.size;

      return {
        ...staff,
        recentShiftCount: shiftCount,
        pendingRequests: pendingRequests,
        lastActive: staff.updatedAt || staff.createdAt
      };
    })
  );

  return staffWithDetails;
};
```

#### スタッフ作成

```typescript
// 新規スタッフアカウント作成
const createStaffAccount = async (staffData: Partial<User>) => {
  const staffDoc = await addDoc(collection(db, 'users'), {
    ...staffData,
    role: 'staff',
    managerId: currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // スタッフ向けウェルカム通知
  await createNotification(staffDoc.id, {
    type: 'announcement',
    title: 'アカウント作成完了',
    message: `${currentUser.shopName} へようこそ！`,
    data: { welcomeMessage: true }
  });

  await logActivity('Create Staff', currentUser.uid, {
    staffId: staffDoc.id,
    staffName: staffData.name
  });

  return staffDoc.id;
};
```

#### スタッフ情報更新

```typescript
// スタッフ詳細情報の更新
const updateStaffDetails = async (staffId: string, updateData: Partial<User>) => {
  await updateDoc(doc(db, 'users', staffId), {
    ...updateData,
    updatedAt: serverTimestamp()
  });

  // 重要な変更（時給、最大労働時間）は通知
  const importantFields = ['hourlyRate', 'maxHoursPerWeek', 'employmentType'];
  const changedImportantFields = Object.keys(updateData).filter(field =>
    importantFields.includes(field)
  );

  if (changedImportantFields.length > 0) {
    await createNotification(staffId, {
      type: 'announcement',
      title: '雇用条件更新',
      message: `雇用条件が更新されました：${changedImportantFields.join(', ')}`,
      data: { updatedFields: changedImportantFields }
    });
  }
};
```

### 4. 承認管理 (`/manager/approvals/page.tsx`)

**目的**: シフト希望・交換申請の承認ワークフロー

#### 承認待ちリクエスト取得

```typescript
// 承認待ちシフトリクエスト
const getPendingApprovals = async (managerId: string) => {
  const [shiftRequests, shiftExchanges] = await Promise.all([
    // シフト希望申請
    getDocs(query(
      collection(db, 'shiftRequests'),
      where('managerId', '==', managerId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    )),

    // シフト交換申請
    getDocs(query(
      collection(db, 'shiftExchanges'),
      where('managerId', '==', managerId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    ))
  ]);

  // スタッフ情報を結合
  const requestsWithStaffInfo = await Promise.all([
    ...shiftRequests.docs.map(async (doc) => {
      const requestData = doc.data();
      const staffDoc = await getDoc(doc(db, 'users', requestData.userId));

      return {
        id: doc.id,
        type: 'shift_request',
        ...requestData,
        staffName: staffDoc.data()?.name || 'Unknown',
        createdAt: requestData.createdAt?.toDate()
      };
    }),

    ...shiftExchanges.docs.map(async (doc) => {
      const exchangeData = doc.data();
      const [fromStaffDoc, toStaffDoc] = await Promise.all([
        getDoc(doc(db, 'users', exchangeData.fromUserId)),
        exchangeData.toUserId ? getDoc(doc(db, 'users', exchangeData.toUserId)) : null
      ]);

      return {
        id: doc.id,
        type: 'shift_exchange',
        ...exchangeData,
        fromStaffName: fromStaffDoc.data()?.name || 'Unknown',
        toStaffName: toStaffDoc?.data()?.name || null,
        createdAt: exchangeData.createdAt?.toDate()
      };
    })
  ]);

  return requestsWithStaffInfo.sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  );
};
```

#### 承認・却下処理

```typescript
// シフトリクエスト承認
const approveShiftRequest = async (requestId: string, approvalNote?: string) => {
  // リクエスト情報取得
  const requestDoc = await getDoc(doc(db, 'shiftRequests', requestId));
  const requestData = requestDoc.data();

  // ステータス更新
  await updateDoc(doc(db, 'shiftRequests', requestId), {
    status: 'approved',
    approvedBy: currentUser.uid,
    approvedAt: serverTimestamp(),
    approvalNote: approvalNote
  });

  // スタッフへの通知
  await createNotification(requestData.userId, {
    type: 'shift_assigned',
    title: 'シフト希望承認',
    message: `${requestData.date}のシフト希望が承認されました`,
    data: { requestId, approvalNote }
  });

  // 監査ログ
  await logActivity('Approve Shift Request', currentUser.uid, {
    requestId,
    staffId: requestData.userId,
    shiftDate: requestData.date
  });
};

// 一括承認処理
const bulkApproveRequests = async (requestIds: string[]) => {
  const approvalPromises = requestIds.map(id => approveShiftRequest(id));
  await Promise.all(approvalPromises);

  // 一括処理の監査ログ
  await logActivity('Bulk Approve Requests', currentUser.uid, {
    requestCount: requestIds.length,
    requestIds
  });
};
```

### 5. 予算管理 (`/manager/budget/page.tsx`)

**目的**: 人件費計算と予算分析

#### 予算計算実行

```typescript
// 期間別予算計算
const calculateBudgetForPeriod = async (
  managerId: string,
  period: { start: Date, end: Date }
) => {
  // スタッフの時給情報取得
  const staffQuery = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff')
  );

  const staffSnapshot = await getDocs(staffQuery);
  const staffRates = new Map<string, number>();

  staffSnapshot.forEach(doc => {
    const staffData = doc.data();
    if (staffData.hourlyRate) {
      staffRates.set(doc.id, staffData.hourlyRate);
    }
  });

  // 期間内シフト取得
  const shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  );

  const shiftsSnapshot = await getDocs(shiftsQuery);
  let totalBudget = 0;
  const shiftBreakdown: ShiftBudgetItem[] = [];

  // JavaScript側で日付フィルタリングと予算計算
  shiftsSnapshot.forEach(shiftDoc => {
    const shiftData = shiftDoc.data();
    const shiftDate = shiftData.date?.toDate();

    if (shiftDate && shiftDate >= period.start && shiftDate <= period.end) {
      let shiftTotal = 0;
      const slotBudgets: SlotBudgetItem[] = [];

      shiftData.slots?.forEach((slot: any) => {
        let slotTotal = 0;
        const staffAssignments: StaffAssignment[] = [];

        slot.assignedStaff?.forEach((staffId: string) => {
          const hourlyRate = staffRates.get(staffId) || 1000; // デフォルト1000円
          const duration = calculateSlotDuration(slot.startTime, slot.endTime);
          const baseCost = hourlyRate * duration;

          // 深夜・休日手当計算
          const bonuses = calculateBonuses(shiftDate, slot, hourlyRate);
          const totalCost = baseCost + bonuses;

          slotTotal += totalCost;
          staffAssignments.push({
            userId: staffId,
            userName: getStaffName(staffId),
            hourlyRate,
            baseCost,
            overtimeCost: bonuses.overtime || 0,
            bonuses: bonuses.total || 0,
            totalCost,
            workDuration: duration
          });
        });

        shiftTotal += slotTotal;
        slotBudgets.push({
          slotId: slot.slotId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: calculateSlotDuration(slot.startTime, slot.endTime),
          assignedStaff: staffAssignments,
          slotTotal,
          isNightShift: isNightShift(slot.startTime, slot.endTime),
          isOvertime: false // 実装に応じて設定
        });
      });

      totalBudget += shiftTotal;
      shiftBreakdown.push({
        shiftId: shiftDoc.id,
        date: shiftDate,
        dayType: getDayType(shiftDate),
        slots: slotBudgets,
        dailyTotal: shiftTotal
      });
    }
  });

  // 予算計算結果を保存
  const budgetCalculation: BudgetCalculation = {
    calculationId: generateId(),
    managerId,
    period: {
      start: period.start,
      end: period.end,
      name: formatPeriodName(period)
    },
    shifts: shiftBreakdown,
    staffCosts: calculateStaffCosts(shiftBreakdown),
    summary: {
      totalShifts: shiftBreakdown.length,
      totalHours: calculateTotalHours(shiftBreakdown),
      totalBaseCost: totalBudget,
      totalOvertimeCost: 0, // 実装に応じて計算
      totalBonusCost: 0,    // 実装に応じて計算
      totalTaxAndInsurance: 0, // 実装に応じて計算
      totalCost: totalBudget,
      budgetVariance: 0     // 予算上限との差
    },
    assumptions: getDefaultAssumptions(),
    createdBy: currentUser.uid,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Firestoreに保存
  await addDoc(collection(db, 'budgetCalculations'), budgetCalculation);

  return budgetCalculation;
};
```

### 6. スケジュール確認 (`/manager/schedules/page.tsx`)

**目的**: スタッフスケジュールの確認と管理

#### スケジュール表示

```typescript
// 週間スケジュール取得
const getWeeklySchedule = async (managerId: string, weekStart: Date) => {
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 期間内シフト取得
  const shiftsQuery = query(
    collection(db, 'shifts'),
    where('managerId', '==', managerId)
  );

  const shiftsSnapshot = await getDocs(shiftsQuery);
  const weekShifts = shiftsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(shift => {
      const shiftDate = shift.date?.toDate();
      return shiftDate && shiftDate >= weekStart && shiftDate < weekEnd;
    });

  // スタッフ情報取得
  const staffQuery = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff')
  );

  const staffSnapshot = await getDocs(staffQuery);
  const staffMap = new Map();
  staffSnapshot.forEach(doc => {
    staffMap.set(doc.id, doc.data());
  });

  // スケジュール表構築
  const schedule = buildScheduleMatrix(weekShifts, staffMap, weekStart);

  return {
    period: { start: weekStart, end: weekEnd },
    shifts: weekShifts,
    staff: Array.from(staffMap.entries()),
    schedule
  };
};
```

## StatsService 詳細分析

### 高速統計計算の仕組み

```typescript
// StatsService の最適化されたクエリパターン
class StatsService {
  // インデックス制限を回避した週次統計
  private static async getWeeklyShiftsStats(managerId: string) {
    // ✅ 単一フィールドクエリ（インデックス不要）
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    );

    const allShifts = await getDocs(shiftsQuery);

    // JavaScript側で日付フィルタリング
    const thisWeekShifts = allShifts.docs.filter(doc => {
      const shiftDate = doc.data().date?.toDate();
      return isThisWeek(shiftDate);
    });

    const lastWeekShifts = allShifts.docs.filter(doc => {
      const shiftDate = doc.data().date?.toDate();
      return isLastWeek(shiftDate);
    });

    return {
      current: thisWeekShifts.length,
      previous: lastWeekShifts.length,
      trend: calculateTrend(thisWeekShifts.length, lastWeekShifts.length)
    };
  }

  // 承認待ち件数の効率的取得
  private static async getPendingApprovalsStats(managerId: string) {
    const [shiftRequests, shiftExchanges] = await Promise.all([
      getDocs(query(
        collection(db, 'shiftRequests'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      )),
      getDocs(query(
        collection(db, 'shiftExchanges'),
        where('managerId', '==', managerId),
        where('status', '==', 'pending')
      ))
    ]);

    const total = shiftRequests.size + shiftExchanges.size;

    return {
      current: total,
      trend: total > 3 ? 'new' as const :
             total > 0 ? 'increased' as const :
             'same' as const
    };
  }
}
```

## エラーハンドリングとフォールバック

### 権限エラー対応

```typescript
// Manager権限チェック付きデータアクセス
const safeManagerDataAccess = async (
  operation: () => Promise<any>,
  managerId: string
) => {
  try {
    // 権限確認
    if (!isAuthorizedManager(['manager'])) {
      throw new Error('Insufficient permissions');
    }

    // 自店舗データのみアクセス確認
    if (currentUser.uid !== managerId && currentUser.role !== 'root') {
      throw new Error('Access denied: Not your store data');
    }

    return await operation();
  } catch (error) {
    console.error('Manager data access error:', error);

    // 監査ログ記録
    await logActivity('Data Access Denied', currentUser.uid, {
      attemptedManagerId: managerId,
      error: error.message
    });

    throw error;
  }
};
```

### データ取得失敗時のフォールバック

```typescript
// 統計データのフォールバック
const getStatsWithFallback = async (managerId: string) => {
  try {
    return await StatsService.subscribeToManagerStats(managerId);
  } catch (error) {
    console.error('Stats service failed, using fallback:', error);

    // フォールバック統計値
    return {
      totalStaff: { current: 0, previous: 0, trend: '±0' },
      weeklyShifts: { current: 0, previous: 0, trend: '±0' },
      pendingApprovals: { current: 0, trend: 'same' },
      monthlyBudget: { current: 0, previous: 0, trend: '±0%', percentage: 0 }
    };
  }
};
```

## パフォーマンス最適化

### 1. クエリ最適化戦略

```typescript
// ✅ 効率的: 並列クエリ実行
const getManagerDashboardData = async (managerId: string) => {
  const [staff, shifts, requests, budget] = await Promise.all([
    UserService.getStaffByManager(managerId),
    getManagerShifts(managerId),
    getPendingApprovals(managerId),
    getLatestBudgetCalculation(managerId)
  ]);

  return { staff, shifts, requests, budget };
};
```

### 2. キャッシュ戦略

```typescript
// スタッフリストのキャッシュ（5分間）
const staffCache = new Map<string, { data: User[], timestamp: number }>();

const getCachedStaff = async (managerId: string): Promise<User[]> => {
  const cached = staffCache.get(managerId);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < 5 * 60 * 1000) {
    return cached.data;
  }

  const freshData = await UserService.getStaffByManager(managerId);
  staffCache.set(managerId, { data: freshData, timestamp: now });

  return freshData;
};
```

### 3. リアルタイム接続管理

```typescript
// 必要最小限のリアルタイム接続
useEffect(() => {
  let unsubscribe: (() => void) | undefined;

  // ダッシュボード表示時のみ統計監視
  if (isVisible && currentUser?.uid) {
    unsubscribe = StatsService.subscribeToManagerStats(
      currentUser.uid,
      setManagerStats
    );
  }

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}, [isVisible, currentUser?.uid]);
```

---

**最終更新**: 2025年9月18日
**バージョン**: v2.0
**担当**: 店舗管理システムチーム