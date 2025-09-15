const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, Timestamp } = require('firebase/firestore');

// 環境変数を読み込み
require('dotenv').config();

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

async function createSimpleUser() {
  console.log('👤 Creating simple test user...');
  
  try {
    // まずはrootユーザーのみ作成
    const rootUser = {
      uid: 'test-root-001',
      userId: 'root',
      password: 'root123',
      name: 'システム管理者',
      role: 'root',
      employmentType: 'full-time',
      skills: ['管理'],
      hourlyRate: 2000,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await setDoc(doc(db, 'users', rootUser.uid), rootUser);
    console.log('✅ Root user created successfully!');
    console.log('Login: root / root123');
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    process.exit(0);
  }
}

createSimpleUser();