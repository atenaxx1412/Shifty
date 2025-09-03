// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9WEHe60M33bAJHbuM63Z1e8JbEU2_Q6s",
  authDomain: "shifty-dc8fb.firebaseapp.com",
  projectId: "shifty-dc8fb",
  storageBucket: "shifty-dc8fb.firebasestorage.app",
  messagingSenderId: "721897290537",
  appId: "1:721897290537:web:26c566721427a6e85e1538"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const messaging = typeof window !== 'undefined' && 'Notification' in window ? getMessaging(app) : null;

export default app;