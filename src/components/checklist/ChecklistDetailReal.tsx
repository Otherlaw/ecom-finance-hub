import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModuleCard } from "@/components/ModuleCard";
import { EtapaFormModal } from "./EtapaFormModal";
import { ProcessarRelatorioModal } from "./ProcessarRelatorioModal";
import { CompletudeMesCard } from "./CompletudeMesCard";
import { ChecklistCanalComItens, ChecklistCanalItem, useChecklistsCanal, calcularProgressoChecklist, getStatusLabel, getStatusColor } from "@/hooks/useChecklistsCanal";
import { getMesNome } from "@/lib/checklist-data";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Download,
  FileText,
  Check,
  Clock,
  AlertCircle,
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
  Save,
  X,
  Loader2,
  File,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

export function ChecklistDetailReal({ checklist, onBack, onRefresh }: ChecklistDetailRealProps) {
  const [showEtapaModal, setShowEtapaModal] = useState(false);
  const [etapaParaEditar, setEtapaParaEditar] = useState<ChecklistCanalItem | null>(null);
  const [etapaParaExcluir, setEtapaParaExcluir] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadItemId, setCurrentUploadItemId] = useState<string | null>(null);
  
  // Modal de processamento de relatório
  const [arquivoParaProcessar, setArquivoParaProcessar] = useState<{
    url: string;
    nome: string;
  } | null>(null);
  const { atualizarEtapa, excluirEtapa, adicionarArquivo, removerArquivo } = useChecklistsCanal();

  const handleUploadClick = (itemId: string) => {
    setCurrentUploadItemId(itemId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadItemId) return;

    setUploadingItemId(currentUploadItemId);

    try {
      // Upload para Storage
      const fileName = `checklist/${currentUploadItemId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Gerar URL pública
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      // Registrar arquivo no banco
      await adicionarArquivo.mutateAsync({
        checklistItemId: currentUploadItemId,
        nomeArquivo: file.name,
        url: urlData.publicUrl,
        tamanhoBytes: file.size,
        tipoMime: file.type,
      });

      onRefresh();
      toast({ title: "Arquivo enviado com sucesso" });
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast({ title: "Erro ao enviar arquivo", description: error.message, variant: "destructive" });
    } finally {
      setUploadingItemId(null);
      setCurrentUploadItemId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
                          <div className="space-y-1">
                            {item.arquivos.map((arquivo) => (
                              <div key={arquivo.id} className="flex items-center gap-2 text-sm p-2 bg-secondary/30 rounded">
                                <File className="h-4 w-4 text-muted-foreground" />
                                <a 
                                  href={arquivo.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex-1 hover:underline text-primary truncate"
                                >
                                  {arquivo.nome_arquivo}
                                </a>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveFile(arquivo.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
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
