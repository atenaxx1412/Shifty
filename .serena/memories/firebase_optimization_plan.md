# Firebase最適化計画

## 🔥 現在の課題と解決策

### 1. クエリパフォーマンス問題
**問題**: クライアント側でのソート処理が多数存在
**影響**: レスポンス速度低下、不要なデータ転送

**解決策**:
```typescript
// src/lib/simpleChatService.ts:248-250 の最適化
const q = query(
  collection(db, 'simpleChatMessages'),
  where('chatRoomId', '==', chatRoomId),
  orderBy('createdAt', 'desc'), // サーバー側ソート
  limit(50) // データ制限
);
```

### 2. 必要なFirestoreインデックス
**追加が必要なインデックス**:
```json
{
  "collectionGroup": "simpleChatMessages",
  "fields": [
    {"fieldPath": "chatRoomId", "order": "ASCENDING"},
    {"fieldPath": "createdAt", "order": "DESCENDING"}
  ]
},
{
  "collectionGroup": "shifts_extended", 
  "fields": [
    {"fieldPath": "managerId", "order": "ASCENDING"},
    {"fieldPath": "status", "order": "ASCENDING"},
    {"fieldPath": "date", "order": "ASCENDING"}
  ]
}
```

### 3. リアルタイムリスナーの最適化
**問題**: メモリリーク、不要なリスナー
**解決箇所**: 
- `src/lib/firebase.ts:95-200` のリアルタイムリスナー
- `src/lib/chatService.ts:566-568` のチャット監視

**改善コード**:
```typescript
// useEffect cleanup の強化
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
  return () => unsubscribe(); // 必須cleanup
}, [dependencies]);
```

### 4. バッチ処理の活用
**対象ファイル**: 
- `src/lib/shiftService.ts:1740-1742` (シフト一括更新)
- `src/lib/simpleChatService.ts:265-266` (未読数リセット)

## 🎯 実装優先度

### 高優先度 (今すぐ実装)
1. **チャットクエリ最適化**: `simpleChatService.ts` のソート処理改善
2. **必要インデックス追加**: `firestore.indexes.json` 更新
3. **リスナーcleanup強化**: 全コンポーネントでuseEffect cleanup確認

### 中優先度 (次のスプリント)
1. **シフト検索ページング**: 大量データ対応
2. **出勤データ集約最適化**: 月次レポート高速化
3. **オフライン対応強化**: PWA機能拡充

### 低優先度 (将来的に)
1. **Firebase Functionsへの移行**: 重い処理のサーバー移行
2. **セキュリティルール詳細化**: きめ細かいアクセス制御
3. **使用量監視強化**: コスト最適化

## 📊 期待効果
- **チャット応答速度**: 2-3秒 → 0.5-1秒
- **シフト検索速度**: 5-8秒 → 1-2秒  
- **月次Firebase使用量**: 30-40%削減
- **ユーザー体験**: 大幅改善

## 🛠 実装手順
1. `firestore.indexes.json` インデックス追加
2. `npm run create-indexes` でデプロイ
3. 各サービスファイルのクエリ最適化
4. リアルタイムリスナーのcleanup強化
5. パフォーマンステスト実行