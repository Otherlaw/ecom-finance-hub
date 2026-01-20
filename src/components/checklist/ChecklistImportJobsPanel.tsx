/**
 * Painel de Jobs de Importação do Checklist
 * 
 * Exibe progresso de importações em andamento e histórico recente.
 * Inclui botão "Ver Detalhes" para abrir modal de resumo da importação.
 */

import { useState, useEffect } from "react";
import { useChecklistImportJobs, ChecklistImportJob } from "@/hooks/useChecklistImportJobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Ban,
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ImportResultDetailModal } from "./ImportResultDetailModal";

interface ChecklistImportJobsPanelProps {
  empresaId?: string;
  checklistItemId?: string;
}

const FASE_LABELS: Record<ChecklistImportJob["fase"], string> = {
  iniciando: "Iniciando...",
  baixando: "Baixando arquivo...",
  parsing: "Lendo arquivo...",
  verificando_duplicatas: "Verificando duplicatas...",
  inserindo: "Inserindo transações...",
  finalizando: "Finalizando...",
};

const FASE_PROGRESS: Record<ChecklistImportJob["fase"], number> = {
  iniciando: 5,
  baixando: 10,
  parsing: 25,
  verificando_duplicatas: 45,
  inserindo: 75,
  finalizando: 95,
};

export function ChecklistImportJobsPanel({ empresaId, checklistItemId }: ChecklistImportJobsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { emAndamento, historico, cancelarJob } = useChecklistImportJobs({
    empresaId,
    checklistItemId,
  });

  const totalJobs = emAndamento.length + historico.length;
  if (totalJobs === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4 border-primary/20 bg-card/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-medium">
                  Processamento de Arquivos
                </CardTitle>
                {emAndamento.length > 0 && (
                  <Badge variant="secondary" className="animate-pulse">
                    {emAndamento.length} em andamento
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Jobs em andamento */}
            {emAndamento.map((job) => (
              <JobProgressCard 
                key={job.id} 
                job={job} 
                onCancel={() => cancelarJob.mutate(job.id)} 
              />
            ))}

            {/* Histórico recente */}
            {historico.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Histórico recente
                </h4>
                {historico.slice(0, 3).map((job) => (
                  <JobHistoryCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function JobProgressCard({ 
  job, 
  onCancel 
}: { 
  job: ChecklistImportJob; 
  onCancel: () => void;
}) {
  // Calcular progresso real baseado nas linhas processadas
  const baseProgress = FASE_PROGRESS[job.fase] || 0;
  let realProgress = baseProgress;

  if (job.total_linhas > 0 && job.linhas_processadas > 0) {
    const percentProcessado = (job.linhas_processadas / job.total_linhas) * 100;
    // Mapear para a faixa de progresso da fase atual
    if (job.fase === "verificando_duplicatas") {
      realProgress = 25 + (percentProcessado * 0.3); // 25-55%
    } else if (job.fase === "inserindo") {
      realProgress = 55 + (percentProcessado * 0.4); // 55-95%
    }
  }

  // Calcular velocidade e ETA
  const tempoDecorrido = (Date.now() - new Date(job.criado_em).getTime()) / 1000;
  const velocidade = job.linhas_processadas > 0 ? job.linhas_processadas / tempoDecorrido : 0;
  const linhasRestantes = job.total_linhas - job.linhas_processadas;
  const etaSegundos = velocidade > 0 ? linhasRestantes / velocidade : 0;

  return (
    <div className="p-4 rounded-lg border bg-background space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span className="font-medium truncate">{job.arquivo_nome}</span>
        </div>
        <Badge variant="outline">{job.canal}</Badge>
      </div>

      {/* Barra de progresso com shimmer */}
      <div className="space-y-1">
        <div className="relative overflow-hidden rounded-full">
          <Progress value={realProgress} className="h-2" />
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{ 
              backgroundSize: "200% 100%",
              animation: "shimmer 2s infinite linear",
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{FASE_LABELS[job.fase]}</span>
          <span>{Math.round(realProgress)}%</span>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {job.total_linhas > 0 && (
          <span>
            {job.linhas_processadas.toLocaleString()} / {job.total_linhas.toLocaleString()} linhas
          </span>
        )}
        {velocidade > 0 && (
          <span className="text-muted-foreground">
            ~{Math.round(velocidade)} linhas/s
          </span>
        )}
        {etaSegundos > 0 && etaSegundos < 3600 && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ETA: {Math.round(etaSegundos)}s
          </span>
        )}
      </div>

      {/* Contadores de resultado */}
      <div className="flex gap-4 text-xs">
        {job.linhas_importadas > 0 && (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {job.linhas_importadas} importadas
          </span>
        )}
        {job.linhas_duplicadas > 0 && (
          <span className="text-yellow-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {job.linhas_duplicadas} duplicatas
          </span>
        )}
        {job.linhas_com_erro > 0 && (
          <span className="text-red-600 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {job.linhas_com_erro} erros
          </span>
        )}
      </div>

      {/* Botão cancelar */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-muted-foreground hover:text-destructive"
        >
          <Ban className="h-3 w-3 mr-1" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function JobHistoryCard({ job }: { job: ChecklistImportJob }) {
  const isSuccess = job.status === "concluido";
  const isCancelled = job.status === "cancelado";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-background/50 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        ) : isCancelled ? (
          <Ban className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
        )}
        <span className="truncate">{job.arquivo_nome}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {isSuccess && (
          <span className="text-xs text-muted-foreground">
            {job.linhas_importadas} importadas
            {job.linhas_duplicadas > 0 && `, ${job.linhas_duplicadas} duplicatas`}
          </span>
        )}
        {job.status === "erro" && job.mensagem_erro && (
          <span className="text-xs text-red-600 max-w-[200px] truncate">
            {job.mensagem_erro}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(job.criado_em), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </span>
      </div>
    </div>
  );
}

// CSS para animação shimmer
const shimmerStyle = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

// Injetar estilo se não existir
if (typeof document !== "undefined") {
  const styleId = "shimmer-animation-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = shimmerStyle;
    document.head.appendChild(style);
  }
}
