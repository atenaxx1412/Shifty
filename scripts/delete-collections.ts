import { config } from 'dotenv';
import path from 'path';

// Load environment variables from the root directory
config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

async function deleteCollection(collectionName: string) {
  console.log(`🗑️  ${collectionName}コレクションを削除中...`);
  
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`✨ ${collectionName}コレクションは既に空です`);
      return;
    }
    
    console.log(`📊 ${snapshot.size}個のドキュメントを削除します`);
    
    // Delete all documents in the collection
    const deletePromises = snapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, collectionName, docSnapshot.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`✅ ${collectionName}コレクションの全ドキュメントを削除しました`);
    
  } catch (error) {
    console.error(`❌ ${collectionName}コレクション削除エラー:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 コレクション削除スクリプトを開始\n');
  
  try {
    // Delete login collection
    await deleteCollection('login');
    
    // Delete shops collection (if confirmed not needed)
    const deleteShops = process.argv.includes('--delete-shops');
    if (deleteShops) {
      await deleteCollection('shops');
    }
    
    console.log('\n✨ コレクション削除完了');
    
  } catch (error) {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('🎉 スクリプト実行完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプト実行エラー:', error);
      process.exit(1);
    });
}

export { deleteCollection };