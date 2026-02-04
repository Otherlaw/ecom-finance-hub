/**
 * Componente de Status e Sincronizacao de NF-e
 * Exibe status da sincronizacao e permite iniciar sync manual
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Settings,
  Info,
  Loader2,
} from "lucide-react";
import { useNfeSyncStatus } from "@/hooks/useNfeSyncStatus";
import { formatDate } from "@/lib/icms-data";

interface NfeSyncStatusProps {
  empresaId: string;
}

export function NfeSyncStatus({ empresaId }: NfeSyncStatusProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { status, isLoading, isSyncing, isRateLimited, nextRetryAt, lastError, startSync, refetch } = useNfeSyncStatus(empresaId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-9" />
      </div>
    );
  }

  const syncState = status?.sync_state;
  const hasCertificate = status?.has_certificate;

  const getStatusBadge = () => {
    if (!syncState) return null;

    // ★ Priorizar rate limit (status='error' com next_retry_at ativo)
    if (isRateLimited) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Aguardando (rate limit)
        </Badge>
      );
    }

    switch (syncState.status) {
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Sincronizando...
          </Badge>
        );
      case "rate_limited":
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando (rate limit)
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case "idle":
      case "completed":
        if (syncState.last_sync_at) {
          return (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Sincronizado
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Nunca sincronizado
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatNextRetry = () => {
    if (!nextRetryAt) return null;
    const date = new Date(nextRetryAt);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLastSync = () => {
    if (!syncState?.last_sync_at) return "Nunca";
    const date = new Date(syncState.last_sync_at);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calcular se o botao deve estar desabilitado
  const isButtonDisabled = !hasCertificate || isSyncing || isRateLimited;
  
  // Texto do botao
  const getButtonText = () => {
    if (isSyncing) return "Sincronizando...";
    if (isRateLimited && nextRetryAt) {
      return `Aguarde até ${formatNextRetry()}`;
    }
    return "Sincronizar NF-e";
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botao principal de sincronizacao */}
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => startSync.mutate()}
        disabled={isButtonDisabled}
        title={isRateLimited ? `Rate limited. Próximo retry: ${formatNextRetry()}` : undefined}
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRateLimited ? (
          <Clock className="h-4 w-4" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {getButtonText()}
      </Button>

      {/* Dialog de detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Ver detalhes da sincronizacao">
            <Info className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sincronizacao de NF-e (Distribuicao DF-e)
            </DialogTitle>
            <DialogDescription>
              Status da sincronizacao automatica de notas fiscais eletronicas
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Status geral */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="flex items-center gap-2">
                  {getStatusBadge()}
                </div>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Ultima Sincronizacao</div>
                <div className="font-medium">{formatLastSync()}</div>
              </div>
            </div>

            {/* Certificado */}
            {!hasCertificate && (
              <Alert className="bg-warning/10 border-warning/30">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Nenhum certificado A1 configurado. Configure um certificado para habilitar a sincronizacao automatica.
                </AlertDescription>
              </Alert>
            )}

            {status?.certificate && (
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm font-medium mb-2">Certificado Digital</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">CNPJ</div>
                    <div className="font-mono">{status.certificate.cnpj}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ambiente</div>
                    <Badge variant={status.certificate.ambiente === "producao" ? "default" : "secondary"}>
                      {status.certificate.ambiente === "producao" ? "Producao" : "Homologacao"}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">UF</div>
                    <div>{status.certificate.uf}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Estatisticas */}
            {syncState && (
              <div className="p-4 rounded-lg border bg-card">
                <div className="text-sm font-medium mb-2">Estatisticas</div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Documentos</div>
                    <div className="text-lg font-semibold">{status?.stats?.total_documents || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Creditos Gerados</div>
                    <div className="text-lg font-semibold">{status?.stats?.total_credits_from_sync || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ultimo NSU</div>
                    <div className="font-mono">{syncState.ult_nsu || 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Max NSU</div>
                    <div className="font-mono">{syncState.max_nsu || 0}</div>
                  </div>
                </div>

                {/* Progress se estiver sincronizando */}
                {syncState.status === "running" && syncState.max_nsu > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso</span>
                      <span>{Math.round((syncState.ult_nsu / syncState.max_nsu) * 100)}%</span>
                    </div>
                    <Progress value={(syncState.ult_nsu / syncState.max_nsu) * 100} />
                  </div>
                )}
              </div>
            )}

            {/* Rate Limited Warning - Mostrar para status='rate_limited' OU status='error' com next_retry_at */}
            {isRateLimited && nextRetryAt && (
              <Alert className="bg-warning/10 border-warning/30">
                <Clock className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Rate limited pela SEFAZ (erro 656). Aguarde até {formatNextRetry()} para tentar novamente.
                  O progresso foi salvo (NSU atual: {syncState?.ult_nsu || 0}).
                </AlertDescription>
              </Alert>
            )}

            {/* Erro genérico (não rate limit) */}
            {lastError && !isRateLimited && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{lastError}</AlertDescription>
              </Alert>
            )}

            {/* Ultimos documentos */}
            {status?.recent_documents && status.recent_documents.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Ultimas Notas Importadas</div>
                <ScrollArea className="h-48 rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chave de Acesso</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {status.recent_documents.map((doc) => (
                        <TableRow key={doc.access_key}>
                          <TableCell className="font-mono text-xs">
                            {doc.access_key.substring(0, 20)}...
                          </TableCell>
                          <TableCell>{doc.issue_date || "-"}</TableCell>
                          <TableCell className="text-right">
                            {doc.total_value
                              ? new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(doc.total_value)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {doc.processed ? (
                              <Badge variant="outline" className="bg-success/10 text-success text-xs">
                                Processado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            {/* Logs */}
            {status?.logs && status.logs.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Historico de Sincronizacao</div>
                <ScrollArea className="h-40 rounded border p-2">
                  <div className="space-y-1 text-xs font-mono">
                    {status.logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex gap-2 ${
                          log.level === "error"
                            ? "text-destructive"
                            : log.level === "warn"
                            ? "text-warning"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="text-muted-foreground/60">
                          {new Date(log.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="uppercase w-12">[{log.level}]</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Badge de status */}
      {getStatusBadge()}
    </div>
  );
}
