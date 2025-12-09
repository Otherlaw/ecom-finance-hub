import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Send, Trash2, Sparkles, MessageCircle, Loader2, Paperclip, Link, Code, Mic, Info, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAssistantChat, ChatMessage, ChatContext } from '@/hooks/useAssistantChat';
import { cn } from '@/lib/utils';

interface AssistantChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: Partial<ChatContext>;
  initialMessage?: string;
}

// Sugestões dinâmicas por rota
const SUGGESTIONS_BY_ROUTE: Record<string, string[]> = {
  '/': ["Como está meu mês?", "Quais alertas pendentes?", "Resumo financeiro"],
  '/dashboard': ["Como está meu mês?", "Quais alertas pendentes?", "Resumo financeiro"],
  '/dre': ["Explique a margem bruta", "Por que o lucro caiu?", "Compare com mês anterior"],
  '/fluxo-caixa': ["Qual o saldo projetado?", "Quais maiores saídas?", "Resumo por origem"],
  '/compras': ["Qual status dos pedidos?", "Há itens atrasados?", "Pedidos em trânsito?"],
  '/icms': ["Tenho crédito suficiente?", "Preciso comprar notas?", "Qual ICMS devido?"],
  '/produtos': ["Qual produto mais vendido?", "Estoque crítico?", "Margem média?"],
  '/estoque-sku': ["Qual estoque atual?", "Produtos em falta?", "Custo médio dos itens?"],
  '/conciliacao': ["Quantas transações pendentes?", "O que falta conciliar?", "Resumo por origem"],
  '/contas-pagar': ["O que vence hoje?", "Total a pagar no mês?", "Maiores credores?"],
  '/contas-receber': ["O que recebo esta semana?", "Títulos em atraso?", "Previsão de recebimentos?"],
  '/checklist-fechamento': ["O que falta para fechar?", "Qual canal mais pendente?", "Progresso do fechamento"],
  '/precificacao': ["Como calcular preço?", "Explique margem", "Taxas do marketplace"],
  '/kpis': ["Qual tendência do mês?", "Comparar períodos", "Quais KPIs críticos?"],
  '/projecoes': ["Qual cenário provável?", "Projeção de faturamento?", "Tendência de lucro?"],
  '/balanco': ["Qual meu patrimônio?", "Ativo vs Passivo?", "Explicar balanço"],
  '/fechamento': ["Mês pode ser fechado?", "Pendências do fechamento?", "Validar dados"],
  '/cartao-credito': ["Gastos do mês?", "Faturas pendentes?", "Maior categoria?"],
  '/fornecedores': ["Maiores fornecedores?", "Histórico de compras?", "Prazo médio?"],
  '/centros-custo': ["Gastos por centro?", "Qual centro mais caro?", "Distribuição de custos"],
  '/plano-contas': ["Estrutura de contas?", "Categorias disponíveis?", "Como categorizar?"],
  '/cmv': ["Qual CMV do período?", "Margem por produto?", "Evolução do CMV?"],
  '/assistant': ["O que você pode fazer?", "Alertas críticos?", "Ajuda com sistema"],
};

const DEFAULT_SUGGESTIONS = [
  "Por que isso aconteceu?",
  "O que você recomenda?",
  "Quais próximos passos?",
];

const MAX_CHARS = 2000;

export function AssistantChatPanel({ isOpen, onClose, initialContext, initialMessage }: AssistantChatPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, isLoading, error, sendMessage, clearMessages, setContext } = useAssistantChat();
  const [inputValue, setInputValue] = useState('');
  const [charCount, setCharCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Obter sugestões baseadas na rota atual
  const currentSuggestions = SUGGESTIONS_BY_ROUTE[location.pathname] || DEFAULT_SUGGESTIONS;

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

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setInputValue(value);
      setCharCount(value.length);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue.trim());
    setInputValue('');
    setCharCount(0);
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
    <div
      ref={chatRef}
      className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] transition-all duration-300 origin-bottom-right animate-pop-in"
    >
      <div className="relative flex flex-col rounded-3xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 border border-zinc-500/50 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400">Fin - Copiloto Financeiro</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs font-medium bg-zinc-800/60 text-zinc-300 rounded-2xl">
              GPT-4
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl">
              Pro
            </span>
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-full hover:bg-zinc-700/50 transition-colors"
              title="Limpar conversa"
            >
              <Trash2 className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-zinc-700/50 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="h-[300px] px-4 py-2" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-4 border border-indigo-500/30">
                <Sparkles className="w-7 h-7 text-indigo-400" />
              </div>
              <h4 className="font-medium text-zinc-200 mb-2">Olá! Sou o Fin</h4>
              <p className="text-sm text-zinc-400 mb-4">
                Posso te ajudar com dúvidas sobre seus números, fechamentos, impostos e relatórios.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {currentSuggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleQuickSuggestion(suggestion)}
                    className="px-3 py-1.5 text-xs bg-zinc-800/60 text-zinc-300 rounded-full border border-zinc-700/50 hover:bg-zinc-700/60 hover:border-zinc-600 transition-all"
                  >
                    {suggestion}
                  </button>
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center shrink-0 border border-indigo-500/30">
                    <Bot className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="bg-zinc-800/60 rounded-2xl rounded-tl-sm px-4 py-2 border border-zinc-700/50">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span className="text-sm text-zinc-400">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Quick suggestions when there are messages */}
        {messages.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-t border-zinc-700/50 flex gap-2 overflow-x-auto">
            {currentSuggestions.map((suggestion) => (
              <Badge
                key={suggestion}
                variant="outline"
                className="cursor-pointer shrink-0 text-xs bg-zinc-800/40 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-200"
                onClick={() => handleQuickSuggestion(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Input Section */}
        <div className="relative overflow-hidden">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={isLoading}
            className="w-full px-6 py-4 bg-transparent border-none outline-none resize-none text-base font-normal leading-relaxed min-h-[80px] text-zinc-100 placeholder-zinc-500 scrollbar-none"
            placeholder="O que você gostaria de saber? Pergunte sobre finanças, relatórios, fechamentos..."
            style={{ scrollbarWidth: 'none' }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-zinc-800/5 to-transparent pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(39, 39, 42, 0.05), transparent)' }}
          />
        </div>

        {/* Controls Section */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Attachment Group */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                {/* File Upload */}
                <button className="group relative p-2.5 bg-transparent border-none rounded-lg cursor-pointer transition-all duration-300 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 hover:scale-105 hover:-rotate-3 transform">
                  <Paperclip className="w-4 h-4 transition-all duration-300 group-hover:scale-125 group-hover:-rotate-12" />
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-zinc-900/95 text-zinc-200 text-xs rounded-lg whitespace-nowrap opacity-0 transition-all duration-300 pointer-events-none group-hover:opacity-100 group-hover:-translate-y-1 shadow-lg border border-zinc-700/50 backdrop-blur-sm z-10">
                    Anexar arquivos
                  </div>
                </button>

                {/* Link */}
                <button className="group relative p-2.5 bg-transparent border-none rounded-lg cursor-pointer transition-all duration-300 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 hover:scale-105 hover:rotate-6 transform">
                  <Link className="w-4 h-4 transition-all duration-300 group-hover:scale-125 group-hover:rotate-12" />
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-zinc-900/95 text-zinc-200 text-xs rounded-lg whitespace-nowrap opacity-0 transition-all duration-300 pointer-events-none group-hover:opacity-100 group-hover:-translate-y-1 shadow-lg border border-zinc-700/50 backdrop-blur-sm z-10">
                    Adicionar link
                  </div>
                </button>

                {/* Code */}
                <button className="group relative p-2.5 bg-transparent border-none rounded-lg cursor-pointer transition-all duration-300 text-zinc-500 hover:text-green-400 hover:bg-zinc-800/80 hover:scale-105 hover:rotate-3 transform">
                  <Code className="w-4 h-4 transition-all duration-300 group-hover:scale-125 group-hover:-rotate-6" />
                  <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-zinc-900/95 text-zinc-200 text-xs rounded-lg whitespace-nowrap opacity-0 transition-all duration-300 pointer-events-none group-hover:opacity-100 group-hover:-translate-y-1 shadow-lg border border-zinc-700/50 backdrop-blur-sm z-10">
                    Inserir código
                  </div>
                </button>
              </div>

              {/* Voice Button */}
              <button className="group relative p-2.5 bg-transparent border border-zinc-700/30 rounded-lg cursor-pointer transition-all duration-300 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 hover:scale-110 hover:rotate-2 transform hover:border-red-500/30">
                <Mic className="w-4 h-4 transition-all duration-300 group-hover:scale-125 group-hover:-rotate-3" />
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-zinc-900/95 text-zinc-200 text-xs rounded-lg whitespace-nowrap opacity-0 transition-all duration-300 pointer-events-none group-hover:opacity-100 group-hover:-translate-y-1 shadow-lg border border-zinc-700/50 backdrop-blur-sm z-10">
                  Entrada por voz
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Character Counter */}
              <div className="text-xs font-medium text-zinc-500">
                <span>{charCount}</span>/<span className="text-zinc-400">{MAX_CHARS}</span>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  "group relative p-3 bg-gradient-to-r from-red-600 to-red-500 border-none rounded-xl cursor-pointer transition-all duration-300 text-white shadow-lg",
                  "hover:from-red-500 hover:to-red-400 hover:scale-110 hover:shadow-red-500/30 hover:shadow-xl active:scale-95 transform hover:-rotate-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:rotate-0"
                )}
                style={{
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 0 0 0 rgba(239, 68, 68, 0.4)',
                }}
              >
                <Send className="w-5 h-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:rotate-12 group-hover:scale-110" />

                {/* Animated background glow */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-lg transform scale-110" />

                {/* Ripple effect on click */}
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-white/20 transform scale-0 group-active:scale-100 transition-transform duration-200 rounded-xl" />
                </div>
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50 text-xs text-zinc-500 gap-6">
            <div className="flex items-center gap-2">
              <Info className="w-3 h-3" />
              <span>
                Pressione <kbd className="px-1.5 py-1 bg-zinc-800 border border-zinc-600 rounded text-zinc-400 font-mono text-xs shadow-sm">Shift + Enter</kbd> para nova linha
              </span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span>Sistema operacional</span>
            </div>
          </div>
        </div>

        {/* Floating Overlay */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), transparent, rgba(147, 51, 234, 0.05))'
          }}
        />
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-pop-in {
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center shrink-0 border border-indigo-500/30">
          <Bot className="w-4 h-4 text-indigo-400" />
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 border border-zinc-600">
          <MessageCircle className="w-4 h-4 text-zinc-300" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          isUser
            ? 'bg-gradient-to-r from-red-600 to-red-500 text-white rounded-tr-sm'
            : 'bg-zinc-800/60 text-zinc-100 rounded-tl-sm border border-zinc-700/50'
        )}
      >
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content || (
            <span className="text-zinc-400 italic">...</span>
          )}
        </div>

        {/* Action links */}
        {message.links && message.links.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/20">
            {message.links.map((link, i) => (
              <Button
                key={i}
                variant="secondary"
                size="sm"
                className="h-6 text-xs bg-white/10 hover:bg-white/20 text-white border-none"
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
