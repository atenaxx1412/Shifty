# データベース連携サービス層 詳細分析

## 概要

Shifty システムでは、Firestore との直接的なやり取りを抽象化するサービス層を構築し、ビジネスロジックとデータアクセスを分離しています。これにより、型安全性、再利用性、保守性を向上させています。

### サービス層の特徴

- **抽象化**: Firestore の複雑なクエリをビジネス向けメソッドに抽象化
- **型安全性**: TypeScript による厳密な型定義
- **パフォーマンス最適化**: 並列クエリ、キャッシュ、バッチ処理
- **エラーハンドリング**: 統一されたエラー処理とフォールバック
- **再利用性**: 複数のコンポーネントで共有可能な共通ロジック

## 主要サービス クラス

### 1. StatsService (`src/lib/statsService.ts`)

**目的**: 店長ダッシュボード用の統計データ提供

#### 設計原則

```typescript
export class StatsService {
  // 📊 高速統計 - フォールバック値で即座に応答
  static subscribeToManagerStats(
    managerId: string,
    callback: (stats: ManagerStats) => void
  ): () => void {
    // 即座にフォールバック値を返し、その後非同期で実データを取得
    setTimeout(async () => {
      const stats = await this.calculateRealStats(managerId);
      callback(stats);
    }, 100);

    return () => {}; // クリーンアップ不要
  }

  // 🔄 並列データ取得で高速化
  private static async calculateRealStats(managerId: string) {
    const [totalStaff, weeklyShifts, pendingApprovals, monthlyBudget] =
      await Promise.all([
        this.getStaffCount(managerId),
        this.getWeeklyShiftsStats(managerId),
        this.getPendingApprovalsStats(managerId),
        this.getMonthlyBudgetStats(managerId)
      ]);

    return { totalStaff, weeklyShifts, pendingApprovals, monthlyBudget };
  }
}
```

#### 主要メソッド

**スタッフ数統計**:
```typescript
private static async getStaffCount(managerId: string) {
  try {
    const staffQuery = query(
      collection(db, 'users'),
      where('managerId', '==', managerId),
      where('role', '==', 'staff')
    );

    const snapshot = await getDocs(staffQuery);
    const current = snapshot.size;

    return {
      current,
      previous: current, // 履歴データが実装されるまでは同値
      trend: '±0'
    };
  } catch (error) {
    console.error('Error fetching staff count:', error);
    return { current: 0, previous: 0, trend: '±0' };
  }
}
```

**週次シフト統計（JavaScript側フィルタリング）**:
```typescript
private static async getWeeklyShiftsStats(managerId: string) {
  try {
    // インデックス不要の単一フィールドクエリ
    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('managerId', '==', managerId)
    );

    const allShifts = await getDocs(shiftsQuery);

    // 日付計算
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { locale: ja });
    const thisWeekEnd = endOfWeek(now, { locale: ja });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: ja });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: ja });

    let currentWeekShifts = 0;
    let previousWeekShifts = 0;

    // JavaScript側で効率的なフィルタリング
    allShifts.forEach(doc => {
      const shiftData = doc.data();
      const shiftDate = shiftData.date?.toDate();

      if (shiftDate && shiftData.slots) {
        const slotsCount = shiftData.slots.length;

        if (shiftDate >= thisWeekStart && shiftDate <= thisWeekEnd) {
          currentWeekShifts += slotsCount;
        }

        if (shiftDate >= lastWeekStart && shiftDate <= lastWeekEnd) {
          previousWeekShifts += slotsCount;
        }
      }
    });

    const trend = currentWeekShifts > previousWeekShifts
      ? `+${currentWeekShifts - previousWeekShifts}`
      : currentWeekShifts < previousWeekShifts
      ? `${currentWeekShifts - previousWeekShifts}`
      : '±0';

    return { current: currentWeekShifts, previous: previousWeekShifts, trend };
  } catch (error) {
    console.error('Error fetching weekly shifts:', error);
    return { current: 0, previous: 0, trend: '±0' };
  }
}
```

**予算統計（複雑なビジネスロジック）**:
```typescript
private static async getMonthlyBudgetStats(managerId: string) {
  try {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // 1. スタッフ時給データ並列取得
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

    // 2. 時給マップ構築
    const staffRates = new Map<string, number>();
    staffSnapshot.forEach(doc => {
      const staffData = doc.data();
      if (staffData.hourlyRate) {
        staffRates.set(doc.id, staffData.hourlyRate);
      }
    });

    // 3. 期間フィルタリングと予算計算
    let currentMonthBudget = 0;

    shiftsSnapshot.forEach(doc => {
      const shiftData = doc.data();
      const shiftDate = shiftData.date?.toDate();

      if (shiftDate && shiftDate >= monthStart && shiftDate <= monthEnd) {
        shiftData.slots?.forEach((slot: any) => {
          slot.assignedStaff?.forEach((staffId: string) => {
            const hourlyRate = staffRates.get(staffId) || 1000;
            const startTime = new Date(`2000/01/01 ${slot.startTime}`);
            const endTime = new Date(`2000/01/01 ${slot.endTime}`);
            const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

            currentMonthBudget += hourlyRate * hours;
          });
        });
      }
    });

    const current = Math.round(currentMonthBudget / 1000); // k円単位

    return {
      current,
      previous: 0, // 履歴実装待ち
      trend: '±0%',
      percentage: 0
    };
  } catch (error) {
    console.error('Error fetching budget stats:', error);
    return { current: 0, previous: 0, trend: '±0%', percentage: 0 };
  }
}
```

### 2. UserService (`src/lib/userService.ts`)

**目的**: ユーザー管理とスタッフ操作の抽象化

#### 設計原則

```typescript
export class UserService {
  // 型安全なスタッフ取得
  async getStaffByManager(managerId: string): Promise<User[]> {
    try {
      const q = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'staff')
      );

      const querySnapshot = await getDocs(q);
      const staff: User[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data();

        // 安全な日付変換
        const createdAt = this.safeDateConversion(userData.createdAt);
        const updatedAt = this.safeDateConversion(userData.updatedAt);

        staff.push({
          uid: doc.id,
          ...userData,
          createdAt,
          updatedAt
        } as User);
      });

      return staff;
    } catch (error) {
      console.error('Error fetching staff:', error);
      throw new Error(`Failed to fetch staff for manager ${managerId}`);
    }
  }

  // Firestore Timestamp の安全な変換
  private safeDateConversion(timestamp: any): Date {
    if (!timestamp) return new Date();

    // Firestore Timestamp の場合
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    // 既に Date オブジェクトの場合
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // 文字列の場合
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }

    // その他の場合はデフォルト値
    return new Date();
  }
}
```

#### 主要機能

**リアルタイムスタッフ監視**:
```typescript
subscribeToStaffUpdates(
  managerId: string,
  callback: (staff: User[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'users'),
    where('managerId', '==', managerId),
    where('role', '==', 'staff'),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q,
    (snapshot) => {
      const staff = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
        createdAt: this.safeDateConversion(doc.data().createdAt),
        updatedAt: this.safeDateConversion(doc.data().updatedAt)
      } as User));

      callback(staff);
    },
    (error) => {
      console.error('Staff subscription error:', error);
      // エラー時はフォールバック値を返す
      callback([]);
    }
  );
}
```

### 3. ShiftService (推定実装)

**目的**: シフト管理の複雑なビジネスロジック

```typescript
export class ShiftService {
  // シフト作成（バリデーション付き）
  static async createShift(shiftData: Partial<Shift>): Promise<string> {
    // 1. データバリデーション
    this.validateShiftData(shiftData);

    // 2. 競合チェック（同じ時間帯の既存シフト）
    await this.checkForConflicts(shiftData);

    // 3. Firestore への保存
    const docRef = await addDoc(collection(db, 'shifts'), {
      ...shiftData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 4. 関連データの更新（通知、ログ等）
    await Promise.all([
      this.notifyAssignedStaff(docRef.id, shiftData),
      this.logShiftCreation(docRef.id, shiftData)
    ]);

    return docRef.id;
  }

  // スタッフアサイン（複雑なビジネスルール）
  static async assignStaffToSlot(
    shiftId: string,
    slotId: string,
    staffIds: string[]
  ): Promise<void> {
    // 1. スタッフの可用性チェック
    const availabilityChecks = await Promise.all(
      staffIds.map(id => this.checkStaffAvailability(id, shiftId))
    );

    const unavailableStaff = staffIds.filter((_, index) =>
      !availabilityChecks[index]
    );

    if (unavailableStaff.length > 0) {
      throw new Error(`Staff not available: ${unavailableStaff.join(', ')}`);
    }

    // 2. スキルマッチング
    await this.validateSkillRequirements(shiftId, slotId, staffIds);

    // 3. 更新実行
    await this.updateShiftSlot(shiftId, slotId, staffIds);

    // 4. 通知送信
    await this.notifySlotAssignment(shiftId, slotId, staffIds);
  }

  // 効率的なシフト検索
  static async searchShifts(criteria: ShiftSearchCriteria): Promise<Shift[]> {
    let baseQuery = query(collection(db, 'shifts'));

    // 必須フィルタ（インデックス使用）
    if (criteria.managerId) {
      baseQuery = query(baseQuery, where('managerId', '==', criteria.managerId));
    }

    if (criteria.status) {
      baseQuery = query(baseQuery, where('status', '==', criteria.status));
    }

    // データ取得
    const snapshot = await getDocs(baseQuery);
    let shifts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Shift));

    // JavaScript側で複雑なフィルタリング
    if (criteria.dateRange) {
      shifts = shifts.filter(shift =>
        this.isDateInRange(shift.date, criteria.dateRange!)
      );
    }

    if (criteria.staffId) {
      shifts = shifts.filter(shift =>
        shift.slots.some(slot =>
          slot.assignedStaff.includes(criteria.staffId!)
        )
      );
    }

    if (criteria.requiredSkills?.length) {
      shifts = shifts.filter(shift =>
        shift.slots.some(slot =>
          criteria.requiredSkills!.every(skill =>
            slot.requiredSkills?.includes(skill)
          )
        )
      );
    }

    return shifts;
  }
}
```

### 4. BudgetService (推定実装)

**目的**: 複雑な予算計算とコスト分析

```typescript
export class BudgetService {
  // 期間別予算計算
  static async calculatePeriodBudget(
    managerId: string,
    period: DateRange,
    options: BudgetCalculationOptions = {}
  ): Promise<BudgetCalculation> {

    // 1. 基礎データの並列取得
    const [staffData, shiftsData, templateData] = await Promise.all([
      this.getStaffRates(managerId),
      this.getPeriodsShifts(managerId, period),
      this.getBudgetTemplate(managerId)
    ]);

    // 2. 予算計算エンジン
    const calculator = new BudgetCalculator({
      staffRates: staffData,
      multipliers: templateData.multipliers,
      companyRates: templateData.companyRates,
      options
    });

    // 3. シフト別コスト計算
    const shiftBudgets = shiftsData.map(shift =>
      calculator.calculateShiftBudget(shift)
    );

    // 4. 集計とサマリー
    const summary = calculator.summarize(shiftBudgets);

    // 5. 結果の保存
    const budgetCalculation: BudgetCalculation = {
      calculationId: this.generateId(),
      managerId,
      period,
      shifts: shiftBudgets,
      staffCosts: calculator.getStaffCostBreakdown(),
      summary,
      assumptions: templateData,
      createdBy: managerId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await addDoc(collection(db, 'budgetCalculations'), budgetCalculation);

    return budgetCalculation;
  }

  // リアルタイム予算監視
  static subscribeTobudgetAlerts(
    managerId: string,
    budgetLimit: number,
    callback: (alert: BudgetAlert) => void
  ): Unsubscribe {
    // 新しいシフトが追加されるたびに予算をチェック
    return onSnapshot(
      query(
        collection(db, 'shifts'),
        where('managerId', '==', managerId),
        where('updatedAt', '>=', startOfMonth(new Date()))
      ),
      async (snapshot) => {
        const currentBudget = await this.calculateCurrentMonthBudget(managerId);

        if (currentBudget.total > budgetLimit) {
          const alert: BudgetAlert = {
            type: 'budget_exceeded',
            managerId,
            currentAmount: currentBudget.total,
            budgetLimit,
            overageAmount: currentBudget.total - budgetLimit,
            timestamp: new Date()
          };

          callback(alert);
        }
      }
    );
  }
}

// 予算計算エンジン
class BudgetCalculator {
  constructor(private config: BudgetCalculatorConfig) {}

  calculateShiftBudget(shift: Shift): ShiftBudgetItem {
    const dailyTotal = shift.slots.reduce((total, slot) => {
      const slotBudget = this.calculateSlotBudget(shift.date, slot);
      return total + slotBudget.slotTotal;
    }, 0);

    return {
      shiftId: shift.shiftId,
      date: shift.date,
      dayType: this.getDayType(shift.date),
      slots: shift.slots.map(slot => this.calculateSlotBudget(shift.date, slot)),
      dailyTotal
    };
  }

  private calculateSlotBudget(date: Date, slot: ShiftSlot): SlotBudgetItem {
    const duration = this.calculateDuration(slot.startTime, slot.endTime);
    const isNightShift = this.isNightShift(slot.startTime, slot.endTime);
    const isOvertime = this.isOvertime(slot, date);

    const staffAssignments = slot.assignedStaff.map(staffId => {
      const hourlyRate = this.config.staffRates[staffId] || 1000;
      const baseCost = hourlyRate * (duration / 60);

      let multiplier = 1;
      if (isNightShift) multiplier *= this.config.multipliers.nightShift;
      if (isOvertime) multiplier *= this.config.multipliers.overtime;
      if (this.isWeekend(date)) multiplier *= this.config.multipliers.weekend;
      if (this.isHoliday(date)) multiplier *= this.config.multipliers.holiday;

      const totalCost = baseCost * multiplier;

      return {
        userId: staffId,
        userName: this.getStaffName(staffId),
        hourlyRate,
        baseCost,
        overtimeCost: isOvertime ? (baseCost * (this.config.multipliers.overtime - 1)) : 0,
        bonuses: totalCost - baseCost,
        totalCost,
        workDuration: duration
      };
    });

    return {
      slotId: slot.slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration,
      assignedStaff: staffAssignments,
      slotTotal: staffAssignments.reduce((sum, assignment) => sum + assignment.totalCost, 0),
      isNightShift,
      isOvertime
    };
  }
}
```

### 5. NotificationService (推定実装)

**目的**: システム通知の統一管理

```typescript
export class NotificationService {
  // 通知作成（型安全）
  static async createNotification(
    userId: string,
    notification: Omit<Notification, 'notificationId' | 'userId' | 'read' | 'createdAt'>
  ): Promise<string> {
    const notificationData: Notification = {
      notificationId: this.generateId(),
      userId,
      ...notification,
      read: false,
      createdAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    // リアルタイム配信（WebSocket経由）
    await this.sendRealTimeNotification(userId, notificationData);

    return docRef.id;
  }

  // 一括通知（効率的）
  static async createBulkNotifications(
    userIds: string[],
    notificationTemplate: Omit<Notification, 'notificationId' | 'userId' | 'read' | 'createdAt'>
  ): Promise<string[]> {
    const batch = writeBatch(db);
    const notificationIds: string[] = [];

    userIds.forEach(userId => {
      const notificationId = this.generateId();
      const docRef = doc(collection(db, 'notifications'), notificationId);

      batch.set(docRef, {
        notificationId,
        userId,
        ...notificationTemplate,
        read: false,
        createdAt: serverTimestamp()
      });

      notificationIds.push(notificationId);
    });

    await batch.commit();

    // 並列でリアルタイム配信
    await Promise.all(
      userIds.map(userId =>
        this.sendRealTimeNotification(userId, {
          notificationId: notificationIds[userIds.indexOf(userId)],
          userId,
          ...notificationTemplate,
          read: false,
          createdAt: new Date()
        })
      )
    );

    return notificationIds;
  }

  // リアルタイム通知監視
  static subscribeToUserNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
  ): Unsubscribe {
    return onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        } as Notification));

        callback(notifications);
      },
      (error) => {
        console.error('Notification subscription error:', error);
        callback([]);
      }
    );
  }
}
```

## サービス層の統合パターン

### 1. サービス間連携

```typescript
// 複数サービスを組み合わせた複雑な操作
export class WorkflowService {
  // シフト承認ワークフロー
  static async approveShiftRequest(requestId: string, managerId: string) {
    // 1. リクエスト情報取得
    const request = await ShiftRequestService.getRequest(requestId);

    // 2. スタッフの可用性チェック
    const isAvailable = await UserService.checkStaffAvailability(
      request.userId,
      request.date
    );

    if (!isAvailable) {
      throw new Error('Staff not available for requested time');
    }

    // 3. シフト更新
    await ShiftService.assignStaffToShift(
      request.shiftId,
      request.userId,
      request.timeSlots
    );

    // 4. リクエストステータス更新
    await ShiftRequestService.updateStatus(requestId, 'approved', managerId);

    // 5. 予算への影響計算
    const budgetImpact = await BudgetService.calculateRequestImpact(request);

    // 6. 通知送信
    await NotificationService.createNotification(request.userId, {
      type: 'shift_assigned',
      title: 'シフト希望承認',
      message: `${request.date} のシフト希望が承認されました`,
      data: { requestId, budgetImpact }
    });

    // 7. 監査ログ
    await AuditService.logActivity('Approve Shift Request', managerId, {
      requestId,
      staffId: request.userId,
      budgetImpact
    });
  }
}
```

### 2. エラーハンドリング戦略

```typescript
// 統一されたエラーハンドリング
export abstract class BaseService {
  protected static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue?: T
  ): Promise<T> {
    try {
      console.time(`⏱️ ${operationName}`);
      const result = await operation();
      console.timeEnd(`⏱️ ${operationName}`);
      return result;
    } catch (error: any) {
      console.error(`❌ ${operationName} failed:`, error);

      // Firestore 特有のエラー処理
      if (error.code === 'permission-denied') {
        throw new ServiceError('PERMISSION_DENIED', `Access denied for ${operationName}`);
      }

      if (error.code === 'unavailable') {
        throw new ServiceError('SERVICE_UNAVAILABLE', `Service temporarily unavailable`);
      }

      // ネットワークエラー
      if (error.code === 'unavailable' || error.message.includes('network')) {
        if (fallbackValue !== undefined) {
          console.warn(`🔄 Using fallback value for ${operationName}`);
          return fallbackValue;
        }
      }

      throw new ServiceError('OPERATION_FAILED', `${operationName} failed: ${error.message}`);
    }
  }
}

// カスタムエラータイプ
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
```

### 3. パフォーマンス監視

```typescript
// サービス層パフォーマンス監視
export class ServiceMonitor {
  private static metrics = new Map<string, PerformanceMetric>();

  static trackServiceCall<T>(
    serviceName: string,
    methodName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const key = `${serviceName}.${methodName}`;

    return operation()
      .then(result => {
        this.recordSuccess(key, performance.now() - startTime);
        return result;
      })
      .catch(error => {
        this.recordError(key, performance.now() - startTime, error);
        throw error;
      });
  }

  private static recordSuccess(key: string, duration: number) {
    const metric = this.metrics.get(key) || this.createMetric();
    metric.totalCalls++;
    metric.successfulCalls++;
    metric.totalDuration += duration;
    metric.averageDuration = metric.totalDuration / metric.totalCalls;

    if (duration > metric.maxDuration) metric.maxDuration = duration;
    if (duration < metric.minDuration) metric.minDuration = duration;

    this.metrics.set(key, metric);

    // 警告レベルのパフォーマンス問題
    if (duration > 2000) {
      console.warn(`🐌 Slow service call: ${key} (${duration.toFixed(2)}ms)`);
    }
  }

  private static recordError(key: string, duration: number, error: Error) {
    const metric = this.metrics.get(key) || this.createMetric();
    metric.totalCalls++;
    metric.failedCalls++;
    metric.lastError = error.message;

    this.metrics.set(key, metric);

    console.error(`💥 Service call failed: ${key} after ${duration.toFixed(2)}ms`, error);
  }

  // メトリクス取得
  static getMetrics(): Record<string, PerformanceMetric> {
    return Object.fromEntries(this.metrics);
  }

  // 定期レポート
  static generateReport(): ServicePerformanceReport {
    const metrics = this.getMetrics();
    const slowestServices = Object.entries(metrics)
      .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    const mostErrorProneServices = Object.entries(metrics)
      .sort(([,a], [,b]) => (b.failedCalls / b.totalCalls) - (a.failedCalls / a.totalCalls))
      .slice(0, 5);

    return {
      generatedAt: new Date(),
      totalServices: Object.keys(metrics).length,
      slowestServices,
      mostErrorProneServices,
      systemHealth: this.calculateSystemHealth(metrics)
    };
  }
}
```

## 最適化されたサービス使用パターン

### 1. コンポーネントでの使用例

```typescript
// React コンポーネントでの効率的なサービス使用
const useManagerDashboard = (managerId: string) => {
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!managerId) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // サービス層を通じた統一されたデータアクセス
        const unsubscribe = StatsService.subscribeToManagerStats(
          managerId,
          (newStats) => {
            setStats(newStats);
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    const cleanup = loadDashboardData();

    return () => {
      if (cleanup) {
        cleanup.then(fn => fn && fn());
      }
    };
  }, [managerId]);

  return { stats, loading, error };
};
```

### 2. 型安全なサービス呼び出し

```typescript
// 型安全なサービスファクトリ
export class ServiceFactory {
  static createStatsService(managerId: string): TypedStatsService {
    return {
      getStats: () => StatsService.subscribeToManagerStats(managerId, () => {}),
      getStaffCount: () => StatsService.getStaffCount(managerId),
      getBudgetStats: () => StatsService.getMonthlyBudgetStats(managerId)
    };
  }

  static createUserService(managerId: string): TypedUserService {
    return {
      getStaff: () => UserService.getStaffByManager(managerId),
      createStaff: (data: Partial<User>) => UserService.createStaff(managerId, data),
      updateStaff: (staffId: string, data: Partial<User>) =>
        UserService.updateStaff(managerId, staffId, data)
    };
  }
}

// 型定義
interface TypedStatsService {
  getStats(): Promise<ManagerStats>;
  getStaffCount(): Promise<StaffCountStats>;
  getBudgetStats(): Promise<BudgetStats>;
}

interface TypedUserService {
  getStaff(): Promise<User[]>;
  createStaff(data: Partial<User>): Promise<string>;
  updateStaff(staffId: string, data: Partial<User>): Promise<void>;
}
```

---

**最終更新**: 2025年9月18日
**バージョン**: v2.0
**担当**: サービス層アーキテクチャチーム