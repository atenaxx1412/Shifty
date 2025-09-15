# 🔄 Shifty - 安定した開発ワークフロー

## 📋 日常の開発コマンド

### 通常の開発
```bash
npm run dev          # 標準の開発サーバー（推奨）
```

### 問題が発生した時
```bash
npm run dev:safe     # .nextをクリアして起動
npm run dev:npx      # npxを使った安全な起動
```

### 緊急時（完全リセット）
```bash
npm run reset        # 完全な依存関係再インストール
```

### ヘルスチェック
```bash
./dev-scripts/health-check.sh  # 開発環境の状態確認
npm run health                 # 依存関係確認
```

## ⚠️ 避けるべきコマンド

❌ `npm run dev:turbo` - 不安定なTurbopack  
❌ `sudo rm -rf` - 権限問題の原因  
❌ `npm install --force` - 依存関係破損のリスク  

## 🛡️ 破損防止のルール

### 1. **定期的なクリーンアップ**
```bash
# 週1回実行推奨
npm run clean        # キャッシュクリア
```

### 2. **安全な停止手順**
```bash
# 開発サーバー停止時
Ctrl+C               # 一度で停止
lsof -ti :3001 | xargs kill -9  # 強制停止が必要な場合のみ
```

### 3. **依存関係管理**
- `package-lock.json`は必ずgitにコミット
- 新しいパッケージ追加後は`npm run health`で確認
- Node.jsバージョンは`.nvmrc`で固定

## 🚨 トラブルシューティング

### 症状：`next: command not found`
```bash
npm run dev:npx      # npxで回避
```

### 症状：`MODULE_NOT_FOUND` 
```bash
npm run dev:safe     # キャッシュクリア後に起動
```

### 症状：`ENOTEMPTY` エラー
```bash
npm run reset        # 完全リセット
```

### 症状：ポート使用中
```bash
lsof -ti :3000,3001,3002 | xargs kill -9
npm run dev
```

## ✅ 正常動作の確認

以下が正常に表示されればOK：
```
✓ Starting...
✓ Ready in 3.1s
- Local: http://localhost:3001
```

## 📊 パフォーマンス最適化

### VS Code設定
```json
// .vscode/settings.json
{
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true
  }
}
```

### Git無視設定
```
# .gitignore に追加済み
.next/
node_modules/
*.tsbuildinfo
.turbo/
```

## 🎯 成功のベストプラクティス

1. **一つのコマンドで開発**: `npm run dev`
2. **問題時は安全モード**: `npm run dev:safe`
3. **定期的なヘルスチェック**: `./dev-scripts/health-check.sh`
4. **緊急時のみリセット**: `npm run reset`

この設定により、依存関係の破損リスクが大幅に減少します！