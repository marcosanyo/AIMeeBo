// meeting-mate-app/src/types/data.ts
export const generateUniqueId = () => Date.now().toString() + Math.random().toString(36).substring(2, 15);

export type ParticipantEntry = { id: string; name: string; role: string; joinedAt?: string; };
export type ParticipantsData = { [key: string]: Omit<ParticipantEntry, 'id'>; };
export type TranscriptEntry = {
  userId: string;
  userName?: string;
  text: string;
  timestamp: string;
  role?: "user" | "ai"; // AI応答区別用
};
export type TodoItem = { id: string; title: string; assignee?: string; dueDate?: string; status: "todo" | "doing" | "done"; detail?: string; priority?: "high" | "medium" | "low"; };
export type NoteItem = { id: string; type: "memo" | "decision" | "issue"; text: string; timestamp: string; };
export type Notes = NoteItem[];
export interface AgendaItemDetail { id: string; text: string; timestamp?: string; }
export interface CurrentAgenda { mainTopic: string; details: AgendaItemDetail[]; }
export type OverviewDiagramData = { 
  title: string; 
  mermaidDefinition: string; 
};
export interface SessionData { sessionId?: string; sessionTitle?: string; startTime?: string; participants: ParticipantsData; transcript: TranscriptEntry[]; tasks: TodoItem[]; notes: Notes; projectTitle?: string; projectSubtitle?: string; meetingDate?: string; overviewDiagram?: OverviewDiagramData; currentAgenda?: CurrentAgenda; suggestedNextTopics?: string[]; }

export type PanelId = "participants" | "currentAgenda" | "suggestedTopics" | "overviewDiagram" | "notes" | "tasks" | "conversationHistory";

// SpeechRecognition types
export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart?: (() => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}
export interface SpeechRecognitionStatic {
  new(): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}
