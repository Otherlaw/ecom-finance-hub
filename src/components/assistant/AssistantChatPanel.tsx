import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Send, Trash2, Sparkles, Loader2, Info, Bot, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAssistantChat, ChatMessage, ChatContext } from '@/hooks/useAssistantChat';
import { useAssistantChatContext } from '@/contexts/AssistantChatContext';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialSelector } from './TutorialSelector';
import { TutorialStepComponent } from './TutorialStep';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresaAtiva } from '@/contexts/EmpresaContext';

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
  const { viewMode, setViewMode, showTutorialSelector, backToChat } = useAssistantChatContext();
  const { profile } = useAuth();
  const { empresaAtiva, empresasDisponiveis } = useEmpresaAtiva();
  const { 
    tutorialAtivo, 
    currentStep, 
    stepAtual, 
    tutoriaisComStatus, 
    iniciarTutorial, 
    avancarStep, 
    voltarStep, 
    sairTutorial,
    isTutorialMode,
  } = useTutorial();

  // Determinar empresa padrão automaticamente - prioriza empresaAtiva do contexto global
  const empresaPadrao = useMemo(() => {
    if (initialContext?.empresa) return initialContext.empresa;
    
    // Priorizar empresaAtiva do contexto global
    if (empresaAtiva) {
      return {
        id: empresaAtiva.id,
        nome: empresaAtiva.nome_fantasia || empresaAtiva.razao_social,
        regime: undefined,
      };
    }
    
    // Fallback: buscar empresa padrão do perfil
    const empresaId = profile?.empresa_padrao_id;
    const empresa = empresasDisponiveis?.find(e => e.id === empresaId) || empresasDisponiveis?.[0];
    
    if (empresa) {
      return {
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.razao_social,
        regime: undefined,
      };
    }
    return undefined;
  }, [profile, empresaAtiva, empresasDisponiveis, initialContext]);
  
  const [inputValue, setInputValue] = useState('');
  const [charCount, setCharCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialized = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Obter sugestões baseadas na rota atual
  const currentSuggestions = SUGGESTIONS_BY_ROUTE[location.pathname] || DEFAULT_SUGGESTIONS;

  // Set initial context when panel opens (com empresa padrão automática)
  useEffect(() => {
    if (isOpen) {
      const contextToSet: Partial<ChatContext> = {
        ...initialContext,
        telaAtual: location.pathname,
      };
      
      // Injetar empresa padrão se não vier no initialContext
      if (empresaPadrao && !initialContext?.empresa) {
        contextToSet.empresa = empresaPadrao;
      }
      
      setContext(contextToSet);
    }
  }, [isOpen, initialContext, empresaPadrao, location.pathname, setContext]);

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
    if (isOpen && textareaRef.current && viewMode === 'chat') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, viewMode]);

  // Sincronizar viewMode com tutorial ativo
  useEffect(() => {
    if (isTutorialMode && tutorialAtivo) {
      setViewMode('tutorial-active');
    }
  }, [isTutorialMode, tutorialAtivo, setViewMode]);

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

  const handleSelectTutorial = (tutorialId: string) => {
    iniciarTutorial(tutorialId);
    setViewMode('tutorial-active');
  };

  const handleSairTutorial = () => {
    sairTutorial();
    setViewMode('chat');
  };

  const handleTutorialNavegar = (path: string) => {
    navigate(path);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={chatRef}
      className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] transition-all duration-300 origin-bottom-right animate-pop-in"
    >
      <div className="relative flex flex-col rounded-3xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 border border-zinc-500/50 shadow-2xl backdrop-blur-xl overflow-hidden h-[480px]">
        {/* Header - mostrar apenas no modo chat */}
        {viewMode === 'chat' && (
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-zinc-400">Fin - Copiloto Financeiro</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Botão Tutorial */}
              <button
                onClick={showTutorialSelector}
                className="p-1.5 rounded-full hover:bg-indigo-500/20 transition-colors group"
                title="Tutoriais"
              >
                <GraduationCap className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400" />
              </button>
              <span className="px-2 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl">
                GPT-5
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
        )}

        {/* Conteúdo baseado no viewMode */}
        {viewMode === 'tutorial-selector' && (
          <TutorialSelector 
            tutoriais={tutoriaisComStatus}
            onSelectTutorial={handleSelectTutorial}
            onVoltar={backToChat}
          />
        )}

        {viewMode === 'tutorial-active' && tutorialAtivo && currentStep && (
          <TutorialStepComponent
            tutorial={tutorialAtivo}
            step={currentStep}
            stepIndex={stepAtual}
            totalSteps={tutorialAtivo.steps.length}
            onAvancar={avancarStep}
            onVoltar={voltarStep}
            onSair={handleSairTutorial}
            onNavegar={handleTutorialNavegar}
          />
        )}

        {viewMode === 'chat' && (
          <>
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
                  <div className="flex flex-wrap gap-2 justify-center mb-3">
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
                  {/* Botão para tutoriais no estado inicial */}
                  <button
                    onClick={showTutorialSelector}
                    className="flex items-center gap-2 px-4 py-2 text-xs bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/30 hover:bg-indigo-500/20 transition-all"
                  >
                    <GraduationCap className="w-4 h-4" />
                    Ver tutoriais do sistema
                  </button>
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
            <div className="relative overflow-hidden mt-auto">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-transparent border-none outline-none resize-none text-base font-normal leading-relaxed min-h-[60px] text-zinc-100 placeholder-zinc-500 scrollbar-none"
                placeholder="O que você gostaria de saber?"
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            {/* Controls Section */}
            <div className="px-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Character Counter */}
                  <div className="text-xs font-medium text-zinc-500">
                    <span>{charCount}</span>/<span className="text-zinc-400">{MAX_CHARS}</span>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Enviar
                </Button>
              </div>

              {/* Footer Info */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/50 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  <span>
                    <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-zinc-400 font-mono text-xs">Shift+Enter</kbd> para nova linha
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Online</span>
                </div>
              </div>
            </div>
          </>
        )}

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
          animation: popIn 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>
    </div>
  );
}

// Componente MessageBubble
function MessageBubble({ 
  message, 
  onLinkClick 
}: { 
  message: ChatMessage; 
  onLinkClick: (path: string) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex items-start gap-2", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center shrink-0 border border-indigo-500/30">
          <Bot className="w-4 h-4 text-indigo-400" />
        </div>
      )}
      
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 border",
          isUser
            ? "bg-red-500/20 border-red-500/30 rounded-tr-sm"
            : "bg-zinc-800/60 border-zinc-700/50 rounded-tl-sm"
        )}
      >
        <p className="text-sm text-zinc-200 whitespace-pre-wrap">{message.content}</p>
        
        {/* Links de ação */}
        {message.links && message.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.links.map((link, i) => (
              <button
                key={i}
                onClick={() => onLinkClick(link.path)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
