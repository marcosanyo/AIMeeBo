import React from 'react';
import { themes } from '@/constants/themes';
import { Sparkles, Lightbulb } from 'lucide-react';

interface SuggestedNextTopicsPanelProps {
  topics: string[];
  currentTheme: typeof themes.dark;
}

const SuggestedNextTopicsPanel: React.FC<SuggestedNextTopicsPanelProps> = ({ topics, currentTheme }) => {
  if (!topics || topics.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Sparkles className={`${currentTheme.text.muted} w-12 h-12 mb-3 mx-auto`} />
          <p className={`${currentTheme.text.secondary} text-sm`}>提案はありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topics.map((topic, index) => (
        <div key={index} className={`${currentTheme.cardInner} rounded-lg p-3.5 transition-all duration-200 hover:shadow-md border ${currentTheme === themes.dark ? 'border-gray-700/50 hover:bg-gray-800/50' : currentTheme === themes.modern ? 'border-white/30 hover:bg-white/15' : 'border-gray-200 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <Lightbulb className={`${currentTheme.text.primary === 'text-white' ? 'text-yellow-400' : 'text-yellow-600'} w-4 h-4 flex-shrink-0`} />
            <span className={`${currentTheme.text.secondary} text-sm leading-relaxed`}>{topic}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SuggestedNextTopicsPanel;
