# Managerユーザー（店長）ドキュメント

## 概要
Managerユーザーは「Shifty」システムにおける店長の役割を持ち、自分の店舗のスタッフとシフト管理を担当します。スタッフの雇用、シフト作成、予算管理、承認業務などを行います。

## 役割と権限

### 🏪 店舗管理
- 自分の店舗情報（shopName, shopAddress, shopPhone, shopEmail）の管理
- 店舗のパフォーマンス分析と統計確認
- 店舗固有の設定とルール管理
- 営業時間と業務パターンの設定

### 👥 スタッフ管理
- 自分の店舗のスタッフ（Staff）の雇用・編集・管理
- スタッフの勤務条件（hourlyRate, maxHoursPerWeek）設定
- スタッフのスキル（skills）と職種（position）管理
- スタッフのアクセス権限とアカウント管理

### 📅 シフト管理
- シフトの作成・編集・削除
- シフトパターンとテンプレートの管理
- スタッフのシフト希望確認と調整
- シフトの承認・却下処理

### 💰 予算管理
- 人件費の計算と予算分析
- シフト別コスト計算
- 月次・週次予算レポート作成
- 予算超過アラートと最適化提案

## 主要機能

### ダッシュボード (`/manager`)
**機能概要**: 店舗の状況を一元管理

**統計情報**（リアルタイム更新）:
- 管理スタッフ数: 現在のスタッフ数とトレンド
- 今週のシフト: 作成済みシフト数
- 承認待ち: 未処理のリクエスト数
- 今月の人件費: 予算消化状況（k円単位）

**店舗インサイト**:
- 売上トレンド: 前週比での売上変化
- スタッフ効率: 労働効率の監視（95%目標）
- シフト充足率: カバー率の確認（98%目標）

### シフト管理 (`/manager/shifts`)
**機能**:
- 新規シフト作成（日付、時間、必要人数）
- 既存シフトの編集と削除
- シフトスロット（時間帯別）の詳細設定
- 必要スキルと優先度の設定

**データ構造**:
```typescript
interface Shift {
  shiftId: string;
  managerId: string;    // 店長のUID
  date: Date;
  slots: ShiftSlot[];
  status: 'draft' | 'published' | 'completed';
}

interface ShiftSlot {
  slotId: string;
  startTime: string;    // "09:00"
  endTime: string;      // "15:00"
  requiredStaff: number;
  assignedStaff: string[];  // Staff UIDs
  positions?: string[];     // "ホール", "キッチン"
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### シフトカレンダー (`/manager/shifts/calendar`)
**機能**:
- カレンダービューでのシフト表示
- ドラッグ&ドロップでのシフト調整
- 月次・週次・日次表示切替
- スタッフ別色分け表示

### スタッフ管理 (`/manager/staff`)
**機能**:
- スタッフアカウントの作成・編集
- スタッフプロファイル管理
- 勤務条件の設定
- スキルと経験値の管理

**スタッフデータ管理**:
```typescript
interface User {  // Staff用
  managerId: string;        // この店長のUID
  hourlyRate?: number;      // 時給設定
  maxHoursPerWeek?: number; // 週最大時間
  skills?: string[];        // ["ホール", "レジ", "キッチン"]
  employmentType?: 'full-time' | 'part-time' | 'contract';
  availability?: {
    [day: string]: {
      available: boolean;
      timeSlots?: { start: string; end: string }[];
    };
  };
}
```

### 承認管理 (`/manager/approvals`)
**承認対象**:
- シフト希望申請（ShiftRequest）
- シフト交換申請（ShiftExchange）
- 休暇申請・その他のリクエスト

**機能**:
- 承認・却下の一括処理
- 承認理由とコメント追加
- 自動承認ルールの設定
- 承認履歴の確認

### 予算管理 (`/manager/budget`)
**計算機能**:
- 基本給計算（時給 × 勤務時間）
- 残業代計算（1.25倍など）
- 深夜手当・休日手当
- 社会保険料・税金計算

**予算テンプレート**:
```typescript
interface BudgetTemplate {
  templateId: string;
  managerId: string;
  staffRates: Record<string, number>;  // userId -> hourly rate
  multipliers: {
    overtime: number;      // 1.25
    nightShift: number;    // 1.1
    weekend: number;       // 1.0
    holiday: number;       // 1.5
  };
  companyRates: {
    socialInsurance: number;       // 0.15
    unemploymentInsurance: number; // 0.006
    workersCompensation: number;   // 0.005
  };
}
```

### スケジュール確認 (`/manager/schedules`)
**機能**:
- スタッフ別スケジュール表示
- シフト充足状況の確認
- 空きシフトと人員不足の特定
- スケジュール調整と最適化提案

## データベース連携

### 使用するFirestoreコレクション
1. **`users`**: 自分の店舗のスタッフ情報
2. **`shifts`**: 自分が作成したシフト
3. **`shiftRequests`**: スタッフからのシフト希望
4. **`shiftExchanges`**: スタッフ間のシフト交換
5. **`budgetCalculations`**: 予算計算結果

### データアクセスパターン
```javascript
// 自分の店舗のスタッフ取得
const staffQuery = query(
  collection(db, 'users'),
  where('managerId', '==', currentUser.uid),
  where('role', '==', 'staff')
);

// 自分のシフト取得
const shiftsQuery = query(
  collection(db, 'shifts'),
  where('managerId', '==', currentUser.uid)
);

// リアルタイム統計監視
const unsubscribe = StatsService.subscribeToManagerStats(
  currentUser.uid,
  (stats: ManagerStats) => {
    setManagerStats(stats);
  }
);
```

## 認証・セキュリティ

### アクセス制御
- **必要役割**: `requiredRoles={['root', 'manager']}`
- **データ分離**: 自分の店舗データのみアクセス可能
- **権限チェック**: 
  ```typescript
  const isAuthorized = (requiredRoles?: UserRole[]) => {
    if (currentUser.role === 'root') return true; // Root is admin
    return requiredRoles.includes(currentUser.role);
  };
  ```

### データセキュリティ
- **Firestore Rules**: managerIdベースのアクセス制御
- **セッション管理**: 30分自動タイムアウト
- **監査ログ**: 重要な操作（スタッフ追加、シフト承認）を記録

## 使いやすさとUX

### ダッシュボードの特徴
- **リアルタイム統計**: StatsServiceによる自動更新
- **トレンド表示**: 前期比での増減表示（+12%、NEW、減少）
- **承認待ちハイライト**: 未処理項目の強調表示
- **アクションパネル**: 6つの主要機能への直接アクセス

### モバイル対応
- **レスポンシブデザイン**: スマートフォン・タブレット完全対応
- **タッチ最適化**: タップしやすいボタンサイズ
- **高速表示**: 必要最小限のデータ転送

### ワークフロー最適化
- **一括操作**: 複数承認の同時処理
- **自動計算**: 予算とコストの自動算出
- **通知システム**: 重要なイベントのリアルタイム通知

## パフォーマンス最適化

### データ取得の最適化
- **並列クエリ**: 複数の統計を同時取得
- **キャッシュ戦略**: 頻繁にアクセスするデータの保存
- **ページネーション**: 大量データの段階的読み込み

### リアルタイム更新
- **WebSocket接続**: Firestore onSnapshotによる即時更新
- **差分更新**: 変更部分のみUI反映
- **接続管理**: 不要な接続の自動切断

## 技術仕様

### ファイル構成
```
src/app/manager/
├── page.tsx                    # メインダッシュボード
├── shifts/
│   ├── page.tsx               # シフト管理
│   └── calendar/
│       ├── page.tsx           # カレンダービュー
│       └── page_improved.tsx  # 改善版カレンダー
├── staff/page.tsx             # スタッフ管理
├── approvals/page.tsx         # 承認管理
├── schedules/page.tsx         # スケジュール確認
└── budget/page.tsx            # 予算管理
```

### 依存サービス
- **StatsService**: リアルタイム統計計算（`src/lib/statsService.ts`）
- **BudgetService**: 予算計算エンジン（`src/lib/budgetService.ts`）
- **ShiftService**: シフト管理ロジック（`src/lib/shiftService.ts`）

## トラブルシューティング

### よくある問題
1. **統計が更新されない**
   - StatsServiceの接続状態を確認
   - Firestore接続の確認
   
2. **スタッフが見つからない**
   - managerIdの設定確認
   - ユーザーロールの確認

3. **予算計算が合わない**
   - BudgetTemplateの設定確認
   - スタッフの時給設定確認

### デバッグ手順
```javascript
// 統計デバッグ
console.log('📊 Manager stats:', managerStats);

// スタッフ取得デバッグ
console.log('👥 Staff query result:', staffSnapshot.size);

// 予算計算デバッグ
console.log('💰 Budget calculation:', budgetResult);
```

---

**最終更新**: 2025年9月16日  
**バージョン**: v1.0  
**担当**: システム開発チーム