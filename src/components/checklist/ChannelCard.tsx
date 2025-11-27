import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  ChecklistMensal, 
  CanalMarketplace, 
  calcularProgresso, 
  getStatusLabel, 
  getStatusColor,
  getChecklistStatus 
} from "@/lib/checklist-data";
import { 
  ShoppingBag, 
  Store, 
  Shirt, 
  Music, 
  ChevronRight, 
  Check, 
  Clock, 
  AlertCircle,
  Plus
} from "lucide-react";

interface ChannelCardProps {
  canal: CanalMarketplace;
  checklist?: ChecklistMensal;
  onClick: () => void;
  onCriar?: () => void;
}

const iconMap: Record<string, React.ElementType> = {
  ShoppingBag,
  Store,
  Shirt,
  Music,
};

export function ChannelCard({ canal, checklist, onClick, onCriar }: ChannelCardProps) {
  const IconComponent = iconMap[canal.icone] || Store;
  
  const hasChecklist = !!checklist;
  const progresso = hasChecklist ? calcularProgresso(checklist.itens) : { concluidos: 0, total: 0, percentual: 0 };
  const status = hasChecklist ? getChecklistStatus(checklist.itens) : 'pendente';

  const getStatusIcon = () => {
    switch (status) {
      case 'concluido':
        return <Check className="h-4 w-4" />;
      case 'em_andamento':
        return <Clock className="h-4 w-4" />;
      case 'nao_aplicavel':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div 
      className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
      onClick={hasChecklist ? onClick : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${canal.cor}20` }}
          >
            <IconComponent 
              className="h-6 w-6" 
              style={{ color: canal.cor }}
            />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{canal.nome}</h3>
            <p className="text-sm text-muted-foreground">
              {hasChecklist ? `${progresso.concluidos}/${progresso.total} etapas` : 'Sem checklist'}
            </p>
          </div>
        </div>

        {hasChecklist && (
          <Badge className={getStatusColor(status)}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusLabel(status)}</span>
          </Badge>
        )}
      </div>

      {/* Progress */}
      {hasChecklist ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progresso.percentual}%</span>
          </div>
          <Progress 
            value={progresso.percentual} 
            className="h-2"
          />
          
          {/* Etapas pendentes obrigatórias */}
          {status !== 'concluido' && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                {progresso.total - progresso.concluidos} etapa(s) obrigatória(s) pendente(s)
              </p>
            </div>
          )}

          {/* Ação */}
          <div className="pt-2 flex items-center justify-end">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 text-primary group-hover:bg-primary/10"
            >
              {status === 'concluido' ? 'Ver detalhes' : 'Continuar'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nenhum checklist criado para este canal no período selecionado.
          </p>
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              onCriar?.();
            }}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Criar Checklist
          </Button>
        </div>
      )}
    </div>
  );
}
