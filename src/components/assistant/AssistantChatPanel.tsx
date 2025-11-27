import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Send, Trash2, Sparkles, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AssistantCharacter } from './AssistantCharacter';
import { useAssistantChat, ChatMessage, ChatContext } from '@/hooks/useAssistantChat';
import { cn } from '@/lib/utils';

interface AssistantChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: Partial<ChatContext>;
  initialMessage?: string;
}

const QUICK_SUGGESTIONS = [
  "Por que isso aconteceu?",
  "O que você recomenda?",
  "Quais próximos passos?",
  "Explique esse cálculo",
];

export function AssistantChatPanel({ isOpen, onClose, initialContext, initialMessage }: AssistantChatPanelProps) {
  const navigate = useNavigate();
  const { messages, isLoading, error, sendMessage, clearMessages, setContext } = useAssistantChat();
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // Set initial context when panel opens
  useEffect(() => {
    if (isOpen && initialContext) {
      setContext(initialContext);
    }
  }, [isOpen, initialContext, setContext]);

  // Send initial message if provided
  useEffect(() => {
    if (isOpen && initialMessage && !hasInitialized.current) {
      hasInitialized.current = true;
      setTimeout(() => {
        sendMessage(initialMessage, initialContext);
      }, 300);
    }
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, initialMessage, initialContext, sendMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLinkClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleQuickSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 h-[600px] max-h-[80vh] flex flex-col bg-card border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AssistantCharacter size="md" mood={isLoading ? 'thinking' : 'neutral'} />
            {isLoading && (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Assis.Fin</h3>
            <p className="text-xs text-muted-foreground">Copiloto Financeiro/Fiscal</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearMessages}
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h4 className="font-medium mb-2">Olá! Sou o Assis.Fin</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Posso te ajudar com dúvidas sobre seus números, fechamentos, impostos, precificação e relatórios.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_SUGGESTIONS.slice(0, 2).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleQuickSuggestion(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onLinkClick={handleLinkClick}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <AssistantCharacter size="sm" mood="thinking" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Quick suggestions when there are messages */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t flex gap-2 overflow-x-auto">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <Badge
              key={suggestion}
              variant="outline"
              className="cursor-pointer hover:bg-muted shrink-0 text-xs"
              onClick={() => handleQuickSuggestion(suggestion)}
            >
              {suggestion}
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Message bubble component
function MessageBubble({ 
  message, 
  onLinkClick 
}: { 
  message: ChatMessage; 
  onLinkClick: (path: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex items-start gap-2', isUser && 'flex-row-reverse')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <AssistantCharacter size="sm" mood="neutral" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm'
        )}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content || (
            <span className="text-muted-foreground italic">...</span>
          )}
        </div>
        
        {/* Action links */}
        {message.links && message.links.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
            {message.links.map((link, i) => (
              <Button
                key={i}
                variant="secondary"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onLinkClick(link.path)}
              >
                Ir para {link.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
