// meeting-mate-app/src/hooks/useFlashMessages.ts
import { useState, useCallback } from 'react';

interface UseFlashMessagesResult {
  flashStates: { [key: string]: boolean };
  triggerFlash: (key: string) => void;
}

export const useFlashMessages = (): UseFlashMessagesResult => {
  const [flashStates, setFlashStates] = useState<{ [key: string]: boolean }>({});

  const triggerFlash = useCallback((key: string) => {
    setFlashStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setFlashStates(prev => ({ ...prev, [key]: false }));
    }, 1500);
  }, []);

  return { flashStates, triggerFlash };
};
