#!/bin/bash

# 🧹 クリーンスタート用スクリプト
echo "🧹 Cleaning development environment..."

# 既存のNode.jsプロセスを終了
echo "📴 Killing existing Node.js processes..."
lsof -ti :3000,3001,3002,3003 | xargs kill -9 2>/dev/null || true

# .nextディレクトリを削除
echo "🗑️ Removing .next directory..."
rm -rf .next

# package-lock.jsonのバックアップ作成
echo "💾 Creating package-lock.json backup..."
cp package-lock.json package-lock.json.backup 2>/dev/null || true

# 開発サーバーを起動
echo "🚀 Starting development server..."
npm run dev

echo "✅ Clean start completed!"