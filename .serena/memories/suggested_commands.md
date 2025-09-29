# 推奨コマンド一覧

## 開発コマンド
```bash
# 開発サーバー起動
npm run dev              # 標準の開発サーバー
npm run dev:safe         # .nextフォルダ削除後に開発サーバー起動
npm run dev:turbo        # Turbopackを使用した高速開発サーバー

# ビルド
npm run build            # 本番用ビルド
npm run build:safe       # .nextフォルダ削除後にビルド
npm run start            # 本番サーバー起動

# コード品質
npm run lint             # ESLintでコード品質チェック
npm run typecheck        # TypeScript型チェック

# メンテナンス
npm run clean            # .next, node_modules/.cacheを削除
npm run reset            # node_modules, package-lock.json, .nextを削除してnpm install
npm run health           # 依存関係とNode.js/npmバージョンチェック
```

## Firebase管理コマンド
```bash
# Firestoreデータベース管理
npm run create-indexes   # Firestoreインデックス作成
npm run cleanup-db       # Firestoreデータクリーンアップ  
npm run init-db          # Firestoreデータベース初期化
npm run reset-db         # データベースリセット（cleanup → init）
npm run init-firestore   # Firestore初期化

# テストデータ作成
npm run create-test-users # テストユーザー作成
```

## システム管理
```bash
# Git操作
git status && git branch # 現在の状態確認（セッション開始時必須）
git checkout -b feature/xxx # フィーチャーブランチ作成

# macOS（Darwin）固有
ls -la                   # ファイル一覧表示
find . -name "*.ts"      # TypeScriptファイル検索
grep -r "pattern" src/   # パターン検索
```

## トラブルシューティング
```bash
# 依存関係の問題
npm run reset           # 完全リセット
npm run health          # ヘルスチェック

# ビルドの問題  
npm run dev:safe        # セーフモード開発
npm run build:safe      # セーフモードビルド

# Firebaseの問題
npm run reset-db        # データベースリセット
```