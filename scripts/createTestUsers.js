import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

// Firebase設定（環境変数から読み取り）
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const testUsers = [
  {
    uid: 'root-001',
    userId: 'root',
    password: 'root123',
    name: 'システム管理者',
    role: 'root',
    email: 'root@shifty.com',
    createdAt: new Date()
  },
  {
    uid: 'manager-001', 
    userId: 'manager',
    password: 'manager123',
    name: '店長太郎',
    role: 'manager',
    email: 'manager@shifty.com',
    shopName: 'テスト店舗',
    shopAddress: '東京都渋谷区テスト1-2-3',
    shopPhone: '03-1234-5678',
    shopEmail: 'test-shop@shifty.com',
    createdAt: new Date()
  },
  {
    uid: 'staff-001',
    userId: 'staff',
    password: 'staff123', 
    name: 'スタッフ花子',
    role: 'staff',
    email: 'staff@shifty.com',
    managerId: 'manager-001',
    hourlyRate: 1000,
    maxHoursPerWeek: 40,
    skills: ['ホール', 'レジ'],
    createdAt: new Date()
  }
];

async function createTestUsers() {
  try {
    console.log('🚀 テストユーザー作成開始...');
    
    for (const user of testUsers) {
      // 既存ユーザーチェック
      const existingUserQuery = query(
        collection(db, 'users'),
        where('userId', '==', user.userId)
      );
      const existingUserSnapshot = await getDocs(existingUserQuery);
      
      if (!existingUserSnapshot.empty) {
        console.log(`⚠️  ユーザー "${user.userId}" は既に存在します`);
        continue;
      }
      
      // ユーザー作成
      await addDoc(collection(db, 'users'), user);
      console.log(`✅ ユーザー "${user.userId}" を作成しました`);
    }
    
    console.log('🎉 テストユーザー作成完了！');
    console.log('\n📋 ログイン情報:');
    console.log('Root: userId="root", password="root123"');
    console.log('Manager: userId="manager", password="manager123"');  
    console.log('Staff: userId="staff", password="staff123"');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

createTestUsers();