# 🛡️ Shifty - 安定した開発環境ガイド

## ❓ よくある問題

- `vendor-chunks/next.js` モジュールが見つからない
- `next: command not found` エラー
- 開発サーバーが頻繁にクラッシュ
- ビルドプロセスの失敗

## 🔧 安定化のための対策

### 1. **使用すべきコマンド**

```bash
# ✅ 推奨：安定版（標準webpack）
npm run dev

# ⚠️  実験的：高速だが不安定
npm run dev:turbo

# 🧹 問題時：完全クリーン
npm run dev:clean

# 🆘 緊急時：強制リセット
npm run fresh
```

### 2. **トラブルシューティング**

```bash
# Step 1: プロセス終了
lsof -ti :3000,3001,3002,3003 | xargs kill -9

# Step 2: キャッシュクリア
rm -rf .next node_modules/.cache

# Step 3: 開発サーバー再起動
npm run dev
```

### 3. **完全リセット（最終手段）**

```bash
# 依存関係の完全削除
rm -rf node_modules package-lock.json .next

# 依存関係の再インストール
npm install

# 開発サーバー起動
npm run dev
```

## 📋 安定化設定

### package.json 最適化

- ❌ `--turbopack` フラグを削除済み
- ✅ 標準webpackを使用
- ✅ 複数の開発オプション追加

### Next.js設定の最適化

```javascript
// next.config.ts
const nextConfig = {
  // Turbopackを無効化（安定性優先）
  experimental: {
    turbo: false
  },
  // TypeScript厳格モードを緩和
  typescript: {
    ignoreBuildErrors: false
  }
}
```

## 🎯 推奨ワークフロー

1. **日常開発**: `npm run dev`
2. **問題発生時**: `npm run dev:clean`
3. **重篤な問題**: `npm run fresh`
4. **最終手段**: 完全リセット

## 🔍 代替手段

### Docker環境（最も安定）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

### Yarn使用（npm代替）

```bash
# yarnのインストール
npm install -g yarn

# 依存関係のインストール
yarn install

# 開発サーバー起動
yarn dev
```

## ⚡ パフォーマンス最適化

### .gitignore 追加

```
# Development
.next/
node_modules/
*.tsbuildinfo
.turbo/

# Cache
.cache/
*.cache
```

### VSCode設定

```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "eslint.workingDirectories": ["./src"],
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true
  }
}
```

## 📊 依存関係管理

### 安定バージョンの使用

- Next.js: `15.5.2` (LTS推奨)
- React: `19.1.0` (安定版)
- TypeScript: `5.x` (最新安定版)
- Firebase: `11.0.0` (最新安定版)

### package-lock.json の管理

- 必ずバージョン管理に含める
- バックアップを作成する
- 破損時は削除して再生成

## 🚨 警告サイン

以下の症状が出たら即座にクリーンアップ：

- `MODULE_NOT_FOUND` エラー
- `vendor-chunks` 関連エラー
- 異常に遅いビルド
- ランダムなTypeScriptエラー

## ✅ 成功指標

正常な開発環境の確認項目：

- [x] `npm run dev` が5秒以内に起動
- [x] ホットリロードが正常に動作
- [x] TypeScriptエラーが適切に表示
- [x] ビルドが1分以内に完了