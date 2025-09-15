import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root directory
config({ path: path.resolve(process.cwd(), '.env.local') });

// Debug environment variables
console.log('🔍 Environment variables debug:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'MISSING');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'MISSING');
console.log('Working directory:', process.cwd());

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { User, UserRole } from '../src/types';

// Initialize Firebase directly in script
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

console.log('🔥 Script Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasAll: Object.values(firebaseConfig).every(v => v && v !== 'undefined')
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface TestAccount {
  userId: string;
  password: string;
  name: string;
  role: UserRole;
  description: string;
}

const testAccounts: TestAccount[] = [
  {
    userId: 'root',
    password: 'demo123',
    name: 'システム管理者',
    role: 'root',
    description: 'すべての機能にアクセス可能'
  },
  {
    userId: 'manager',
    password: 'demo123',
    name: '田中店長',
    role: 'manager',
    description: 'スタッフ管理とシフト作成が可能'
  },
  {
    userId: 'staff',
    password: 'demo123',
    name: '山田太郎',
    role: 'staff',
    description: '自分のシフト確認と希望提出が可能'
  }
];

async function initializeFirestore() {
  console.log('🚀 Firestore初期化を開始します...');
  
  try {
    for (const account of testAccounts) {
      try {
        console.log(`\n👤 ${account.role}アカウントを作成中: ${account.userId}`);
        
        // Generate unique uid
        const uid = `${account.role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create user document in Firestore
        const userData: User = {
          uid,
          userId: account.userId,
          password: account.password, // In production, this should be hashed
          name: account.name,
          role: account.role,
          employmentType: account.role === 'staff' ? 'part-time' : 'full-time',
          skills: [],
          availability: {},
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        // Add role-specific data for manager
        if (account.role === 'manager') {
          userData.shopName = 'サンプル店舗';
          userData.shopAddress = '東京都渋谷区1-1-1';
          userData.shopPhone = '03-1234-5678';
          userData.shopEmail = 'shop@shifty.com';
        }
        
        await setDoc(doc(db, 'users', uid), userData);
        console.log(`✅ ${account.role}アカウント作成完了: ${account.name} (ID: ${account.userId})`);
        
      } catch (error: any) {
        console.error(`❌ ${account.role}アカウント作成エラー:`, error.message);
        throw error;
      }
    }
    
    // Create sample shop
    console.log('\n🏪 サンプル店舗を作成中...');
    const shopData = {
      shopId: 'shop_001',
      name: 'Shifty Cafe本店',
      address: '東京都渋谷区1-1-1',
      managers: [], // Will be filled by manager UIDs
      staff: [], // Will be filled by staff UIDs
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await setDoc(doc(db, 'shops', 'shop_001'), shopData);
    console.log('✅ サンプル店舗作成完了');
    
    console.log('\n🎉 Firestore初期化が完了しました!');
    console.log('\n📋 作成されたテストアカウント:');
    testAccounts.forEach(account => {
      console.log(`${account.role}: ${account.userId} / ${account.password} (${account.name})`);
    });
    
  } catch (error) {
    console.error('❌ 初期化エラー:', error);
    process.exit(1);
  }
}

// Run initialization
if (require.main === module) {
  initializeFirestore()
    .then(() => {
      console.log('✅ 初期化スクリプト実行完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプト実行エラー:', error);
      process.exit(1);
    });
}

export { initializeFirestore };