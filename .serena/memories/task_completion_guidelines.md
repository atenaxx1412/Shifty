# タスク完了時の実行ガイドライン

## 必須チェック項目
タスク完了前に以下を必ず実行してください：

### 1. コード品質チェック
```bash
# 型チェック（必須）
npm run typecheck

# ESLintチェック（必須）  
npm run lint

# ビルドテスト（推奨）
npm run build
```

### 2. Firebase関連タスクの場合
```bash
# Firestoreインデックス確認
npm run create-indexes

# データベース接続テスト
npm run init-firestore

# 開発サーバーでの動作確認
npm run dev
```

### 3. Git操作
```bash
# 現在の状態確認
git status

# 変更内容の確認  
git diff

# ステージング（変更が意図的な場合）
git add .

# コミット（明確なメッセージで）
git commit -m "feat: Firebase query optimization for chat messages"
```

## エラー時の対応
- **型エラー**: TypeScript型定義を修正
- **Lintエラー**: ESLint規則に従って修正（自動修正: `npx eslint --fix`）
- **ビルドエラー**: 依存関係やImport文を確認
- **Firebase接続エラー**: 環境変数（.env.local）を確認

## 完了基準
- [ ] すべてのチェックがPASS
- [ ] ブラウザでの動作確認完了
- [ ] 関連するテストケースが動作
- [ ] ドキュメント更新（必要に応じて）

## 品質維持のルール
1. **機能が動作することを確認する**
2. **既存機能に影響がないことを確認する** 
3. **エラーログが出力されていないことを確認する**
4. **パフォーマンスが劣化していないことを確認する**