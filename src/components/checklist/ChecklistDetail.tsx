import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ModuleCard } from "@/components/ModuleCard";
import { ChecklistItemComponent } from "./ChecklistItemComponent";
import {
  ChecklistMensal,
  ChecklistStatus,
  ChecklistItemArquivo,
  calcularProgresso,
  getStatusLabel,
  getStatusColor,
  getChecklistStatus,
  getMesNome,
} from "@/lib/checklist-data";
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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistDetailProps {
  checklist: ChecklistMensal;
  onBack: () => void;
  onUpdate: (checklist: ChecklistMensal) => void;
}

const iconMap: Record<string, React.ElementType> = {
  mercado_livre: ShoppingBag,
  shopee: Store,
  shein: Shirt,
  tiktok: Music,
};

export function ChecklistDetail({ checklist, onBack, onUpdate }: ChecklistDetailProps) {
  const [localChecklist, setLocalChecklist] = useState(checklist);
  
  const progresso = calcularProgresso(localChecklist.itens);
  const status = getChecklistStatus(localChecklist.itens);
  const IconComponent = iconMap[localChecklist.canalId] || Store;

  const handleStatusChange = (itemId: string, newStatus: ChecklistStatus) => {
    const updatedItens = localChecklist.itens.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          status: newStatus,
          dataHoraConclusao: newStatus === 'concluido' ? new Date() : undefined,
          responsavel: newStatus === 'concluido' ? 'Admin' : undefined,
        };
      }
      return item;
    });

    const updatedChecklist = {
      ...localChecklist,
      itens: updatedItens,
      atualizadoEm: new Date(),
    };

    setLocalChecklist(updatedChecklist);
    onUpdate(updatedChecklist);

    toast({
      title: "Status atualizado",
      description: `Etapa marcada como "${getStatusLabel(newStatus)}"`,
    });
  };

  const handleObservacoesChange = (itemId: string, observacoes: string) => {
    const updatedItens = localChecklist.itens.map((item) => {
      if (item.id === itemId) {
        return { ...item, observacoes };
      }
      return item;
    });

    const updatedChecklist = {
      ...localChecklist,
      itens: updatedItens,
      atualizadoEm: new Date(),
    };

    setLocalChecklist(updatedChecklist);
    onUpdate(updatedChecklist);
  };

  const handleFileUpload = (itemId: string, file: File) => {
    const novoArquivo: ChecklistItemArquivo = {
      id: `arq_${Date.now()}`,
      checklistItemId: itemId,
      nomeArquivo: file.name,
      url: URL.createObjectURL(file),
      dataUpload: new Date(),
    };

    const updatedItens = localChecklist.itens.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          arquivos: [...item.arquivos, novoArquivo],
        };
      }
      return item;
    });

    const updatedChecklist = {
      ...localChecklist,
      itens: updatedItens,
      atualizadoEm: new Date(),
    };

    setLocalChecklist(updatedChecklist);
    onUpdate(updatedChecklist);

    toast({
      title: "Arquivo anexado",
      description: `"${file.name}" foi adicionado com sucesso.`,
    });
  };

  const handleFileRemove = (itemId: string, arquivoId: string) => {
    const updatedItens = localChecklist.itens.map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          arquivos: item.arquivos.filter((a) => a.id !== arquivoId),
        };
      }
      return item;
    });

    const updatedChecklist = {
      ...localChecklist,
      itens: updatedItens,
      atualizadoEm: new Date(),
    };

    setLocalChecklist(updatedChecklist);
    onUpdate(updatedChecklist);

    toast({
      title: "Arquivo removido",
      description: "O arquivo foi removido com sucesso.",
    });
  };

  const handleExportReport = () => {
    toast({
      title: "Exportando relatório",
      description: "O relatório será gerado em PDF.",
    });
    // Implementar exportação real quando backend estiver disponível
  };

  const getStatusSummary = () => {
    const summary = {
      concluido: localChecklist.itens.filter(i => i.status === 'concluido').length,
      em_andamento: localChecklist.itens.filter(i => i.status === 'em_andamento').length,
      pendente: localChecklist.itens.filter(i => i.status === 'pendente').length,
      nao_aplicavel: localChecklist.itens.filter(i => i.status === 'nao_aplicavel').length,
    };
    return summary;
  };

  const statusSummary = getStatusSummary();

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
              <h2 className="text-xl font-bold">{localChecklist.canalNome}</h2>
              <p className="text-sm text-muted-foreground">
                {localChecklist.empresaNome} • {getMesNome(localChecklist.mes)}/{localChecklist.ano}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(status)}>
            {status === 'concluido' && <Check className="h-4 w-4 mr-1" />}
            {status === 'em_andamento' && <Clock className="h-4 w-4 mr-1" />}
            {status === 'pendente' && <AlertCircle className="h-4 w-4 mr-1" />}
            {getStatusLabel(status)}
          </Badge>
          <Button variant="outline" className="gap-2" onClick={handleExportReport}>
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-6 rounded-xl bg-card border border-border">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Progress */}
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Progresso Geral</h3>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-4xl font-bold">{progresso.percentual}%</span>
              <span className="text-sm text-muted-foreground mb-1">
                {progresso.concluidos}/{progresso.total} etapas obrigatórias
              </span>
            </div>
            <Progress value={progresso.percentual} className="h-3" />
          </div>

          {/* Status Summary */}
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

        {/* Info */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
          <span>Criado em: {format(new Date(localChecklist.criadoEm), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span>Última atualização: {format(new Date(localChecklist.atualizadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        </div>
      </div>

      {/* Checklist Items */}
      <ModuleCard
        title="Etapas do Checklist"
        description={`${localChecklist.itens.length} etapas no total`}
        icon={FileText}
      >
        <div className="space-y-3">
          {localChecklist.itens
            .sort((a, b) => a.ordem - b.ordem)
            .map((item) => (
              <ChecklistItemComponent
                key={item.id}
                item={item}
                onStatusChange={handleStatusChange}
                onObservacoesChange={handleObservacoesChange}
                onFileUpload={handleFileUpload}
                onFileRemove={handleFileRemove}
              />
            ))}
        </div>
      </ModuleCard>
    </div>
  );
}
