import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Settings, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { useAssistantEngine } from '@/hooks/useAssistantEngine';
import { AssistantAlert, SEVERITY_CONFIG, formatRelativeTime } from '@/lib/assistant-data';
import { cn } from '@/lib/utils';

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

  const [currentPopupAlert, setCurrentPopupAlert] = useState<AssistantAlert | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AssistantAlert | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const unreadCount = getUnreadCount();
  const isSilenced = config.silenciado && config.silenciadoAte && new Date() < config.silenciadoAte;

  // Mostrar popup para novos alertas
  useEffect(() => {
    if (newAlerts.length > 0 && !currentPopupAlert && !isSilenced) {
      // Pegar o alerta mais crítico
      const sortedAlerts = [...newAlerts].sort((a, b) => {
        const severityOrder = ['critico', 'alto', 'medio', 'baixo', 'informativo'];
        return severityOrder.indexOf(a.severidade) - severityOrder.indexOf(b.severidade);
      });
      setCurrentPopupAlert(sortedAlerts[0]);
    }
  }, [newAlerts, currentPopupAlert, isSilenced]);

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

  const recentAlerts = alerts
    .filter(a => a.status === 'novo' || a.status === 'em_analise')
    .slice(0, 5);

  return (
    <>
      {/* Widget principal */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {/* Mini lista de alertas recentes */}
        {isExpanded && (
          <div className="bg-card border rounded-xl shadow-xl w-80 max-h-96 overflow-hidden animate-in slide-in-from-bottom-2">
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AssistantCharacter size="sm" mood={isAnalyzing ? 'thinking' : 'neutral'} />
                <div>
                  <h3 className="font-semibold text-sm">Assis.Fin</h3>
                  <p className="text-xs text-muted-foreground">
                    {isAnalyzing ? 'Analisando...' : `${unreadCount} alertas pendentes`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(false)}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>

            <div className="divide-y max-h-64 overflow-y-auto">
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

        {/* Botão principal do widget */}
        <div className="flex items-center gap-2">
          {/* Menu de configurações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-lg">
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

        {/* Última análise */}
        {lastAnalysis && (
          <p className="text-[10px] text-muted-foreground">
            Última análise: {formatRelativeTime(lastAnalysis)}
          </p>
        )}
      </div>

      {/* Popup de alerta */}
      {currentPopupAlert && !isSilenced && (
        <AlertPopup
          alert={currentPopupAlert}
          onDismiss={handleDismissPopup}
          onViewDetails={() => handleViewDetails(currentPopupAlert)}
        />
      )}

      {/* Modal de detalhes */}
      <AlertDetailModal
        alert={selectedAlert}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onResolve={handleResolve}
        onIgnore={handleIgnore}
        onAnalyze={handleAnalyze}
      />
    </>
  );
}
