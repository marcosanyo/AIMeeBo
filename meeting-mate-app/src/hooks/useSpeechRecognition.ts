// meeting-mate-app/src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '@/types/data'; // 型定義をインポート

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  onError?: (event: SpeechRecognitionErrorEvent) => void;
  onEnd?: () => void;
}

export const useSpeechRecognition = (options: UseSpeechRecognitionOptions) => {
  // コールバックはuseRefでラップし、常に最新値を参照
  const onResultRef = useRef(options.onResult);
  const onErrorRef = useRef(options.onError);
  const onEndRef = useRef(options.onEnd);

  useEffect(() => {
    onResultRef.current = options.onResult;
    onErrorRef.current = options.onError;
    onEndRef.current = options.onEnd;
  }, [options.onResult, options.onError, options.onEnd]);

  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechApiAvailable, setIsSpeechApiAvailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const userManuallyStoppedRef = useRef(false);
  const finalBufferRef = useRef<string[]>([]);
  const bufferSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log("Attempting to initialize Speech Recognition API");
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      console.log("SpeechRecognitionAPI found");
      setIsSpeechApiAvailable(true);
      const recognitionInstance = new SpeechRecognitionAPI();
      recognitionInstance.continuous = false; // ループ認識のためfalse
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'ja-JP';

      recognitionInstance.onstart = () => {
        setIsRecording(true);
        console.log("SpeechRecognition onstart: setIsRecording(true)");
      };

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        let hasFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            hasFinal = true;
            finalBufferRef.current.push(transcriptPart);
            console.log('[onresult:FINAL]', transcriptPart);
          } else {
            console.log('[onresult:INTERIM]', transcriptPart);
          }
        }
        // isFinalな結果が出た場合、バッファ送信タイマーをリセット
        if (hasFinal) {
          if (bufferSendTimeoutRef.current) {
            clearTimeout(bufferSendTimeoutRef.current);
          }
          bufferSendTimeoutRef.current = setTimeout(() => {
            const fullSentence = finalBufferRef.current.join('');
            if (fullSentence) {
              onResultRef.current(fullSentence);
              finalBufferRef.current = [];
            }
          }, 500); // 500ms無音でバッファ送信
          // stop()は即時でなく300ms遅延で呼ぶ
          if (!userManuallyStoppedRef.current && recognitionRef.current) {
            setTimeout(() => {
              if (recognitionRef.current) { // nullチェックを追加
                try {
                  recognitionRef.current.stop();
                  console.log("Speech recognition stopped from onresult (delayed). Will restart in onend.");
                } catch (e: unknown) {
                  if (e instanceof Error && e.name !== 'InvalidStateError') {
                    console.warn('Error stopping recognition before restart (onresult):', e);
                  }
                }
              }
            }, 300);
          }
        }
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') {
          // no-speechエラーはsupress（何もしない）
          return;
        }
        console.error('音声認識エラー詳細:', event.error, "メッセージ:", event.message);
        if (onErrorRef.current) {
          onErrorRef.current(event);
        }
        // 'not-allowed' や 'service-not-allowed' 以外のエラーの場合に再開を試みる
        if (event.error !== 'not-allowed' && event.error !== 'service-not-allowed' && recognitionRef.current) {
          console.log("Speech recognition error, attempting to restart.");
          if (!userManuallyStoppedRef.current) {
            try {
              recognitionRef.current.stop(); // stop() を呼び出して onend をトリガー
            } catch (e: unknown) {
              if (e instanceof Error && e.name !== 'InvalidStateError') {
                console.warn('Error stopping recognition on error:', e);
              }
            }
          }
        }
      };

      recognitionInstance.onend = () => {
        setIsRecording(false);
        console.log("SpeechRecognition onend: setIsRecording(false)");
        if (onEndRef.current) {
          onEndRef.current();
        }
        // ユーザーが手動で停止していない場合のみ再開
        if (!userManuallyStoppedRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.start();
                console.log("Speech recognition restarted from onend.");
              } catch (e) {
                console.error('Error restarting recognition from onend:', e);
              }
            } else {
              console.warn('onend: recognitionRef.current is null, cannot restart');
            }
          }, 500); // 500ms遅延
        } else {
          console.log("Speech recognition ended due to manual stop, not restarting.");
        }
      };

      recognitionRef.current = recognitionInstance;
      console.log("Speech recognition initialized, instance:", recognitionRef.current);
    } else {
      console.warn('音声認識非対応ブラウザ');
      setIsSpeechApiAvailable(false);
    }

    return () => {
      if (recognitionRef.current) {
        console.log("Cleaning up speech recognition instance.");
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        try {
          recognitionRef.current.stop();
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'InvalidStateError') {
            console.warn('Cleanup stopエラー:', e);
          }
        }
      } else {
        console.warn('Cleanup: recognitionRef.current is already null');
      }
    };
  }, []); // 依存配列を空にして初回マウント時のみ実行

  useEffect(() => {
    if (!recognitionRef.current) {
      console.log("Speech start/stop effect: recognitionRef.current is null");
      return;
    }
    if (isRecording) {
      // isRecordingがtrueになったら、毎回start()を試みる（多重startはcatchで握りつぶす）
      try {
        userManuallyStoppedRef.current = false; // 録音開始時は手動停止フラグをリセット
        recognitionRef.current.start();
        console.log("Speech recognition started (forced).");
      } catch (e) {
        const err = e as { name?: string, message?: string };
        if (err.name !== 'InvalidStateError') {
          console.error('認識開始失敗:', err.name, err.message, e);
          setIsRecording(false); // エラー時はUIも停止
        } else {
          // すでにstart済みの場合は無視
          console.log('Speech recognition already started (InvalidStateError).');
        }
      }
    } else {
      // isRecordingがfalseになったら、手動停止の場合のみstop()を呼ぶ
      console.log("Speech start/stop effect: isRecording is false.");
      // userManuallyStoppedRef.current が true の場合のみ stop() を呼ぶ
      // onend からの setIsRecording(false) で意図せず stop() が呼ばれるのを防ぐ
      if (userManuallyStoppedRef.current) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            console.log("Speech recognition stopped (manual).");
          } catch (e) {
            if ((e as { name?: string }).name !== 'InvalidStateError') {
              console.error('認識停止失敗:', e);
            }
          }
        } else {
          console.warn('stop() called but recognitionRef is null');
        }
      } else {
        console.log("Speech recognition not stopped (not manual stop).");
      }
    }
  }, [isRecording]);

  const toggleSpeechRecognition = useCallback(() => {
    console.log("toggleSpeechRecognition called. Current isRecording:", isRecording);
    if (!recognitionRef.current) {
      console.log("toggleSpeechRecognition: recognitionRef.current is null, cannot toggle.");
      return;
    }
    if (isRecording) {
      // 手動停止時はフラグを立てる
      userManuallyStoppedRef.current = true;
      setIsRecording(false);
    } else {
      userManuallyStoppedRef.current = false;
      setIsRecording(true);
    }
  }, [isRecording]);

  return {
    isRecording,
    isSpeechApiAvailable,
    toggleSpeechRecognition,
    recognitionRef // recognitionRef を公開
  };
};
