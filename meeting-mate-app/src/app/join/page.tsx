'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function JoinRoomPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [participantName, setParticipantName] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  // ルームに参加する処理
  const handleJoinRoom = async () => {
    if (!currentUser) {
      setError("ログインしていません。まずログインしてください。");
      return;
    }
    
    if (isJoining || hasJoined) {
      return; // Already processing or completed, prevent multiple clicks
    }
    
    setError(null);
    setIsJoining(true);
    
    if (!roomId.trim()) {
      setError("ルームIDを入力してください。");
      setIsJoining(false);
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      // Firebase Hosting rewritesまたはNext.js dev proxyを使用して相対URLでAPI呼び出し
      const response = await fetch(`/join_room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          idToken, 
          roomId: roomId.trim(), 
          speakerName: participantName.trim() || currentUser.displayName || currentUser.email || currentUser.uid 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to join room');
      }
      
      console.log(`Successfully joined room ${roomId} via API`);
      setHasJoined(true);
      router.push(`/room/${roomId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while joining the room.");
      }
      console.error("Join room error:", err);
    } finally {
      // 成功時は再有効化しない（hasJoinedがtrueの場合）
      if (!hasJoined) {
        setIsJoining(false);
      }
    }
  };

  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</div>;
  }

  if (!currentUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-100">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">ルームに参加</h1>
          <div className="text-center">
            <p className="text-slate-600 mb-6">ルームに参加するには、まずログインが必要です。</p>
            <Link 
              href="/"
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-100">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">ルームに参加</h1>
        
        {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}
        
        <div className="text-center mb-6">
          <p className="text-lg text-slate-700">ようこそ、{currentUser.displayName || 'ユーザー'}!</p>
          <p className="text-sm text-slate-500">参加したいルームの情報を入力してください。</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="roomIdInput" className="block text-sm font-medium text-slate-700 mb-1">
              ルームID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="roomIdInput"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="ルームIDを入力"
              required
            />
          </div>
          
          <div>
            <label htmlFor="participantNameInput" className="block text-sm font-medium text-slate-700 mb-1">
              参加者名 (オプション)
            </label>
            <input
              type="text"
              id="participantNameInput"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="あなたの名前を入力 (例: 山田太郎)"
            />
            <p className="text-xs text-slate-500 mt-1">
              入力しない場合は、アカウント情報が使用されます
            </p>
          </div>
          
          <button
            onClick={handleJoinRoom}
            disabled={!roomId.trim() || isJoining || hasJoined}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                参加中...
              </div>
            ) : (
              'このルームに参加する'
            )}
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link 
            href="/"
            className="text-indigo-600 hover:text-indigo-500 text-sm"
          >
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}