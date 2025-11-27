import { useState, useEffect } from 'react';
import { useAssistantAlerts } from '@/hooks/useAssistantAlerts';
import { AssistantPanel } from './AssistantPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAlertDate, priorityConfig } from '@/lib/assistant-data';

export function AssistantCharacter() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [currentBubbleAlert, setCurrentBubbleAlert] = useState<string | null>(null);
  const [dismissedBubbles, setDismissedBubbles] = useState<Set<string>>(new Set());

  const { activeAlerts, unreadCount, config } = useAssistantAlerts();

  // Show bubble for critical alerts
  useEffect(() => {
    if (!config.notifications.popup || isMinimized || isPanelOpen) {
      setShowBubble(false);
      return;
    }

    const criticalAlert = activeAlerts.find(
      a => (a.priority === 'critical' || a.priority === 'high') && !dismissedBubbles.has(a.id)
    );

    if (criticalAlert && criticalAlert.id !== currentBubbleAlert) {
      setCurrentBubbleAlert(criticalAlert.id);
      setShowBubble(true);

      // Auto-hide bubble after 10 seconds
      const timer = setTimeout(() => {
        setShowBubble(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [activeAlerts, dismissedBubbles, config.notifications.popup, isMinimized, isPanelOpen, currentBubbleAlert]);

  const currentAlert = activeAlerts.find(a => a.id === currentBubbleAlert);

  const handleDismissBubble = () => {
    if (currentBubbleAlert) {
      setDismissedBubbles(prev => new Set([...prev, currentBubbleAlert]));
    }
    setShowBubble(false);
    setCurrentBubbleAlert(null);
  };

  const handleOpenPanel = () => {
    setShowBubble(false);
    setIsPanelOpen(true);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="icon"
          variant="outline"
          className="h-10 w-10 rounded-full shadow-lg bg-card border-border hover:bg-accent"
          onClick={() => setIsMinimized(false)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Speech Bubble */}
      {showBubble && currentAlert && (
        <div className="fixed bottom-24 right-4 z-50 animate-fade-in">
          <div 
            className={cn(
              'relative max-w-[300px] p-4 rounded-xl border shadow-xl bg-card',
              priorityConfig[currentAlert.priority].borderColor
            )}
          >
            {/* Close button */}
            <button
              onClick={handleDismissBubble}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-background border border-border hover:bg-accent transition-colors"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">
                {priorityConfig[currentAlert.priority].icon}
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground leading-tight">
                  {currentAlert.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {currentAlert.message}
                </p>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 mt-2 text-xs text-primary"
                  onClick={handleOpenPanel}
                >
                  Ver detalhes →
                </Button>
              </div>
            </div>

            {/* Arrow pointing to character */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-card border-b border-r border-border rotate-45" />
          </div>
        </div>
      )}

      {/* Character Button */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {/* Minimize button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-50 hover:opacity-100"
          onClick={() => setIsMinimized(true)}
        >
          <Minimize2 className="h-3 w-3" />
        </Button>

        {/* Main character button */}
        <button
          onClick={handleOpenPanel}
          className={cn(
            'relative group',
            'w-14 h-14 rounded-full',
            'bg-gradient-to-br from-primary via-primary/90 to-primary/70',
            'shadow-lg shadow-primary/25',
            'flex items-center justify-center',
            'transition-all duration-300',
            'hover:scale-105 hover:shadow-xl hover:shadow-primary/30',
            'active:scale-95',
            // Pulse animation for unread
            unreadCount > 0 && 'animate-pulse'
          )}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" 
               style={{ animationDuration: '3s' }} />
          
          {/* Icon */}
          <Sparkles className="h-7 w-7 text-primary-foreground relative z-10" />

          {/* Badge */}
          {config.notifications.badge && unreadCount > 0 && (
            <Badge 
              className={cn(
                'absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center',
                'text-xs font-bold',
                activeAlerts.some(a => a.priority === 'critical')
                  ? 'bg-red-500 text-white border-red-600'
                  : 'bg-orange-500 text-white border-orange-600'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}

          {/* Hover label */}
          <span className="absolute right-full mr-3 px-2 py-1 rounded bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-border">
            Assistente Inteligente
          </span>
        </button>
      </div>

      {/* Panel */}
      <AssistantPanel open={isPanelOpen} onOpenChange={setIsPanelOpen} />
    </>
  );
}
