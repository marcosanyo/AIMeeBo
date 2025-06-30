"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth } from '../firebase';
import { signInAnonymously } from 'firebase/auth';
import { Users, MessageSquare, FileText, Clock, CheckCircle, AlertTriangle, BarChart3, Calendar, TrendingUp, Mic, ListTodo, ChevronDown, ChevronUp } from 'lucide-react';
import * as d3 from 'd3';

const generateUniqueId = () => Date.now().toString() + Math.random().toString(36).substring(2, 15);

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

interface CustomWindow extends Window {
  SpeechRecognition?: SpeechRecognitionStatic;
  webkitSpeechRecognition?: SpeechRecognitionStatic;
}
declare const window: CustomWindow;

type ParticipantEntry = { id: string; name: string; role: string; joinedAt?: string; };
type ParticipantsData = { [key: string]: Omit<ParticipantEntry, 'id'>; };
type TranscriptEntry = { speaker: string; text: string; timestamp: string };
type TodoItem = { id: string; title: string; assignee?: string; dueDate?: string; status: "todo" | "doing" | "done"; detail?: string; };
type NoteItem = { id: string; type: "memo" | "decision" | "issue"; text: string; timestamp: string; };
type Notes = NoteItem[];
interface AgendaItemDetail { id: string; text: string; timestamp?: string; }
interface CurrentAgenda { mainTopic: string; details: AgendaItemDetail[]; }
type OverviewDiagramData = { 
  title: string; 
  mermaidDefinition: string; 
};
interface SessionData { sessionId?: string; sessionTitle?: string; startTime?: string; participants: ParticipantsData; transcript: TranscriptEntry[]; tasks: TodoItem[]; notes: Notes; projectTitle?: string; projectSubtitle?: string; meetingDate?: string; overviewDiagram?: OverviewDiagramData; currentAgenda?: CurrentAgenda; suggestedNextTopics?: string[]; }

const PanelHeader = ({ title, icon: Icon, isLoading }: { title: string, icon: React.ElementType, isLoading?: boolean }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-800">{title}</h2></div>
    {isLoading && <div className="loader"></div>}
  </div>
);

const ParticipantsList = ({ participants }: { participants: ParticipantEntry[] }) => (
  <div className="space-y-3">
    {participants.length > 0 ? participants.map((p, i) => {
      const name = p.name || "不明な参加者"; const role = p.role || "参加者";
      const initials = typeof name === 'string' ? name.substring(0, 2).toUpperCase() : "??";
      const colors = ["bg-blue-500", "bg-purple-500", "bg-orange-500", "bg-green-500", "bg-red-500", "bg-pink-500", "bg-indigo-500"];
      const bgColor = colors[i % colors.length];
      return (<div key={p.id} className="flex items-center gap-3"><div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center text-white font-bold text-sm`}>{initials}</div><div><div className="font-semibold text-slate-800">{name}</div><div className="text-xs text-slate-600">{role}</div></div></div>);
    }) : <p className="text-slate-500 text-sm">参加者情報はありません。</p>}
  </div>
);

const NotesDisplay = ({ notes }: { notes: Notes }) => {
  const displayNotes = [...notes].sort((a, b) => { const typeOrder = { decision: 0, issue: 1, memo: 2 }; if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type]; return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); });
  const getNoteStyle = (type: NoteItem['type']) => { switch (type) { case 'decision': return { icon: CheckCircle, color: 'text-green-600', borderColor: 'border-green-500', titleColor: 'text-green-700 font-semibold' }; case 'issue': return { icon: AlertTriangle, color: 'text-yellow-500', borderColor: 'border-yellow-500', titleColor: 'text-yellow-700 font-semibold' }; case 'memo': default: return { icon: FileText, color: 'text-gray-700', borderColor: 'border-gray-400', titleColor: 'text-gray-800 font-medium' }; } };
  const typeToJapanese = (type: NoteItem['type']) => { switch (type) { case 'decision': return '決定事項'; case 'issue': return '課題'; case 'memo': return 'メモ'; default: return 'ノート'; } };
  return (<div className="bg-transparent rounded-lg text-sm text-slate-700 p-0">{displayNotes.length > 0 ? (<div className="grid grid-cols-1 gap-3">{displayNotes.map((item) => { const { icon: IconComponent, color, borderColor, titleColor } = getNoteStyle(item.type); return (<div key={item.id} className={`bg-white rounded-lg p-3 border-l-4 ${borderColor} shadow-md hover:shadow-lg transition-shadow`}><div className="flex items-start gap-2"><IconComponent className={`w-5 h-5 ${color} mt-0.5 flex-shrink-0`} /><div className="flex-grow"><div className={`text-sm ${titleColor}`}>{typeToJapanese(item.type)}</div><p className="text-xs text-slate-600 whitespace-pre-wrap break-words">{item.text}</p><div className="text-xs text-slate-400 mt-1 text-right">{new Date(item.timestamp).toLocaleString('ja-JP')}</div></div></div></div>); })}</div>) : <p className="text-slate-500 text-sm">ノートはありません。</p>}</div>);
};

const TasksPanel = ({ tasks, flashKeyStates, isLoading }: { tasks: TodoItem[], flashKeyStates: { [key: string]: boolean }, isLoading?: boolean }) => {
  if (!tasks || tasks.length === 0) return (<div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4"><PanelHeader title="タスク" icon={ListTodo} isLoading={isLoading} /><p className="text-slate-500 text-sm">タスクはありません。</p></div>);
  const statusToJapanese = (status: TodoItem['status']) => { switch (status) { case 'todo': return '未着手'; case 'doing': return '進行中'; case 'done': return '完了'; default: return status; } };
  return (<div className={`panel-appear ${flashKeyStates.issues ? 'content-flash' : ''}`}><div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4"><PanelHeader title="タスク" icon={ListTodo} isLoading={isLoading} /><div className="space-y-3">{tasks.map((task) => { const IconComponent = task.status === "done" ? CheckCircle : task.status === "doing" ? Clock : AlertTriangle; const statusConfig = { todo: { borderColor: 'border-orange-500', textColor: 'text-orange-600', iconColor: 'text-orange-500' }, doing: { borderColor: 'border-blue-500', textColor: 'text-blue-600', iconColor: 'text-blue-500' }, done: { borderColor: 'border-green-500', textColor: 'text-green-600', iconColor: 'text-green-500' }, }; const currentStatusStyle = statusConfig[task.status] || statusConfig.todo; return (<div key={`task-${task.id}`} className={`bg-white rounded-lg p-3 border-l-4 ${currentStatusStyle.borderColor} shadow-md hover:shadow-lg transition-shadow`}><div className="flex items-start gap-2"><IconComponent className={`w-4 h-4 ${currentStatusStyle.iconColor} mt-0.5 flex-shrink-0`} /><div className="flex-grow"><div className="font-semibold text-slate-800 text-sm">{task.title}</div><div className="text-xs mt-1"><span className={`font-medium ${currentStatusStyle.textColor} px-2 py-0.5 rounded-full bg-opacity-20 ${task.status === 'todo' ? 'bg-orange-100' : task.status === 'doing' ? 'bg-blue-100' : 'bg-green-100'}`}>{statusToJapanese(task.status)}</span>{task.assignee && <span className="ml-2 text-slate-500">担当: {task.assignee}</span>}{task.dueDate && <span className="ml-2 text-slate-500">期限: {task.dueDate}</span>}</div>{task.detail && <p className="mt-1.5 text-xs text-slate-600 whitespace-pre-wrap break-words">{task.detail}</p>}</div></div></div>); })}</div></div></div>);
};

const DebugTranscriptPanel = ({ transcript }: { transcript: TranscriptEntry[] }) => (<div className="bg-slate-800 text-white p-4 rounded-lg shadow mt-6 panel-appear"><div className="flex items-center gap-2 mb-3"><MessageSquare className="w-5 h-5 text-green-400" /><h3 className="text-lg font-semibold">デバッグ用トランスクリプト</h3></div><div className="space-y-2 max-h-60 overflow-y-auto text-sm">{transcript.map((t, i) => (<div key={i} className="p-1.5 bg-slate-700 rounded"><span className="font-semibold text-green-300">{t.speaker} ({t.timestamp}): </span><span>{t.text}</span></div>))}{transcript.length === 0 && <p className="text-slate-400">トランスクリプトはありません。</p>}</div></div>);

const OverviewDiagramPanel = React.memo(({ diagramData, isLoading }: { diagramData: OverviewDiagramData | null, isLoading?: boolean }) => {
  if (!diagramData || !diagramData.mermaidDefinition) return (<div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 h-auto min-h-[200px]"><PanelHeader title={diagramData?.title || "概要図"} icon={BarChart3} isLoading={isLoading} /><p className="text-slate-500 text-sm">{diagramData?.mermaidDefinition ? "図を読み込み中..." : "概要図データがありません。"}</p></div>);
  const displayTitle = diagramData.title || "概要図";
  return (<div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 h-auto"><PanelHeader title={displayTitle} icon={BarChart3} isLoading={isLoading} /><MermaidDiagram definition={diagramData.mermaidDefinition} /></div>);
});
OverviewDiagramPanel.displayName = 'OverviewDiagramPanel';

const MermaidDiagram = React.memo(({ definition }: { definition: string }) => {
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagramId] = useState<string>(`mermaid-diagram-${generateUniqueId()}`);
  const [processedDefinition, setProcessedDefinition] = useState<string>("");
  useEffect(() => { const newDecodedDefinition = definition.replace(/\\n/g, "\n"); setProcessedDefinition(newDecodedDefinition); }, [definition]);
  useEffect(() => { const renderMermaid = async (currentDefinition: string) => { if (currentDefinition && mermaidContainerRef.current) { setSvgContent(null); setError(null); try { const mermaid = (await import('mermaid')).default; const tempId = `mermaid-temp-${generateUniqueId()}`; const { svg } = await mermaid.render(tempId, currentDefinition); if (svg) setSvgContent(svg); else setError("Mermaid rendering returned no SVG."); } catch (e: unknown) { if (e instanceof Error) setError(e.message); else setError("Failed to render Mermaid diagram."); setSvgContent(null); } } else if (!currentDefinition) { setSvgContent(null); setError(null); } }; renderMermaid(processedDefinition); }, [processedDefinition]);
  useEffect(() => { if (svgContent && mermaidContainerRef.current) { const container = mermaidContainerRef.current; container.innerHTML = svgContent; const svgElement = container.querySelector("svg"); if (svgElement) { const d3Svg = d3.select(svgElement); let innerG = d3Svg.select("g"); if (innerG.empty()) { const content = d3Svg.html(); d3Svg.html(`<g>${content}</g>`); innerG = d3Svg.select("g"); } const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => { innerG.attr("transform", event.transform.toString()); }); d3Svg.call(zoomBehavior); d3Svg.style("max-width", "100%"); d3Svg.style("height", "auto"); } } }, [svgContent]);
  if (error) return <div ref={mermaidContainerRef} className="text-red-500 text-sm p-2 bg-red-50 rounded-md">Error rendering diagram: {error}</div>;
  return (<div ref={mermaidContainerRef} key={diagramId} className="mermaid-diagram-container w-full h-auto flex justify-center items-center overflow-hidden bg-white" style={{ minHeight: '200px', maxHeight: '500px' }}>{!svgContent && !error && <div className="text-slate-500 text-sm">Loading diagram...</div>}</div>);
});
MermaidDiagram.displayName = 'MermaidDiagram';

const CurrentAgendaDisplayPanel = ({ agenda, flashKeyStates, isLoading }: { agenda: CurrentAgenda | null, flashKeyStates: { [key: string]: boolean }, isLoading?: boolean }) => {
  if (!agenda) return null;
  return (<div className={`panel-appear ${flashKeyStates.currentTopic ? 'content-flash' : ''}`}><div className="bg-gradient-to-br from-sky-50 to-sky-100 rounded-xl p-4"><PanelHeader title="現在の議題" icon={MessageSquare} isLoading={isLoading} /><h3 className="text-slate-800 font-semibold text-md mb-2">{agenda.mainTopic}</h3>{agenda.details && agenda.details.length > 0 && (<ul className="list-disc list-inside space-y-1 text-sm text-slate-700 pl-2">{agenda.details.map((detail) => (<li key={detail.id}>{detail.text}{detail.timestamp && <span className="text-xs text-slate-500 ml-1">({detail.timestamp})</span>}</li>))}</ul>)}{(!agenda.details || agenda.details.length === 0) && (<p className="text-sm text-slate-500">詳細な会話内容はありません。</p>)}</div></div>);
};

const SuggestedNextTopicsPanel = ({ topics, flashKeyStates, isLoading }: { topics: string[], flashKeyStates: { [key: string]: boolean }, isLoading?: boolean }) => {
  if (!topics || topics.length === 0) return null;
  return (<div className={`panel-appear ${flashKeyStates.suggestedNextTopic ? 'content-flash' : ''}`}><div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4"><PanelHeader title="推奨される次の議題" icon={TrendingUp} isLoading={isLoading} /><ul className="list-disc list-inside space-y-1 text-sm text-slate-700 pl-2">{topics.map((topic, index) => (<li key={`suggested-${index}`}>{topic}</li>))}</ul></div></div>);
};

// ClockDisplay Component
const ClockDisplay = React.memo(() => {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleString('ja-JP'));

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('ja-JP')), 1000);
    return () => clearInterval(timer);
  }, []);

  return <div className="text-sm opacity-75">{currentTime}</div>;
});
ClockDisplay.displayName = 'ClockDisplay';

export default function MeetingMatePage() {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [tasks, setTasks] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState<Notes>([]);
  const [currentAgenda, setCurrentAgenda] = useState<CurrentAgenda | null>(null);
  const [suggestedNextTopics, setSuggestedNextTopics] = useState<string[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>("システム開発プロジェクト定例会議");
  const [projectSubtitle, setProjectSubtitle] = useState<string>("ECサイトプロジェクト進捗確認");
  const [meetingDate, setMeetingDate] = useState<string>("2025年5月26日 14:00-15:00");
  const [overviewDiagramData, setOverviewDiagramData] = useState<OverviewDiagramData | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string } | null>(null);
  const [roomData, setRoomData] = useState<SessionData | null>(null);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [joinRoomIdInput, setJoinRoomIdInput] = useState<string>("");
  const [joinNameInput, setJoinNameInput] = useState<string>("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState<boolean>(false);
  const [newRoomIdInput, setNewRoomIdInput] = useState<string>("");
  const [newRoomNameInput, setNewRoomNameInput] = useState<string>("");
  const [createRoomUserNameInput, setCreateRoomUserNameInput] = useState<string>("");
  const [createRoomError, setCreateRoomError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [newTranscriptText, setNewTranscriptText] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const userManuallyStoppedRef = useRef(false);
  const [flashStates, setFlashStates] = useState<{ [key: string]: boolean }>({});
  const [processingAgents, setProcessingAgents] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState({ participants: true, currentAgenda: true, suggestedTopics: true, overviewDiagram: true, notes: true, tasks: true, debugInput: false, debugTranscript: false, });
  const toggleSection = (section: keyof typeof expandedSections) => { setExpandedSections(prev => ({ ...prev, [section]: !prev[section] })); };
  const triggerFlash = (key: string) => { setFlashStates(prev => ({ ...prev, [key]: true })); setTimeout(() => setFlashStates(prev => ({ ...prev, [key]: false })), 1500); };

  const callBackendApi = useCallback(async (newestEntry: TranscriptEntry, currentTranscriptSnapshot: TranscriptEntry[]) => { 
    const requestBody = { jsonrpc: "2.0", method: "ExecuteTask", params: { task: { taskId: generateUniqueId(), messages: [...currentTranscriptSnapshot.map(e => ({ role: e.speaker === currentUser?.name ? "user" : "agent", parts: [{ text: e.text }] })), { role: "user", parts: [{ text: newestEntry.text }] }], roomId: currentRoomId, speakerName: currentUser?.name || "Unknown Speaker" } }, id: generateUniqueId() }; 
    const response = await fetch("/invoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }); 
    if (!response.ok) throw new Error(`APIエラー ${response.status}: ${await response.text()}`); 
    return response.json(); 
  }, [currentUser, currentRoomId]);

  const handleAddTranscript = useCallback(async (textToAdd?: string) => {
    const textToProcess = textToAdd !== undefined ? textToAdd : newTranscriptText;
    if (!textToProcess.trim() || !currentUser) return;
    const newEntry: TranscriptEntry = { speaker: currentUser.name, text: textToProcess, timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) };
    setTranscript(prev => [...prev, newEntry]); triggerFlash('transcript'); setProcessingAgents([]);
    try {
      const backendResponse = await callBackendApi(newEntry, [...transcript, newEntry]);
      if (backendResponse && backendResponse.result) {
        const { result } = backendResponse;
        if (result.invokedAgents) setProcessingAgents(result.invokedAgents);
        if (result.updatedTasks) { setTasks(result.updatedTasks); triggerFlash('issues'); }
        if (result.updatedParticipants) { setParticipants(Object.entries(result.updatedParticipants as ParticipantsData).map(([id, p]) => ({ id, ...p }))); triggerFlash('participants'); }
        if (result.updatedMinutes) { setNotes(result.updatedMinutes as Notes); triggerFlash('tasks_minutes'); }
        if (result.updatedAgenda) { if (result.updatedAgenda.currentAgenda?.mainTopic) { setCurrentAgenda(result.updatedAgenda.currentAgenda); triggerFlash('currentTopic'); } if (result.updatedAgenda.suggestedNextTopics) { setSuggestedNextTopics(result.updatedAgenda.suggestedNextTopics); triggerFlash('suggestedNextTopic'); } }
        if (result.updatedOverviewDiagram) { setOverviewDiagramData(result.updatedOverviewDiagram); triggerFlash('overviewDiagram'); }
      }
    } catch (apiError) { console.error("Backend APIエラー:", apiError); setError(apiError instanceof Error ? apiError.message : String(apiError)); }
    finally { setTimeout(() => setProcessingAgents([]), 1000); }
    if (textToAdd === undefined) setNewTranscriptText("");
  }, [currentUser, newTranscriptText, transcript, callBackendApi]);

  useEffect(() => {
    const initializeMermaid = async () => { try { const mermaid = (await import('mermaid')).default; mermaid.initialize({ startOnLoad: false, theme: 'neutral' }); } catch (initError) { console.error("Global Mermaid initialization failed:", initError); } };
    initializeMermaid();
    // const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('ja-JP')), 1000); // Moved to ClockDisplay
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognitionInstance = new SpeechRecognitionAPI();
      recognitionInstance.continuous = true; recognitionInstance.interimResults = true; recognitionInstance.lang = 'ja-JP';
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => { let finalTranscript = ''; for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; } if (finalTranscript) handleAddTranscript(finalTranscript); };
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => { console.error('音声認識エラー:', event.error); if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed' && isRecording && recognitionRef.current) { setTimeout(() => { if (isRecording && recognitionRef.current) try { recognitionRef.current.start(); } catch (e) { console.error('エラー後再開失敗:', e); } }, 500); } };
      recognitionInstance.onend = () => {
        if (!userManuallyStoppedRef.current && recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch (e: unknown) {
            if (e instanceof Error && e.name !== 'InvalidStateError') console.warn('onend stopエラー:', e);
            else if (!(e instanceof Error)) console.warn('onend stopエラー (unknown type):', e);
          }
          setTimeout(() => { if (!userManuallyStoppedRef.current && recognitionRef.current) try { recognitionRef.current.start(); } catch (e) { console.error('onend 再開失敗:', e); } }, 100);
        }
      };
      recognitionRef.current = recognitionInstance;
    } else { console.warn('音声認識非対応ブラウザ'); }
    return () => {
      // clearInterval(timer); // timer is now local to ClockDisplay
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; recognitionRef.current.onerror = null; recognitionRef.current.onresult = null;
        try { recognitionRef.current.stop(); } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'InvalidStateError') console.warn('Cleanup stopエラー:', e);
          else if (!(e instanceof Error)) console.warn('Cleanup stopエラー (unknown type):', e);
        }
      }
    };
  // }, []); // Removed currentTime from dependencies as it's handled by ClockDisplay
  }, [handleAddTranscript, isRecording]); // Adding required dependencies

  useEffect(() => { 
    if (!recognitionRef.current) return; 
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => { 
      let finalTranscript = ''; 
      for (let i = event.resultIndex; i < event.results.length; ++i) { 
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; 
      } 
      if (finalTranscript) handleAddTranscript(finalTranscript); 
    }; 
  }, [handleAddTranscript, isRecording]);
  useEffect(() => { if (!recognitionRef.current) return; if (isRecording) { try { recognitionRef.current.start(); } catch (e) { const err = e as {name?: string; message?: string; error?:string}; if (err.name === 'InvalidStateError') console.warn('認識開始試行時、既に開始済み'); else { console.error('認識開始失敗:', e); if (err.name === 'NotAllowedError' || err.message === 'Permission dismissed' || err.error === 'not-allowed') setIsRecording(false); } } } else { try { recognitionRef.current.stop(); } catch (e) { if ((e as {name?:string}).name !== 'InvalidStateError') console.error('認識停止失敗:', e); } } }, [isRecording]);
  const toggleSpeechRecognition = () => { if (!recognitionRef.current) return; userManuallyStoppedRef.current = isRecording; setIsRecording(!isRecording); };
  useEffect(() => { if (roomData) { setParticipants(roomData.participants ? Object.entries(roomData.participants).map(([id, p]) => ({ id, ...(p as Omit<ParticipantEntry, 'id'>) })) : []); setTranscript(roomData.transcript || []); setTasks(roomData.tasks || []); setNotes(roomData.notes || []); setCurrentAgenda(roomData.currentAgenda || null); setSuggestedNextTopics(roomData.suggestedNextTopics || []); if (roomData.sessionTitle) setProjectTitle(roomData.sessionTitle); if (roomData.projectSubtitle) setProjectSubtitle(roomData.projectSubtitle); if (roomData.meetingDate) setMeetingDate(roomData.meetingDate); if (roomData.overviewDiagram) setOverviewDiagramData(roomData.overviewDiagram); setIsLoading(false); } }, [roomData]);
  const handleJoinRoom = async () => {
    if (!joinRoomIdInput.trim() || !joinNameInput.trim()) {
      setJoinError("ルームIDと名前を入力してください。");
      return;
    }
    setIsLoading(true);
    setJoinError(null);
    setError(null);
    try {
      // Firebase Authenticationの匿名認証でログイン
      const firebaseAuth = auth();
      if (!firebaseAuth) {
        throw new Error("Firebase設定が見つかりません。");
      }
      const userCredential = await signInAnonymously(firebaseAuth);
      const currentUser = userCredential.user;

      if (!currentUser) {
        throw new Error("匿名ログインに失敗しました。");
      }

      const idToken = await currentUser.getIdToken();
      // Firebase Hosting rewritesまたはNext.js dev proxyを使用して相対URLでAPI呼び出し
      const response = await fetch(`/join_room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken, roomId: joinRoomIdInput, speakerName: joinNameInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to join room via API');
      }

      console.log(`Successfully joined room ${joinRoomIdInput} via API`);
      setCurrentRoomId(joinRoomIdInput);
      setCurrentUser({ id: currentUser.uid, name: joinNameInput }); // 匿名ユーザーのUIDを使用
      setIsJoined(true);
      // ルームデータはuseRoomDataフックでFirebaseから取得されるため、ここでは設定しない
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setJoinError(`参加エラー: ${msg}`);
      console.error("参加失敗:", e);
      setRoomData(null);
      setIsJoined(false);
    } finally {
      setIsLoading(false);
    }
  };
  const handleCreateRoom = async () => { if (!newRoomIdInput.trim() || !newRoomNameInput.trim() || !createRoomUserNameInput.trim()) { setCreateRoomError("全項目入力必須"); return; } setIsCreatingRoom(true); setCreateRoomError(null); try { const apiResponse = await fetch('/create_room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_id: newRoomIdInput, room_name: newRoomNameInput }) }); if (!apiResponse.ok) { const errData = await apiResponse.json().catch(() => ({ detail: "不明なエラー" })); throw new Error(errData.detail || `HTTPエラー ${apiResponse.status}`); } const newRoomData = await apiResponse.json(); setShowCreateRoomModal(false); const baseData = newRoomData.data || { participants: {}, transcript: [], tasks: [], notes: [], overviewDiagram: { title: "概要図", items: [], externalIntegrations: "", mermaidDefinition: "graph TD;\nA[開始];" }, currentAgenda: { mainTopic: "会議開始", details: [] }, suggestedNextTopics: ["議題提案"] }; setRoomData({ ...baseData, sessionId: `session_${newRoomIdInput}`, sessionTitle: newRoomNameInput, projectTitle: newRoomNameInput }); setCurrentRoomId(newRoomIdInput); setCurrentUser({ id: `user_${Date.now()}`, name: createRoomUserNameInput }); setIsJoined(true); } catch (e) { const msg = e instanceof Error ? e.message : String(e); setCreateRoomError(`作成エラー: ${msg}`); console.error("作成失敗:", e); } finally { setIsCreatingRoom(false); setNewRoomIdInput(""); setNewRoomNameInput(""); setCreateRoomUserNameInput(""); } };

  if (!isJoined) return (<div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-sky-100 p-4"><div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md"><h1 className="text-3xl font-bold text-center text-slate-800 mb-2">AIMeeBo</h1><p className="text-center text-slate-600 mb-8">会議に参加または新規作成</p><div className="mb-8 p-6 border border-slate-200 rounded-lg bg-slate-50"><h2 className="text-xl font-semibold text-slate-700 mb-4 text-center">既存の会議に参加</h2>{joinError && <p className="text-red-500 text-sm mb-4 text-center">{joinError}</p>}<div className="space-y-4"><div><label htmlFor="joinRoomId" className="block text-sm font-medium text-slate-700 mb-1">ルームID</label><input type="text" id="joinRoomId" value={joinRoomIdInput} onChange={(e) => setJoinRoomIdInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: project_alpha_room" /></div><div><label htmlFor="joinUserName" className="block text-sm font-medium text-slate-700 mb-1">あなたの名前</label><input type="text" id="joinUserName" value={joinNameInput} onChange={(e) => setJoinNameInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 田中" /></div><button onClick={handleJoinRoom} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md hover:shadow-lg disabled:opacity-70">{isLoading ? "参加処理中..." : "会議に参加"}</button></div></div><div className="text-center"><button onClick={() => { setShowCreateRoomModal(true); setCreateRoomError(null); if (joinNameInput.trim()) setCreateRoomUserNameInput(joinNameInput); }} className="text-blue-600 hover:text-blue-700 font-medium underline">新しい会議室を作成</button></div></div>{showCreateRoomModal && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md"><h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">新しい会議室を作成</h2>{createRoomError && <p className="text-red-500 text-sm mb-4 text-center">{createRoomError}</p>}<div className="space-y-4"><div><label htmlFor="newRoomName" className="block text-sm font-medium text-slate-700 mb-1">会議室名</label><input type="text" id="newRoomName" value={newRoomNameInput} onChange={(e) => setNewRoomNameInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 定例プロジェクト会議" /></div><div><label htmlFor="newRoomId" className="block text-sm font-medium text-slate-700 mb-1">新しいルームID</label><input type="text" id="newRoomId" value={newRoomIdInput} onChange={(e) => setNewRoomIdInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: project_beta_room_xyz" /></div><div><label htmlFor="createRoomUserName" className="block text-sm font-medium text-slate-700 mb-1">あなたの名前</label><input type="text" id="createRoomUserName" value={createRoomUserNameInput} onChange={(e) => setCreateRoomUserNameInput(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="例: 山田" /></div><div className="flex gap-4 mt-6"><button onClick={handleCreateRoom} disabled={isCreatingRoom} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg disabled:opacity-70">{isCreatingRoom ? "作成中..." : "作成して参加"}</button><button onClick={() => { setShowCreateRoomModal(false); setCreateRoomError(null); }} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 rounded-lg">キャンセル</button></div></div></div></div>)}<footer className="mt-12 text-center text-sm text-slate-500"><p>&copy; {new Date().getFullYear()} AIMeeBo App.</p></footer></div>);
  if (isLoading && !roomData) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><p className="text-xl text-slate-700">読み込み中...</p></div>;
  if (error && !isJoined) return <div className="min-h-screen flex items-center justify-center bg-red-100"><p className="text-xl text-red-700">エラー: {error}</p></div>;
  if (!roomData && isJoined) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><p className="text-xl text-slate-700">ルームデータが見つかりません。</p></div>;

  const CollapsiblePanel = ({ title, icon: Icon, sectionKey, children, isLoading }: { title: string, icon: React.ElementType, sectionKey: keyof typeof expandedSections, children: React.ReactNode, isLoading?: boolean }) => (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-0 border border-slate-200 shadow-md">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-200 transition-colors rounded-t-xl" onClick={() => toggleSection(sectionKey)}>
        <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-slate-700" /><h2 className="font-semibold text-slate-800">{title}</h2></div>
        <div className="flex items-center">{isLoading && <div className="loader-sm mr-2"></div>}{expandedSections[sectionKey] ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}</div>
      </div>
      <div className={`p-4 border-t border-slate-200 ${expandedSections[sectionKey] ? '' : 'hidden'}`}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 p-4">
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-4 sm:mb-0"><h1 className="text-3xl font-bold mb-1">{projectTitle}</h1><p className="text-blue-200 text-lg">{projectSubtitle} (ルーム: {currentRoomId})</p></div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            <p className="text-sm text-blue-300 mb-1">参加者: {currentUser?.name}</p>
            <div className="flex items-center gap-2 text-blue-200 mb-1 justify-start sm:justify-end"><Calendar className="w-5 h-5" /><span>{meetingDate}</span></div>
            <ClockDisplay />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-12 gap-6">
        {/* Left Column: Common for MD and LG */}
        <div className="flex flex-col space-y-6 md:col-span-1 lg:col-span-3">
          {participants.length > 0 && (<CollapsiblePanel title="参加者" icon={Users} sectionKey="participants" isLoading={processingAgents.includes("ParticipantManagementAgent")}><ParticipantsList participants={participants} /></CollapsiblePanel>)}
          <CollapsiblePanel title="現在の議題" icon={MessageSquare} sectionKey="currentAgenda" isLoading={processingAgents.includes("AgendaManagementAgent")}><CurrentAgendaDisplayPanel agenda={currentAgenda} flashKeyStates={flashStates} isLoading={false} /></CollapsiblePanel>
          <CollapsiblePanel title="推奨される次の議題" icon={TrendingUp} sectionKey="suggestedTopics" isLoading={processingAgents.includes("AgendaManagementAgent")}><SuggestedNextTopicsPanel topics={suggestedNextTopics} flashKeyStates={flashStates} isLoading={false} /></CollapsiblePanel>
        </div>

        {/* Middle Column for LG, part of Right Column for MD */}
        {/* For MD: This section will be part of the md:col-span-2 stack */}
        {/* For LG: This section will be lg:col-span-5 */}
        <div className="flex flex-col space-y-6 md:col-span-2 lg:col-span-5"> {/* MD takes remaining 2 cols, LG takes 5 */}
          {/* Notes Panel: Always first in this column/stack */}
          <CollapsiblePanel title="ノート" icon={FileText} sectionKey="notes" isLoading={processingAgents.includes("NotesGeneratorAgent")}>
            <div><NotesDisplay notes={notes} /></div>
          </CollapsiblePanel>

          {/* Tasks Panel: Second in this column/stack for MD. For LG, it's also here. */}
          <CollapsiblePanel title="タスク" icon={ListTodo} sectionKey="tasks" isLoading={processingAgents.includes("TaskManagementAgent")}>
            <div><TasksPanel tasks={tasks} flashKeyStates={flashStates} isLoading={false} /></div>
          </CollapsiblePanel>

          {/* Overview Panel: Third in this column/stack for MD. For LG, it moves to its own column. */}
          {/* This div is only for MD layout. For LG, OverviewDiagramPanel is in a separate column. */}
          <div className="lg:hidden flex flex-col space-y-6"> {/* Hidden on LG and above */}
            <CollapsiblePanel title="会議の概要図" icon={BarChart3} sectionKey="overviewDiagram" isLoading={processingAgents.includes("OverviewDiagramAgent")}>
                <OverviewDiagramPanel diagramData={overviewDiagramData} isLoading={false} />
            </CollapsiblePanel>
          </div>
        </div>

        {/* Right Column for LG (Overview Diagram), Hidden on MD and below as it's stacked in the middle column */}
        <div className="hidden lg:flex lg:flex-col lg:space-y-6 lg:col-span-4"> {/* Only visible on LG and up, takes 4 cols */}
          <CollapsiblePanel title="会議の概要図" icon={BarChart3} sectionKey="overviewDiagram" isLoading={processingAgents.includes("OverviewDiagramAgent")}>
            <OverviewDiagramPanel diagramData={overviewDiagramData} isLoading={false} />
          </CollapsiblePanel>
        </div>
      </div>

      <div className="mt-6">
        <CollapsiblePanel title="デバッグ用入力" icon={Mic} sectionKey="debugInput">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-4 items-end">
            <div className="md:col-span-1">
              <label htmlFor="transcriptInput" className="block text-sm font-medium text-slate-700 mb-1">新しい発言内容</label>
              <textarea id="transcriptInput" className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500" rows={2} value={newTranscriptText} onChange={(e) => setNewTranscriptText(e.target.value)} placeholder="発言内容を入力..."/>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => handleAddTranscript()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={processingAgents.length > 0}>{processingAgents.length > 0 ? "処理中..." : "発言を追加"}</button>
            <button onClick={toggleSpeechRecognition} className={`px-4 py-2 rounded-md flex items-center gap-2 ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} text-white`} disabled={!recognitionRef.current && !isRecording || processingAgents.length > 0}><Mic className="w-5 h-5" />{isRecording ? "音声入力停止" : "音声入力開始"}</button>
          </div>
          {!recognitionRef.current && !isRecording && <p className="text-sm text-red-500 mt-2">Web Speech API は現在利用できません。</p>}
        </CollapsiblePanel>
      </div>

      {transcript.length > 0 && (
        <div className="mt-6">
          <CollapsiblePanel title="デバッグ用トランスクリプト" icon={MessageSquare} sectionKey="debugTranscript">
            <DebugTranscriptPanel transcript={transcript} />
          </CollapsiblePanel>
        </div>
      )}
      <footer className="mt-8 text-center text-sm text-slate-500"><p>&copy; {new Date().getFullYear()} AIMeeBo App.</p></footer>
    </div>
  );
}
