import React from 'react';
import { GitBranch } from 'lucide-react';
import { themes } from '@/constants/themes';
import { OverviewDiagramData } from '@/types/data';
import MermaidDiagram from './MermaidDiagram'; // 後で作成

interface OverviewDiagramPanelProps {
  diagramData: OverviewDiagramData | null;
  currentTheme: typeof themes.dark;
  themeType: 'light' | 'dark' | 'modern';
  isFullScreen?: boolean;
}

const OverviewDiagramPanel: React.FC<OverviewDiagramPanelProps> = React.memo(({ diagramData, currentTheme, themeType, isFullScreen = false }) => {
  console.log("OverviewDiagramPanel: diagramData received:", diagramData);
  console.log("OverviewDiagramPanel: mermaidDefinition:", diagramData?.mermaidDefinition);
  
  if (!diagramData || !diagramData.mermaidDefinition) {
    return (
      <div className={`${isFullScreen ? 'w-full h-full' : `${currentTheme.cardInner} border rounded-xl p-4`} flex items-center justify-center`} style={isFullScreen ? {} : { minHeight: '200px' }}>
        <div className="text-center">
          <div className={`w-16 h-16 ${currentTheme === themes.dark ? 'bg-gray-700' : currentTheme === themes.modern ? 'bg-white/10' : 'bg-gray-200'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <GitBranch className={`w-8 h-8 ${currentTheme.text.muted}`} />
          </div>
          <p className={`${currentTheme.text.secondary} text-sm`}>概要図が生成されると<br />ここに表示されます</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`${isFullScreen ? 'w-full h-full' : `${currentTheme.cardInner} border rounded-xl p-4`} flex items-center justify-center`} style={isFullScreen ? {} : { minHeight: '200px' }}>
      <MermaidDiagram definition={diagramData.mermaidDefinition} theme={themeType} />
    </div>
  );
});
OverviewDiagramPanel.displayName = 'OverviewDiagramPanel';

export default OverviewDiagramPanel;
