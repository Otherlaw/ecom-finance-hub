import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModuleCard } from "@/components/ModuleCard";
import { EtapaFormModal } from "./EtapaFormModal";
import { ConferenciaImportacaoModal, ConferenciaData } from "./ConferenciaImportacaoModal";
import { ChecklistCanalComItens, ChecklistCanalItem, useChecklistsCanal, calcularProgressoChecklist, getStatusLabel, getStatusColor } from "@/hooks/useChecklistsCanal";
import { getMesNome } from "@/lib/checklist-data";
import { supabase } from "@/integrations/supabase/client";
import { validarPeriodoArquivo, getNomeMes } from "@/lib/validar-periodo-arquivo";
import { processarArquivoChecklist, ResultadoProcessamento } from "@/lib/processar-arquivo-checklist";
import {
  ArrowLeft,
  FileText,
  Check,
  ShoppingBag,
  Store,
  Shirt,
  Music,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
  File,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChecklistDetailRealProps {
  checklist: ChecklistCanalComItens;
  onBack: () => void;
  onRefresh: () => void;
}

const iconMap: Record<string, React.ElementType> = {
  mercado_livre: ShoppingBag,
  shopee: Store,
  shein: Shirt,
  tiktok: Music,
};

interface PendingUpload {
  file: File;
  itemId: string;
  validacao: {
    valido: boolean;
    periodoDetectado: { mes: number; ano: number } | null;
    periodoEsperado: { mes: number; ano: number };
  };
}

export function ChecklistDetailReal({ checklist, onBack, onRefresh }: ChecklistDetailRealProps) {
  const [showEtapaModal, setShowEtapaModal] = useState(false);
  const [etapaParaEditar, setEtapaParaEditar] = useState<ChecklistCanalItem | null>(null);
  const [etapaParaExcluir, setEtapaParaExcluir] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [processingArquivoId, setProcessingArquivoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadItemId, setCurrentUploadItemId] = useState<string | null>(null);
  
  // Estado para modal de confirmação de período incompatível
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [showPeriodoAlertModal, setShowPeriodoAlertModal] = useState(false);
  
  // Estado para modal de conferência de importação
  const [showConferenciaModal, setShowConferenciaModal] = useState(false);
  const [conferenciaData, setConferenciaData] = useState<ConferenciaData | null>(null);

  const { atualizarEtapa, excluirEtapa, adicionarArquivo, removerArquivo, marcarArquivoProcessado } = useChecklistsCanal();

  const handleUploadClick = (itemId: string) => {
    setCurrentUploadItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItemId) return;

    // Primeiro, validar o período do arquivo
    const validacao = await validarPeriodoArquivo(file, checklist.mes, checklist.ano);
    
    if (validacao.alertaIncompatibilidade && validacao.periodoDetectado) {
      // Período incompatível - mostrar modal de confirmação
      setPendingUpload({
        file,
        itemId: currentUploadItemId,
        validacao: {
          valido: validacao.valido,
          periodoDetectado: validacao.periodoDetectado,
          periodoEsperado: validacao.periodoEsperado,
        },
      });
      setShowPeriodoAlertModal(true);
      // Limpar input para permitir reselecionar mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
    // Período válido ou não detectável - prosseguir com upload
    await executarUpload(file, currentUploadItemId);
  };

  const executarUpload = async (file: File, itemId: string) => {
    setUploadingItemId(itemId);

    try {
      // Upload para Storage
      const fileName = `checklist/${itemId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      // Registrar arquivo no banco
      const arquivoResult = await adicionarArquivo.mutateAsync({
        checklistItemId: itemId,
        nomeArquivo: file.name,
        url: urlData.publicUrl,
        tamanhoBytes: file.size,
        tipoMime: file.type,
      });

      toast({ title: "Arquivo enviado com sucesso" });
      
      // Processar automaticamente o arquivo
      if (arquivoResult) {
        await processarArquivoAutomaticamente(arquivoResult.id, urlData.publicUrl, file.name);
      }

      onRefresh();
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({ title: "Erro ao enviar arquivo", description: error.message, variant: "destructive" });
    } finally {
      setUploadingItemId(null);
      setCurrentUploadItemId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmUploadWithInvalidPeriod = async () => {
    if (pendingUpload) {
      await executarUpload(pendingUpload.file, pendingUpload.itemId);
    }
    setShowPeriodoAlertModal(false);
    setPendingUpload(null);
  };

  const handleCancelUpload = () => {
    setShowPeriodoAlertModal(false);
    setPendingUpload(null);
    setCurrentUploadItemId(null);
  };

  const processarArquivoAutomaticamente = async (arquivoId: string, fileUrl: string, nomeArquivo: string) => {
    setProcessingArquivoId(arquivoId);
    
    try {
      toast({ title: "Processando arquivo...", description: "Extraindo transações" });
      
      const resultado = await processarArquivoChecklist(
        arquivoId,
        fileUrl,
        checklist.canal_id,
        checklist.empresa_id,
        nomeArquivo
      );
      
      // Preparar dados para modal de conferência
      const confData: ConferenciaData = {
        nomeArquivo,
        tipoArquivoDetectado: resultado.detalhes?.tipoArquivoDetectado || "desconhecido",
        periodoDetectado: null, // Seria extraído da validação prévia
        periodoEsperado: { mes: checklist.mes, ano: checklist.ano },
        periodoCompativel: true,
        estatisticas: {
          totalLinhasArquivo: resultado.detalhes?.totalLinhasArquivo || 0,
          totalTransacoesGeradas: resultado.detalhes?.totalTransacoesGeradas || 0,
          transacoesImportadas: resultado.transacoesImportadas,
          duplicatasIgnoradas: resultado.duplicatasIgnoradas,
          transacoesComErro: resultado.transacoesComErro,
        },
        tiposMovimentacao: [],
        amostraTransacoes: [],
      };
      
      if (resultado.sucesso) {
        const msg = resultado.duplicatasIgnoradas > 0
          ? `${resultado.transacoesImportadas} transações importadas (${resultado.duplicatasIgnoradas} duplicatas ignoradas)`
          : `${resultado.transacoesImportadas} transações importadas`;
        
        toast({ 
          title: "Arquivo processado!", 
          description: msg,
          action: resultado.transacoesImportadas > 0 ? (
            <Button variant="outline" size="sm" onClick={() => {
              setConferenciaData(confData);
              setShowConferenciaModal(true);
            }}>
              Ver detalhes
            </Button>
          ) : undefined,
        });
      } else {
        toast({ 
          title: "Erro ao processar arquivo", 
          description: resultado.erros.join(", ") || "Não foi possível extrair transações",
          variant: "destructive",
        });
      }
      
      onRefresh();
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast({ 
        title: "Erro ao processar arquivo", 
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setProcessingArquivoId(null);
    }
  };

  const handleReprocessarArquivo = async (arquivo: { id: string; url: string; nome_arquivo: string }) => {
    await processarArquivoAutomaticamente(arquivo.id, arquivo.url, arquivo.nome_arquivo);
  };

  const handleRemoveFile = async (arquivoId: string) => {
    try {
      await removerArquivo.mutateAsync(arquivoId);
      onRefresh();
      toast({ title: "Arquivo removido" });
    } catch (error: any) {
      toast({ title: "Erro ao remover arquivo", variant: "destructive" });
    }
  };

  const progresso = calcularProgressoChecklist(checklist.itens);
  const IconComponent = iconMap[checklist.canal_id] || Store;

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const item = checklist.itens.find(i => i.id === itemId);
    if (newStatus === "concluido" && item?.exige_upload && (!item.arquivos || item.arquivos.length === 0)) {
      toast({
        title: "Upload obrigatório",
        description: "Esta etapa exige anexar um arquivo antes de ser concluída.",
        variant: "destructive",
      });
      return;
    }

    await atualizarEtapa.mutateAsync({ id: itemId, status: newStatus });
    onRefresh();
    toast({ title: "Status atualizado" });
  };

  const handleExcluirEtapa = async () => {
    if (etapaParaExcluir) {
      await excluirEtapa.mutateAsync(etapaParaExcluir);
      setEtapaParaExcluir(null);
      onRefresh();
    }
  };

  const toggleExpand = (itemId: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setExpandedItems(newSet);
  };

  const statusSummary = {
    concluido: checklist.itens.filter(i => i.status === "concluido").length,
    em_andamento: checklist.itens.filter(i => i.status === "em_andamento").length,
    pendente: checklist.itens.filter(i => i.status === "pendente").length,
    nao_aplicavel: checklist.itens.filter(i => i.status === "nao_aplicavel").length,
  };

  // Resumo de etapas críticas (bloqueia_fechamento = true)
  const etapasCriticas = checklist.itens.filter(i => i.bloqueia_fechamento);
  const etapasCriticasConcluidas = etapasCriticas.filter(
    i => i.status === "concluido" || i.status === "nao_aplicavel"
  );

  // Renderizar status de processamento do arquivo
  const renderArquivoStatus = (arquivo: { processado: boolean; transacoes_importadas: number; resultado_processamento: any }) => {
    if (processingArquivoId === arquivo.resultado_processamento?.arquivoId) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processando...
        </span>
      );
    }
    
    if (arquivo.processado) {
      if (arquivo.transacoes_importadas > 0) {
        return (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            {arquivo.transacoes_importadas} transações importadas
          </span>
        );
      } else {
        const resultado = arquivo.resultado_processamento?.resultado;
        if (resultado?.duplicatas > 0) {
          return (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              {resultado.duplicatas} duplicatas ignoradas
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" />
            Processado (sem novas transações)
          </span>
        );
      }
    }
    
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        Aguardando processamento
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <IconComponent className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{checklist.canal_nome}</h2>
              <p className="text-sm text-muted-foreground">
                {getMesNome(checklist.mes)}/{checklist.ano}
              </p>
            </div>
          </div>
        </div>
        <Badge className={getStatusColor(checklist.status as any)}>
          {getStatusLabel(checklist.status as any)}
        </Badge>
      </div>

      {/* Progress Card */}
      <div className="p-6 rounded-xl bg-card border border-border">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Progresso Geral</h3>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-4xl font-bold">{progresso.percentual}%</span>
              <span className="text-sm text-muted-foreground mb-1">
                {progresso.concluidos}/{progresso.total} etapas obrigatórias
              </span>
            </div>
            <Progress value={progresso.percentual} className="h-3" />
            {etapasCriticas.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Etapas críticas: {etapasCriticasConcluidas.length}/{etapasCriticas.length}
              </p>
            )}
          </div>
          <div className="md:col-span-3 grid grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-success/5 border border-success/20">
              <p className="text-2xl font-bold text-success">{statusSummary.concluido}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-warning/5 border border-warning/20">
              <p className="text-2xl font-bold text-warning">{statusSummary.em_andamento}</p>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-2xl font-bold text-destructive">{statusSummary.pendente}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-secondary border border-border">
              <p className="text-2xl font-bold text-muted-foreground">{statusSummary.nao_aplicavel}</p>
              <p className="text-xs text-muted-foreground">N/A</p>
            </div>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <ModuleCard
        title="Etapas do Checklist"
        description={`${checklist.itens.length} etapas no total`}
        icon={FileText}
        actions={
          <Button onClick={() => { setEtapaParaEditar(null); setShowEtapaModal(true); }} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Etapa
          </Button>
        }
      >
        <div className="space-y-3">
          {checklist.itens.sort((a, b) => a.ordem - b.ordem).map((item) => (
            <Collapsible key={item.id} open={expandedItems.has(item.id)} onOpenChange={() => toggleExpand(item.id)}>
              <div className={`border rounded-lg ${item.status === "concluido" ? "border-success/30 bg-success/5" : "border-border"}`}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                      {item.ordem}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${item.status === "concluido" ? "line-through text-muted-foreground" : ""}`}>
                          {item.nome}
                        </span>
                        {item.obrigatorio ? (
                          <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-secondary">Opcional</Badge>
                        )}
                        {item.exige_upload && (
                          <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">
                            <Upload className="h-3 w-3 mr-1" />Upload
                          </Badge>
                        )}
                        {item.bloqueia_fechamento && (
                          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                            Bloqueia fechamento
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(item.status as any)}>
                      {getStatusLabel(item.status as any)}
                    </Badge>
                    {expandedItems.has(item.id) ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {item.descricao && <p className="text-sm text-muted-foreground">{item.descricao}</p>}
                    
                    {/* Área de upload */}
                    {item.exige_upload && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleUploadClick(item.id)}
                            disabled={uploadingItemId === item.id}
                          >
                            {uploadingItemId === item.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {uploadingItemId === item.id ? "Enviando..." : "Enviar arquivo"}
                          </Button>
                        </div>
                        {/* Lista de arquivos */}
                        {item.arquivos && item.arquivos.length > 0 && (
                          <div className="space-y-2">
                            {item.arquivos.map((arquivo) => (
                              <div key={arquivo.id} className="flex flex-col gap-1 text-sm p-3 bg-secondary/30 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <a 
                                    href={arquivo.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex-1 hover:underline text-primary truncate"
                                  >
                                    {arquivo.nome_arquivo}
                                  </a>
                                  {!arquivo.processado && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleReprocessarArquivo(arquivo)}
                                      disabled={processingArquivoId === arquivo.id}
                                    >
                                      {processingArquivoId === arquivo.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                      )}
                                      Processar
                                    </Button>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveFile(arquivo.id)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {/* Status do processamento */}
                                <div className="ml-6">
                                  {renderArquivoStatus(arquivo)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="em_andamento">Em andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="nao_aplicavel">N/A</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => { setEtapaParaEditar(item); setShowEtapaModal(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => setEtapaParaExcluir(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </ModuleCard>

      {/* Modal de etapa */}
      <EtapaFormModal
        open={showEtapaModal}
        onOpenChange={setShowEtapaModal}
        checklistId={checklist.id}
        etapa={etapaParaEditar}
        onSuccess={onRefresh}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!etapaParaExcluir} onOpenChange={() => setEtapaParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirEtapa}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de alerta de período incompatível */}
      <Dialog open={showPeriodoAlertModal} onOpenChange={setShowPeriodoAlertModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Período Incompatível Detectado
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              {pendingUpload && (
                <>
                  <p>
                    O arquivo <strong>"{pendingUpload.file.name}"</strong> contém transações de{" "}
                    <strong className="text-amber-600">
                      {pendingUpload.validacao.periodoDetectado 
                        ? `${getNomeMes(pendingUpload.validacao.periodoDetectado.mes)}/${pendingUpload.validacao.periodoDetectado.ano}`
                        : "período desconhecido"
                      }
                    </strong>
                    , mas este checklist é de{" "}
                    <strong className="text-primary">
                      {getNomeMes(pendingUpload.validacao.periodoEsperado.mes)}/{pendingUpload.validacao.periodoEsperado.ano}
                    </strong>.
                  </p>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">Isso pode indicar:</p>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-1">
                      <li>Arquivo errado selecionado</li>
                      <li>Upload no checklist de período incorreto</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deseja continuar mesmo assim? As transações serão importadas com as datas originais do arquivo.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelUpload}>
              Cancelar
            </Button>
            <Button variant="default" onClick={handleConfirmUploadWithInvalidPeriod} className="bg-amber-600 hover:bg-amber-700">
              Continuar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de conferência de importação */}
      <ConferenciaImportacaoModal
        open={showConferenciaModal}
        onOpenChange={setShowConferenciaModal}
        data={conferenciaData}
      />

      {/* Input de arquivo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".csv,.xlsx,.xls,.pdf,.xml,.txt"
      />
    </div>
  );
}
