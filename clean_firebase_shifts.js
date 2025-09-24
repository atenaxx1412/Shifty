import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Firebase設定 (src/lib/firebase.tsと同じ設定を使用)
const firebaseConfig = {
  apiKey: "AIzaSyASXZ2c5NxBpW_fGktYPa0-R0qXTNHYl7k",
  authDomain: "shifty-49f99.firebaseapp.com",
  projectId: "shifty-49f99",
  storageBucket: "shifty-49f99.appspot.com",
  messagingSenderId: "246825088",
  appId: "1:246825088:web:14eed17b6a95b1b5b05b5c",
  measurementId: "G-66Z78YT5GW"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanFirebaseShifts() {
  console.log('🧹 Starting Firebase shift data cleanup...');

  try {
    // 既存のシフトコレクションをチェック
    const collections = ['shifts', 'shifts_extended'];

    for (const collectionName of collections) {
      console.log(`\n📂 Checking collection: ${collectionName}`);

      const querySnapshot = await getDocs(collection(db, collectionName));

      if (querySnapshot.empty) {
        console.log(`✅ Collection ${collectionName} is already empty`);
        continue;
      }

      console.log(`📊 Found ${querySnapshot.size} documents in ${collectionName}`);

      // ドキュメントの詳細を表示
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`🔍 Document ${doc.id}:`);
        console.log(`   - managerId: ${data.managerId || 'undefined'}`);
        console.log(`   - date: ${data.date ? (data.date.toDate ? data.date.toDate().toISOString() : data.date) : 'undefined'}`);
        console.log(`   - status: ${data.status || 'undefined'}`);
      });

      // ユーザーに削除の確認を求める
      console.log(`\n⚠️  Ready to delete ${querySnapshot.size} documents from ${collectionName}`);
      console.log('🗑️  To proceed with deletion, uncomment the deletion code below and run again');

      // 削除コード（安全のためコメントアウト）
      /*
      let deletedCount = 0;
      for (const document of querySnapshot.docs) {
        await deleteDoc(doc(db, collectionName, document.id));
        deletedCount++;
        console.log(`🗑️  Deleted document ${document.id} (${deletedCount}/${querySnapshot.size})`);
      }
      console.log(`✅ Successfully deleted ${deletedCount} documents from ${collectionName}`);
      */
    }

    console.log('\n✅ Firebase shift data cleanup completed');
    console.log('\n📝 Summary:');
    console.log('   - All existing shift documents have been identified');
    console.log('   - To delete, uncomment the deletion code and run again');
    console.log('   - New shift system with auto-assignment is ready');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// スクリプト実行
cleanFirebaseShifts().then(() => {
  console.log('\n🏁 Script execution completed');
  process.exit(0);
});