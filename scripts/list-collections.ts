import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root directory
config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Initialize Firebase directly in script
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listAllCollections() {
  console.log('📊 Firestore データベース分析中...\n');
  
  try {
    // 主要なコレクションを手動でチェック（Firestoreは全コレクション一覧機能がクライアント側にない）
    const knownCollections = [
      'users',
      'shops', 
      'shifts',
      'shifts_extended',
      'shiftRequests',
      'shiftExchanges',
      'notifications',
      'chatRooms',
      'chatMessages',
      'attendanceRecords',
      'budgetCalculations',
      'activityLogs',
      'system_logs',
      'login' // 古いコレクション
    ];

    console.log('🔍 既知のコレクションをチェック中...\n');

    for (const collectionName of knownCollections) {
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        if (!snapshot.empty) {
          console.log(`📦 ${collectionName}: ${snapshot.size}個のドキュメント`);
          
          // 最初のドキュメントの構造をサンプル表示
          const firstDoc = snapshot.docs[0];
          const data = firstDoc.data();
          const keys = Object.keys(data).slice(0, 5); // 最初の5つのフィールドのみ
          console.log(`   📋 フィールド例: ${keys.join(', ')}${Object.keys(data).length > 5 ? '...' : ''}`);
          console.log(`   🆔 サンプルID: ${firstDoc.id}\n`);
        }
      } catch (error: any) {
        if (!error.message.includes('not found')) {
          console.log(`⚠️ ${collectionName}: アクセスエラー`);
        }
      }
    }

    console.log('✅ データベース分析完了');
    
  } catch (error) {
    console.error('❌ 分析エラー:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  listAllCollections()
    .then(() => {
      console.log('\n🎉 分析スクリプト実行完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプト実行エラー:', error);
      process.exit(1);
    });
}

export { listAllCollections };