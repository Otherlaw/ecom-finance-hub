import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AssistantAlert, 
  CATEGORY_CONFIG, 
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  formatRelativeTime 
} from '@/lib/assistant-data';
import { AssistantCharacter } from './AssistantCharacter';
import { 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  FileText,
  MessageCircleQuestion,
  TrendingDown,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertDetailModalProps {
  alert: AssistantAlert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolve: (alertId: string) => void;
  onIgnore: (alertId: string) => void;
  onAnalyze: (alertId: string) => void;
  onAskAssistant?: (alert: AssistantAlert) => void;
}

export function AlertDetailModal({
  alert,
  open,
  onOpenChange,
  onResolve,
  onIgnore,
  onAnalyze,
  onAskAssistant,
}: AlertDetailModalProps) {
  const navigate = useNavigate();

  if (!alert) return null;

  const categoryConfig = CATEGORY_CONFIG[alert.categoria];
  const severityConfig = SEVERITY_CONFIG[alert.severidade];
  const statusConfig = STATUS_CONFIG[alert.status];

  const handleNavigate = () => {
    if (alert.linkDestino) {
      onOpenChange(false);
      navigate(alert.linkDestino);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 backdrop-blur-xl border-zinc-700/50 text-white">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <AssistantCharacter size="lg" mood={alert.severidade} animated={false} />
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{alert.titulo}</DialogTitle>
              <DialogDescription className="sr-only">Detalhes do alerta do assistente financeiro</DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn(severityConfig.bgColor, severityConfig.color, 'border', severityConfig.borderColor)}>
                  {severityConfig.label}
                </Badge>
                <Badge variant="outline" className={categoryConfig.color}>
                  {categoryConfig.label}
                </Badge>
                <Badge variant="secondary" className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Metadados */}
          <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{formatRelativeTime(alert.dataDeteccao)}</span>
            </div>
            {alert.empresa && (
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                <span>{alert.empresa}</span>
              </div>
            )}
            {alert.canal && (
              <div className="flex items-center gap-1">
                <span className="font-medium">{alert.canal}</span>
              </div>
            )}
          </div>

          <Separator className="bg-zinc-700/50" />

          {/* Descrição completa */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
              <FileText className="w-4 h-4" />
              Análise Detalhada
            </h4>
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 whitespace-pre-wrap text-sm text-zinc-300">
              {alert.descricaoCompleta}
            </div>
          </div>

          {/* Impacto estimado */}
          {alert.impactoEstimado && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h4 className="font-semibold mb-1 flex items-center gap-2 text-destructive">
                <TrendingDown className="w-4 h-4" />
                Impacto Estimado
              </h4>
              <p className="text-sm">{alert.impactoEstimado}</p>
            </div>
          )}

          {/* Dados de contexto */}
          {alert.dadosContexto && Object.keys(alert.dadosContexto).length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-white">Dados da Análise</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(alert.dadosContexto).map(([key, value]) => (
                  <div key={key} className="bg-zinc-800/50 border border-zinc-700/50 rounded p-2 text-sm">
                    <span className="text-zinc-400 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="ml-2 font-medium text-white">
                      {typeof value === 'number' 
                        ? value.toLocaleString('pt-BR', { 
                            style: key.toLowerCase().includes('valor') || key.toLowerCase().includes('impacto') 
                              ? 'currency' 
                              : 'decimal',
                            currency: 'BRL',
                            maximumFractionDigits: 2
                          })
                        : String(value)
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ação recomendada */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2 text-primary">
              <AlertTriangle className="w-4 h-4" />
              Ação Recomendada
            </h4>
            <p className="text-sm text-zinc-300">{alert.acaoRecomendada}</p>
          </div>

          <Separator className="bg-zinc-700/50" />

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            {/* Perguntar ao Fin */}
            {onAskAssistant && (
              <Button 
                variant="secondary"
                className="gap-2 bg-zinc-700/50 hover:bg-zinc-600/50 text-white border-zinc-600"
                onClick={() => onAskAssistant(alert)}
              >
                <MessageCircleQuestion className="w-4 h-4" />
                Perguntar ao Fin
              </Button>
            )}

            {alert.linkDestino && (
              <Button onClick={handleNavigate} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Ir para o módulo
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            
            {alert.status !== 'resolvido' && (
              <Button 
                variant="outline" 
                className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
                onClick={() => onResolve(alert.id)}
              >
                <CheckCircle className="w-4 h-4" />
                Marcar como Resolvido
              </Button>
            )}
            
            {alert.status !== 'em_analise' && alert.status !== 'resolvido' && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => onAnalyze(alert.id)}
              >
                <Clock className="w-4 h-4" />
                Em Análise
              </Button>
            )}
            
            {alert.status !== 'ignorado' && alert.status !== 'resolvido' && (
              <Button 
                variant="ghost" 
                className="gap-2 text-muted-foreground"
                onClick={() => onIgnore(alert.id)}
              >
                <XCircle className="w-4 h-4" />
                Ignorar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
