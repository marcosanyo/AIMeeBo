import React, { useEffect, useRef } from 'react';
import { participantColors, getParticipantColorIndex } from './ParticipantsList';

interface ChatHistoryItem {
  id: number;
  user: string;
  avatar: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system';
  userId?: string; // ユーザーIDを追加
}

interface ConversationHistoryPanelProps {
  chatHistory: ChatHistoryItem[];
  currentTheme: typeof import('@/constants/themes').themes.dark;
}

const ConversationHistoryPanel: React.FC<ConversationHistoryPanelProps> = ({ 
  chatHistory, 
  currentTheme 
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message when chat history updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatHistory]);

  if (!chatHistory || chatHistory.length === 0) {
    return (
      <div className={`text-center py-8 ${currentTheme.text.secondary}`}>
        <p>まだ会話がありません</p>
      </div>
    );
  }

  return (
    <div ref={chatContainerRef} className="h-48 overflow-y-auto space-y-4">
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
                <span className={`font-medium ${currentTheme.text.primary}`}>{chat.user}</span>
                <span className={`text-xs ${currentTheme.text.tertiary}`}>
                  {new Date(chat.timestamp).toLocaleTimeString('ja-JP', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <div className={`${currentTheme.text.secondary} break-words whitespace-pre-line`}>{chat.message}</div>
            </div>
          </div>
        );
      })}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ConversationHistoryPanel;