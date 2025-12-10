import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModuleCard } from "@/components/ModuleCard";
import { canaisMarketplace } from "@/lib/checklist-data";
import {
  ChecklistCanalComItens,
  calcularProgressoChecklist,
  determinarStatusChecklist,
  getStatusLabel,
  getStatusColor,
} from "@/hooks/useChecklistsCanal";
import {
  Building2,
  Check,
  Clock,
  AlertCircle,
  ShoppingBag,
  Store,
  Shirt,
  Music,
  CheckCircle2,
} from "lucide-react";

interface ConsolidatedViewProps {
  empresa: { id: string; nome: string; canaisAtivos: string[] };
  mes: number;
  ano: number;
  checklists: ChecklistCanalComItens[];
}

const iconMap: Record<string, React.ElementType> = {
  mercado_livre: ShoppingBag,
  shopee: Store,
  shein: Shirt,
  tiktok: Music,
};

const getMesNome = (mes: number): string => {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses[mes - 1] || "";
};

export function ConsolidatedView({ empresa, mes, ano, checklists }: ConsolidatedViewProps) {
  // Canais ativos da empresa
  const canaisAtivos = canaisMarketplace.filter(c => empresa.canaisAtivos.includes(c.id));

  // Calcular status consolidado
  const getConsolidatedStatus = (): { status: string; canaisConcluidos: number; totalCanais: number } => {
    let canaisConcluidos = 0;
    const totalCanais = canaisAtivos.length;

    canaisAtivos.forEach(canal => {
      const checklist = checklists.find(c => c.canal_id === canal.id);
      if (checklist) {
        const status = determinarStatusChecklist(checklist.itens);
        if (status === 'concluido' || status === 'nao_aplicavel') {
          canaisConcluidos++;
        }
      }
    });

    let status: string = 'pendente';
    if (canaisConcluidos === totalCanais && totalCanais > 0) {
      status = 'concluido';
    } else if (canaisConcluidos > 0) {
      status = 'em_andamento';
    }

    return { status, canaisConcluidos, totalCanais };
  };

  const consolidatedStatus = getConsolidatedStatus();
  const percentualGeral = consolidatedStatus.totalCanais > 0 
    ? Math.round((consolidatedStatus.canaisConcluidos / consolidatedStatus.totalCanais) * 100) 
    : 0;

  return (
    <ModuleCard
      title="Status Consolidado do Fechamento"
      description={`${empresa.nome} • ${getMesNome(mes)}/${ano}`}
      icon={Building2}
    >
      {/* Header com status geral */}
      <div className="p-6 rounded-xl bg-secondary/30 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Fechamento do Mês</h3>
            <p className="text-sm text-muted-foreground">
              {consolidatedStatus.canaisConcluidos} de {consolidatedStatus.totalCanais} canais concluídos
            </p>
          </div>
          <Badge className={`text-base px-4 py-2 ${getStatusColor(consolidatedStatus.status)}`}>
            {consolidatedStatus.status === 'concluido' && <CheckCircle2 className="h-5 w-5 mr-2" />}
            {consolidatedStatus.status === 'em_andamento' && <Clock className="h-5 w-5 mr-2" />}
            {consolidatedStatus.status === 'pendente' && <AlertCircle className="h-5 w-5 mr-2" />}
            {getStatusLabel(consolidatedStatus.status)}
          </Badge>
        </div>

        <Progress value={percentualGeral} className="h-3" />
        <p className="text-sm text-muted-foreground mt-2 text-center">{percentualGeral}% concluído</p>
      </div>

      {/* Lista de canais */}
      <div className="space-y-4">
        {canaisAtivos.map((canal) => {
          const checklist = checklists.find(c => c.canal_id === canal.id);
          const IconComponent = iconMap[canal.id] || Store;
          
          let canalStatus: string = 'pendente';
          let progresso = { concluidos: 0, total: 0, percentual: 0 };
          
          if (checklist) {
            canalStatus = determinarStatusChecklist(checklist.itens);
            progresso = calcularProgressoChecklist(checklist.itens);
          }

          return (
            <div
              key={canal.id}
              className={`p-4 rounded-lg border ${
                canalStatus === 'concluido' 
                  ? 'border-success/30 bg-success/5' 
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${canal.cor}20` }}
                  >
                    <IconComponent className="h-5 w-5" style={{ color: canal.cor }} />
                  </div>
                  <div>
                    <h4 className="font-medium">{canal.nome}</h4>
                    {checklist ? (
                      <p className="text-sm text-muted-foreground">
                        {progresso.concluidos}/{progresso.total} etapas • {progresso.percentual}%
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Checklist não iniciado</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {checklist && (
                    <div className="w-24">
                      <Progress value={progresso.percentual} className="h-2" />
                    </div>
                  )}
                  <Badge className={getStatusColor(canalStatus)}>
                    {canalStatus === 'concluido' && <Check className="h-3 w-3 mr-1" />}
                    {canalStatus === 'em_andamento' && <Clock className="h-3 w-3 mr-1" />}
                    {canalStatus === 'pendente' && <AlertCircle className="h-3 w-3 mr-1" />}
                    {canalStatus === 'nao_aplicavel' && '-'}
                    {getStatusLabel(canalStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regras de conclusão */}
      <div className="mt-6 p-4 rounded-lg bg-info/5 border border-info/20">
        <h4 className="text-sm font-medium text-info mb-2">Critérios de Conclusão</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• O fechamento do mês é considerado <strong>Concluído</strong> quando todos os canais ativos estiverem com checklist 100% concluído ou marcados como N/A.</li>
          <li>• Canais que não operaram no mês podem ser marcados como N/A.</li>
          <li>• Todos os uploads obrigatórios devem estar anexados para concluir as etapas.</li>
        </ul>
      </div>
    </ModuleCard>
  );
}
