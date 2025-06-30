// meeting-mate-app/src/hooks/useBackendApi.ts
import { useCallback } from 'react';
import { TranscriptEntry, generateUniqueId } from '@/types/data'; // generateUniqueId も型定義ファイルからインポート

interface BackendApiResponse {
  result?: {
    invokedAgents?: string[];
    updatedTasks?: boolean;
    updatedParticipants?: boolean;
    updatedMinutes?: boolean;
    updatedAgenda?: {
      currentAgenda?: { mainTopic?: string };
      suggestedNextTopics?: string[];
    };
    updatedOverviewDiagram?: boolean;
  };
}

interface UseBackendApiResult {
  callBackendApi: (newestEntry: TranscriptEntry, currentRoomId: string, pageCurrentUser: { id: string; name: string } | null) => Promise<BackendApiResponse>;
}

export const useBackendApi = (): UseBackendApiResult => {
  const callBackendApi = useCallback(async (newestEntry: TranscriptEntry, currentRoomId: string, pageCurrentUser: { id: string; name: string } | null) => {
    if (!currentRoomId || !pageCurrentUser) {
      throw new Error("Room ID or User not available for API call");
    }
    const requestBody = {
      jsonrpc: "2.0",
      method: "ExecuteTask",
      params: {
        task: {
          taskId: generateUniqueId(),
          messages: [{ role: "user", parts: [{ text: newestEntry.text }] }],
          roomId: currentRoomId,
          speakerId: newestEntry.userId, // userIdを追加
          speakerName: newestEntry.userName || newestEntry.userId // userNameを優先し、なければuserIdを使用
        }
      },
      id: generateUniqueId()
    };
    // Firebase Hosting rewritesまたはNext.js dev proxyを使用して相対URLでAPI呼び出し
    const fullUrl = `/invoke`;
    console.log(`Attempting to fetch from: ${fullUrl}`); // デバッグログは残す
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      // エラーレスポンスをテキストとして一度だけ読み取る
      const errorText = await response.text();

      // JSONとして解析を試みる
      try {
        const errorData = JSON.parse(errorText);
        if (errorData && errorData.error && errorData.error.message) {
          throw new Error(`APIエラー ${response.status}: ${errorData.error.message}`);
        } else {
          throw new Error(`APIエラー ${response.status}: ${JSON.stringify(errorData)}`);
        }
      } catch (jsonError) {
        // JSONとして解析できない場合はテキストをそのまま使用
        console.error("Failed to parse error response as JSON:", jsonError);
        throw new Error(`APIエラー ${response.status}: ${errorText}`);
      }
    }

    // 成功レスポンスの場合、JSONとして解析
    const responseText = await response.text();
    try {
      const jsonResponse = JSON.parse(responseText);
      
      // Check for errors in the JSON response (FastAPI returns 200 with error details in JSON)
      if (jsonResponse.error) {
        const errorMessage = jsonResponse.error.message || 'Unknown error occurred';
        const errorCode = jsonResponse.error.code || 'UNKNOWN';
        throw new Error(`APIエラー [${errorCode}]: ${errorMessage}`);
      }
      
      return jsonResponse;
    } catch (error) {
      console.error("Failed to parse API response as JSON:", error);
      throw new Error("APIレスポンスの解析に失敗しました");
    }
  }, []);

  return { callBackendApi };
};
