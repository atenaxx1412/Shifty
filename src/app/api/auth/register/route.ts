import { NextRequest, NextResponse } from 'next/server';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role = 'staff' }: { 
      email: string; 
      password: string; 
      name: string; 
      role?: UserRole; 
    } = await request.json();

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Create user document in Firestore
    const userData: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      name,
      role,
      employmentType: 'part-time',
      skills: [],
      availability: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);

    return NextResponse.json({ 
      success: true, 
      user: { uid: firebaseUser.uid, email, name, role } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'ユーザー作成に失敗しました' },
      { status: 400 }
    );
  }
}