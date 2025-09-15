import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const testUsers = [
  {
    uid: 'test-root-001',
    userId: 'root',
    password: 'root123',
    name: 'システム管理者',
    role: 'root',
    employmentType: 'full-time',
    skills: ['管理', '経営', 'システム管理'],
    hourlyRate: 2000,
    maxHoursPerWeek: 40,
    availability: {
      monday: { start: '09:00', end: '18:00', available: true },
      tuesday: { start: '09:00', end: '18:00', available: true },
      wednesday: { start: '09:00', end: '18:00', available: true },
      thursday: { start: '09:00', end: '18:00', available: true },
      friday: { start: '09:00', end: '18:00', available: true },
      saturday: { start: '09:00', end: '15:00', available: true },
      sunday: { available: false }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    uid: 'test-manager-001',
    userId: 'manager',
    password: 'manager123',
    name: '店長',
    role: 'manager',
    shopId: 'shop-001',
    shopName: 'テスト店舗',
    shopAddress: '東京都渋谷区1-1-1',
    shopPhone: '03-0000-0000',
    shopEmail: 'test-shop@example.com',
    employmentType: 'full-time',
    skills: ['管理', 'シフト作成', '人事', '売上管理'],
    hourlyRate: 1500,
    maxHoursPerWeek: 40,
    availability: {
      monday: { start: '08:00', end: '20:00', available: true },
      tuesday: { start: '08:00', end: '20:00', available: true },
      wednesday: { start: '08:00', end: '20:00', available: true },
      thursday: { start: '08:00', end: '20:00', available: true },
      friday: { start: '08:00', end: '20:00', available: true },
      saturday: { start: '08:00', end: '18:00', available: true },
      sunday: { start: '10:00', end: '16:00', available: true }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    uid: 'test-staff-001',
    userId: 'staff',
    password: 'staff123',
    name: 'スタッフ',
    role: 'staff',
    shopId: 'shop-001',
    managerId: 'test-manager-001',
    employmentType: 'part-time',
    skills: ['接客', 'レジ', '清掃'],
    hourlyRate: 1000,
    maxHoursPerWeek: 25,
    availability: {
      monday: { start: '10:00', end: '16:00', available: true },
      tuesday: { start: '10:00', end: '16:00', available: true },
      wednesday: { available: false },
      thursday: { start: '14:00', end: '20:00', available: true },
      friday: { start: '14:00', end: '20:00', available: true },
      saturday: { start: '09:00', end: '17:00', available: true },
      sunday: { start: '12:00', end: '18:00', available: true }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

async function createTestUsers() {
  console.log('👥 Creating test users in Firestore...');
  
  try {
    for (const user of testUsers) {
      console.log(`📝 Creating ${user.name} (${user.role}) with ID: ${user.userId}...`);
      
      await setDoc(doc(db, 'users', user.uid), user);
      
      console.log(`✅ ${user.name}: Created successfully`);
      console.log(`   - UserID: ${user.userId}`);
      console.log(`   - Password: ${user.password}`);
      console.log(`   - Role: ${user.role}`);
    }
    
    console.log('\n🎉 All test users created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Root: root / root123');
    console.log('Manager: manager / manager123');
    console.log('Staff: staff / staff123');
    
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  }
}

createTestUsers();