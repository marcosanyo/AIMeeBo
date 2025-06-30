import React, { useState, useRef } from 'react';
import { ParticipantEntry, TranscriptEntry } from '@/types/data';
import Portal from './Portal';
import { themes } from '@/constants/themes';

interface ParticipantsListProps {
  participants: ParticipantEntry[];
  transcripts: TranscriptEntry[];
  currentTheme: typeof themes.dark;
  onParticipantEnter?: (id: string) => void;
  onParticipantLeave?: (id: string) => void;
}

// 参加者IDから一貫した色インデックスを生成する関数
// 注意: 会話履歴パネルとチャットポップアップでも同じ関数を使用する
export const getParticipantColorIndex = (id: string): number => {
  // 単純なハッシュ関数
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0; // 32bit整数に変換
  }
  return Math.abs(hash) % participantColors.length;
};

// 色の配列を定義（アプリ全体で共通）
export const participantColors = [
  "from-blue-500 to-purple-500",
  "from-green-500 to-teal-500",
  "from-orange-500 to-red-500",
  "from-pink-500 to-purple-500",
  "from-indigo-500 to-blue-500",
  "from-yellow-500 to-orange-500",
  "from-red-500 to-pink-500",
  "from-purple-500 to-indigo-500",
  "from-teal-500 to-cyan-500",
  "from-cyan-500 to-blue-500",
  "from-emerald-500 to-green-500",
  "from-amber-500 to-yellow-500"
];

const ParticipantsList: React.FC<ParticipantsListProps> = ({ participants, transcripts, currentTheme, onParticipantEnter, onParticipantLeave }) => {
  const [hoveredParticipantId, setHoveredParticipantId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number, left: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const participantRef = useRef<HTMLDivElement | null>(null);

  const hoveredParticipantTranscripts = hoveredParticipantId
    ? transcripts.filter(t => t.userId === hoveredParticipantId)
    : [];
  // 5人まではスクロール無し、6人以上でスクロール
  const maxVisibleParticipants = 5;
  const needsScroll = participants.length > maxVisibleParticipants;

  // 2カラム切り替えロジックは将来用に残す（現状は未使用）
  // const columnCount = participants.length <= 4 ? 1 : 2;
  // const columnCount = 1;

  // 役割の表示を日本語に変換する関数
  const getLocalizedRole = (role: string | undefined): string => {
    if (!role) return "参加者";
    switch (role.toLowerCase()) {
      case "creator": return "ルーム作成者";
      case "participant": return "参加者";
      default: return role;
    }
  };

  return (
    <div className={`relative ${needsScroll ? 'h-80 overflow-y-auto' : ''}`}>
      <div className={`grid grid-cols-1 gap-3`}>
        {participants.length > 0 ? participants.map((p) => {
          const name = p.name || "不明な参加者";
          const role = getLocalizedRole(p.role);
          const initials = typeof name === 'string' ? name.substring(0, 2).toUpperCase() : "??";
          const colorIndex = getParticipantColorIndex(p.id);
          const bgColor = participantColors[colorIndex];

          return (
            <div
              key={p.id}
              ref={participantRef}
              className={`relative flex items-center space-x-2 p-2 rounded-xl ${currentTheme.cardInner} border transition-all duration-200 hover:shadow-md ${currentTheme === themes.dark ? 'hover:bg-gray-800/50' : currentTheme === themes.modern ? 'hover:bg-white/15' : 'hover:bg-gray-50'}`}
              onMouseEnter={(e) => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                const rect = e.currentTarget.getBoundingClientRect();
                setPopupPosition({ top: rect.top, left: rect.right });
                setHoveredParticipantId(p.id);
                if (onParticipantEnter) onParticipantEnter(p.id);
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredParticipantId(null);
                  setPopupPosition(null);
                }, 200); // 少し遅延させて、ポップアップへの移動をスムーズに
                if (onParticipantLeave) onParticipantLeave(p.id);
              }}
            >
              <div className={`w-8 h-8 bg-gradient-to-r ${bgColor} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${currentTheme.text.primary} font-medium text-xs truncate`}>{name}</p>
                <p className={`${currentTheme.text.secondary} text-xs`}>{role}</p>
              </div>
            </div>
          );
        }) : (
          // 2カラム用のcol-span-2は将来用に残す
          <p className={`${currentTheme.text.secondary} text-sm text-center`}>参加者情報はありません。</p>
        )}
      </div>
      {hoveredParticipantId && popupPosition && hoveredParticipantTranscripts.length > 0 && (
        <Portal>
          <div
            style={{ top: `${popupPosition.top}px`, left: `${popupPosition.left}px` }}
            className={`fixed ml-2 w-72 p-4 rounded-xl shadow-2xl z-[100] ${currentTheme.card} ${currentTheme.text.primary} ${currentTheme.border} backdrop-blur-sm bg-opacity-80`}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              setHoveredParticipantId(null);
              setPopupPosition(null);
            }}
          >
            <div className={`border-b ${currentTheme.border} pb-2 mb-2`}>
              <h4 className={`font-bold text-sm ${currentTheme.text.primary}`}>{participants.find(p=>p.id === hoveredParticipantId)?.name || '不明な参加者'} の発言履歴</h4>
            </div>
            <ul className="space-y-3 max-h-56 overflow-y-auto pr-2">
              {hoveredParticipantTranscripts.map((transcript, index) => (
                <li key={transcript.timestamp + index} className={`text-xs ${currentTheme.text.secondary} leading-relaxed`}>
                  {transcript.text}
                </li>
              ))}
            </ul>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default ParticipantsList;
