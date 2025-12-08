import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Settings, ChevronUp, ChevronDown, Volume2, VolumeX, MessageCircle, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AssistantCharacter } from './AssistantCharacter';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('fin-minimized') === 'true';
  });

  const unreadCount = getUnreadCount();
  const isSilenced = config.silenciado && config.silenciadoAte && new Date() < config.silenciadoAte;

  // Salvar preferência de minimizado
  useEffect(() => {
    localStorage.setItem('fin-minimized', String(isMinimized));
  }, [isMinimized]);

  // Mostrar popup para novos alertas
  useEffect(() => {
    if (newAlerts.length > 0 && !currentPopupAlert && !isSilenced) {
      const sortedAlerts = [...newAlerts].sort((a, b) => {
        const severityOrder = ['critico', 'alto', 'medio', 'baixo', 'informativo'];
        return severityOrder.indexOf(a.severidade) - severityOrder.indexOf(b.severidade);
      });
      setCurrentPopupAlert(sortedAlerts[0]);
    }
  }, [newAlerts, currentPopupAlert, isSilenced]);

  // Fechar expanded quando chat abre
  useEffect(() => {
    if (isChatOpen) {
      setIsExpanded(false);
    }
  }, [isChatOpen]);

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

  // Widget minimizado - apenas ícone pequeno
  if (isMinimized && !isChatOpen) {
    return (
      <>
        <button
          onClick={() => setIsMinimized(false)}
          className={cn(
            'fixed bottom-4 right-4 z-40',
            'h-10 w-10 rounded-full shadow-lg transition-all hover:scale-110',
            'bg-gradient-to-br from-primary to-primary/80',
            'flex items-center justify-center'
          )}
        >
          <AssistantCharacter size="sm" mood="neutral" />
          {unreadCount > 0 && !isSilenced && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Popup de alerta mesmo minimizado */}
        {currentPopupAlert && !isSilenced && (
          <AlertPopup
            alert={currentPopupAlert}
            onDismiss={handleDismissPopup}
            onViewDetails={() => {
              setIsMinimized(false);
              handleViewDetails(currentPopupAlert);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Widget principal - bottom-20 para não sobrepor paginação */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2">
        {/* Mini lista de alertas recentes */}
        {isExpanded && !isChatOpen && (
          <div className="bg-card border rounded-xl shadow-xl w-80 max-h-96 overflow-hidden animate-in slide-in-from-bottom-2">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AssistantCharacter size="sm" mood={isAnalyzing ? 'thinking' : 'neutral'} />
                <div>
                  <h3 className="font-semibold text-sm">Fin</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAnalyzing ? 'Analisando...' : `${unreadCount} alertas pendentes`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={() => setIsMinimized(true)}
                  title="Minimizar"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(false)}>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Botão de chat */}
            <div className="p-2 border-b bg-primary/5">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => openChat()}
              >
                <MessageCircle className="w-4 h-4" />
                Conversar com o Fin
              </Button>
            </div>

            <div className="divide-y max-h-48 overflow-y-auto">
              {recentAlerts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum alerta pendente no momento.
                </div>
              ) : (
                recentAlerts.map(alert => {
                  const severityConfig = SEVERITY_CONFIG[alert.severidade];
                  return (
                    <button
                      key={alert.id}
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => handleViewDetails(alert)}
                    >
                      <div className="flex gap-2">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', severityConfig.bgColor.replace('bg-', 'bg-').replace('-100', '-500'))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{alert.titulo}</p>
                          <p className="text-xs text-muted-foreground truncate">{alert.descricao}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={cn('text-[10px] px-1 py-0', severityConfig.color)}>
                              {severityConfig.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(alert.dataDeteccao)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-2 border-t bg-muted/30">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleGoToCenter}>
                Ver todos os alertas
              </Button>
            </div>
          </div>
        )}

        {/* Botões principais do widget */}
        {!isChatOpen && (
          <div className="flex items-center gap-2">
            {/* Botão de minimizar */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full shadow-lg bg-card"
              onClick={() => setIsMinimized(true)}
              title="Minimizar Fin"
            >
              <Minus className="w-3 h-3" />
            </Button>

            {/* Botão de chat rápido */}
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shadow-lg bg-card"
              onClick={() => openChat()}
              title="Conversar com o Fin"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>

            {/* Menu de configurações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-lg bg-card">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={runAnalysis} disabled={isAnalyzing}>
                  <Bell className="w-4 h-4 mr-2" />
                  Executar análise
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isSilenced ? (
                  <DropdownMenuItem onClick={unsilence}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Reativar alertas
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => silenceFor(60)}>
                      <VolumeX className="w-4 h-4 mr-2" />
                      Silenciar por 1 hora
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => silenceFor(240)}>
                      <VolumeX className="w-4 h-4 mr-2" />
                      Silenciar por 4 horas
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleGoToCenter}>
                  <Bell className="w-4 h-4 mr-2" />
                  Central de Alertas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Botão do personagem */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'relative h-14 w-14 rounded-full shadow-xl transition-all hover:scale-105',
                'bg-gradient-to-br from-primary to-primary/80',
                'flex items-center justify-center',
                isAnalyzing && 'animate-pulse'
              )}
            >
              <AssistantCharacter 
                size="md" 
                mood={isSilenced ? 'neutral' : isAnalyzing ? 'thinking' : unreadCount > 0 ? 'alto' : 'neutral'} 
              />
              
              {/* Badge de contagem */}
              {unreadCount > 0 && !isSilenced && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}

              {/* Indicador de silenciado */}
              {isSilenced && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                  <BellOff className="w-3 h-3" />
                </span>
              )}
            </button>
          </div>
        )}

        {/* Última análise */}
        {lastAnalysis && !isChatOpen && (
          <p className="text-[10px] text-muted-foreground">
            Última análise: {formatRelativeTime(lastAnalysis)}
          </p>
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
    </>
  );
}
