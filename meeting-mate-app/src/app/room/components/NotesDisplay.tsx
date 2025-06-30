import React, { useState } from 'react';
import { NoteItem } from '@/types/data';
import { themes } from '@/constants/themes';
import { CheckCircle2, AlertTriangle, StickyNote, FileText } from 'lucide-react';

interface NotesDisplayProps {
  notes: NoteItem[];
  currentTheme: typeof themes.dark;
}

const NotesDisplay: React.FC<NotesDisplayProps> = ({ notes, currentTheme }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'decision' | 'issue' | 'memo'>('all');

  // Group notes by type
  const notesByType = {
    decision: notes.filter(note => note.type === 'decision').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    issue: notes.filter(note => note.type === 'issue').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    memo: notes.filter(note => note.type === 'memo').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  };

  const displayNotes = activeTab === 'all' 
    ? [...notes].sort((a, b) => {
        const typeOrder = { decision: 0, issue: 1, memo: 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
    : notesByType[activeTab];

  const getTypeIcon = (type: NoteItem['type']) => {
    const iconClass = `w-5 h-5 flex-shrink-0`;
    switch (type) {
      case 'issue': return <AlertTriangle className={`${iconClass} ${currentTheme.text.primary === 'text-white' ? 'text-amber-400' : 'text-amber-600'}`} />;
      case 'memo': return <StickyNote className={`${iconClass} ${currentTheme.text.primary === 'text-white' ? 'text-blue-400' : 'text-blue-600'}`} />;
      case 'decision': return <CheckCircle2 className={`${iconClass} ${currentTheme.text.primary === 'text-white' ? 'text-green-400' : 'text-green-600'}`} />;
      default: return <StickyNote className={`${iconClass} ${currentTheme.text.secondary}`} />;
    }
  };

  const getTabStyle = (tabType: 'all' | 'decision' | 'issue' | 'memo') => {
    const isActive = activeTab === tabType;
    const baseStyle = `px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer border`;
    
    if (isActive) {
      return `${baseStyle} ${currentTheme.text.primary === 'text-white' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300'}`;
    }
    
    return `${baseStyle} ${currentTheme.text.secondary} ${currentTheme.text.primary === 'text-white' ? 'hover:bg-gray-700/50 border-gray-700/50' : 'hover:bg-gray-100 border-gray-200'} hover:${currentTheme.text.primary}`;
  };

  const getTabIcon = (tabType: 'all' | 'decision' | 'issue' | 'memo') => {
    const iconClass = 'w-3 h-3 mr-1';
    switch (tabType) {
      case 'all': return <FileText className={iconClass} />;
      case 'decision': return <CheckCircle2 className={iconClass} />;
      case 'issue': return <AlertTriangle className={iconClass} />;
      case 'memo': return <StickyNote className={iconClass} />;
    }
  };

  const getTabLabel = (tabType: 'all' | 'decision' | 'issue' | 'memo') => {
    const counts = {
      all: notes.length,
      decision: notesByType.decision.length,
      issue: notesByType.issue.length,
      memo: notesByType.memo.length
    };
    
    const labels = {
      all: 'すべて',
      decision: '決定事項',
      issue: '課題',
      memo: 'メモ'
    };
    
    return `${labels[tabType]} (${counts[tabType]})`;
  };

  const typeToJapanese = (type: NoteItem['type']) => {
    switch (type) {
      case 'decision': return '決定事項';
      case 'issue': return '課題';
      case 'memo': return 'メモ';
      default: return 'ノート';
    }
  };
  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return null;
    }
  };

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className={`${currentTheme.text.muted} w-12 h-12 mb-3 mx-auto`} />
          <p className={`${currentTheme.text.secondary} text-sm`}>ノートはありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1 rounded-lg" style={{ backgroundColor: currentTheme.text.primary === 'text-white' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)' }}>
        {(['all', 'decision', 'issue', 'memo'] as const).map((tabType) => (
          <button
            key={tabType}
            onClick={() => setActiveTab(tabType)}
            className={getTabStyle(tabType)}
          >
            {getTabIcon(tabType)}
            {getTabLabel(tabType)}
          </button>
        ))}
      </div>

      {/* Notes Content */}
      {displayNotes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            {getTabIcon(activeTab)}
            <p className={`${currentTheme.text.secondary} text-sm mt-2`}>
              {activeTab === 'all' ? 'ノートはありません' : `${getTabLabel(activeTab).split(' (')[0]}はありません`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayNotes.map((item) => {
            const formattedDate = formatDate(item.timestamp);
            return (
              <div key={item.id} className={`${currentTheme.cardInner} rounded-lg p-4 transition-all duration-200 hover:shadow-md border ${currentTheme === themes.dark ? 'border-gray-700/50 hover:bg-gray-800/50' : currentTheme === themes.modern ? 'border-white/30 hover:bg-white/15' : 'border-gray-200 hover:bg-gray-50'}`}>
                <div className="flex items-start gap-3">
                  {getTypeIcon(item.type)}
                  <div className="flex-1">
                    <h3 className={`${currentTheme.text.primary} font-medium text-sm mb-2`}>{typeToJapanese(item.type)}</h3>
                    <p className={`${currentTheme.text.secondary} text-sm leading-relaxed`}>{item.text}</p>
                    {formattedDate && (
                      <p className={`${currentTheme.text.muted} text-xs mt-3`}>{formattedDate}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotesDisplay;
