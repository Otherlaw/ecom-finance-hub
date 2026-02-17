/**
 * Componente de Status e Sincronizacao de NF-e
 * MODO AUTOMÁTICO: Exibe status da sincronização automática (estilo Arquivei/Qive)
 * Sem botão de sync manual - sincronização roda em background via cron
 * 
 * Funcionalidades:
 * - Exibe progresso real (ult_nsu/max_nsu)
 * - Mostra próxima sincronização automática
 * - Countdown para cooldown (cStat 137 ou erro 656)
 * - Reset manual apenas para sync travada
 */

import { useState, useEffect } from "react";
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
  Info,
  Loader2,
  RotateCcw,
  Play,
  Trash2,
} from "lucide-react";
import { useNfeSyncStatus } from "@/hooks/useNfeSyncStatus";

interface NfeSyncStatusProps {
  empresaId: string;
}

export function NfeSyncStatus({ empresaId }: NfeSyncStatusProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { 
    status, 
    isLoading, 
    isSyncing, 
    isRateLimited, 
    nextRetryAt, 
    lastError, 
    resetSync,
    startSync,
    devResetState,
    refetch,
    isStuck,
    timeUntilRetry,
    nextExecutionLabel,
    syncMode,
    firstSuccessAt,
  } = useNfeSyncStatus(empresaId);

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

   // Calcular progresso real
   const hasBacklog = syncState && syncState.max_nsu > 0 && syncState.ult_nsu < syncState.max_nsu;
   const progressPercent = syncState && syncState.max_nsu > 0 
     ? Math.round((syncState.ult_nsu / syncState.max_nsu) * 100)
     : 0;
 
   // Detectar se foi pausado para proteção anti-rate-limit
   const isPaused = syncState?.status === "idle" && 
     syncState?.last_error?.includes("Pausado") || 
     syncState?.last_error?.includes("Limite de") ||
     syncState?.last_error?.includes("cStat 137");
 
  const getStatusBadge = () => {
    if (!syncState) return null;

    // Priorizar rate limit
    if (isRateLimited) {
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Aguardando ({timeUntilRetry || "..."})
        </Badge>
      );
    }

    // Sync travada
    if (isStuck) {
      return (
        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Sync travada
        </Badge>
      );
    }

     // Pausado para proteção
     if (isPaused) {
       return (
         <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
           <Clock className="h-3 w-3 mr-1" />
             Aguardando próximo ciclo
         </Badge>
       );
     }
 
    switch (syncState.status) {
      case "queued":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Iniciando...
          </Badge>
        );
      case "running":
         return (
           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
             <Loader2 className="h-3 w-3 mr-1 animate-spin" />
             Sincronizando... {progressPercent > 0 && `(${progressPercent}%)`}
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

   // Formatar próxima sincronização
   const formatNextSync = () => {
     if (!nextRetryAt) return null;
     const date = new Date(nextRetryAt);
     return date.toLocaleString("pt-BR", {
       day: "2-digit",
       month: "2-digit",
       hour: "2-digit",
       minute: "2-digit",
     });
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

  const handleResetSync = () => {
    resetSync.mutate();
  };

  // Verificar se cooldown está ativo (next_retry_at > now)
  const cooldownActive = nextRetryAt && new Date(nextRetryAt) > new Date();
  
  // Reset só aparece se: (1) travado E (2) NÃO está em rate limit E (3) cooldown expirou
  const canShowReset = isStuck && !isRateLimited && !cooldownActive;

  return (
    <div className="flex items-center gap-2">
       {/* Botao de reset apenas quando travado E sem cooldown ativo */}
       {canShowReset && (
        <Button
          variant="destructive"
          size="sm"
          className="gap-2"
          onClick={handleResetSync}
          disabled={resetSync.isPending}
          title="Resetar sincronizacao travada"
        >
          {resetSync.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reiniciar
        </Button>
      )}
      
      {/* Aviso quando travado mas precisa esperar cooldown */}
      {isStuck && cooldownActive && (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Aguarde cooldown expirar
        </Badge>
      )}

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

            {/* Alerta de sync travada */}
            {isStuck && (
              <Alert className="bg-orange-50 border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-700">
                  A sincronizacao parece estar travada (sem atualizacoes ha mais de 3 minutos). 
                  Clique em "Reiniciar" para destravar e tentar novamente.
                </AlertDescription>
              </Alert>
            )}
             
             {/* Alerta de pausa para proteção */}
             {isPaused && (
               <Alert className="bg-blue-50 border-blue-200">
                 <Clock className="h-4 w-4 text-blue-600" />
                 <AlertDescription className="text-blue-700">
                   Sincronização pausada para evitar rate limit da SEFAZ. 
                   {hasBacklog && (
                 <span> Ainda há documentos pendentes ({syncState?.ult_nsu}/{syncState?.max_nsu} NSUs).</span>
                   )}
               <span> A sincronização automática retomará em breve.</span>
                 </AlertDescription>
               </Alert>
             )}

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
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Estatísticas</div>
                  <Badge variant="outline" className="text-xs">
                    {syncMode === "continuous" ? "Contínuo" : syncMode === "awaiting_first_sync" ? "Aguardando 1ª sync" : syncMode === "bootstrap" ? "Importação inicial" : "Diário"}
                  </Badge>
                </div>
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
                 {(syncState.status === "running" || syncState.status === "queued" || hasBacklog) && syncState.max_nsu > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                       <span>Progresso {hasBacklog && !isSyncing && "(pendente)"}</span>
                       <span>{progressPercent}%</span>
                    </div>
                     <Progress value={progressPercent} className={hasBacklog && !isSyncing ? "opacity-60" : ""} />
                     {hasBacklog && !isSyncing && (
                       <div className="text-xs text-muted-foreground mt-1">
                         {syncState.max_nsu - syncState.ult_nsu} NSUs restantes
                       </div>
                     )}
                  </div>
                )}
              </div>
            )}

            {/* Rate Limited Warning */}
            {isRateLimited && (
              <Alert className="bg-warning/10 border-warning/30">
                <Clock className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Rate limited pela SEFAZ (erro 656). {nextExecutionLabel || "Aguardando próxima execução automática às 00:00."}
                {timeUntilRetry && <span className="font-medium"> ({timeUntilRetry} restantes)</span>}
                  <br />
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
                        <TableHead>Tipo</TableHead>
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
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${doc.direction === 'emitida' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                              {doc.direction === 'emitida' ? 'Emitida' : 'Recebida'}
                            </Badge>
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
                <ScrollArea className="h-48 rounded border p-2">
                  <div className="space-y-1 text-xs font-mono">
                    {status.logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex gap-2 ${
                          log.level === "error"
                            ? "text-destructive"
                            : log.level === "warn"
                            ? "text-warning"
                            : log.level === "debug"
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="text-muted-foreground/60 shrink-0">
                          {new Date(log.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span className="uppercase w-14 shrink-0">[{log.level}]</span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Botoes de acao no dialog */}
            <div className="flex gap-2 pt-4 border-t">
               {/* Reset apenas quando travado */}
               {isStuck && (
                <Button
                  variant="outline"
                  className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={handleResetSync}
                   disabled={resetSync.isPending || isRateLimited}
                >
                   {resetSync.isPending ? (
                     <Loader2 className="h-4 w-4 animate-spin" />
                   ) : (
                     <RotateCcw className="h-4 w-4" />
                   )}
                  Resetar Sync
                </Button>
              )}
              
               {/* Informação sobre modo automático */}
               <div className="flex-1 text-sm text-muted-foreground">
                 {isSyncing ? (
                   <span className="flex items-center gap-1">
                     <Loader2 className="h-3 w-3 animate-spin" />
                     Sincronização em andamento...
                   </span>
                 ) : nextExecutionLabel ? (
                   <span>{nextExecutionLabel}</span>
                 ) : nextRetryAt && new Date(nextRetryAt) > new Date() ? (
                   <span>Próxima execução: {formatNextSync()}</span>
                 ) : (
                   <span>Sincronização automática ativa (diária às 00:00)</span>
                 )}
               </div>
 
              <Button
                variant="default"
                className="gap-2"
                onClick={() => startSync.mutate()}
                disabled={isSyncing || isRateLimited || isStuck || startSync.isPending}
              >
                {startSync.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Forçar Sincronização
              </Button>

              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => {
                  if (window.confirm("ATENÇÃO: Isso vai zerar o NSU e o bootstrap_completed_at, simulando uma empresa nova. Continuar?")) {
                    devResetState.mutate();
                  }
                }}
                disabled={isSyncing || devResetState.isPending}
              >
                {devResetState.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Hard Reset (DEV)
              </Button>

              <Button
                variant="ghost"
                className="gap-2"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Botão de sync rápido */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => startSync.mutate()}
        disabled={isSyncing || isRateLimited || isStuck || startSync.isPending || !hasCertificate}
        title={!hasCertificate ? "Configure um certificado primeiro" : "Iniciar sincronização manual"}
      >
        {startSync.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        Sincronizar
      </Button>

      {/* Badge de status */}
      {getStatusBadge()}
    </div>
  );
}
