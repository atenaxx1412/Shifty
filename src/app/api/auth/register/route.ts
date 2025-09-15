import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { userId, password, name, role = 'staff' }: { 
      userId: string; 
      password: string; 
      name: string; 
      role?: UserRole; 
    } = await request.json();

    // Check if userId already exists
    const userQuery = query(
      collection(db, 'users'),
      where('userId', '==', userId)
    );
    const existingUser = await getDocs(userQuery);
    
    if (!existingUser.empty) {
      return NextResponse.json(
        { error: 'このユーザーIDは既に使用されています' },
        { status: 400 }
      );
    }

    // Generate unique uid
    const uid = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create user document in Firestore
    const userData: User = {
      uid,
      userId,
      password, // In production, this should be hashed
      name,
      role,
      employmentType: 'part-time',
      skills: [],
      availability: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'users', uid), userData);

    return NextResponse.json({ 
      success: true, 
      user: { uid, userId, name, role } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'ユーザー作成に失敗しました' },
      { status: 400 }
    );
  }
}