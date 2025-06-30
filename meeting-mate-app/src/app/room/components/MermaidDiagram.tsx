import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { generateUniqueId } from '@/types/data';

interface MermaidDiagramProps {
  definition: string;
  theme?: 'light' | 'dark' | 'modern';
}

// Function to clean and fix common Mermaid syntax issues
const cleanMermaidDefinition = (definition: string): string => {
  console.log("cleanMermaidDefinition: Input:", definition);
  console.log("cleanMermaidDefinition: Input type:", typeof definition);
  
  if (!definition || typeof definition !== 'string') {
    console.warn("cleanMermaidDefinition: Invalid input, returning fallback");
    return 'graph TD;\n    A[No diagram data];';
  }

  let cleaned = definition.trim();
  console.log("cleanMermaidDefinition: After trim:", cleaned);
  
  // Remove any markdown code blocks if they somehow got through
  if (cleaned.startsWith('```mermaid')) {
    cleaned = cleaned.replace(/^```mermaid\s*/, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  
  // Ensure cleaned is still a string after processing
  if (!cleaned || typeof cleaned !== 'string') {
    console.error("cleanMermaidDefinition: Cleaned became invalid, returning fallback");
    return 'graph TD;\n    A[Processing error];';
  }
  
  // If the content appears to be on a single line (no newlines), try to add some formatting
  if (!cleaned.includes('\n') && cleaned.length > 100) {
    console.log("cleanMermaidDefinition: Single line detected, attempting to add line breaks");
    // Add line breaks after common Mermaid elements for better readability
    cleaned = cleaned
      // Add line breaks after node definitions
      .replace(/(\]\s+)([A-Z_]+\[)/g, '$1\n    $2')
      .replace(/(\)\s+)([A-Z_]+\()/g, '$1\n    $2')
      .replace(/(\}\s+)([A-Z_]+\{)/g, '$1\n    $2')
      .replace(/(\}\s+)([A-Z_]+\[)/g, '$1\n    $2')
      .replace(/(\]\s+)([A-Z_]+\()/g, '$1\n    $2')
      .replace(/(\)\s+)([A-Z_]+\[)/g, '$1\n    $2')
      // Add line breaks before subgraph and class definitions
      .replace(/(\s+)(subgraph\s+)/g, '\n\n    $2')
      .replace(/(\s+)(end\s*$)/g, '\n    $2')
      .replace(/(\s+)(classDef\s+)/g, '\n\n    $2')
      .replace(/(\s+)(class\s+)/g, '\n    $2')
      // Add line breaks after arrows
      .replace(/(\s+-->\s+[^;\n]+)(\s+)([A-Z_]+)/g, '$1\n    $3')
      .replace(/(\s+--\s*"[^"]*"\s*-->\s+[^;\n]+)(\s+)([A-Z_]+)/g, '$1\n    $3');
  }
  
  // Clean up problematic characters and syntax but preserve structure
  cleaned = cleaned
    // Fix HTML line breaks in text
    .replace(/<br\s*\/?>/gi, '<br/>')
    // Ensure proper spacing around arrows
    .replace(/-->/g, ' --> ')
    .replace(/--->/g, ' ---> ')
    .replace(/-\.->/g, ' -.-> ');
  
  // Split into lines for processing
  const lines = cleaned.split('\n');
  const cleanedLines: string[] = [];
  
  console.log("cleanMermaidDefinition: Split into", lines.length, "lines");
  
  for (let line of lines) {
    // Ensure line is a string
    if (typeof line !== 'string') {
      console.warn("cleanMermaidDefinition: Non-string line detected, skipping:", line);
      continue;
    }
    
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      cleanedLines.push('');
      continue;
    }
    
    // Fix single % comments to %%
    if (trimmedLine.startsWith('%') && !trimmedLine.startsWith('%%')) {
      line = line.replace(/^(\s*)%/, '$1%%');
    }
    
    // Clean Unicode characters from comments to prevent parse errors
    if (trimmedLine.startsWith('%%')) {
      const commentMatch = line.match(/^(\s*%%)(.*)$/);
      if (commentMatch) {
        const indent = commentMatch[1];
        const commentText = commentMatch[2];
        // Remove problematic Unicode characters
        const cleanComment = commentText.replace(/[^\x00-\x7F]/g, '').trim();
        line = indent + (cleanComment ? ' ' + cleanComment : ' Comment');
      }
    }
    
    // Remove any trailing semicolons that might cause issues
    if (trimmedLine.endsWith(';;')) {
      line = line.replace(/;;$/, ';');
    }
    
    // Fix subgraph syntax issues
    if (trimmedLine.includes('subgraph') && !trimmedLine.match(/^subgraph\s+\w+(\[.*\])?$/)) {
      // Ensure proper subgraph syntax
      const subgraphMatch = line.match(/^(\s*)subgraph\s+(.+)$/);
      if (subgraphMatch) {
        const indent = subgraphMatch[1];
        const content = subgraphMatch[2].trim();
        // If content has brackets, it's a label
        if (content.includes('[') && content.includes(']')) {
          line = `${indent}subgraph ${content}`;
        } else {
          // Simple subgraph name
          line = `${indent}subgraph ${content}`;
        }
      }
    }
    
    cleanedLines.push(line);
  }
  
  let result = cleanedLines.join('\n').trim();
  
  // Additional post-processing for complex diagrams
  result = result
    // Ensure proper spacing in subgraph labels
    .replace(/subgraph\s+([A-Z_]+)\[([^\]]+)\]/g, 'subgraph $1["$2"]')
    // Fix potential issues with node definitions containing special characters
    .replace(/\["([^"]*)<br\/>([^"]*)"\]/g, '["$1<br/>$2"]')
    // Ensure class assignments are on separate lines
    .replace(/(\w+)\s+(class\s+)/g, '$1\n    $2')
    // Clean up multiple spaces but preserve line structure
    .replace(/[ \t]+/g, ' ')
    // Ensure proper line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  
  // If still appears to be a single line, force line breaks more aggressively
  const lineCount = result.split('\n').length;
  if (lineCount < 5 && result.length > 200) {
    console.log("cleanMermaidDefinition: Forcing more aggressive line breaks");
    result = result
      // Force line breaks after each node definition
      .replace(/([A-Z_]+\[[^\]]+\])\s+/g, '$1\n    ')
      .replace(/([A-Z_]+\([^)]+\))\s+/g, '$1\n    ')
      .replace(/([A-Z_]+\{[^}]+\})\s+/g, '$1\n    ')
      // Add line breaks before subgraph
      .replace(/\s+(subgraph\s+)/g, '\n\n    $1')
      .replace(/\s+(end)\s+/g, '\n    $1\n\n    ')
      // Add line breaks before classDef
      .replace(/\s+(classDef\s+)/g, '\n\n    $1')
      // Add line breaks before class assignments
      .replace(/\s+(class\s+)/g, '\n    $1')
      // Fix arrows with labels
      .replace(/(\s+)([A-Z_]+\s+--"[^"]*"-->\s+[A-Z_]+)/g, '\n    $2')
      .replace(/(\s+)([A-Z_]+\s+-->\s+[A-Z_]+)/g, '\n    $2')
      // Clean up
      .replace(/^\s+/gm, '    ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
  
  // Validate that it starts with a proper graph declaration
  if (!result.startsWith('graph TD') && !result.startsWith('graph LR')) {
    console.warn('Mermaid definition does not start with graph TD/LR, adding default');
    return 'graph TD;\n    A[Invalid diagram format];\n    B[Please check the diagram definition];\n    A --> B;';
  }
  
  const finalLineCount = result.split('\n').length;
  console.log(`cleanMermaidDefinition: Final result - ${finalLineCount} lines, ${result.length} chars`);
  if (finalLineCount < 10) {
    console.log("cleanMermaidDefinition: Final result (full):", result);
  } else {
    console.log("cleanMermaidDefinition: Final result preview:", result.substring(0, 300) + "...");
  }
  return result;
};

const MermaidDiagram: React.FC<MermaidDiagramProps> = React.memo(({ definition, theme = 'light' }) => {
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagramId] = useState<string>(`mermaid-diagram-${generateUniqueId()}`);
  const [processedDefinition, setProcessedDefinition] = useState<string>("");

  useEffect(() => {
    console.log("MermaidDiagram: Raw definition received:", definition);
    console.log("MermaidDiagram: Definition type:", typeof definition);
    
    // Ensure we have a valid string
    if (!definition || typeof definition !== 'string') {
      console.warn("MermaidDiagram: Invalid definition, using fallback");
      setProcessedDefinition('graph TD;\n    A[No diagram data];');
      return;
    }
    
    // Decode and clean the Mermaid definition
    let newDecodedDefinition = definition;
    
    // Handle JSON-stringified content (if it comes from Firebase as escaped JSON)
    try {
      // Try to parse as JSON first (in case it's double-encoded)
      const parsed = JSON.parse(definition);
      if (typeof parsed === 'string') {
        newDecodedDefinition = parsed;
        console.log("MermaidDiagram: Parsed from JSON:", newDecodedDefinition);
      }
    } catch {
      // Not JSON, proceed with string processing
      console.log("MermaidDiagram: Not JSON, processing as string");
    }
    
    // Replace escaped newlines
    newDecodedDefinition = newDecodedDefinition.replace(/\\n/g, "\n");
    
    // Clean up common issues
    try {
      newDecodedDefinition = cleanMermaidDefinition(newDecodedDefinition);
      console.log("MermaidDiagram: Cleaned definition:", newDecodedDefinition);
    } catch (cleanError) {
      console.error("MermaidDiagram: Error during cleaning:", cleanError);
      newDecodedDefinition = 'graph TD;\n    A[Cleaning error];\n    B[Please check console];';
    }
    
    setProcessedDefinition(newDecodedDefinition);
  }, [definition]);

  useEffect(() => {
    const renderMermaid = async (currentDefinition: string) => {
      if (currentDefinition && mermaidContainerRef.current) {
        setSvgContent(null);
        setError(null);
        try {
          const mermaid = (await import('mermaid')).default;
          
          // Configure Mermaid for better error handling
          const mermaidTheme = theme === 'dark' || theme === 'modern' ? 'dark' : 'neutral';
          const isDarkTheme = theme === 'dark' || theme === 'modern';
          
          mermaid.initialize({
            startOnLoad: false,
            theme: mermaidTheme,
            securityLevel: 'loose',
            fontFamily: 'Arial, sans-serif',
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true
            },
            themeVariables: {
              fontFamily: 'Arial, sans-serif',
              // ダークテーマの場合の背景色設定
              ...(isDarkTheme && {
                primaryColor: '#374151',
                primaryTextColor: '#f3f4f6',
                primaryBorderColor: '#6b7280',
                lineColor: '#9ca3af',
                secondaryColor: '#4b5563',
                tertiaryColor: '#1f2937',
                background: '#1f2937',
                mainBkg: '#374151',
                secondBkg: '#4b5563',
                tertiaryBkg: '#6b7280'
              })
            }
          });
          
          const tempId = `mermaid-temp-${generateUniqueId()}`;
          console.log("MermaidDiagram: Attempting to render with definition:", currentDefinition);
          
          const { svg } = await mermaid.render(tempId, currentDefinition);
          if (svg) setSvgContent(svg);
          else setError("Mermaid rendering returned no SVG.");
        } catch (e: unknown) {
          let errorMessage = "Failed to render Mermaid diagram.";
          if (e instanceof Error) {
            errorMessage = e.message;
            console.error("Mermaid rendering error details:", {
              message: e.message,
              stack: e.stack,
              name: e.name
            });
            
            // Provide more helpful error messages for common issues
            if (errorMessage.includes("Parse error")) {
              errorMessage = `Parse error in diagram: ${errorMessage}. Please check the Mermaid syntax.`;
            } else if (errorMessage.includes("UNICODE_TEXT")) {
              errorMessage = "Unicode character error in diagram. The diagram contains unsupported characters.";
            } else if (errorMessage.includes("split")) {
              errorMessage = "Data processing error: Invalid diagram data format.";
            } else if (errorMessage.includes("subgraph")) {
              errorMessage = "Subgraph syntax error: Please check subgraph definitions.";
            }
          }
          console.error("Mermaid rendering error:", e);
          console.log("Problematic definition length:", currentDefinition?.length);
          console.log("Problematic definition preview:", currentDefinition?.substring(0, 200) + "...");
          
          // Try to create a simplified fallback diagram
          const fallbackDiagram = `graph TD
    A["エラーが発生しました"]
    B["図の生成に失敗"]
    A --> B
    
    classDef error fill:#FEF2F2,stroke:#FEF2F2,color:#DC2626
    class A,B error`;
          
          try {
            const mermaidForFallback = (await import('mermaid')).default;
            const { svg: fallbackSvg } = await mermaidForFallback.render(`fallback-${generateUniqueId()}`, fallbackDiagram);
            if (fallbackSvg) {
              setSvgContent(fallbackSvg);
              setError(`Diagram error: ${errorMessage}`);
              return;
            }
          } catch (fallbackError) {
            console.error("Even fallback diagram failed:", fallbackError);
          }
          
          setError(errorMessage);
          setSvgContent(null);
        }
      } else if (!currentDefinition) {
        setSvgContent(null);
        setError(null);
      }
    };
    renderMermaid(processedDefinition);
  }, [processedDefinition, theme]);

  useEffect(() => {
    if (svgContent && mermaidContainerRef.current) {
      const container = mermaidContainerRef.current;
      container.innerHTML = svgContent;
      const svgElement = container.querySelector("svg");
      if (svgElement) {
        const d3Svg = d3.select(svgElement);
        // 縦横比を保持して中央配置
        d3Svg.attr("preserveAspectRatio", "xMidYMid meet");
        let innerG = d3Svg.select("g");
        if (innerG.empty()) {
          const content = d3Svg.html();
          d3Svg.html(`<g>${content}</g>`);
          innerG = d3Svg.select("g");
        }
        const zoomBehavior = d3.zoom<SVGSVGElement, unknown>().on("zoom", (event) => { innerG.attr("transform", event.transform.toString()); });
        d3Svg.call(zoomBehavior);
        d3Svg.style("max-width", "100%");
        d3Svg.style("height", "100%");
        d3Svg.style("width", "100%");
      }
    }
  }, [svgContent]);

  // テーマに応じた背景色とテキスト色を設定
  const isDarkTheme = theme === 'dark' || theme === 'modern';
  const backgroundClass = isDarkTheme ? 'bg-gray-800' : 'bg-white';
  const textClass = isDarkTheme ? 'text-gray-300' : 'text-slate-500';
  const errorBgClass = isDarkTheme ? 'bg-red-900/50' : 'bg-red-50';
  const errorTextClass = isDarkTheme ? 'text-red-300' : 'text-red-500';

  if (error) return <div ref={mermaidContainerRef} className={`${errorTextClass} text-sm p-2 ${errorBgClass} rounded-md`}>Error rendering diagram: {error}</div>;
  return (<div ref={mermaidContainerRef} key={diagramId} className={`mermaid-diagram-container w-full h-full flex justify-center items-center overflow-hidden ${backgroundClass}`} style={{ minHeight: '150px' }}>{!svgContent && !error && <div className={`${textClass} text-sm`}>Loading diagram...</div>}</div>);
});
MermaidDiagram.displayName = 'MermaidDiagram';

export default MermaidDiagram;
