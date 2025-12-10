import { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
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
        'fixed bottom-36 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]',
        'transform transition-all duration-300 ease-out',
        isVisible && !isExiting 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
      )}
    >
      <div 
        className="bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header com gradiente */}
        <div className={cn(
          'px-4 py-3 flex items-center gap-3 border-b border-zinc-700/50',
          'bg-gradient-to-r from-zinc-800/50 to-transparent'
        )}>
          <AssistantCharacter size="sm" mood={alert.severidade} />
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-medium', severityConfig.color)}>
              Fin • {severityConfig.label}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {formatRelativeTime(alert.dataDeteccao)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-zinc-400 hover:text-white hover:bg-zinc-700/50"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Corpo */}
        <div className="p-4 space-y-3">
          {/* Frase do personagem */}
          <p className="text-xs text-zinc-400 italic">
            "{phrase}"
          </p>

          {/* Título e descrição */}
          <div>
            <h4 className="font-semibold text-sm mb-1 text-white">{alert.titulo}</h4>
            <p className="text-xs text-zinc-400 line-clamp-2">
              {alert.descricao}
            </p>
          </div>

          {/* Impacto se houver */}
          {alert.impactoEstimado && (
            <div className="bg-red-500/10 text-red-400 text-xs px-2 py-1.5 rounded-lg border border-red-500/20">
              💰 {alert.impactoEstimado}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs gap-1 bg-primary hover:bg-primary/90"
              onClick={handleViewDetails}
            >
              Ver detalhes
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-zinc-400 hover:text-white hover:bg-zinc-700/50"
              onClick={handleDismiss}
            >
              Depois
            </Button>
          </div>
        </div>

        {/* Barra de progresso de auto-hide */}
        <div className="h-1 bg-zinc-800">
          <div 
            className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all ease-linear"
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
