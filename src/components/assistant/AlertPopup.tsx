import { useEffect, useState } from 'react';
import { X, ChevronRight, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssistantAlert, SEVERITY_CONFIG, getAssistantPhrase, formatRelativeTime } from '@/lib/assistant-data';
import { AssistantCharacter } from './AssistantCharacter';
import { cn } from '@/lib/utils';

interface AlertPopupProps {
  alert: AssistantAlert;
  onDismiss: () => void;
  onViewDetails: () => void;
  autoHideDelay?: number; // em segundos
}

export function AlertPopup({ 
  alert, 
  onDismiss, 
  onViewDetails,
  autoHideDelay = 15
}: AlertPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const severityConfig = SEVERITY_CONFIG[alert.severidade];
  const phrase = getAssistantPhrase(alert.severidade);

  useEffect(() => {
    // Animar entrada
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-hide após delay
    const hideTimer = setTimeout(() => {
      handleDismiss();
    }, autoHideDelay * 1000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [autoHideDelay]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleViewDetails = () => {
    setIsExiting(true);
    setTimeout(() => {
      onViewDetails();
    }, 300);
  };

  return (
    <div
      className={cn(
        'fixed bottom-20 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]',
        'transform transition-all duration-300 ease-out',
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
      )}
    >
      <div 
        className={cn(
          'bg-card border-2 rounded-xl shadow-2xl overflow-hidden',
          severityConfig.borderColor
        )}
      >
        {/* Header com gradiente */}
        <div className={cn(
          'px-4 py-3 flex items-center gap-3',
          severityConfig.bgColor
        )}>
          <AssistantCharacter size="sm" mood={alert.severidade} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-medium', severityConfig.color)}>
              Assis.Fin • {severityConfig.label}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {formatRelativeTime(alert.dataDeteccao)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-3">
          {/* Frase do personagem */}
          <p className="text-xs text-muted-foreground italic">
            "{phrase}"
          </p>

          {/* Título e descrição */}
          <div>
            <h4 className="font-semibold text-sm mb-1">{alert.titulo}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {alert.descricao}
            </p>
          </div>

          {/* Impacto se houver */}
          {alert.impactoEstimado && (
            <div className="bg-destructive/10 text-destructive text-xs px-2 py-1 rounded">
              💰 {alert.impactoEstimado}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1"
              onClick={handleViewDetails}
            >
              Ver detalhes
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={handleDismiss}
            >
              Depois
            </Button>
          </div>
        </div>

        {/* Barra de progresso de auto-hide */}
        <div className="h-1 bg-muted">
          <div 
            className={cn('h-full transition-all ease-linear', severityConfig.bgColor.replace('bg-', 'bg-'))}
            style={{
              animation: `shrinkWidth ${autoHideDelay}s linear forwards`
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
