import React from 'react';
import { Users, GitBranch, CheckSquare, Network, ClipboardList, BookOpen, MessageSquare } from 'lucide-react';
import ParticipantsList from '@/app/room/components/ParticipantsList';
import NotesDisplay from '@/app/room/components/NotesDisplay';
import TasksPanel from '@/app/room/components/TasksPanel';
import OverviewDiagramPanel from '@/app/room/components/OverviewDiagramPanel';
import CurrentAgendaDisplayPanel from '@/app/room/components/CurrentAgendaDisplayPanel';
import SuggestedNextTopicsPanel from '@/app/room/components/SuggestedNextTopicsPanel';
import ConversationHistoryPanel from '@/app/room/components/ConversationHistoryPanel';
import { PanelId, ParticipantEntry, Notes, TodoItem, CurrentAgenda, OverviewDiagramData, TranscriptEntry } from '@/types/data';
import { themes } from '@/constants/themes';

type PanelConfig = {
  [key in PanelId]: {
    title: string;
    icon: React.ElementType;
    content: React.ReactNode;
  };
};

interface ChatHistoryItem {
  id: number;
  user: string;
  avatar: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system';
}

export const getPanelConfig = (
  participants: ParticipantEntry[],
  notes: Notes,
  tasks: TodoItem[],
  currentAgenda: CurrentAgenda | null,
  suggestedNextTopics: string[],
  overviewDiagramData: OverviewDiagramData | null,
  currentTheme: typeof themes.dark,
  themeType: 'light' | 'dark' | 'modern',
  chatHistory: ChatHistoryItem[],
  transcripts: TranscriptEntry[],
  onParticipantEnter: (id: string) => void,
  onParticipantLeave: (id: string) => void
): PanelConfig => ({
  participants: {
    title: '参加者',
    icon: Users,
    content: <ParticipantsList participants={participants} transcripts={transcripts} currentTheme={currentTheme} onParticipantEnter={onParticipantEnter} onParticipantLeave={onParticipantLeave} />
  },
  currentAgenda: {
    title: '現在の議題',
    icon: ClipboardList,
    content: <CurrentAgendaDisplayPanel agenda={currentAgenda} currentTheme={currentTheme} />
  },
  suggestedTopics: {
    title: '提案される次の議題',
    icon: GitBranch,
    content: <SuggestedNextTopicsPanel topics={suggestedNextTopics} currentTheme={currentTheme} />
  },
  overviewDiagram: {
    title: '会議の概要図',
    icon: Network,
    content: <OverviewDiagramPanel diagramData={overviewDiagramData} currentTheme={currentTheme} themeType={themeType} />
  },
  notes: {
    title: 'ノート',
    icon: BookOpen,
    content: <NotesDisplay notes={notes} currentTheme={currentTheme} />
  },
  tasks: {
    title: 'タスク',
    icon: CheckSquare,
    content: <TasksPanel tasks={tasks} currentTheme={currentTheme} />
  },
  conversationHistory: {
    title: '会話履歴',
    icon: MessageSquare,
    content: <ConversationHistoryPanel chatHistory={chatHistory} currentTheme={currentTheme} />
  }
} as PanelConfig);
