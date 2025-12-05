import { useState, useEffect } from "react";
import { useMarketplaceImportJobs, MarketplaceImportJob, cancelarJob, excluirJob } from "@/hooks/useMarketplaceImportJobs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Upload, 
  Check, 
  X, 
  AlertCircle, 
  FileSpreadsheet, 
  Clock, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
  Ban,
  Trash2,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MarketplaceImportJobsPanelProps {
  empresaId?: string;
  onReprocessar?: (job: MarketplaceImportJob) => void;
}

const CANAIS_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  mercado_pago: "Mercado Pago",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok Shop",
  shein: "Shein",
  outro: "Outro",
};

export function MarketplaceImportJobsPanel({ empresaId, onReprocessar }: MarketplaceImportJobsPanelProps) {
  const { emAndamento, historico, isLoading } = useMarketplaceImportJobs({ empresaId });
  const [expanded, setExpanded] = useState(true);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<MarketplaceImportJob | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [jobToCancel, setJobToCancel] = useState<MarketplaceImportJob | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Se não há jobs, não mostrar nada
  if (!isLoading && emAndamento.length === 0 && historico.length === 0) {
    return null;
  }

  const handleViewError = (job: MarketplaceImportJob) => {
    setSelectedError(job);
    setErrorModalOpen(true);
  };

  const handleCancelClick = (job: MarketplaceImportJob) => {
    setJobToCancel(job);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;
    
    setIsCanceling(true);
    try {
      await cancelarJob(jobToCancel.id);
      toast.success("Importação cancelada");
    } catch (error) {
      toast.error("Erro ao cancelar importação");
    } finally {
      setIsCanceling(false);
      setCancelModalOpen(false);
      setJobToCancel(null);
    }
  };

  const handleReprocessar = (job: MarketplaceImportJob) => {
    if (onReprocessar) {
      onReprocessar(job);
    } else {
      toast.info("Para reprocessar, importe o arquivo novamente pelo modal de importação");
    }
  };

  const handleExcluirJob = async (job: MarketplaceImportJob) => {
    setIsDeleting(job.id);
    try {
      await excluirJob(job.id);
      toast.success("Registro de importação excluído");
    } catch (error) {
      toast.error("Erro ao excluir registro");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
      {/* Header colapsável */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Upload className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold flex items-center gap-2">
              Importações do Marketplace
              {emAndamento.length > 0 && (
                <Badge variant="secondary" className="animate-pulse bg-primary/20 text-primary text-[10px]">
                  <Zap className="h-3 w-3 mr-1" />
                  Tempo real
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground">
              {emAndamento.length > 0 
                ? `${emAndamento.length} importação em andamento`
                : `${historico.length} importações no histórico`
              }
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {/* Importações em Andamento */}
              {emAndamento.length > 0 && (
                <div className="p-4 border-b border-border bg-primary/5">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Importações em Andamento
                  </h4>
                  <div className="space-y-3">
                    {emAndamento.map((job) => (
                      <JobEmAndamentoCard 
                        key={job.id} 
                        job={job} 
                        onCancel={() => handleCancelClick(job)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de Importações */}
              {historico.length > 0 && (
                <div className="p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Histórico de Importações
                  </h4>
                  <ScrollArea className="max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-[130px]">Data</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right">Importadas</TableHead>
                          <TableHead className="text-right">Duplicadas</TableHead>
                          <TableHead className="text-right">Erros</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(job.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium text-sm max-w-[180px] truncate" title={job.arquivo_nome}>
                              {job.arquivo_nome}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {CANAIS_LABELS[job.canal] || job.canal}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-success">
                              {job.linhas_importadas.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {job.linhas_duplicadas.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-destructive">
                              {job.linhas_com_erro > 0 ? job.linhas_com_erro.toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              {job.status === 'concluido' ? (
                                <Badge className="bg-success/10 text-success border-success/20">
                                  <Check className="h-3 w-3 mr-1" />
                                  Concluído
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                  <X className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {job.status === 'erro' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleViewError(job)}
                                      title="Ver erro"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-primary hover:text-primary"
                                      onClick={() => handleReprocessar(job)}
                                      title="Reprocessar"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleExcluirJob(job)}
                                  disabled={isDeleting === job.id}
                                  title="Excluir registro"
                                >
                                  {isDeleting === job.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de erro */}
      <Dialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Detalhes do Erro
            </DialogTitle>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Arquivo:</span>
                  <p className="font-medium">{selectedError.arquivo_nome}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Canal:</span>
                  <p className="font-medium">{CANAIS_LABELS[selectedError.canal] || selectedError.canal}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total de Linhas:</span>
                  <p className="font-medium">{selectedError.total_linhas.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Processadas:</span>
                  <p className="font-medium">{selectedError.linhas_processadas.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Mensagem de Erro:</span>
                <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {selectedError.mensagem_erro || "Erro desconhecido"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de cancelamento */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Cancelar Importação
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta importação? As linhas já processadas serão mantidas.
            </DialogDescription>
          </DialogHeader>
          {jobToCancel && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p><strong>Arquivo:</strong> {jobToCancel.arquivo_nome}</p>
              <p><strong>Progresso:</strong> {jobToCancel.linhas_processadas.toLocaleString()} de {jobToCancel.total_linhas.toLocaleString()} linhas</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModalOpen(false)} disabled={isCanceling}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isCanceling}>
              {isCanceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Card de job em andamento com progresso em tempo real
function JobEmAndamentoCard({ job, onCancel }: { job: MarketplaceImportJob; onCancel: () => void }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  const targetProgress = job.total_linhas > 0 
    ? Math.round((job.linhas_processadas / job.total_linhas) * 100) 
    : 0;

  // Animação suave do progresso
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(targetProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [targetProgress]);

  // Calcular velocidade de processamento
  const tempoDecorrido = (new Date().getTime() - new Date(job.criado_em).getTime()) / 1000; // segundos
  const velocidade = tempoDecorrido > 0 ? Math.round(job.linhas_processadas / tempoDecorrido) : 0;
  const tempoRestante = velocidade > 0 
    ? Math.round((job.total_linhas - job.linhas_processadas) / velocidade)
    : 0;

  const formatTempo = (segundos: number): string => {
    if (segundos < 60) return `${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${minutos}m ${seg}s`;
  };

  return (
    <div className="p-4 rounded-lg bg-card border border-primary/20 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-ping" />
          </div>
          <span className="font-medium text-sm">{job.arquivo_nome}</span>
          <Badge variant="outline" className="text-xs">
            {CANAIS_LABELS[job.canal] || job.canal}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {format(new Date(job.criado_em), "HH:mm", { locale: ptBR })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            <Ban className="h-3 w-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>

      {/* Barra de progresso animada */}
      <div className="space-y-2">
        <div className="relative">
          <Progress 
            value={animatedProgress} 
            className="h-3 transition-all duration-500"
          />
          {/* Indicador de atividade */}
          <div 
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            style={{ 
              left: `${Math.max(0, animatedProgress - 5)}%`,
              display: animatedProgress < 100 ? 'block' : 'none'
            }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {job.linhas_processadas.toLocaleString()} de {job.total_linhas.toLocaleString()} linhas
            </span>
            {velocidade > 0 && (
              <span className="text-primary/70">
                ~{velocidade}/s
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tempoRestante > 0 && animatedProgress < 100 && (
              <span className="text-muted-foreground">
                ~{formatTempo(tempoRestante)} restantes
              </span>
            )}
            <span className="font-bold text-primary">{animatedProgress}%</span>
          </div>
        </div>
      </div>

      {/* Contadores em tempo real */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10">
          <Check className="h-3 w-3 text-success" />
          <span className="text-success font-medium">{job.linhas_importadas.toLocaleString()}</span>
          <span className="text-success/70">importadas</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10">
          <AlertCircle className="h-3 w-3 text-amber-500" />
          <span className="text-amber-600 font-medium">{job.linhas_duplicadas.toLocaleString()}</span>
          <span className="text-amber-500/70">duplicadas</span>
        </div>
        {job.linhas_com_erro > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10">
            <X className="h-3 w-3 text-destructive" />
            <span className="text-destructive font-medium">{job.linhas_com_erro.toLocaleString()}</span>
            <span className="text-destructive/70">erros</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[10px] uppercase tracking-wide">Processando</span>
        </div>
      </div>
    </div>
  );
}
