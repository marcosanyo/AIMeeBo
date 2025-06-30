// meeting-mate-app/src/hooks/useRoomData.ts
import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { database as db } from '@/firebase';
import { SessionData, ParticipantEntry, TodoItem, NoteItem, CurrentAgenda, OverviewDiagramData, TranscriptEntry } from '@/types/data';
import { useAuth } from '@/contexts/AuthContext';

interface UseRoomDataResult {
  roomData: SessionData | null;
  participants: ParticipantEntry[];
  transcript: TranscriptEntry[];
  tasks: TodoItem[];
  notes: NoteItem[];
  currentAgenda: CurrentAgenda | null;
  suggestedNextTopics: string[];
  projectTitle: string;
  projectSubtitle: string;
  meetingDate: string;
  overviewDiagramData: OverviewDiagramData | null;
  ownerUid: string | null;
  joinRequests: { [uid: string]: { name: string; requestedAt: string } };
  isLoading: boolean;
  error: string | null;
  pageCurrentUser: { id: string; name: string } | null; // pageCurrentUserを追加
  apiKeyExpiresAt: string | null; // APIキーの期限
  apiKeyDurationHours: number | null; // APIキーの持続時間
}

export const useRoomData = (roomId: string | null): UseRoomDataResult => {
  const { currentUser: authCurrentUser } = useAuth();

  const [roomData, setRoomData] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [currentAgenda, setCurrentAgenda] = useState<CurrentAgenda | null>(null);
  const [suggestedNextTopics, setSuggestedNextTopics] = useState<string[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>("会議タイトル");
  const [projectSubtitle, setProjectSubtitle] = useState<string>("会議サブタイトル");
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toLocaleDateString('ja-JP'));
  const [overviewDiagramData, setOverviewDiagramData] = useState<OverviewDiagramData | null>(null);
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<{ [uid: string]: { name: string; requestedAt: string } }>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCurrentUser, setPageCurrentUser] = useState<{ id: string; name: string } | null>(null); // useRoomData内で管理
  const [apiKeyExpiresAt, setApiKeyExpiresAt] = useState<string | null>(null);
  const [apiKeyDurationHours, setApiKeyDurationHours] = useState<number | null>(null);

  useEffect(() => {
    if (authCurrentUser && !pageCurrentUser) { // authCurrentUserがあり、pageCurrentUserがまだ設定されていない場合のみ初期化
      const initialName = authCurrentUser.displayName || authCurrentUser.email || `ゲスト (${authCurrentUser.uid.substring(0, 4)}...)`;
      setPageCurrentUser({ id: authCurrentUser.uid, name: initialName });
    } else if (!authCurrentUser && pageCurrentUser) {
      // 認証情報がなくなった場合
      setPageCurrentUser(null);
    }
  }, [authCurrentUser, pageCurrentUser]);

  useEffect(() => {
    if (roomId) { // roomIdがあればデータをロード
      const firebaseDb = db();
      if (!firebaseDb) {
        console.warn("Firebase database not available during build or missing config");
        setIsLoading(false);
        setError("Firebase設定が見つかりません。");
        return;
      }
      
      setIsLoading(true);
      setError(null);
      const roomRef = ref(firebaseDb, `rooms/${roomId}`);
      const listener = onValue(roomRef, (snapshot) => {
        console.log("Firebase onValue: Received data for room", roomId);
        const data = snapshot.val();
        if (data) {
          console.log("Firebase onValue: Raw data:", data);
          setRoomData(data as SessionData);
          const newParticipants = data.participants ? Object.entries(data.participants).map(([id, p]) => ({ id, ...(p as Omit<ParticipantEntry, 'id'>) })) : [];
          setParticipants(newParticipants);
          const newTranscript: TranscriptEntry[] = (data.transcript || []).map((t: TranscriptEntry) => {
            return {
              userId: t.userId || 'unknown', // userIdがなければ'unknown'
              userName: t.userName || '不明なユーザー', // userNameがなければ'不明なユーザー'
              text: t.text || '',
              timestamp: t.timestamp || new Date().toISOString(),
            };
          });
          setTranscript(newTranscript);
          const newTasks = data.tasks && typeof data.tasks === 'object' ? Object.values(data.tasks) : [];
          setTasks(newTasks as TodoItem[]);
          const newNotes = data.notes && typeof data.notes === 'object' ? Object.values(data.notes) : [];
          setNotes(newNotes as NoteItem[]);
          const newCurrentAgenda = data.currentAgenda || null;
          setCurrentAgenda(newCurrentAgenda);
          const suggestedTopicsData = data.suggestedNextTopics;
          let newSuggestedNextTopics: string[] = [];
          if (suggestedTopicsData) {
            if (Array.isArray(suggestedTopicsData)) {
              newSuggestedNextTopics = suggestedTopicsData.map(String).filter(Boolean);
            } else if (typeof suggestedTopicsData === 'object') {
              newSuggestedNextTopics = Object.values(suggestedTopicsData)
                .map(topic => {
                  if (typeof topic === 'string') return topic;
                  if (topic && typeof (topic as { title: string }).title === 'string') return (topic as { title: string }).title;
                  return '';
                })
                .filter(Boolean);
            }
          }
          setSuggestedNextTopics(newSuggestedNextTopics);
          if (data.sessionTitle) setProjectTitle(data.sessionTitle);
          else if (data.projectTitle) setProjectTitle(data.projectTitle);
          if (data.projectSubtitle) setProjectSubtitle(data.projectSubtitle);
          if (data.meetingDate) setMeetingDate(data.meetingDate);
          if (data.overviewDiagram) {
            console.log("useRoomData: Setting overviewDiagram data:", data.overviewDiagram);
            setOverviewDiagramData(data.overviewDiagram);
          } else {
            console.log("useRoomData: No overviewDiagram data found");
          }

          setOwnerUid(data.owner_uid || null);
          setJoinRequests(data.join_requests || {});
          setApiKeyExpiresAt(data.apiKeyExpiresAt || null);
          setApiKeyDurationHours(data.apiKeyDurationHours || null);

          console.log("Firebase onValue: All states updated based on new data.");
        } else {
          console.warn("Firebase onValue: No data found for room", roomId);
          setError(`ルームID '${roomId}' のデータが見つかりません。`);
          setRoomData(null);
        }
        setIsLoading(false);
      }, (firebaseError) => {
        console.error("Firebase onValue: Data fetch error:", firebaseError);
        setError(`データ取得エラー: ${firebaseError.message}`);
        setIsLoading(false);
      });
      return () => {
        console.log("Firebase onValue: Cleaning up listener for room", roomId);
        off(roomRef, 'value', listener);
      };
    } else { // roomIdがない場合
      setIsLoading(false);
      setRoomData(null);
      setParticipants([]);
      setTranscript([]);
      setTasks([]);
      setNotes([]);
      setCurrentAgenda(null);
      setSuggestedNextTopics([]);
      setProjectTitle("会議タイトル");
      setProjectSubtitle("会議サブタイトル");
      setMeetingDate(new Date().toLocaleDateString('ja-JP'));
      setOverviewDiagramData(null);
      setOwnerUid(null);
      setJoinRequests({});
      setApiKeyExpiresAt(null);
      setApiKeyDurationHours(null);
      setError(null);
    }
  }, [roomId]); // pageCurrentUserを依存配列から削除

  // participantsがロードされた後にpageCurrentUser.nameを更新するuseEffect
  useEffect(() => {
    if (authCurrentUser && participants && pageCurrentUser) { // pageCurrentUserがnullでないことを確認
      const currentParticipant = participants.find(p => p.id === authCurrentUser.uid);
      let newUserName = pageCurrentUser.name; // 現在の名前をデフォルトとする

      if (currentParticipant && currentParticipant.name) {
        newUserName = currentParticipant.name; // participantsから取得した名前を最優先
      } else if (authCurrentUser.displayName) {
        newUserName = authCurrentUser.displayName; // FirebaseのdisplayNameを次点
      } else if (authCurrentUser.isAnonymous) {
        newUserName = `ゲスト (${authCurrentUser.uid.substring(0, 4)}...)`; // 匿名ユーザーのフォールバック（デバッグ用）
      } else if (authCurrentUser.email) {
        newUserName = authCurrentUser.email; // メールアドレスログインのフォールバック（デバッグ用）
      }

      // 新しい名前が現在の名前と異なる場合のみ更新
      if (pageCurrentUser.name !== newUserName) {
        setPageCurrentUser(prev => prev ? { ...prev, name: newUserName } : null);
      }
    }
  }, [authCurrentUser, participants, pageCurrentUser]);

  return {
    roomData,
    participants,
    transcript,
    tasks,
    notes,
    currentAgenda,
    suggestedNextTopics,
    projectTitle,
    projectSubtitle,
    meetingDate,
    overviewDiagramData,
    ownerUid,
    joinRequests,
    isLoading,
    error,
    pageCurrentUser, // pageCurrentUserを戻り値に追加
    apiKeyExpiresAt,
    apiKeyDurationHours,
  };
};
