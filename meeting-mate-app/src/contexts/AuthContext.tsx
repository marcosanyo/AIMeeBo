'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase'; // 先ほど作成したfirebase.tsをインポート

import { signOut } from 'firebase/auth'; // signOutをインポート

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>; // logout関数を追加
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      // Firebase not available (during build or config missing)
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // クリーンアップ関数
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      throw new Error('Firebase not available');
    }
    
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.error("Error signing out: ", error);
      throw error; // エラーを再スローして呼び出し元で処理できるようにする
    }
  };

  const value = {
    currentUser,
    loading,
    logout, // valueにlogoutを追加
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
