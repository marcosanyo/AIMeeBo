'use client';

import React, { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // signOut, // AuthContextから提供されるため削除
  signInAnonymously,
  updateProfile // updateProfileをインポート
} from 'firebase/auth';
import Link from 'next/link';

// MeetingMatePage のインポートは不要なため削除
// SessionData 型定義は不要なため削除

export default function Home() {
  const { currentUser, loading, logout } = useAuth(); // logoutをAuthContextから取得

  // Separate state for registration and login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string>(''); // 参加者名を追加
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'anonymous'>('login'); // Tab state

  // ユーザー登録処理
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      setError("Firebase設定が見つかりません。");
      return;
    }
    try {
      await createUserWithEmailAndPassword(firebaseAuth, signupEmail, signupPassword);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during sign up.");
      }
      console.error("Sign up error:", err);
    }
  };

  // ログイン処理
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      setError("Firebase設定が見つかりません。");
      return;
    }
    try {
      await signInWithEmailAndPassword(firebaseAuth, loginEmail, loginPassword);
      if (firebaseAuth.currentUser && participantName) {
        await updateProfile(firebaseAuth.currentUser, { displayName: participantName });
      }
      // ルームへの自動参加処理を削除
      // setHasJoinedRoomSuccessfully(true); // ★ 削除
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during login.");
      }
      console.error("Login error:", err);
    }
  };

  // ログアウト処理 (AuthContextのlogoutを使用するため、ここでの定義は不要)
  const handlePageLogout = async () => { // ページ固有のログアウト処理が必要な場合のために残すが、基本的にはAuthContextのlogoutを使う
    setError(null);
    try {
      await logout(); // AuthContextのlogout関数を呼び出す
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during logout.");
      }
      console.error("Logout error:", err);
    }
  };

  // 匿名認証処理
  const handleAnonymousLogin = async () => {
    setError(null);
    const firebaseAuth = auth();
    if (!firebaseAuth) {
      setError("Firebase設定が見つかりません。");
      return;
    }
    try {
      await signInAnonymously(firebaseAuth);
      if (firebaseAuth.currentUser && participantName) {
        await updateProfile(firebaseAuth.currentUser, { displayName: participantName });
      }
      // ルームへの自動参加処理を削除
      // setHasJoinedRoomSuccessfully(true); // ★ 削除
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred during anonymous login.");
      }
      console.error("Anonymous login error:", err);
    }
  };

  // Realtime Databaseからルームデータを取得するuseEffectはboard.tsxに移行したため削除


  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</div>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 overflow-x-hidden w-screen max-w-full">
      <div className="max-w-lg w-full box-border p-8 bg-white rounded-lg shadow-xl overflow-x-auto">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">AIMeeBo</h1>

        {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}

        {!currentUser ? (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setActiveTab('login'); setError(null); }}
                className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
                  activeTab === 'login'
                    ? 'border-green-500 text-green-600 bg-green-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                既存ユーザー
              </button>
              <button
                onClick={() => { setActiveTab('signup'); setError(null); }}
                className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
                  activeTab === 'signup'
                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                新規登録
              </button>
              <button
                onClick={() => { setActiveTab('anonymous'); setError(null); }}
                className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
                  activeTab === 'anonymous'
                    ? 'border-slate-500 text-slate-600 bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                かんたんログイン
              </button>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {activeTab === 'login' && (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">ログイン</h2>
                    <p className="text-sm text-slate-500">既存のアカウントでログインしてください</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-medium text-slate-600">メールアドレス</label>
                      <input
                        type="email"
                        id="login-email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="login-password" className="block text-sm font-medium text-slate-600">パスワード</label>
                      <input
                        type="password"
                        id="login-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      />
                    </div>
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors">
                      ログイン
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'signup' && (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">新規登録</h2>
                    <p className="text-sm text-slate-500">新しいアカウントを作成してください</p>
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <label htmlFor="signup-email" className="block text-sm font-medium text-slate-600">メールアドレス</label>
                      <input
                        type="email"
                        id="signup-email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="signup-password" className="block text-sm font-medium text-slate-600">パスワード</label>
                      <input
                        type="password"
                        id="signup-password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                    </div>
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                      アカウント作成
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'anonymous' && (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-slate-700 mb-2">かんたんログイン</h2>
                    <p className="text-sm text-slate-500">アカウント作成不要ですぐに始められます</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="participant-name" className="block text-sm font-medium text-slate-600">表示名（任意）</label>
                      <input
                        type="text"
                        id="participant-name"
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        placeholder="会議での表示名を入力"
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500 sm:text-sm"
                      />
                    </div>
                    <button
                      onClick={handleAnonymousLogin}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                    >
                      今すぐ始める
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-slate-700">ようこそ、{currentUser.displayName || 'ユーザー'}!</p>
              <p className="text-sm text-slate-500">UID: {currentUser.uid}</p>
            </div>

            {/* ナビゲーションオプション */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-700 text-center">何をしますか？</h2>

              <div className="grid grid-cols-1 gap-4">
                <Link
                  href="/join"
                  className="flex flex-col items-center justify-center py-6 px-4 border border-blue-300 rounded-lg shadow-sm text-center bg-blue-50 hover:bg-blue-100 transition-colors group"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-700 transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-1">ルームに参加</h3>
                  <p className="text-sm text-slate-600">既存のルームIDを使って参加する</p>
                </Link>

                <Link
                  href="/create"
                  className="flex flex-col items-center justify-center py-6 px-4 border border-purple-300 rounded-lg shadow-sm text-center bg-purple-50 hover:bg-purple-100 transition-colors group"
                >
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-700 transition-colors">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-1">新しいルームを作成</h3>
                  <p className="text-sm text-slate-600">新しい会議ルームを作成して開始する</p>
                </Link>
              </div>
            </div>

            <button
              onClick={handlePageLogout} // AuthContextのlogoutを使う
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
