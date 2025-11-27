import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChecklistItem, 
  ChecklistStatus, 
  getStatusLabel, 
  getStatusColor 
} from "@/lib/checklist-data";
import {
  Check,
  Clock,
  AlertCircle,
  Minus,
  ChevronDown,
  ChevronRight,
  Upload,
  FileText,
  Download,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistItemComponentProps {
  item: ChecklistItem;
  onStatusChange: (itemId: string, status: ChecklistStatus) => void;
  onObservacoesChange: (itemId: string, observacoes: string) => void;
  onFileUpload: (itemId: string, file: File) => void;
  onFileRemove: (itemId: string, arquivoId: string) => void;
}

const statusOptions: { value: ChecklistStatus; label: string; icon: React.ElementType }[] = [
  { value: 'pendente', label: 'Pendente', icon: AlertCircle },
  { value: 'em_andamento', label: 'Em andamento', icon: Clock },
  { value: 'concluido', label: 'Concluído', icon: Check },
  { value: 'nao_aplicavel', label: 'N/A', icon: Minus },
];

export function ChecklistItemComponent({
  item,
  onStatusChange,
  onObservacoesChange,
  onFileUpload,
  onFileRemove,
}: ChecklistItemComponentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [observacoes, setObservacoes] = useState(item.observacoes || '');
  const [isEditingObs, setIsEditingObs] = useState(false);

  const handleStatusChange = (newStatus: ChecklistStatus) => {
    // Verificar se exige upload e está tentando concluir
    if (newStatus === 'concluido' && item.exigeUpload && item.arquivos.length === 0) {
      toast({
        title: "Upload obrigatório",
        description: "Para concluir esta etapa, é obrigatório anexar o(s) relatório(s) correspondente(s).",
        variant: "destructive",
      });
      return;
    }
    onStatusChange(item.id, newStatus);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(item.id, file);
      e.target.value = '';
    }
  };

  const handleSaveObservacoes = () => {
    onObservacoesChange(item.id, observacoes);
    setIsEditingObs(false);
    toast({
      title: "Observações salvas",
      description: "As observações foram atualizadas com sucesso.",
    });
  };

  const getStatusIcon = (status: ChecklistStatus) => {
    const option = statusOptions.find(o => o.value === status);
    const Icon = option?.icon || AlertCircle;
    return <Icon className="h-4 w-4" />;
  };

  const getTipoEtapaLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'baixar_relatorio': 'Baixar Relatório',
      'conferir_valores': 'Conferir Valores',
      'conciliacao': 'Conciliação',
      'upload_arquivo': 'Upload',
      'validacao': 'Validação',
      'outro': 'Outro',
    };
    return labels[tipo] || tipo;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`border rounded-lg ${item.status === 'concluido' ? 'border-success/30 bg-success/5' : 'border-border'}`}>
        {/* Header */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
            {/* Ordem */}
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
              {item.ordem}
            </div>

            {/* Nome e badges */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${item.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>
                  {item.nome}
                </span>
                {item.obrigatorio && (
                  <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                )}
                {item.exigeUpload && (
                  <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">
                    <Upload className="h-3 w-3 mr-1" />
                    Upload
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {getTipoEtapaLabel(item.tipoEtapa)}
                </Badge>
                {item.dataHoraConclusao && (
                  <span className="text-xs text-muted-foreground">
                    Concluído em {format(new Date(item.dataHoraConclusao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {item.responsavel && ` por ${item.responsavel}`}
                  </span>
                )}
              </div>
            </div>

            {/* Status */}
            <Badge className={getStatusColor(item.status)}>
              {getStatusIcon(item.status)}
              <span className="ml-1">{getStatusLabel(item.status)}</span>
            </Badge>

            {/* Arquivos badge */}
            {item.arquivos.length > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <FileText className="h-3 w-3 mr-1" />
                {item.arquivos.length}
              </Badge>
            )}

            {/* Expand */}
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
            {/* Descrição */}
            {item.descricao && (
              <div>
                <h4 className="text-sm font-medium mb-1">Descrição</h4>
                <p className="text-sm text-muted-foreground">{item.descricao}</p>
              </div>
            )}

            {/* Status Selector */}
            <div>
              <h4 className="text-sm font-medium mb-2">Alterar Status</h4>
              <Select value={item.status} onValueChange={(v) => handleStatusChange(v as ChecklistStatus)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload de Arquivos */}
            <div>
              <h4 className="text-sm font-medium mb-2">
                Arquivos Anexados
                {item.exigeUpload && <span className="text-destructive ml-1">*</span>}
              </h4>
              
              {item.arquivos.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {item.arquivos.map((arquivo) => (
                    <div 
                      key={arquivo.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{arquivo.nomeArquivo}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(arquivo.dataUpload), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onFileRemove(item.id, arquivo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">Nenhum arquivo anexado</p>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  id={`file-${item.id}`}
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Adicionar Arquivo
                </Button>
              </div>
            </div>

            {/* Observações */}
            <div>
              <h4 className="text-sm font-medium mb-2">Observações</h4>
              {isEditingObs ? (
                <div className="space-y-2">
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações sobre esta etapa..."
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveObservacoes} className="gap-1">
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setObservacoes(item.observacoes || '');
                        setIsEditingObs(false);
                      }}
                      className="gap-1"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="p-3 rounded-lg bg-secondary/30 min-h-[60px] cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setIsEditingObs(true)}
                >
                  {item.observacoes ? (
                    <p className="text-sm">{item.observacoes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Clique para adicionar observações...</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
