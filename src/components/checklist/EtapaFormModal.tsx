import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChecklistsCanal, ChecklistCanalItem } from "@/hooks/useChecklistsCanal";
import { Loader2 } from "lucide-react";

interface EtapaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  etapa?: ChecklistCanalItem | null;
  onSuccess?: () => void;
}

const TIPOS_ETAPA = [
  { value: "baixar_relatorio", label: "Baixar Relatório" },
  { value: "upload_arquivo", label: "Upload de Arquivo" },
  { value: "conferir_valores", label: "Conferir Valores" },
  { value: "conciliacao", label: "Conciliação" },
  { value: "validacao", label: "Validação" },
  { value: "outro", label: "Outro" },
];

export function EtapaFormModal({
  open,
  onOpenChange,
  checklistId,
  etapa,
  onSuccess,
}: EtapaFormModalProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoEtapa, setTipoEtapa] = useState("outro");
  const [obrigatorio, setObrigatorio] = useState(true);
  const [exigeUpload, setExigeUpload] = useState(false);

  const { criarEtapa, atualizarEtapa } = useChecklistsCanal();

  const isEditing = !!etapa;

  // Preencher campos ao editar
  useEffect(() => {
    if (etapa) {
      setNome(etapa.nome);
      setDescricao(etapa.descricao || "");
      setTipoEtapa(etapa.tipo_etapa);
      setObrigatorio(etapa.obrigatorio);
      setExigeUpload(etapa.exige_upload);
    } else {
      setNome("");
      setDescricao("");
      setTipoEtapa("outro");
      setObrigatorio(true);
      setExigeUpload(false);
    }
  }, [etapa, open]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;

    try {
      if (isEditing && etapa) {
        await atualizarEtapa.mutateAsync({
          id: etapa.id,
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
          tipoEtapa,
          obrigatorio,
          exigeUpload,
        });
      } else {
        await criarEtapa.mutateAsync({
          checklistId,
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
          tipoEtapa,
          obrigatorio,
          exigeUpload,
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const isPending = criarEtapa.isPending || atualizarEtapa.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere os dados da etapa do checklist."
              : "Adicione uma nova etapa ao checklist de fechamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Etapa *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Baixar relatório de vendas"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes sobre o que deve ser feito nesta etapa..."
              rows={2}
            />
          </div>

          {/* Tipo de Etapa */}
          <div className="space-y-2">
            <Label htmlFor="tipoEtapa">Tipo da Etapa</Label>
            <Select value={tipoEtapa} onValueChange={setTipoEtapa}>
              <SelectTrigger id="tipoEtapa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ETAPA.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="obrigatorio">Obrigatória</Label>
                <p className="text-xs text-muted-foreground">
                  Etapas obrigatórias devem ser concluídas para fechar o período
                </p>
              </div>
              <Switch
                id="obrigatorio"
                checked={obrigatorio}
                onCheckedChange={setObrigatorio}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="exigeUpload">Exige Upload</Label>
                <p className="text-xs text-muted-foreground">
                  Só pode ser concluída após anexar pelo menos um arquivo
                </p>
              </div>
              <Switch
                id="exigeUpload"
                checked={exigeUpload}
                onCheckedChange={setExigeUpload}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Criar Etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
