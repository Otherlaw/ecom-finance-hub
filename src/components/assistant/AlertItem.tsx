import { AssistantAlert, priorityConfig, categoryConfig, formatAlertDate } from '@/lib/assistant-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AlertItemProps {
  alert: AssistantAlert;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onClosePanel?: () => void;
}

export function AlertItem({ alert, onResolve, onDismiss, onClosePanel }: AlertItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  const priority = priorityConfig[alert.priority];
  const category = categoryConfig[alert.category];

  const handleNavigate = () => {
    if (alert.relatedRoute) {
      onClosePanel?.();
      navigate(alert.relatedRoute);
    }
  };

  return (
    <div 
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        priority.bgColor,
        priority.borderColor,
        alert.status !== 'active' && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{priority.icon}</span>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={cn('text-xs', priority.color)}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {category.icon} {category.label}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatAlertDate(alert.createdAt)}
            </span>
          </div>
          
          <h4 className="font-semibold text-sm text-foreground leading-tight">
            {alert.title}
          </h4>
          
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {alert.message}
          </p>
        </div>
      </div>

      {/* Expandable Details */}
      {(alert.details || alert.suggestedAction || alert.impact) && (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Menos detalhes
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Mais detalhes
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="mt-3 space-y-3 text-sm animate-fade-in">
              {alert.details && (
                <div className="p-3 rounded-md bg-background/50">
                  <span className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                    Detalhes
                  </span>
                  <p className="mt-1 text-foreground">{alert.details}</p>
                </div>
              )}
              
              {alert.suggestedAction && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
                  <span className="font-medium text-xs text-primary uppercase tracking-wider">
                    💡 Ação Sugerida
                  </span>
                  <p className="mt-1 text-foreground">{alert.suggestedAction}</p>
                </div>
              )}
              
              {alert.impact && (
                <div className="p-3 rounded-md bg-destructive/5 border border-destructive/10">
                  <span className="font-medium text-xs text-destructive uppercase tracking-wider">
                    ⚠️ Impacto
                  </span>
                  <p className="mt-1 text-foreground">{alert.impact}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {alert.status === 'active' && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 flex-1"
            onClick={() => onResolve(alert.id)}
          >
            <Check className="h-3 w-3" />
            Resolvido
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="h-3 w-3" />
            Dispensar
          </Button>
          
          {alert.relatedRoute && (
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs gap-1"
              onClick={handleNavigate}
            >
              <ExternalLink className="h-3 w-3" />
              Abrir
            </Button>
          )}
        </div>
      )}

      {/* Resolved indicator */}
      {alert.status === 'resolved' && alert.resolvedAt && (
        <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1">
          <Check className="h-3 w-3 text-success" />
          Resolvido em {formatAlertDate(alert.resolvedAt)}
        </div>
      )}
    </div>
  );
}
