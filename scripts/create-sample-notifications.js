import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 環境変数を読み込み
import 'dotenv/config';

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('Firebase Config:', {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey
});

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createSampleNotifications() {
  console.log('📢 Creating sample system notifications...');
  
  try {
    const sampleNotifications = [
      {
        type: 'user_registration',
        title: '新しい店長が登録されました',
        message: '田中太郎さんが新しい店長として登録されました',
        priority: 'medium',
        read: false
      },
      {
        type: 'security_alert',
        title: 'セキュリティアラート',
        message: '複数回のログイン失敗が検出されました (IP: 192.168.1.100)',
        priority: 'high',
        read: false
      },
      {
        type: 'system_error',
        title: 'システムエラー',
        message: 'バックアップ処理でエラーが発生しました。管理者に連絡してください。',
        priority: 'critical',
        read: false
      },
      {
        type: 'maintenance',
        title: 'メンテナンス予定',
        message: '9月15日 2:00-4:00にシステムメンテナンスを実施します',
        priority: 'medium',
        read: false
      },
      {
        type: 'statistics',
        title: 'ユーザー数が100名を突破',
        message: 'システム利用者数が100名を超えました。成長率: 前月比+25%',
        priority: 'low',
        read: true  // 1件は既読にしておく
      },
      {
        type: 'database',
        title: 'データベース最適化完了',
        message: 'データベースの最適化処理が正常に完了しました。パフォーマンスが15%向上しました。',
        priority: 'medium',
        read: true
      }
    ];

    const notificationsRef = collection(db, 'systemNotifications');
    
    for (const notification of sampleNotifications) {
      await addDoc(notificationsRef, {
        ...notification,
        timestamp: serverTimestamp()
      });
      console.log(`✅ Created: ${notification.title}`);
    }
    
    console.log('🎉 All sample notifications created successfully!');
    console.log(`📊 Total created: ${sampleNotifications.length} notifications`);
    console.log(`📚 Unread: ${sampleNotifications.filter(n => !n.read).length}`);
    console.log(`📖 Read: ${sampleNotifications.filter(n => n.read).length}`);
    
  } catch (error) {
    console.error('❌ Error creating notifications:', error);
  } finally {
    process.exit(0);
  }
}

createSampleNotifications();