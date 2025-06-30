'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateRoomPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [meetingSubtitle, setMeetingSubtitle] = useState<string>('');
  const [llmApiKey, setLlmApiKey] = useState<string>('');
  const [selectedLlmModels, setSelectedLlmModels] = useState<string[]>([]);
  const [participantName, setParticipantName] = useState<string>('');
  const [representativeMode, setRepresentativeMode] = useState<boolean>(false);
  const [apiKeyDurationHours, setApiKeyDurationHours] = useState<number>(24);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [hasCreated, setHasCreated] = useState<boolean>(false);

  const availableLlmModels = [
    "gemini-2.5-flash-preview-05-20",
    // 他の利用可能なモデルを追加
  ];

  // 新しいルームを作成する処理
  const handleCreateRoom = async () => {
    if (!currentUser) {
      setError("ログインしていません。まずログインしてください。");
      return;
    }

    if (isCreating || hasCreated) {
      return; // Already processing or completed, prevent multiple clicks
    }

    setError(null);
    setIsCreating(true);

    if (!roomId.trim()) {
      setError("ルームIDを入力してください。");
      setIsCreating(false);
      return;
    }

    if (!roomName.trim()) {
      setError("ルーム名を入力してください。");
      setIsCreating(false);
      return;
    }

    if (!llmApiKey.trim()) {
      setError("LLM APIキーを入力してください。");
      setIsCreating(false);
      return;
    }

    if (selectedLlmModels.length === 0) {
      setError("LLMモデルを選択してください。");
      setIsCreating(false);
      return;
    }

    if (apiKeyDurationHours < 1 || apiKeyDurationHours > 8760) {
      setError("APIキー持続時間は1時間から8760時間（1年）の間で設定してください。");
      setIsCreating(false);
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      // Firebase Hosting rewritesまたはNext.js dev proxyを使用して相対URLでAPI呼び出し
      const response = await fetch(`/create_room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          room_id: roomId.trim(),
          room_name: roomName.trim(),
          meeting_subtitle: meetingSubtitle.trim(),
          llm_api_key: llmApiKey.trim(),
          llm_models: selectedLlmModels,
          speakerName: participantName.trim() || currentUser.displayName || currentUser.email || currentUser.uid,
          representativeMode: representativeMode,
          api_key_duration_hours: apiKeyDurationHours,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create new room');
      }

      console.log(`Successfully created room ${roomId} via API`);
      setHasCreated(true);
      router.push(`/room/${roomId}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while creating the room.");
      }
      console.error("Create room error:", err);
    } finally {
      // 成功時は再有効化しない（hasCreatedがtrueの場合）
      if (!hasCreated) {
        setIsCreating(false);
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
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">ルームを作成</h1>
          <div className="text-center">
            <p className="text-slate-600 mb-6">ルームを作成するには、まずログインが必要です。</p>
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100">
      <div className="max-w-lg w-full p-8 bg-white rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">新しいルームを作成</h1>

        {error && <p className="text-red-500 text-center mb-4 bg-red-100 p-3 rounded-md">{error}</p>}

        <div className="text-center mb-6">
          <p className="text-lg text-slate-700">ようこそ、{currentUser.displayName || 'ユーザー'}!</p>
          <p className="text-sm text-slate-500">新しいルームの詳細を入力してください。</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="createRoomIdInput" className="block text-sm font-medium text-slate-700 mb-1">
              ルームID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="createRoomIdInput"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="新しいルームIDを入力"
              required
            />
          </div>

          <div>
            <label htmlFor="roomNameInput" className="block text-sm font-medium text-slate-700 mb-1">
              ルーム名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="roomNameInput"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="ルーム名を入力 (例: プロジェクトキックオフ)"
              required
            />
          </div>

          <div>
            <label htmlFor="meetingSubtitleInput" className="block text-sm font-medium text-slate-700 mb-1">
              会議サブタイトル
            </label>
            <input
              type="text"
              id="meetingSubtitleInput"
              value={meetingSubtitle}
              onChange={(e) => setMeetingSubtitle(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="会議サブタイトルを入力 (例: 第1回定例)"
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

          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="representativeModeCheckbox"
                checked={representativeMode}
                onChange={(e) => setRepresentativeMode(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
              />
              <label htmlFor="representativeModeCheckbox" className="ml-2 block text-sm font-medium text-slate-700">
                代表参加者モード
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              有効にすると、発言者を特定せずに議事録を作成します。書記のみが確認する場合や、全員がサインインしない場合に使用してください。
            </p>
          </div>

          <div>
            <label htmlFor="llmApiKeyInput" className="block text-sm font-medium text-slate-700 mb-1">
              LLM APIキー <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="llmApiKeyInput"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="LLM APIキーを入力 (必須)"
              required
            />
          </div>

          <div>
            <label htmlFor="apiKeyDurationInput" className="block text-sm font-medium text-slate-700 mb-1">
              APIキー持続時間 (時間)
            </label>
            <input
              type="number"
              id="apiKeyDurationInput"
              value={apiKeyDurationHours}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setApiKeyDurationHours(24); // 空の場合はデフォルト値に戻す
                } else {
                  const numValue = parseInt(value);
                  if (!isNaN(numValue) && numValue >= 1 && numValue <= 8760) {
                    setApiKeyDurationHours(numValue);
                  }
                }
              }}
              min="1"
              max="8760"
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="24"
            />
            <p className="text-xs text-slate-500 mt-1">
              1時間から8760時間（1年）まで設定可能です。デフォルトは24時間です。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              LLMモデルを選択 <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 space-y-2">
              {availableLlmModels.map((model) => (
                <div key={model} className="flex items-center">
                  <input
                    type="radio"
                    id={`model-${model}`}
                    name="llmModel"
                    value={model}
                    checked={selectedLlmModels.includes(model)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLlmModels([model]); // 単一選択なので配列に1つだけ
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor={`model-${model}`} className="ml-2 block text-sm text-slate-700">
                    {model}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">1つのモデルを選択してください</p>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!roomId.trim() || !roomName.trim() || !llmApiKey.trim() || selectedLlmModels.length === 0 || isCreating || hasCreated}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                作成中...
              </div>
            ) : (
              'このルームを作成する'
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
