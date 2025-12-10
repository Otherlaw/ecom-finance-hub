import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ChatContext } from '@/hooks/useAssistantChat';

type ViewMode = 'chat' | 'tutorial-selector' | 'tutorial-active';

interface AssistantChatContextType {
  isChatOpen: boolean;
  openChat: (initialMessage?: string, context?: Partial<ChatContext>) => void;
  closeChat: () => void;
  initialMessage?: string;
  initialContext?: Partial<ChatContext>;
  
  // Modo tutorial
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showTutorialSelector: () => void;
  backToChat: () => void;
}

const AssistantChatContext = createContext<AssistantChatContextType | undefined>(undefined);

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [initialContext, setInitialContext] = useState<Partial<ChatContext> | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  const openChat = useCallback((message?: string, context?: Partial<ChatContext>) => {
    setInitialMessage(message);
    setInitialContext(context);
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setInitialMessage(undefined);
    setInitialContext(undefined);
    setViewMode('chat');
  }, []);

  const showTutorialSelector = useCallback(() => {
    setViewMode('tutorial-selector');
  }, []);

  const backToChat = useCallback(() => {
    setViewMode('chat');
  }, []);

  return (
    <AssistantChatContext.Provider value={{ 
      isChatOpen, 
      openChat, 
      closeChat, 
      initialMessage, 
      initialContext,
      viewMode,
      setViewMode,
      showTutorialSelector,
      backToChat,
    }}>
      {children}
    </AssistantChatContext.Provider>
  );
}

export function useAssistantChatContext() {
  const context = useContext(AssistantChatContext);
  if (!context) {
    throw new Error('useAssistantChatContext must be used within AssistantChatProvider');
  }
  return context;
}
