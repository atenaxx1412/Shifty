# Rootユーザー（システム管理者）ドキュメント

## 概要
Rootユーザーは「Shifty」システムの最高管理権限を持つ役割です。システム全体の設定、全ユーザーの管理、データベース操作、セキュリティ監視などを担当します。

## 役割と権限

### 🔧 システム管理
- システム全体の設定と環境変数の管理
- サーバー稼働状況とパフォーマンスの監視
- システムメンテナンスとバックアップの実行
- エラーログとシステムアラートの監視

### 👥 ユーザー管理
- 全店長（Manager）ユーザーの作成・編集・削除
- 全スタッフ（Staff）ユーザーの閲覧・管理
- ユーザー権限とアクセス制御の設定
- アカウントのロック・解除とパスワードリセット

### 🏪 店舗管理
- 新規店舗（Manager）の追加と承認
- 店舗情報（shopName, shopAddress, shopPhone, shopEmail）の管理
- 店舗別パフォーマンスと統計データの分析
- 店舗間のデータ整合性確保

## 主要機能

### ダッシュボード (`/root`)
**機能概要**: システム全体の状況を一元監視

**統計情報**:
- 総ユーザー数（リアルタイム更新）
- アクティブ店長数
- システム全体のシフト数
- セキュリティアラート件数

**システム状態監視**:
- サーバー応答時間（45ms）
- データベース接続数（12/100）
- 予定されたメンテナンス通知

### 店長管理 (`/root/shops`)
**機能**:
- 店長アカウントの作成・編集・削除
- 店舗情報の詳細管理
- 店長別パフォーマンス分析
- スタッフ数と店舗規模の統計

**データ管理**:
```typescript
// Manager用データ構造
{
  role: 'manager',
  shopName: string,      // 店舗名
  shopAddress: string,   // 住所
  shopPhone: string,     // 電話番号
  shopEmail: string      // 店舗メール
}
```

### ユーザー管理 (`/root/users`)
**機能**:
- 全ユーザー（Root, Manager, Staff）の一覧表示
- ユーザー詳細情報の編集
- ユーザー役割（Role）の変更
- ユーザーアクティビティログの確認

### データベース管理 (`/root/database`)
**機能**:
- Firestoreデータベースの状態監視
- データのバックアップと復元
- データベース最適化とクリーンアップ
- データ整合性チェックとレポート

### システム設定 (`/root/settings`)
**設定項目**:
- セッション管理（タイムアウト: 30分）
- セキュリティポリシー設定
- システム通知とアラート設定
- データ保持ポリシーと自動削除設定

### ログ管理 (`/root/logs`)
**監視対象**:
- ユーザーログイン・ログアウト履歴
- システムエラーとセキュリティイベント
- データベース操作ログ
- パフォーマンス統計とアラート

### レポート機能 (`/root/reports`)
**統合レポート**:
- 全店舗の月次・週次パフォーマンス
- ユーザーアクティビティ統計
- システム利用状況分析
- セキュリティインシデントレポート

## データベース連携

### 使用するFirestoreコレクション
1. **`users`**: 全ユーザー情報（Root, Manager, Staff）
2. **`activityLogs`**: システム活動ログ
3. **`shifts`**: 全店舗のシフト情報（読み取り専用）
4. **`systemSettings`**: システム設定情報

### 主要クエリ例
```javascript
// 全ユーザー数取得
const usersSnapshot = await getDocs(collection(db, 'users'));
setTotalUsers(usersSnapshot.size);

// 店長数取得
const managersQuery = query(
  collection(db, 'users'), 
  where('role', '==', 'manager')
);
const managersSnapshot = await getDocs(managersQuery);

// リアルタイムアクティビティログ監視
const unsubscribe = onSnapshot(
  query(collection(db, 'activityLogs'), 
        orderBy('timestamp', 'desc'), 
        limit(4)),
  (snapshot) => {
    // ログ更新処理
  }
);
```

## 認証・セキュリティ

### アクセス制御
- **認証**: カスタムFirestore認証システム
- **セッション管理**: 30分自動タイムアウト
- **権限チェック**: `isAuthorized(['root'])`
- **ミドルウェア**: `/root/*` パス保護

### セキュリティ監視
- ログイン失敗試行の監視
- 異常なデータベースアクセスの検出
- システム侵入試行アラート
- 自動ロックアウト機能

### 監査ログ
```typescript
// 成功ログ
await logAuth('Login Success', user.uid, user.name, user.role, true);

// セキュリティイベント
await logSecurity('Failed Login Attempt', 'warn', 
                  undefined, userId, 
                  { userId, reason: 'Invalid credentials' });
```

## 使いやすさとUX

### ダッシュボードの特徴
- **リアルタイム更新**: WebSocket接続による即座の状態反映
- **レスポンシブデザイン**: モバイル・タブレット対応
- **直感的UI**: 重要な情報を視覚的に表示
- **効率的ナビゲーション**: 6つの主要機能への素早いアクセス

### パフォーマンス
- **高速読み込み**: 統計データの並列取得
- **効率的データ表示**: 必要最小限のデータ取得
- **キャッシュ活用**: 頻繁にアクセスされるデータの最適化

### エラーハンドリング
- **グレースフルデグラデーション**: 一部機能エラー時も他機能は継続
- **ユーザーフレンドリーなエラーメッセージ**: 技術詳細は隠蔽
- **自動リトライ**: 一時的な接続エラーに対する自動回復

## 技術仕様

### 使用技術
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Firebase/Firestore
- **認証**: カスタムFirestore認証
- **状態管理**: React Context API
- **リアルタイム通信**: Firestore onSnapshot

### ファイル構成
```
src/app/root/
├── page.tsx              # メインダッシュボード
├── shops/
│   ├── page.tsx          # 店長管理
│   └── staff-modal.tsx   # スタッフモーダル
├── users/page.tsx        # ユーザー管理
├── database/page.tsx     # データベース管理
├── settings/page.tsx     # システム設定
├── logs/page.tsx         # ログ管理
└── reports/page.tsx      # レポート機能
```

## 開発者向け情報

### 新機能追加時の注意点
1. **権限チェック**: 全てのRoot機能で`allowedRoles={['root']}`確認
2. **監査ログ**: 重要な操作は必ず`auditLogger`に記録
3. **エラーハンドリング**: ユーザー向けと開発者向けメッセージを分離
4. **パフォーマンス**: 大量データ処理時はページネーション実装

### デバッグとトラブルシューティング
- **ログレベル**: Console.log で詳細な実行ログを出力
- **Firestore Rules**: データベースアクセス権限の確認
- **ネットワークタブ**: API呼び出しとレスポンス時間の監視

---

**最終更新**: 2025年9月16日  
**バージョン**: v1.0  
**担当**: システム開発チーム