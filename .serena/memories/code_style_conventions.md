# コーディング規約とスタイル

## 命名規則
- **ファイル名**: camelCase（例: `userService.ts`）
- **コンポーネント**: PascalCase（例: `ChatSidebar.tsx`）
- **変数・関数**: camelCase（例: `getUserData`）
- **定数**: UPPER_SNAKE_CASE（例: `CHAT_MESSAGES_COLLECTION`）
- **型・インターフェース**: PascalCase（例: `User`, `ChatMessage`）

## ディレクトリ構造
```
src/
├── app/                 # Next.js App Router
├── components/          # 再利用可能コンポーネント
│   ├── ui/             # 基本UIコンポーネント
│   ├── layout/         # レイアウト関連
│   └── [domain]/       # ドメイン特化コンポーネント
├── lib/                # サービス層・ユーティリティ
├── hooks/              # カスタムフック
├── contexts/           # Reactコンテキスト
├── services/           # データサービス
├── types/              # TypeScript型定義
└── utils/              # 汎用ユーティリティ
```

## TypeScript規約
- **厳密な型付け**: `any`の使用を避ける
- **インターフェース定義**: 必須（`src/types/`）
- **Null安全**: `!`の使用を最小限に

## Firebase規約
- **コレクション名**: snake_case（例: `chat_messages`）
- **サービスクラス**: PascalCase（例: `ChatService`）
- **エラーハンドリング**: 必須（try-catch）
- **リアルタイムリスナー**: メモリリーク対策必須

## コメント規約
- **日本語コメント**: ビジネスロジック説明
- **英語コメント**: 技術的実装詳細
- **JSDoc**: 公開関数・クラス