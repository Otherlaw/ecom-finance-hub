import { useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  links?: Array<{ label: string; path: string }>;
}

export interface ChatContext {
  empresa?: {
    nome: string;
    regime: string;
  };
  telaAtual?: string;
  periodo?: string;
  alertas?: Array<{
    titulo: string;
    descricao: string;
    severidade: string;
  }>;
  dadosAdicionais?: Record<string, any>;
}

interface UseAssistantChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, additionalContext?: Partial<ChatContext>) => Promise<void>;
  clearMessages: () => void;
  setContext: (context: Partial<ChatContext>) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Map routes to friendly names
const ROUTE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/dre': 'DRE',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/icms': 'Créditos de ICMS',
  '/precificacao': 'Precificação',
  '/checklist-fechamento': 'Checklist de Fechamento',
  '/contas-pagar': 'Contas a Pagar',
  '/contas-receber': 'Contas a Receber',
  '/compras': 'Compras',
  '/fornecedores': 'Fornecedores',
  '/produtos': 'Produtos',
  '/estoque-sku': 'Estoque por SKU',
  '/kpis': 'KPIs',
  '/projecoes': 'Projeções',
  '/empresas': 'Empresas',
  '/balanco': 'Balanço',
  '/fechamento': 'Fechamento',
  '/conciliacao': 'Conciliação',
  '/cartao-credito': 'Cartão de Crédito',
  '/centros-custo': 'Centros de Custo',
  '/plano-contas': 'Plano de Contas',
  '/cmv': 'Relatório CMV',
  '/movimentos-manuais': 'Movimentos Manuais',
  '/mapeamentos-marketplace': 'Mapeamentos de SKU',
  '/regras-marketplace': 'Regras de Marketplace',
  '/regras-categorizacao': 'Regras de Categorização',
  '/configuracoes': 'Configurações',
  '/usuarios': 'Usuários',
  '/assistant': 'Central de Alertas',
};

// Parse links from assistant response
function parseLinks(content: string): { cleanContent: string; links: Array<{ label: string; path: string }> } {
  const linkRegex = /\[LINK:(\/[^\]]+)\]/g;
  const links: Array<{ label: string; path: string }> = [];
  
  const cleanContent = content.replace(linkRegex, (match, path) => {
    const label = ROUTE_NAMES[path] || path;
    links.push({ label, path });
    return `**${label}**`;
  });
  
  return { cleanContent, links };
}

export function useAssistantChat(): UseAssistantChatReturn {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContextState] = useState<ChatContext>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  const setContext = useCallback((newContext: Partial<ChatContext>) => {
    setContextState(prev => ({ ...prev, ...newContext }));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string, additionalContext?: Partial<ChatContext>) => {
    if (!content.trim()) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Build message history for context
    const messageHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Merge contexts
    const fullContext: ChatContext = {
      ...context,
      ...additionalContext,
      telaAtual: additionalContext?.telaAtual || ROUTE_NAMES[location.pathname] || location.pathname,
    };

    try {
      // Obter token de sessão do usuário autenticado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Você precisa estar logado para usar o Fin');
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/assistant-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: messageHistory,
          context: fullContext,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao processar sua pergunta');
      }

      if (!response.body) {
        throw new Error('Resposta sem corpo');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let assistantMessageId = `assistant-${Date.now()}`;
      let textBuffer = '';

      // Add empty assistant message
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              assistantContent += deltaContent;
              
              // Parse links and update message
              const { cleanContent, links } = parseLinks(assistantContent);
              
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: cleanContent, links }
                  : m
              ));
            }
          } catch {
            // Incomplete JSON, put back and wait
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content;
            if (deltaContent) {
              assistantContent += deltaContent;
              const { cleanContent, links } = parseLinks(assistantContent);
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: cleanContent, links }
                  : m
              ));
            }
          } catch { /* ignore */ }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o Fin';
      setError(errorMessage);
      console.error('[useAssistantChat] Error:', err);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [messages, context, location.pathname]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setContext,
  };
}
