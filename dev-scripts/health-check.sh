#!/bin/bash

# 🩺 Shifty開発環境ヘルスチェック
echo "🩺 Shifty Development Environment Health Check"
echo "=============================================="

# Node.js環境チェック
echo "📦 Node.js Environment:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  Architecture: $(uname -m)"

# プロジェクト依存関係チェック  
echo ""
echo "🔍 Project Dependencies:"
if [ -f "node_modules/.bin/next" ]; then
    echo "  ✅ Next.js binary: Found"
else
    echo "  ❌ Next.js binary: Missing"
fi

if [ -f "package-lock.json" ]; then
    echo "  ✅ package-lock.json: Found"
else
    echo "  ⚠️  package-lock.json: Missing"
fi

# キャッシュ状態チェック
echo ""
echo "🗄️  Cache Status:"
if [ -d ".next" ]; then
    echo "  📁 .next cache: $(du -sh .next | cut -f1)"
else
    echo "  📁 .next cache: Not found"
fi

if [ -d "node_modules/.cache" ]; then
    echo "  📁 npm cache: $(du -sh node_modules/.cache | cut -f1)"
else
    echo "  📁 npm cache: Not found"
fi

# ポート使用状況チェック
echo ""
echo "🌐 Port Usage:"
for port in 3000 3001 3002 3003; do
    if lsof -ti :$port > /dev/null 2>&1; then
        echo "  🔴 Port $port: In use"
    else
        echo "  🟢 Port $port: Available"
    fi
done

# 推奨アクション
echo ""
echo "💡 Recommended Actions:"
echo "  - Regular use: npm run dev"
echo "  - After problems: npm run dev:safe"
echo "  - Emergency: npm run reset"
echo "  - Alternative: npm run dev:npx"

echo ""
echo "✅ Health check completed!"