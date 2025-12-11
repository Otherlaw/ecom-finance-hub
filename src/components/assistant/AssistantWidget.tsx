import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Settings, Volume2, VolumeX, Minus, Bot, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertPopup } from './AlertPopup';
import { AlertDetailModal } from './AlertDetailModal';
import { AssistantChatPanel } from './AssistantChatPanel';
import { useAssistantEngine } from '@/hooks/useAssistantEngine';
import { useAssistantChatContext } from '@/contexts/AssistantChatContext';
import { AssistantAlert, SEVERITY_CONFIG, formatRelativeTime } from '@/lib/assistant-data';
import { cn } from '@/lib/utils';
import { ChatContext } from '@/hooks/useAssistantChat';

export function AssistantWidget() {
  const navigate = useNavigate();
  const {
    alerts,
    newAlerts,
    config,
    isAnalyzing,
    lastAnalysis,
    dismissAlert,
    updateAlertStatus,
    silenceFor,
    unsilence,
    getUnreadCount,
    runAnalysis,
  } = useAssistantEngine();

  const { isChatOpen, openChat, closeChat, initialMessage, initialContext } = useAssistantChatContext();

  const [currentPopupAlert, setCurrentPopupAlert] = useState<AssistantAlert | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AssistantAlert | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('fin-minimized') === 'true';
  });

  const unreadCount = getUnreadCount();
  const isSilenced = config.silenciado && config.silenciadoAte && new Date() < config.silenciadoAte;

  // Salvar preferência de minimizado
  useEffect(() => {
    localStorage.setItem('fin-minimized', String(isMinimized));
  }, [isMinimized]);

  // Popups automáticos desativados - alertas disponíveis apenas na Central de Alertas
  // useEffect(() => {
  //   if (newAlerts.length > 0 && !currentPopupAlert && !isSilenced) {
  //     const sortedAlerts = [...newAlerts].sort((a, b) => {
  //       const severityOrder = ['critico', 'alto', 'medio', 'baixo', 'informativo'];
  //       return severityOrder.indexOf(a.severidade) - severityOrder.indexOf(b.severidade);
  //     });
  //     setCurrentPopupAlert(sortedAlerts[0]);
  //   }
  // }, [newAlerts, currentPopupAlert, isSilenced]);

  const handleDismissPopup = () => {
    if (currentPopupAlert) {
      dismissAlert(currentPopupAlert.id);
      setCurrentPopupAlert(null);
    }
  };

  const handleViewDetails = (alert: AssistantAlert) => {
    setSelectedAlert(alert);
    setDetailModalOpen(true);
    if (currentPopupAlert?.id === alert.id) {
      setCurrentPopupAlert(null);
    }
  };

  const handleResolve = (alertId: string) => {
    updateAlertStatus(alertId, 'resolvido');
    setDetailModalOpen(false);
  };

  const handleIgnore = (alertId: string) => {
    updateAlertStatus(alertId, 'ignorado');
    setDetailModalOpen(false);
  };

  const handleAnalyze = (alertId: string) => {
    updateAlertStatus(alertId, 'em_analise');
  };

  const handleGoToCenter = () => {
    navigate('/assistant');
  };

  const handleAskAboutAlert = (alert: AssistantAlert) => {
    const alertContext: Partial<ChatContext> = {
      alertas: [{
        titulo: alert.titulo,
        descricao: alert.descricao,
        severidade: alert.severidade,
      }],
      dadosAdicionais: alert.dadosContexto,
    };
    openChat(`Me explique mais sobre este alerta: "${alert.titulo}"`, alertContext);
    setDetailModalOpen(false);
  };

  const recentAlerts = alerts
    .filter(a => a.status === 'novo' || a.status === 'em_analise')
    .slice(0, 5);

  const toggleChat = () => {
    if (isChatOpen) {
      closeChat();
    } else {
      openChat();
    }
  };

  return (
    <>
      {/* Botão flutuante 3D com glow */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className={cn(
            'floating-ai-button relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 transform',
            isChatOpen ? 'rotate-90' : 'rotate-0'
          )}
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(168,85,247,0.8) 100%)',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.7), 0 0 40px rgba(124, 58, 237, 0.5), 0 0 60px rgba(109, 40, 217, 0.3)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Efeito 3D */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30" />

          {/* Brilho interno */}
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />

          {/* Ícone */}
          <div className="relative z-10">
            {isChatOpen ? (
              <X className="w-8 h-8 text-white" />
            ) : (
              <Bot className="w-8 h-8 text-white" />
            )}
          </div>

          {/* Animação ping */}
          {!isChatOpen && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-indigo-500" />
          )}

          {/* Badge de contagem */}
          {unreadCount > 0 && !isSilenced && !isChatOpen && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-bounce">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}

          {/* Indicador de silenciado */}
          {isSilenced && !isChatOpen && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-zinc-700 text-zinc-400 flex items-center justify-center">
              <BellOff className="w-3 h-3" />
            </span>
          )}
        </button>

        {/* Menu de configurações - aparece quando não está em chat */}
        {!isChatOpen && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-zinc-800/90 border border-zinc-700/50 flex items-center justify-center transition-all hover:scale-110 hover:bg-zinc-700"
              >
                <Settings className="w-4 h-4 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-zinc-900 border-zinc-700">
              <DropdownMenuItem onClick={runAnalysis} disabled={isAnalyzing} className="text-zinc-200 focus:bg-zinc-800">
                <Bell className="w-4 h-4 mr-2" />
                Executar análise
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              {isSilenced ? (
                <DropdownMenuItem onClick={unsilence} className="text-zinc-200 focus:bg-zinc-800">
                  <Volume2 className="w-4 h-4 mr-2" />
                  Reativar alertas
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => silenceFor(60)} className="text-zinc-200 focus:bg-zinc-800">
                    <VolumeX className="w-4 h-4 mr-2" />
                    Silenciar por 1 hora
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => silenceFor(240)} className="text-zinc-200 focus:bg-zinc-800">
                    <VolumeX className="w-4 h-4 mr-2" />
                    Silenciar por 4 horas
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem onClick={handleGoToCenter} className="text-zinc-200 focus:bg-zinc-800">
                <Bell className="w-4 h-4 mr-2" />
                Central de Alertas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Chat Panel */}
      <AssistantChatPanel
        isOpen={isChatOpen}
        onClose={closeChat}
        initialMessage={initialMessage}
        initialContext={initialContext}
      />

      {/* Popup de alerta */}
      {currentPopupAlert && !isSilenced && !isChatOpen && (
        <AlertPopup
          alert={currentPopupAlert}
          onDismiss={handleDismissPopup}
          onViewDetails={() => handleViewDetails(currentPopupAlert)}
        />
      )}

      {/* Modal de detalhes com botão de perguntar */}
      <AlertDetailModal
        alert={selectedAlert}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onResolve={handleResolve}
        onIgnore={handleIgnore}
        onAnalyze={handleAnalyze}
        onAskAssistant={handleAskAboutAlert}
      />

      {/* CSS para animações do botão */}
      <style>{`
        .floating-ai-button:hover {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.9), 0 0 50px rgba(124, 58, 237, 0.7), 0 0 70px rgba(109, 40, 217, 0.5) !important;
        }
      `}</style>
    </>
  );
}
