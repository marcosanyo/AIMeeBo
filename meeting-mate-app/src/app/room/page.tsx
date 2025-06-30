"use client";
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { Users, MessageSquare, Clock, LogOut, X, User, Send, Sun, Moon, Palette, Mic, Plus, Eye} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

// カスタムフックのインポート
import { useRoomData } from '@/hooks/useRoomData';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useBackendApi } from '@/hooks/useBackendApi';
import { useFlashMessages } from '@/hooks/useFlashMessages';

// 定数と型定義のインポート
import { MAX_COLS, MIN_COL_WIDTH } from '@/constants/layout';
import { themes } from '@/constants/themes';

import { getPanelConfig } from '@/app/room/constants/panelConfig';
import Panel from '@/app/room/components/Panel';
import OverviewDiagramPanel from '@/app/room/components/OverviewDiagramPanel';
import { participantColors, getParticipantColorIndex } from '@/app/room/components/ParticipantsList';

// 型定義とユーティリティ関数のインポート
import {
  TranscriptEntry, PanelId
} from '@/types/data';

// 日付と時刻を統合して表示するコンポーネント
const DateTimeDisplay = React.memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 日付と時刻を統合したフォーマット (2025/6/30 02:20:16)
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  return <span>{formatDateTime(currentTime)}</span>;
});
DateTimeDisplay.displayName = 'DateTimeDisplay';

export default function RoomPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, loading, logout } = useAuth();
  const [message, setMessage] = useState('');
  const [isChatVisible, setIsChatVisible] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ id: number; user: string; avatar: string; message: string; timestamp: string; type: 'chat' | 'system'; userId?: string }>>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); // 未読メッセージ数
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'modern'>('light'); // デフォルトはライトテーマ
  const [modalContent, setModalContent] = useState<{ title: string; children: React.ReactNode; panelId?: PanelId } | null>(null);
  const [processingAgents, setProcessingAgents] = useState<string[]>([]); // 処理中のエージェント名

  // クライアントサイドでroomIdを取得
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const pathSegments = pathname.split('/');
    if (pathSegments.length >= 3 && pathSegments[1] === 'room') {
      const extractedRoomId = pathSegments[2];
      if (extractedRoomId && extractedRoomId !== '') {
        setRoomId(extractedRoomId);
      } else {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [pathname, router]);

  const {
    participants,
    notes,
    tasks,
    currentAgenda,
    suggestedNextTopics,
  projectTitle,
  projectSubtitle,
  overviewDiagramData,
  pageCurrentUser,
    transcript, // ここにtranscriptを追加
    apiKeyExpiresAt,
    // apiKeyDurationHours, // 将来的に使用予定
  } = useRoomData(roomId);

  // ヘルパー関数: userNameから表示名を生成
  const getDisplayName = useCallback((userName: string | undefined | null) => {
    if (!userName) return "不明";
    // メールアドレス形式であれば、@より前の部分を抽出
    if (userName.includes('@') && userName.includes('.')) {
      return userName.split('@')[0];
    }
    return userName;
  }, []);

  // APIキーの残り時間を計算する関数
  const getApiKeyTimeRemaining = useCallback(() => {
    if (!apiKeyExpiresAt) return null;

    try {
      const expiresDate = new Date(apiKeyExpiresAt);
      const now = new Date();
      const diffMs = expiresDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        return { expired: true, text: "期限切れ" };
      }

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHours >= 24) {
        const diffDays = Math.floor(diffHours / 24);
        return {
          expired: false,
          text: `${diffDays}日${diffHours % 24}時間`
        };
      } else if (diffHours >= 1) {
        return {
          expired: false,
          text: `${diffHours}時間${diffMinutes}分`
        };
      } else {
        return {
          expired: false,
          text: `${diffMinutes}分`
        };
      }
    } catch (error) {
      console.error("Error calculating API key time remaining:", error);
      return null;
    }
  }, [apiKeyExpiresAt]);

  // APIキーの残り時間を定期的に更新
  const [apiKeyTimeRemaining, setApiKeyTimeRemaining] = useState<{ expired: boolean; text: string } | null>(null);

  useEffect(() => {
    const updateTimeRemaining = () => {
      setApiKeyTimeRemaining(getApiKeyTimeRemaining());
    };

    // 初回実行
    updateTimeRemaining();

    // 1分ごとに更新
    const interval = setInterval(updateTimeRemaining, 60000);

    return () => clearInterval(interval);
  }, [getApiKeyTimeRemaining]);

  // transcriptをchatHistoryに反映
  useEffect(() => {
    if (transcript && Array.isArray(transcript)) {
      const newChatHistory = transcript.map((t, idx) => ({
        id: idx + 1,
        user: t.role === "ai" ? "AI Assistant" : getDisplayName(t.userName),
        avatar: t.role === "ai" ? "AI" : (typeof t.userName === "string" ? getDisplayName(t.userName).substring(0, 2).toUpperCase() : "??"),
        message: t.text,
        timestamp: t.timestamp,
        type: (t.role === "ai" ? "system" : "chat") as 'chat' | 'system',
        userId: t.userId // userIdを追加
      }));
      setChatHistory(newChatHistory);
      // チャットパネルが非表示の場合に未読数を増やす
      if (!isChatVisible && newChatHistory.length > chatHistory.length) {
        setUnreadMessageCount(prev => prev + (newChatHistory.length - chatHistory.length));
      }
    }
  }, [transcript, getDisplayName, isChatVisible, chatHistory.length]);

  // チャットパネルが表示されたら未読数をリセットし、最新メッセージへスクロール
  useEffect(() => {
    if (isChatVisible) {
      setUnreadMessageCount(0);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatVisible]);

  // chatHistoryが更新されたら最新メッセージへスクロール (チャットパネル表示時のみ)
  useEffect(() => {
    if (isChatVisible) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatVisible]);

  const currentRoomId = roomId;
  const { callBackendApi } = useBackendApi();
  const { triggerFlash } = useFlashMessages();

  // handleSpeechResult関数を先に定義
  const handleSpeechResult = useCallback(async (finalTranscript: string) => {
    if (finalTranscript && pageCurrentUser && currentRoomId) {
      const newEntry: TranscriptEntry = {
        userId: pageCurrentUser.id,
        userName: pageCurrentUser.name,
        text: finalTranscript,
        timestamp: new Date().toISOString(), // ISO形式に変更
        role: "user" // ユーザー発言なので'user'を設定
      };

      try {
        const backendResponse = await callBackendApi(newEntry, currentRoomId, pageCurrentUser);
        if (backendResponse && backendResponse.result) {
          const { result } = backendResponse;
          if (result.invokedAgents) setProcessingAgents(result.invokedAgents);
          if (result.updatedTasks) triggerFlash('issues');
          if (result.updatedParticipants) triggerFlash('participants');
          if (result.updatedMinutes) triggerFlash('tasks_minutes');
          if (result.updatedAgenda) {
            if (result.updatedAgenda.currentAgenda?.mainTopic) triggerFlash('currentTopic');
            if (result.updatedAgenda.suggestedNextTopics) triggerFlash('suggestedNextTopic');
          }
          if (result.updatedOverviewDiagram) triggerFlash('overviewDiagram');
        }
      } catch (apiError: Error | unknown) {
        console.error("Error sending speech transcript to backend:", apiError);

        // エラーメッセージをチャット履歴に追加
        const errorMessage = apiError instanceof Error ? apiError.message : "バックエンドとの通信中にエラーが発生しました";
        const systemErrorEntry = {
          id: Date.now(),
          user: "システム",
          avatar: "SYS",
          message: `エラー: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          type: 'system' as const,
          userId: "system"
        };

        setChatHistory(prev => [...prev, systemErrorEntry]);
        if (!isChatVisible) {
          setUnreadMessageCount(prev => prev + 1);
        }
      } finally {
        setTimeout(() => setProcessingAgents([]), 1000);
      }
    }
  }, [callBackendApi, currentRoomId, pageCurrentUser, triggerFlash, isChatVisible]);

  const { isRecording, isSpeechApiAvailable, toggleSpeechRecognition } = useSpeechRecognition({
    onResult: handleSpeechResult,
    onError: (error) => {
      console.error('Speech recognition error:', error);
    },
    onEnd: () => {
      console.log('Speech recognition ended');
    },
  });

  // Pinterest風レイアウト用の状態
  const [cols, setCols] = useState<PanelId[][]>([
    ['participants', 'conversationHistory', 'tasks'],
    ['currentAgenda', 'suggestedTopics'],
    ['overviewDiagram', 'notes']
  ]);
  const [widths, setWidths] = useState<number[]>([33.34, 33.33, 33.33]); // %
  const [dragged, setDragged] = useState<PanelId | null>(null);
  const [target, setTarget] = useState<string | null>(null); // "col-pos"
  const [isResizing, setIsResizing] = useState<number | null>(null);
  const [screenSize, setScreenSize] = useState<'large' | 'small'>('large');
  const [hoveredPanel, setHoveredPanel] = useState<PanelId | null>(null);

  // Panel visibility state
  const [hiddenPanels, setHiddenPanels] = useState<Set<PanelId>>(new Set());

  // refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLElement | null>(null);

  const [chatPanelPosition, setChatPanelPosition] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [isDraggingChatPanel, setIsDraggingChatPanel] = useState(false);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const messageSquareButtonRef = useRef<HTMLButtonElement>(null);

  // チャットパネルの初期位置を設定
  useEffect(() => {
    if (isChatVisible && messageSquareButtonRef.current && chatPanelRef.current) {
      const buttonRect = messageSquareButtonRef.current.getBoundingClientRect();
      const panelWidth = chatPanelRef.current.offsetWidth;
      const panelHeight = chatPanelRef.current.offsetHeight;

      // ボタンの左端に合わせ、ボタンの上端からパネルの高さ分上に配置
      const newX = buttonRect.left;
      const newY = buttonRect.top - panelHeight - 10; // 10pxは余白

      // 画面外にはみ出さないように調整
      const boundedX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth));
      const boundedY = Math.min(Math.max(0, newY), window.innerHeight - panelHeight);

      setChatPanelPosition({
        x: boundedX,
        y: boundedY,
        offsetX: 0, // 初期位置設定時はオフセットは0
        offsetY: 0,
      });
    }
  }, [isChatVisible]);

  const selectedTheme = themes[currentTheme];

  // 画面幅監視
  useEffect(() => {
    const onResize = () => setScreenSize(window.innerWidth < 768 ? 'small' : 'large');
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 共通 Util
  const normalizeCols = useCallback((_cols: PanelId[][]) => {
    const filtered = _cols.filter(c => c.length > 0).slice(0, MAX_COLS);
    const count = Math.max(filtered.length, 1);
    const even = 100 / count;
    setWidths(Array(count).fill(even));
    return filtered;
  }, []);

  // ドラッグ開始
  const onDragStart = (e: React.DragEvent, id: PanelId) => {
    // ゴースト画像を作成
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
    ghost.style.opacity = '0.5';
    ghost.style.position = 'absolute';
    ghost.style.top = '-9999px';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    const rect = e.currentTarget.getBoundingClientRect();
    e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
    e.dataTransfer.effectAllowed = 'move';
    // ブラウザが drag セッションを確立した後で状態を更新
    requestAnimationFrame(() => {
      setDragged(id);
      setTarget(null);
    });
  };

  const onDragEnd = () => {
    // ゴースト画像を撤去
    if (ghostRef.current) {
      document.body.removeChild(ghostRef.current);
      ghostRef.current = null;
    }
    setDragged(null);
    setTarget(null);
    // 空列を除去して幅計算
    setCols(prev => normalizeCols(prev));
  };

  // デスクトップへ Drop
  const handleDropDesktop = (colIdx: number, pos: number | 'end') => {
    if (!dragged) return;
    // 取り出し
    const next = cols.map(c => c.filter(p => p !== dragged));
    // 必要なら新列を確保
    if (colIdx >= next.length && next.length < MAX_COLS) {
      while (next.length <= colIdx) next.push([]);
    }
    colIdx = Math.min(colIdx, MAX_COLS - 1);
    // 挿入
    if (pos === 'end') next[colIdx].push(dragged);
    else next[colIdx].splice(pos as number, 0, dragged);
    setCols(normalizeCols(next));
    setDragged(null);
    setTarget(null);
  };

  // モバイルへ Drop
  const handleDropMobile = (pos: number | 'end') => {
    if (!dragged) return;
    // モバイル用の順序を使用
    const mobileOrder: PanelId[] = [
      'participants',
      'conversationHistory',
      'currentAgenda',
      'suggestedTopics',
      'tasks',
      'notes',
      'overviewDiagram'
    ];
    const flat = mobileOrder.filter(p => p !== dragged);
    if (pos === 'end') flat.push(dragged);
    else flat.splice(pos as number, 0, dragged);

    // 新しい順序を3カラムレイアウトに再配置
    // デスクトップレイアウトの順序を維持するため、適切なカラムに配置
    const newCols: PanelId[][] = [[], [], []];
    flat.forEach(panelId => {
      if (panelId === 'participants' || panelId === 'conversationHistory' || panelId === 'tasks') {
        newCols[0].push(panelId);
      } else if (panelId === 'currentAgenda' || panelId === 'suggestedTopics') {
        newCols[1].push(panelId);
      } else if (panelId === 'overviewDiagram' || panelId === 'notes') {
        newCols[2].push(panelId);
      }
    });

    setCols(newCols);
    setWidths([33.34, 33.33, 33.33]);
    setDragged(null);
    setTarget(null);
  };

  // リサイズ
  const onResizeStart = (i: number) => setIsResizing(i);
  const onResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing === null || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const w = [...widths];
    if (cols.length === 2) {
      w[0] = Math.max(MIN_COL_WIDTH, Math.min(100 - MIN_COL_WIDTH, pct));
      w[1] = 100 - w[0];
    }
    if (cols.length === 3) {
      if (isResizing === 0) {
        w[0] = Math.max(MIN_COL_WIDTH, Math.min(100 - 2 * MIN_COL_WIDTH, pct));
        const rest = 100 - w[0];
        const ratio = widths[1] / (widths[1] + widths[2]);
        w[1] = Math.max(MIN_COL_WIDTH, rest * ratio);
        w[2] = rest - w[1];
        if (w[2] < MIN_COL_WIDTH) {
          w[2] = MIN_COL_WIDTH;
          w[1] = rest - w[2];
        }
      } else {
        const leftSum = widths[0];
        const mid = pct - leftSum;
        w[1] = Math.max(MIN_COL_WIDTH, Math.min(100 - leftSum - MIN_COL_WIDTH, mid));
        w[2] = 100 - w[0] - w[1];
        if (w[2] < MIN_COL_WIDTH) {
          w[2] = MIN_COL_WIDTH;
          w[1] = 100 - w[0] - w[2];
        }
      }
    }
    setWidths(w);
  }, [isResizing, widths, cols.length]);

  useEffect(() => {
    if (isResizing !== null) {
      const mv = (e: MouseEvent) => onResizeMove(e);
      const up = () => setIsResizing(null);
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
      document.body.style.cursor = 'col-resize';
      return () => {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, onResizeMove]);

  // DropZone コンポーネント
  const DropZone = ({ col, pos }: { col: number; pos: number | 'end' }) => {
    if (!dragged) return null;
    const id = `${col}-${pos}`;
    const active = target === id;
    const handleDrop = screenSize === 'small'
      ? () => handleDropMobile(pos)
      : () => handleDropDesktop(col, pos);
    return (
      <div
        onDragEnter={() => setTarget(id)}
        onDragLeave={(e) => {
          // 子要素への移動は無視
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setTarget(null);
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop();
        }}
        className={`${selectedTheme.dropzone} ${active ? selectedTheme.dropzoneActive : ''} rounded-lg h-20 flex items-center justify-center`}>
        <Plus className={`${active ? 'text-white opacity-90 scale-125' : 'opacity-50'} transition-all duration-200`} />
      </div>
    );
  };

  // スマホ用タッチドラッグ対応・ダブルタップ拡大対応
  const [touchDrag, setTouchDrag] = useState<{ id: PanelId | null, startY: number, startX: number, index: number }>({ id: null, startY: 0, startX: 0, index: -1 });
  const [lastTap, setLastTap] = useState<number>(0);
  const [zoomPanelId, setZoomPanelId] = useState<PanelId | null>(null);

  const handleParticipantEnter = useCallback(() => {
    setHoveredPanel('participants');
  }, []);

  const handleParticipantLeave = useCallback(() => {
    setHoveredPanel(null);
  }, []);

  const panelConfig = React.useMemo(() =>
    getPanelConfig(participants, notes, tasks, currentAgenda, suggestedNextTopics, overviewDiagramData, selectedTheme, currentTheme, chatHistory, transcript, handleParticipantEnter, handleParticipantLeave),
    [participants, notes, tasks, currentAgenda, suggestedNextTopics, overviewDiagramData, selectedTheme, currentTheme, chatHistory, transcript, handleParticipantEnter, handleParticipantLeave]
  );

  // zoomPanelIdが設定されたらモーダルを表示
  useEffect(() => {
    if (zoomPanelId) {
      const cfg = panelConfig[zoomPanelId as PanelId];
      if (cfg) {
        setModalContent({
          title: cfg.title,
          children: cfg.content,
          panelId: zoomPanelId
        });
      }
      setZoomPanelId(null); // モーダル表示後リセット
    }
  }, [zoomPanelId, panelConfig]); // panelConfigを依存配列に追加

  const handleTouchStart = (e: React.TouchEvent, id: PanelId, idx: number) => {
    if (e.touches.length === 1) {
      setTouchDrag({ id, startY: e.touches[0].clientY, startX: e.touches[0].clientX, index: idx });
      // ダブルタップ判定
      const now = Date.now();
      if (now - lastTap < 350) {
        setZoomPanelId(id);
      }
      setLastTap(now);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDrag.id) return;
    // 指の移動量で並び替え位置を決定
    const moveY = e.touches[0].clientY - touchDrag.startY;
    const moveX = e.touches[0].clientX - touchDrag.startX;
    // 縦方向の移動が大きい場合のみ
    if (Math.abs(moveY) > 30 || Math.abs(moveX) > 30) {
      setDragged(touchDrag.id);
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragged && screenSize === 'small') {
      const touch = e.changedTouches[0];
      const panels = document.querySelectorAll('.panel-draggable');
      let pos: number | 'end' = 'end'; // 型を明示的に指定
      panels.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (touch.clientY < rect.top + rect.height / 2 && pos === 'end') {
          pos = i;
        }
      });
      handleDropMobile(pos);
    }
    setDragged(null);
    setTouchDrag({ id: null, startY: 0, startX: 0, index: -1 });
  };

  // Desktop レイアウト
  const renderDesktop = () => {
    const showExtra = dragged && cols.length < MAX_COLS;
    const displayCols = showExtra ? cols.length + 1 : cols.length;
    return (
      <div ref={containerRef} className="relative group">
        <div className="flex gap-4">
          {Array.from({ length: displayCols }, (_, cIdx) => {
            const items = cols[cIdx] ?? [];
            const isNew = cIdx >= cols.length;
            const w = widths[cIdx] ?? 100 / displayCols;
            return (
              <div key={`col-${cIdx}`} style={{ width: `${w}%` }} className={`flex flex-col space-y-4`}>
                {((!isNew && dragged) || (isNew && dragged)) && <DropZone col={cIdx} pos={0} />}
                {items.filter(pid => !hiddenPanels.has(pid)).map((pid, i) => (
                  <div key={pid} className={pid === 'participants' && hoveredPanel === 'participants' ? 'z-40' : ''}>
                    <Panel
                      id={pid}
                      idx={i}
                      participants={participants}
                      transcripts={transcript}
                      notes={notes}
                      tasks={tasks}
                      currentAgenda={currentAgenda}
                      suggestedNextTopics={suggestedNextTopics}
                      overviewDiagramData={overviewDiagramData}
                      currentTheme={selectedTheme}
                      themeType={currentTheme}
                      chatHistory={chatHistory}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onToggleVisibility={togglePanelVisibility}
                      onParticipantEnter={handleParticipantEnter}
                      onParticipantLeave={handleParticipantLeave}
                      onDoubleClick={() => {
                        const cfg = panelConfig[pid as PanelId];
                        if (cfg) {
                          setModalContent({
                            title: cfg.title,
                            children: cfg.content,
                            panelId: pid
                          });
                        }
                      }}
                      dragged={dragged}
                    />
                    {dragged && <DropZone col={cIdx} pos={i + 1} />}
                  </div>
                ))}
                {items.filter(pid => !hiddenPanels.has(pid)).length === 0 && !isNew && dragged && <DropZone col={cIdx} pos="end" />}
              </div>
            );
          })}
        </div>
        {cols.length > 1 && Array.from({ length: cols.length - 1 }, (_, i) => {
          const left = widths.slice(0, i + 1).reduce((a, b) => a + b, 0);
          return (
            <div key={`handle-${i}`}
              className="absolute top-0 w-6 h-full cursor-col-resize z-10 transition-all opacity-0 hover:opacity-100"
              style={{ left: `calc(${left}% - 3px)` }}
              onMouseDown={() => onResizeStart(i)}>
              <div className={`absolute inset-0 w-2 h-full mx-auto ${currentTheme === 'light' ? 'bg-blue-400/40 hover:bg-blue-500/60' : currentTheme === 'dark' ? 'bg-white/30 hover:bg-white/50' : 'bg-white/30 hover:bg-white/50'}`}>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Mobile レイアウト
  const renderMobile = () => {
    // モバイル用の特定の順序を定義
    const mobileOrder: PanelId[] = [
      'participants',
      'conversationHistory',
      'currentAgenda',
      'suggestedTopics',
      'tasks',
      'notes',
      'overviewDiagram'
    ];
    const all = mobileOrder.filter(pid => !hiddenPanels.has(pid));
    return (
      <div className="space-y-4">
        {dragged && <DropZone col={0} pos={0} />}
        {all.map((pid, i) => (
          <Fragment key={pid}>
            <Panel
              id={pid}
              idx={i}
              participants={participants}
              transcripts={transcript}
              notes={notes}
              tasks={tasks}
              currentAgenda={currentAgenda}
              suggestedNextTopics={suggestedNextTopics}
              overviewDiagramData={overviewDiagramData}
              currentTheme={selectedTheme}
              themeType={currentTheme}
              chatHistory={chatHistory}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onToggleVisibility={togglePanelVisibility}
              onParticipantEnter={handleParticipantEnter}
              onParticipantLeave={handleParticipantLeave}
              onDoubleClick={() => {
                const cfg = panelConfig[pid as PanelId];
                if (cfg) {
                  setModalContent({
                    title: cfg.title,
                    children: cfg.content,
                    panelId: pid
                  });
                }
              }}
              dragged={dragged}
            />
            {dragged && <DropZone col={0} pos={i + 1} />}
          </Fragment>
        ))}
      </div>
    );
  };

  // その他の関数
  const toggleTheme = useCallback(() => {
    setCurrentTheme(prev => {
      switch (prev) {
        case 'light': return 'dark';
        case 'dark': return 'modern';
        case 'modern': return 'light';
        default: return 'light';
      }
    });
  }, []);

  // Panel visibility handlers
  const togglePanelVisibility = useCallback((panelId: PanelId) => {
    setHiddenPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(panelId)) {
        newSet.delete(panelId);
      } else {
        newSet.add(panelId);
      }
      return newSet;
    });
  }, []);

  const showAllPanels = useCallback(() => {
    setHiddenPanels(new Set());
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  }, [logout, router]);


  const handleChatPanelMouseDown = useCallback((e: React.MouseEvent) => {
    if (chatPanelRef.current) {
      setIsDraggingChatPanel(true);
      const rect = chatPanelRef.current.getBoundingClientRect();
      setChatPanelPosition({
        x: rect.left,
        y: rect.top,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      });
    }
  }, []);

  const handleChatPanelMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingChatPanel && chatPanelRef.current) {
      const newX = e.clientX - chatPanelPosition.offsetX;
      const newY = e.clientY - chatPanelPosition.offsetY;

      const maxX = window.innerWidth - chatPanelRef.current.offsetWidth;
      const maxY = window.innerHeight - chatPanelRef.current.offsetHeight;

      const boundedX = Math.min(Math.max(0, newX), maxX);
      const boundedY = Math.min(Math.max(0, newY), maxY);

      chatPanelRef.current.style.left = `${boundedX}px`;
      chatPanelRef.current.style.top = `${boundedY}px`;
    }
  }, [isDraggingChatPanel, chatPanelPosition]);

  const handleChatPanelMouseUp = useCallback(() => {
    setIsDraggingChatPanel(false);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (message.trim() && pageCurrentUser && currentRoomId) {
      const newEntry: TranscriptEntry = {
        userId: pageCurrentUser.id,
        userName: pageCurrentUser.name,
        text: message,
        timestamp: new Date().toISOString(), // ISO形式に変更
        role: "user" // ユーザー発言なので'user'を設定
      };
      triggerFlash('transcript');
      setProcessingAgents([]);
      try {
        const backendResponse = await callBackendApi(newEntry, currentRoomId, pageCurrentUser);
        if (backendResponse && backendResponse.result) {
          const { result } = backendResponse;
          if (result.invokedAgents) setProcessingAgents(result.invokedAgents);
          if (result.updatedTasks) triggerFlash('issues');
          if (result.updatedParticipants) triggerFlash('participants');
          if (result.updatedMinutes) triggerFlash('tasks_minutes');
          if (result.updatedAgenda) {
            if (result.updatedAgenda.currentAgenda?.mainTopic) triggerFlash('currentTopic');
            if (result.updatedAgenda.suggestedNextTopics) triggerFlash('suggestedNextTopic');
          }
          if (result.updatedOverviewDiagram) triggerFlash('overviewDiagram');
        }
      } catch (apiError: Error | unknown) {
        console.error("Error sending manual transcript to backend:", apiError);

        // エラーメッセージをチャット履歴に追加
        const errorMessage = apiError instanceof Error ? apiError.message : "バックエンドとの通信中にエラーが発生しました";
        const systemErrorEntry = {
          id: Date.now(),
          user: "システム",
          avatar: "SYS",
          message: `エラー: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          type: 'system' as const,
          userId: "system"
        };

        setChatHistory(prev => [...prev, systemErrorEntry]);
        if (!isChatVisible) {
          setUnreadMessageCount(prev => prev + 1);
        }
      } finally {
        setTimeout(() => setProcessingAgents([]), 1000);
      }
      setMessage('');
    }
  }, [message, pageCurrentUser, currentRoomId, callBackendApi, triggerFlash, isChatVisible]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Mouse move/up listeners for chat panel dragging
  useEffect(() => {
    if (isDraggingChatPanel) {
      const handleMouseMove = (e: MouseEvent) => handleChatPanelMouseMove(e);
      const handleMouseUp = () => handleChatPanelMouseUp();

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingChatPanel, handleChatPanelMouseMove, handleChatPanelMouseUp]);

  // Show loading screen while authentication is being checked
  if (loading) {
    return <div className="flex min-h-screen flex-col items-center justify-center p-24">Loading...</div>;
  }

  // Show error page if user is not authenticated
  if (!currentUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">ルームアクセス</h1>
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-medium text-slate-800 mb-2">アクセスが拒否されました</p>
              <p className="text-slate-600">このルームにアクセスするには、まずログインが必要です。</p>
            </div>
            <Link
              href="/"
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className={`min-h-screen ${selectedTheme.bg}`}>
      {/* Header */}
      <header className={`${selectedTheme.header} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${selectedTheme.text.primary}`}>{projectTitle}</h1>
              <p className={`${selectedTheme.text.secondary} text-sm`}>{projectSubtitle} (ルーム: {currentRoomId})</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`text-right ${selectedTheme.text.secondary} text-sm`}>
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>参加者: {pageCurrentUser?.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <div className="flex flex-col">
                  <DateTimeDisplay />
                  {apiKeyTimeRemaining && (
                    <span className={`text-xs ${selectedTheme.text.secondary}`}>
                      APIキー: {apiKeyTimeRemaining.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                currentTheme === 'light'
                  ? 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                  : currentTheme === 'dark'
                  ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
              aria-label="Toggle theme"
            >
              {currentTheme === 'light' ? (
                <Moon className="w-5 h-5" />
              ) : currentTheme === 'dark' ? (
                <Palette className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            {hiddenPanels.size > 0 && (
              <button
                onClick={showAllPanels}
                className={`px-4 py-2 rounded-lg border transition-all duration-200 flex items-center space-x-2 ${
                  currentTheme === 'light'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    : currentTheme === 'dark'
                    ? 'bg-blue-900/50 border-blue-700 text-blue-300 hover:bg-blue-800/50'
                    : 'bg-blue-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30'
                }`}
                title="非表示のパネルをすべて表示"
              >
                <Eye className="w-4 h-4" />
                <span>{hiddenPanels.size}</span>
              </button>
            )}
            <button onClick={handleLogout} className={`px-4 py-2 rounded-lg border transition-all duration-200 flex items-center space-x-2 ${selectedTheme.button.danger}`}>
              <LogOut className="w-4 h-4" />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6 px-4 sm:px-6 max-w-full">
        {screenSize === 'small' ? renderMobile() : renderDesktop()}
      </main>

      {/* Chat Panel */}
      {isChatVisible && (
        <div
          ref={chatPanelRef}
          className="fixed w-full max-w-md z-30"
          style={{
            left: chatPanelPosition.x,
            top: chatPanelPosition.y,
            cursor: isDraggingChatPanel ? 'grabbing' : 'grab',
          }}
          onMouseDown={handleChatPanelMouseDown}
        >
          <div className={`${currentTheme === 'light' ? 'bg-white' : 'bg-gray-900'} rounded-2xl border ${currentTheme === 'light' ? 'border-gray-200' : 'border-white/20'} flex flex-col max-h-[40vh]`}>
            <div className={`flex items-center justify-between p-3 border-b ${selectedTheme.cardInner}`}>
              <h3 className={`${selectedTheme.text.primary} font-semibold flex items-center space-x-2`}><MessageSquare className="w-5 h-5"/><span>会話履歴</span></h3>
              <button onClick={() => setIsChatVisible(false)} className={`p-1 rounded-full ${currentTheme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-white/10'}`}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              {chatHistory.map((chat) => {
                // システムメッセージはグレー、ユーザーメッセージは参加者パネルと同じ色のグラデーション

                const bgColor = chat.type === 'system'
                  ? 'bg-gray-500'
                  : `bg-gradient-to-r ${participantColors[getParticipantColorIndex(chat.userId || chat.user)]}`;

                return (
                  <div key={chat.id} className={`flex items-start space-x-3 text-sm`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-xs ${bgColor}`}>{chat.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <p className={`${selectedTheme.text.primary} font-medium`}>{chat.type === 'system' ? 'AI Assistant' : chat.user}</p>
                        <p className={`${selectedTheme.text.muted} text-xs`}>{chat.timestamp}</p>
                      </div>
                      <p className={`${selectedTheme.text.secondary} leading-relaxed`}>{chat.message}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Input Bar */}
      <div className={`fixed bottom-0 left-0 right-0 ${selectedTheme.header} border-t z-20`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          {processingAgents.length > 0 && (
            <div className="mb-2 text-sm text-purple-400 flex items-center space-x-2">
              <span className="animate-spin">⚙️</span>
              <span>AIが処理中: {processingAgents.join(', ')}</span>
            </div>
          )}
          <div className="flex items-center space-x-3">
            {/* Input Area */}
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="発言やコメントを入力..."
                className={`w-full ${selectedTheme.input} border rounded-xl p-3 pr-24 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500`}
                rows={1}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                <button onClick={handleSendMessage} className={`${selectedTheme.button.primary} text-white p-2 rounded-lg transition-all`}>
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button onClick={() => toggleSpeechRecognition()} className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : `${selectedTheme.button.secondary} text-white`}`} disabled={!isSpeechApiAvailable}>
                <Mic className="w-5 h-5" />
              </button>
              <button ref={messageSquareButtonRef} onClick={() => setIsChatVisible(!isChatVisible)} className={`relative p-3 rounded-xl transition-colors border ${selectedTheme.cardInner}`}>
                <MessageSquare className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadMessageCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        </div>

      {modalContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`${selectedTheme.card} w-full h-full flex flex-col`}>
            <div className={`flex justify-between items-center p-4 border-b ${selectedTheme.header}`}>
              <h3 className={`text-xl font-semibold ${selectedTheme.text.primary}`}>{modalContent.title}</h3>
              <button
                onClick={() => setModalContent(null)}
                className={`${selectedTheme.text.tertiary} hover:${selectedTheme.text.secondary}`}
                aria-label="閉じる"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className={`${selectedTheme.cardInner} flex-1 ${
              modalContent.panelId === 'overviewDiagram'
                ? 'overflow-hidden'
                : modalContent.panelId === 'conversationHistory'
                ? 'overflow-hidden'
                : 'p-4 overflow-y-auto'
            }`}>
              {modalContent.panelId === 'overviewDiagram' ? (
                <OverviewDiagramPanel
                  diagramData={overviewDiagramData}
                  currentTheme={selectedTheme}
                  themeType={currentTheme}
                  isFullScreen={true}
                />
              ) : modalContent.panelId === 'conversationHistory' ? (
                <div className="h-full p-4">
                  <div className="h-full overflow-y-auto space-y-4">
                    {chatHistory.map((chat) => {
                      // システムメッセージはグレー、ユーザーメッセージは参加者パネルと同じ色のグラデーション
                      const bgColor = chat.type === 'system'
                        ? 'bg-gray-500'
                        : `bg-gradient-to-r ${participantColors[getParticipantColorIndex(chat.userId || chat.user)]}`;

                      return (
                        <div key={chat.id} className="flex items-start space-x-3 text-sm">
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-xs ${bgColor}`}>
                            {chat.avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`font-medium ${selectedTheme.text.primary}`}>{chat.user}</span>
                              <span className={`text-xs ${selectedTheme.text.tertiary}`}>
                                {new Date(chat.timestamp).toLocaleTimeString('ja-JP', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <p className={`${selectedTheme.text.secondary} break-words`}>{chat.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : modalContent.panelId === 'participants' ? (
                <div className="h-full p-4">
                  <div className="h-full overflow-y-auto">
                    <div className={`grid ${participants.length <= 4 ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                      {participants.length > 0 ? participants.map((p) => {
                        const name = p.name || "不明な参加者";
                        // 役割の表示を日本語に変換
                        const role = (() => {
                          if (!p.role) return "参加者";
                          switch (p.role.toLowerCase()) {
                            case "creator": return "ルーム作成者";
                            case "participant": return "参加者";
                            default: return p.role;
                          }
                        })();
                        const initials = typeof name === 'string' ? name.substring(0, 2).toUpperCase() : "??";
                        // 参加者IDに基づいて色を選択
                        const colorIndex = getParticipantColorIndex(p.id);
                        const bgColor = participantColors[colorIndex];

                        return (
                          <div key={p.id} className={`flex items-center space-x-2 p-2 rounded-xl ${selectedTheme.cardInner} border`}>
                            <div className={`w-8 h-8 bg-gradient-to-r ${bgColor} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`${selectedTheme.text.primary} font-medium text-xs truncate`}>{name}</p>
                              <p className={`${selectedTheme.text.secondary} text-xs`}>{role}</p>
                            </div>
                          </div>
                        );
                      }) : <p className={`${selectedTheme.text.secondary} text-sm ${participants.length <= 4 ? '' : 'col-span-2'} text-center`}>参加者情報はありません。</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-4">
                  {modalContent.children}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
