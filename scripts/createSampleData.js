// Firebase初期化
const admin = require('firebase-admin');
const path = require('path');

// サービスアカウントキーファイルのパスを設定
// 実際の環境では環境変数で設定することを推奨
const serviceAccount = {
  // ここにFirebase Service Accountの情報を設定
  // 実際の本番環境では環境変数から読み込み
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(), // または credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createSampleData() {
  console.log('📦 Creating sample data for development...');

  try {
    // サンプル店長データ
    const managerData = {
      uid: 'manager_001',
      email: 'manager@shifty.com',
      name: 'マネージャー',
      role: 'manager',
      shopName: 'サンプル店舗',
      shopAddress: '東京都渋谷区',
      shopPhone: '03-1234-5678',
      shopEmail: 'shop@shifty.com',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // サンプルスタッフデータ
    const staffData = [
      {
        uid: 'staff_001',
        email: 'staff1@shifty.com',
        name: '田中太郎',
        role: 'staff',
        managerId: 'manager_001',
        employmentType: 'part-time',
        skills: ['レジ', 'フロア'],
        hourlyRate: 1200,
        maxHoursPerWeek: 25,
        availability: {
          monday: { available: true, preferredHours: ['09:00-17:00'] },
          tuesday: { available: true, preferredHours: ['09:00-17:00'] },
          wednesday: { available: false, preferredHours: [] },
          thursday: { available: true, preferredHours: ['13:00-21:00'] },
          friday: { available: true, preferredHours: ['13:00-21:00'] },
          saturday: { available: true, preferredHours: ['09:00-21:00'] },
          sunday: { available: true, preferredHours: ['09:00-21:00'] }
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        uid: 'staff_002',
        email: 'staff2@shifty.com',
        name: '佐藤花子',
        role: 'staff',
        managerId: 'manager_001',
        employmentType: 'part-time',
        skills: ['レジ', 'キッチン'],
        hourlyRate: 1300,
        maxHoursPerWeek: 30,
        availability: {
          monday: { available: true, preferredHours: ['09:00-17:00'] },
          tuesday: { available: false, preferredHours: [] },
          wednesday: { available: true, preferredHours: ['09:00-17:00'] },
          thursday: { available: true, preferredHours: ['13:00-21:00'] },
          friday: { available: true, preferredHours: ['13:00-21:00'] },
          saturday: { available: true, preferredHours: ['09:00-21:00'] },
          sunday: { available: false, preferredHours: [] }
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        uid: 'staff_003',
        email: 'staff3@shifty.com',
        name: '鈴木一郎',
        role: 'staff',
        managerId: 'manager_001',
        employmentType: 'full-time',
        skills: ['レジ', 'フロア', 'キッチン', 'リーダー'],
        hourlyRate: 1500,
        maxHoursPerWeek: 40,
        availability: {
          monday: { available: true, preferredHours: ['09:00-18:00'] },
          tuesday: { available: true, preferredHours: ['09:00-18:00'] },
          wednesday: { available: true, preferredHours: ['09:00-18:00'] },
          thursday: { available: true, preferredHours: ['09:00-18:00'] },
          friday: { available: true, preferredHours: ['09:00-18:00'] },
          saturday: { available: false, preferredHours: [] },
          sunday: { available: false, preferredHours: [] }
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    // 店長データを作成/更新
    console.log('👔 Creating manager data...');
    await db.collection('users').doc('manager_001').set(managerData, { merge: true });
    console.log('✅ Manager data created successfully');

    // スタッフデータを作成/更新
    console.log('👥 Creating staff data...');
    for (const staff of staffData) {
      await db.collection('users').doc(staff.uid).set(staff, { merge: true });
      console.log(`✅ Staff ${staff.name} created successfully`);
    }

    console.log('🎉 Sample data creation completed!');
    console.log(`Created 1 manager and ${staffData.length} staff members`);

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  createSampleData()
    .then(() => {
      console.log('📋 Sample data creation finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { createSampleData };