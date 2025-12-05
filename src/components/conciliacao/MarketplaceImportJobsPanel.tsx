import { useState } from "react";
import { useMarketplaceImportJobs, MarketplaceImportJob } from "@/hooks/useMarketplaceImportJobs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MarketplaceImportJobsPanelProps {
  empresaId?: string;
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

export function MarketplaceImportJobsPanel({ empresaId }: MarketplaceImportJobsPanelProps) {
  const { emAndamento, historico, isLoading } = useMarketplaceImportJobs({ empresaId });
  const [expanded, setExpanded] = useState(true);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<MarketplaceImportJob | null>(null);

  // Se não há jobs, não mostrar nada
  if (!isLoading && emAndamento.length === 0 && historico.length === 0) {
    return null;
  }

  const handleViewError = (job: MarketplaceImportJob) => {
    setSelectedError(job);
    setErrorModalOpen(true);
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
            <h3 className="font-semibold">Importações do Marketplace</h3>
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
                      <JobEmAndamentoCard key={job.id} job={job} />
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
                          <TableHead className="text-center w-[60px]"></TableHead>
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
                              {job.status === 'erro' && job.mensagem_erro && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleViewError(job)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
    </div>
  );
}

// Card de job em andamento
function JobEmAndamentoCard({ job }: { job: MarketplaceImportJob }) {
  const progress = job.total_linhas > 0 
    ? Math.round((job.linhas_processadas / job.total_linhas) * 100) 
    : 0;

  return (
    <div className="p-4 rounded-lg bg-card border border-primary/20">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{job.arquivo_nome}</span>
          <Badge variant="outline" className="text-xs">
            {CANAIS_LABELS[job.canal] || job.canal}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(job.criado_em), "HH:mm", { locale: ptBR })}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {job.linhas_processadas.toLocaleString()} de {job.total_linhas.toLocaleString()} linhas processadas
          </span>
          <span className="font-medium">{progress}%</span>
        </div>
      </div>

      {/* Contadores */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <Check className="h-3 w-3 text-success" />
          <span className="text-success font-medium">{job.linhas_importadas.toLocaleString()}</span>
          <span className="text-muted-foreground">importadas</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{job.linhas_duplicadas.toLocaleString()}</span>
          <span className="text-muted-foreground">duplicadas</span>
        </div>
        {job.linhas_com_erro > 0 && (
          <div className="flex items-center gap-1">
            <X className="h-3 w-3 text-destructive" />
            <span className="text-destructive font-medium">{job.linhas_com_erro.toLocaleString()}</span>
            <span className="text-muted-foreground">erros</span>
          </div>
        )}
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary ml-auto" />
      </div>
    </div>
  );
}
