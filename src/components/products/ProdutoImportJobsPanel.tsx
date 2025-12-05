import { useState, useEffect } from "react";
import { useProdutoImportJobs, ProdutoImportJob, cancelarJobProduto, excluirJobProduto } from "@/hooks/useProdutoImportJobs";
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
  Ban,
  Trash2,
  Zap,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProdutoImportJobsPanelProps {
  empresaId?: string;
}

export function ProdutoImportJobsPanel({ empresaId }: ProdutoImportJobsPanelProps) {
  const { emAndamento, historico, isLoading } = useProdutoImportJobs({ empresaId });
  const [expanded, setExpanded] = useState(true);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<ProdutoImportJob | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [jobToCancel, setJobToCancel] = useState<ProdutoImportJob | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (!isLoading && emAndamento.length === 0 && historico.length === 0) {
    return null;
  }

  const handleViewError = (job: ProdutoImportJob) => {
    setSelectedError(job);
    setErrorModalOpen(true);
  };

  const handleCancelClick = (job: ProdutoImportJob) => {
    setJobToCancel(job);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;
    
    setIsCanceling(true);
    try {
      await cancelarJobProduto(jobToCancel.id);
      toast.success("Importação cancelada");
    } catch (error) {
      toast.error("Erro ao cancelar importação");
    } finally {
      setIsCanceling(false);
      setCancelModalOpen(false);
      setJobToCancel(null);
    }
  };

  const handleExcluirJob = async (job: ProdutoImportJob) => {
    setIsDeleting(job.id);
    try {
      await excluirJobProduto(job.id);
      toast.success("Registro de importação excluído");
    } catch (error) {
      toast.error("Erro ao excluir registro");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold flex items-center gap-2">
              Importações de Produtos
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
                          <TableHead className="text-right">Novos</TableHead>
                          <TableHead className="text-right">Atualizados</TableHead>
                          <TableHead className="text-right">Mapeamentos</TableHead>
                          <TableHead className="text-right">Erros</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center w-[80px]">Ações</TableHead>
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
                            <TableCell className="text-right font-medium text-success">
                              {job.linhas_importadas.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-primary">
                              {job.linhas_atualizadas.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {job.mapeamentos_criados.toLocaleString()}
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
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleViewError(job)}
                                    title="Ver erro"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
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
                  <span className="text-muted-foreground">Total de Linhas:</span>
                  <p className="font-medium">{selectedError.total_linhas.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Processadas:</span>
                  <p className="font-medium">{selectedError.linhas_processadas.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Importadas:</span>
                  <p className="font-medium">{selectedError.linhas_importadas.toLocaleString()}</p>
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
              Tem certeza que deseja cancelar esta importação? Os produtos já processados serão mantidos.
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

function JobEmAndamentoCard({ job, onCancel }: { job: ProdutoImportJob; onCancel: () => void }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  const targetProgress = job.total_linhas > 0 
    ? Math.round((job.linhas_processadas / job.total_linhas) * 100) 
    : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(targetProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [targetProgress]);

  const tempoDecorrido = (new Date().getTime() - new Date(job.criado_em).getTime()) / 1000;
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

      <div className="space-y-2">
        <div className="relative">
          <Progress 
            value={animatedProgress} 
            className="h-3 transition-all duration-500"
          />
          <div 
            className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
            style={{ 
              left: `${Math.min(animatedProgress, 95)}%`,
              opacity: animatedProgress < 100 ? 1 : 0 
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-primary">
              {animatedProgress}%
            </span>
            <span className="text-muted-foreground">
              {job.linhas_processadas.toLocaleString()} / {job.total_linhas.toLocaleString()} linhas
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {velocidade > 0 && (
              <span>{velocidade} linhas/s</span>
            )}
            {tempoRestante > 0 && animatedProgress < 100 && (
              <span>~{formatTempo(tempoRestante)} restante</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs pt-1">
          <span className="text-success">
            ✓ {job.linhas_importadas} novos
          </span>
          <span className="text-primary">
            ↻ {job.linhas_atualizadas} atualizados
          </span>
          <span className="text-muted-foreground">
            🔗 {job.mapeamentos_criados} mapeamentos
          </span>
          {job.linhas_com_erro > 0 && (
            <span className="text-destructive">
              ✕ {job.linhas_com_erro} erros
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
