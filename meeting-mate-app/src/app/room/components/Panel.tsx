import React from 'react';
import { GripVertical, EyeOff } from 'lucide-react';
import { getPanelConfig } from '@/app/room/constants/panelConfig';
import { themes } from '@/constants/themes';
import { ParticipantEntry, NoteItem, TodoItem, CurrentAgenda, OverviewDiagramData, PanelId, TranscriptEntry } from '@/types/data';

interface PanelProps {
  id: PanelId;
  idx: number;
  participants: ParticipantEntry[];
  transcripts: TranscriptEntry[];
  notes: NoteItem[];
  tasks: TodoItem[];
  currentAgenda: CurrentAgenda | null; // null を許容
  suggestedNextTopics: string[];
  overviewDiagramData: OverviewDiagramData | null; // null を許容
  currentTheme: typeof themes.dark; // themesの型を正確に指定
  themeType: 'light' | 'dark' | 'modern';
  chatHistory: Array<{ id: number; user: string; avatar: string; message: string; timestamp: string; type: 'chat' | 'system' }>;
  onDragStart: (e: React.DragEvent, id: PanelId) => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent, id: PanelId, idx: number) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onDoubleClick: () => void;
  onToggleVisibility?: (id: PanelId) => void;
  onParticipantEnter: (id: string) => void;
  onParticipantLeave: (id: string) => void;
  dragged: PanelId | null;
}

const Panel = ({
  id,
  idx,
  participants,
  transcripts,
  notes,
  tasks,
  currentAgenda,
  suggestedNextTopics,
  overviewDiagramData,
  currentTheme,
  themeType,
  chatHistory,
  onDragStart,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onDoubleClick,
  onToggleVisibility,
  onParticipantEnter,
  onParticipantLeave,
  dragged,
}: PanelProps) => {
  const panelConfig = React.useMemo(() =>
    getPanelConfig(participants, notes, tasks, currentAgenda, suggestedNextTopics, overviewDiagramData, currentTheme, themeType, chatHistory, transcripts, onParticipantEnter, onParticipantLeave),
    [participants, notes, tasks, currentAgenda, suggestedNextTopics, overviewDiagramData, currentTheme, themeType, chatHistory, transcripts, onParticipantEnter, onParticipantLeave]
  );

  const cfg = panelConfig[id];
  if (!cfg) return null;

  return (
    <div
      className={`panel-draggable ${currentTheme.card} p-4 group
        ${dragged === id ? 'opacity-40 scale-95' : ''}`}>
      <div
        draggable
        onDragStart={e => onDragStart(e, id)}
        onDragEnd={onDragEnd}
        onTouchStart={e => onTouchStart(e, id, idx)}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onDoubleClick={onDoubleClick}
        className="flex justify-between items-center mb-2 cursor-move">
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${currentTheme.text.primary}`}>
          <cfg.icon className="w-4 h-4" />{cfg.title}
        </h3>
        <div className="flex items-center gap-1">
          {onToggleVisibility && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(id);
              }}
              className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200
                hover:bg-red-500/20 hover:text-red-500 ${currentTheme.text.secondary}`}
              title="パネルを非表示にする"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}
          <GripVertical className={`w-4 h-4 opacity-0 group-hover:opacity-70 transition-opacity ${currentTheme === themes.dark || currentTheme === themes.modern ? 'text-white' : ''}`} />
        </div>
      </div>
      <div>{cfg.content}</div>
    </div>
  );
};

export default Panel;
