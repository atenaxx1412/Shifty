// Debug script to check Firestore user data
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  // This is temporary for debugging - normally loaded from env
  projectId: "shifty-d7b19", // Update with your actual project ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
  try {
    console.log('🔍 Checking all manager users...');

    const managersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'manager')
    );

    const managersSnapshot = await getDocs(managersQuery);

    console.log(`📊 Found ${managersSnapshot.size} manager users:`);

    managersSnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log(`👤 Manager:`, {
        docId: doc.id,
        uid: userData.uid,
        userId: userData.userId,
        name: userData.name || '❌ NAME IS EMPTY/UNDEFINED',
        email: userData.email,
        shopName: userData.shopName,
        role: userData.role
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUsers();