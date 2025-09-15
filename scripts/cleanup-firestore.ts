import { config } from 'dotenv';
config({ path: '.env.local' });

import { collection, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

async function cleanupFirestore() {
  console.log('🧹 Firestoreデータベースのクリーンアップを開始します...');
  
  try {
    // 1. 古いemail-basedユーザーデータを削除
    console.log('\n1️⃣ 古いemail-basedユーザーデータを削除中...');
    await cleanupOldUsers();
    
    // 2. 不要なコレクションを削除
    console.log('\n2️⃣ 不要なコレクションを削除中...');
    await cleanupUnusedCollections();
    
    // 3. 古いログデータをクリア
    console.log('\n3️⃣ 古いログデータをクリア中...');
    await cleanupLogs();
    
    console.log('\n✅ データベースクリーンアップが完了しました!');
    console.log('次に init-firestore.ts を実行して新しいデータを作成してください。');
    
  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
    process.exit(1);
  }
}

async function cleanupOldUsers() {
  try {
    // email-basedの古いユーザーを削除
    const oldEmails = [
      'staff@shifty.com',
      'manager@shifty.com', 
      'root@shifty.com'
    ];
    
    const usersCollection = collection(db, 'users');
    const userDocs = await getDocs(usersCollection);
    
    let deletedCount = 0;
    
    for (const userDoc of userDocs.docs) {
      const userData = userDoc.data();
      
      // emailフィールドがあり、古いemailリストに含まれる場合、または
      // userIdフィールドがない古いデータの場合は削除
      if (userData.email && (oldEmails.includes(userData.email) || !userData.userId)) {
        await deleteDoc(doc(db, 'users', userDoc.id));
        console.log(`  ❌ 削除: ${userData.email || userData.name || userDoc.id}`);
        deletedCount++;
      }
    }
    
    console.log(`  ✅ ${deletedCount}個の古いユーザーを削除しました`);
  } catch (error) {
    console.error('  ❌ ユーザー削除エラー:', error);
  }
}

async function cleanupUnusedCollections() {
  try {
    const collectionsToCleanup = [
      'login', // 古いloginコレクション
      'shifts_extended', // 使われていない可能性
    ];
    
    for (const collectionName of collectionsToCleanup) {
      try {
        const collectionRef = collection(db, collectionName);
        const docs = await getDocs(collectionRef);
        
        let deletedCount = 0;
        for (const docSnapshot of docs.docs) {
          await deleteDoc(doc(db, collectionName, docSnapshot.id));
          deletedCount++;
        }
        
        if (deletedCount > 0) {
          console.log(`  ❌ ${collectionName}: ${deletedCount}個のドキュメントを削除`);
        }
      } catch (error) {
        console.log(`  ⚠️ ${collectionName} コレクションが存在しないかアクセスできません`);
      }
    }
  } catch (error) {
    console.error('  ❌ コレクション削除エラー:', error);
  }
}

async function cleanupLogs() {
  try {
    const logCollections = ['activityLogs', 'system_logs'];
    
    for (const collectionName of logCollections) {
      try {
        const collectionRef = collection(db, collectionName);
        const docs = await getDocs(collectionRef);
        
        let deletedCount = 0;
        for (const docSnapshot of docs.docs) {
          await deleteDoc(doc(db, collectionName, docSnapshot.id));
          deletedCount++;
        }
        
        if (deletedCount > 0) {
          console.log(`  🧹 ${collectionName}: ${deletedCount}個のログを削除`);
        }
      } catch (error) {
        console.log(`  ⚠️ ${collectionName} ログのクリーンアップをスキップ`);
      }
    }
  } catch (error) {
    console.error('  ❌ ログ削除エラー:', error);
  }
}

// 実行
cleanupFirestore();