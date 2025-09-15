# Staffユーザー（スタッフ）ドキュメント

## 概要
Staffユーザーは「Shifty」システムにおけるスタッフの役割を持ち、自分のシフト管理と勤怠管理を行います。シフト希望の提出、交換申請、出退勤記録、スケジュール確認などが主な機能です。

## 役割と権限

### 📅 シフト関連
- 自分のシフト希望の提出・編集
- 確定シフトの確認と管理
- 他スタッフとのシフト交換申請
- 緊急シフトの確認と応募

### ⏰ 勤怠管理
- 出勤・退勤の記録（打刻）
- 勤務時間の確認と管理
- 月次・週次勤務実績の確認
- 休憩時間と残業時間の記録

### 📊 個人情報管理
- プロファイル情報の確認・更新
- 勤務可能時間の設定
- スキルと経験の管理
- 給与・交通費情報の確認

### 🔔 通知・コミュニケーション
- シフト関連通知の受信
- 店長からのお知らせ確認
- システムからの重要通知
- スタッフ間コミュニケーション

## 主要機能

### ダッシュボード (`/staff`)
**機能概要**: スタッフの日常業務を一元管理

**統計情報**:
- 今月のシフト: 勤務予定回数（12回）
- 今月の勤務時間: 累計勤務時間（96時間）
- 未確認の通知: 新しい通知数（3件）
- 今月の評価: パフォーマンス評価（4.8/5.0）

**出勤・退勤管理**:
- **リアルタイム状態表示**: 現在の勤務状況（勤務中/勤務外）
- **ワンクリック打刻**: 出勤・退勤ボタン
- **勤務時間表示**: 本日の累計勤務時間
- **詳細記録**: 出勤時刻、退勤時刻、メモ

### 出退勤システム
**技術仕様**:
```typescript
// 出勤記録
await attendanceService.clockIn(
  currentUser,
  shiftId?,        // 関連するシフトID（任意）
  location?,       // 位置情報（任意）
  notes: string    // メモ
);

// 退勤記録
await attendanceService.clockOut(
  currentUser.uid,
  location?,       // 位置情報（任意）
  notes: string    // メモ
);

// リアルタイム状態監視
const unsubscribe = attendanceService.subscribeToAttendanceStatus(
  currentUser.uid,
  (status: AttendanceStatus) => {
    setAttendanceStatus(status);
  }
);
```

**勤怠データ構造**:
```typescript
interface AttendanceRecord {
  recordId: string;
  userId: string;
  managerId: string;     // 所属店長のUID
  date: Date;
  clockInTime?: Date;    // 出勤時刻
  clockOutTime?: Date;   // 退勤時刻
  status: 'clocked_in' | 'clocked_out' | 'break' | 'absent';
  totalWorkTime?: number;    // 実際の労働時間（分）
  breakTime?: number;        // 休憩時間（分）
  overtimeMinutes?: number;  // 残業時間（分）
  notes?: string;            // メモ
}
```

### シフト確認 (`/staff/schedule`)
**機能**:
- **カレンダービュー**: 今後のシフト予定表示
- **詳細情報**: 日時、勤務時間、ポジション、状態
- **月次・週次切替**: 表示期間の選択
- **ステータス表示**: 「確定」「仮」「調整中」

**シフト表示例**:
```
09/17(火) 09:00-15:00 [ホール] 確定
09/19(木) 15:00-21:00 [キッチン] 確定  
09/21(土) 09:00-15:00 [ホール] 仮
09/23(月) 18:00-22:00 [レジ] 確定
```

### シフト希望提出 (`/staff/requests/new`)
**機能**:
- **希望日時選択**: カレンダーから希望日を選択
- **時間帯指定**: 勤務可能時間の設定
- **優先度設定**: 'preferred' | 'available' | 'unavailable'
- **メモ追加**: 特記事項や要望の入力

**データ構造**:
```typescript
interface ShiftRequest {
  requestId: string;
  userId: string;
  shiftId: string;
  date: Date;
  preference: 'preferred' | 'available' | 'unavailable';
  timeSlots?: { start: string; end: string }[];
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

### シフト希望履歴 (`/staff/requests`)
**機能**:
- **申請履歴**: 過去の希望申請一覧
- **ステータス確認**: 承認・却下・保留中の状態
- **編集・削除**: 未承認の希望の修正
- **フィルタリング**: 期間や状態での絞り込み

### シフト交換 (`/staff/exchanges`)
**機能**:
- **交換申請**: 他スタッフとのシフト交換依頼
- **交換要請への対応**: 受信した交換要請の承認・却下
- **交換履歴**: 過去の交換実績確認
- **自動マッチング**: システムによる最適な交換相手提案

**交換データ構造**:
```typescript
interface ShiftExchange {
  exchangeId: string;
  fromUserId: string;    // 交換依頼者
  toUserId?: string;     // 交換相手（未定の場合はundefined）
  shiftId: string;
  shiftSlotId: string;
  reason?: string;       // 交換理由
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;   // 承認者（通常は店長）
}
```

### 勤務実績 (`/staff/attendance`)
**機能**:
- **月次集計**: 勤務日数、総労働時間、残業時間
- **日別詳細**: 日毎の出退勤記録
- **給与概算**: 時給ベースの給与計算
- **CSV出力**: 勤務データのエクスポート

**勤務実績データ**:
```typescript
interface AttendanceSummary {
  userId: string;
  period: { start: Date; end: Date };
  totalWorkDays: number;        // 勤務日数
  totalWorkTime: number;        // 総労働時間（分）
  totalOvertimeMinutes: number; // 総残業時間
  averageWorkTimePerDay: number;// 平均勤務時間
  attendanceRate: number;       // 出勤率（%）
  lateCount: number;            // 遅刻回数
  earlyLeaveCount: number;      // 早退回数
}
```

## データベース連携

### 使用するFirestoreコレクション
1. **`users`**: 自分のプロファイル情報
2. **`shifts`**: 確定シフト情報（読み取り専用）
3. **`shiftRequests`**: 自分の希望申請
4. **`shiftExchanges`**: シフト交換関連
5. **`attendanceRecords`**: 出退勤記録
6. **`notifications`**: 通知・お知らせ

### データアクセスパターン
```javascript
// 自分のシフト取得
const shiftsQuery = query(
  collection(db, 'shifts'),
  where('assignedStaff', 'array-contains', currentUser.uid)
);

// 自分の勤怠記録取得
const attendanceQuery = query(
  collection(db, 'attendanceRecords'),
  where('userId', '==', currentUser.uid),
  orderBy('date', 'desc')
);

// リアルタイム出勤状況監視
const unsubscribe = attendanceService.subscribeToAttendanceStatus(
  currentUser.uid,
  (status) => setAttendanceStatus(status)
);
```

## 認証・セキュリティ

### アクセス制御
- **必要役割**: `allowedRoles={['root', 'manager', 'staff']}`
- **データ分離**: 自分関連のデータのみアクセス可能
- **権限制御**: 他スタッフのデータは閲覧不可

### プライバシー保護
- **個人情報**: 給与・評価情報の暗号化
- **位置情報**: 出退勤時の位置記録（任意）
- **データ保持**: 法定保存期間後の自動削除

## 使いやすさとUX

### モバイルファースト設計
- **スマートフォン最適化**: 出退勤操作の簡易化
- **タッチフレンドリー**: 大きなボタンとスワイプ操作
- **オフライン対応**: ネットワーク不良時の対応

### 直感的インターフェース
- **ダッシュボード**: 重要な情報を一目で確認
- **アクションパネル**: 6つの主要機能への素早いアクセス
- **ステータス表示**: 現在の状況を視覚的に表示

### 通知システム
**通知タイプ**:
- **shift_assigned**: シフト確定通知
- **exchange_request**: シフト交換依頼
- **reminder**: 希望提出締切通知
- **announcement**: 店長からのお知らせ

**通知表示**:
```typescript
interface Notification {
  notificationId: string;
  userId: string;
  type: 'shift_assigned' | 'shift_changed' | 'exchange_request' | 
        'exchange_response' | 'reminder' | 'announcement';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
```

## パフォーマンス最適化

### リアルタイム更新
- **WebSocket接続**: 即座の状態変化反映
- **差分更新**: 変更箇所のみUI更新
- **接続管理**: バッテリー消費最小化

### データ効率化
- **ページネーション**: 大量データの段階的読み込み
- **キャッシュ戦略**: よく使用するデータの保存
- **画像最適化**: プロファイル画像の軽量化

## 技術仕様

### ファイル構成
```
src/app/staff/
├── page.tsx              # メインダッシュボード
├── schedule/page.tsx     # シフト確認
├── requests/
│   ├── page.tsx          # 希望履歴
│   └── new/page.tsx      # 新規希望提出
├── exchanges/page.tsx    # シフト交換
└── attendance/page.tsx   # 勤務実績（未実装）
```

### 依存サービス
- **AttendanceService**: 勤怠管理エンジン（`src/lib/attendanceService.ts`）
- **ShiftService**: シフト管理ロジック（`src/lib/shiftService.ts`）
- **NotificationService**: 通知管理システム

### 外部ライブラリ
```typescript
// 日付操作
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

// UI コンポーネント
import { Timer, Play, Square, MapPin } from 'lucide-react';
```

## トラブルシューティング

### よくある問題

1. **出退勤が記録されない**
   ```
   解決策:
   - ネットワーク接続の確認
   - ブラウザの位置情報許可確認
   - localStorage の容量確認
   ```

2. **シフトが表示されない**
   ```
   解決策:
   - managerId の設定確認
   - シフト承認状況の確認
   - 日付フィルタの確認
   ```

3. **通知が届かない**
   ```
   解決策:
   - 通知許可設定の確認
   - Firestore Rules の確認
   - サービスワーカーの状態確認
   ```

### デバッグ手順
```javascript
// 出勤状況デバッグ
console.log('📊 Attendance status:', attendanceStatus);

// シフトデバッグ
console.log('📅 Upcoming shifts:', upcomingShifts);

// 通知デバッグ
console.log('🔔 Notifications:', recentNotifications);
```

## よくある質問 (FAQ)

**Q: 出勤時刻を間違えて記録した場合は？**
A: 店長に修正依頼を行うか、管理者に連絡してください。

**Q: シフト交換が承認されない場合は？**
A: 店長による最終承認が必要です。交換理由を明記してください。

**Q: 給与情報はどこで確認できますか？**
A: 勤務実績ページで概算を確認できますが、正式な給与明細は別途提供されます。

---

**最終更新**: 2025年9月16日  
**バージョン**: v1.0  
**担当**: システム開発チーム