import React from 'react';
import { themes } from '@/constants/themes';
import { CurrentAgenda } from '@/types/data';
import { Flag, Dot } from 'lucide-react';

interface CurrentAgendaDisplayPanelProps {
  agenda: CurrentAgenda | null;
  currentTheme: typeof themes.dark;
}

const CurrentAgendaDisplayPanel: React.FC<CurrentAgendaDisplayPanelProps> = ({ agenda, currentTheme }) => {
  if (!agenda) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Flag className={`${currentTheme.text.muted} w-12 h-12 mb-3 mx-auto`} />
          <p className={`${currentTheme.text.secondary} text-sm`}>議題が設定されていません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* mainTopic の枠を削除し、テキストのみ表示 */}
      <div className="flex items-start gap-3">
        <Flag className={`${currentTheme.text.primary === 'text-white' ? 'text-indigo-400' : 'text-indigo-600'} w-6 h-6 flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <p className={`${currentTheme.text.primary} text-base font-semibold leading-relaxed`}>{agenda.mainTopic}</p>
        </div>
      </div>

      {agenda.details && agenda.details.length > 0 && (
        <div className="space-y-2">
          {/* 「詳細項目」というタイトルを削除 */}
          <div className="space-y-2">
            {agenda.details.map((detail, index) => (
              <div key={detail.id || index} className={`${currentTheme.cardInner} rounded-lg p-3.5 transition-all duration-200 hover:shadow-md border ${currentTheme === themes.dark ? 'border-gray-700/50 hover:bg-gray-800/50' : currentTheme === themes.modern ? 'border-white/30 hover:bg-white/15' : 'border-gray-200 hover:bg-gray-50'} group`}>
                <div className="flex items-start gap-3">
                  <Dot className={`${currentTheme.text.primary === 'text-white' ? 'text-indigo-400' : 'text-indigo-600'} w-4 h-4 flex-shrink-0 mt-0.5`} />
                  <p className={`${currentTheme.text.secondary} text-sm leading-relaxed`}>{detail.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentAgendaDisplayPanel;
