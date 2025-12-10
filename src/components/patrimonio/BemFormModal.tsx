import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PatrimonioBem, PatrimonioBemInsert, TIPO_BEM_LABELS, GRUPO_BALANCO_OPTIONS } from "@/hooks/usePatrimonio";

interface BemFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  bem?: PatrimonioBem | null;
  onSubmit: (data: PatrimonioBemInsert | (Partial<PatrimonioBem> & { id: string })) => void;
  isLoading?: boolean;
}

export function BemFormModal({ open, onOpenChange, empresaId, bem, onSubmit, isLoading }: BemFormModalProps) {
  const [tipo, setTipo] = useState<PatrimonioBem["tipo"]>("imobilizado");
  const [grupoBalanco, setGrupoBalanco] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataAquisicao, setDataAquisicao] = useState("");
  const [valorAquisicao, setValorAquisicao] = useState("");
  const [vidaUtilMeses, setVidaUtilMeses] = useState("");
  const [depreciacaoAcumulada, setDepreciacaoAcumulada] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (bem) {
      setTipo(bem.tipo);
      setGrupoBalanco(bem.grupo_balanco);
      setDescricao(bem.descricao);
      setDataAquisicao(bem.data_aquisicao);
      setValorAquisicao(bem.valor_aquisicao.toString());
      setVidaUtilMeses(bem.vida_util_meses?.toString() || "");
      setDepreciacaoAcumulada(bem.depreciacao_acumulada?.toString() || "0");
      setObservacoes(bem.observacoes || "");
    } else {
      setTipo("imobilizado");
      setGrupoBalanco("");
      setDescricao("");
      setDataAquisicao("");
      setValorAquisicao("");
      setVidaUtilMeses("");
      setDepreciacaoAcumulada("0");
      setObservacoes("");
    }
  }, [bem, open]);

  // Atualiza grupo quando tipo muda
  useEffect(() => {
    if (!bem) {
      setGrupoBalanco(GRUPO_BALANCO_OPTIONS[tipo][0] || "");
    }
  }, [tipo, bem]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      empresa_id: empresaId,
      tipo,
      grupo_balanco: grupoBalanco,
      descricao,
      data_aquisicao: dataAquisicao,
      valor_aquisicao: parseFloat(valorAquisicao) || 0,
      vida_util_meses: vidaUtilMeses ? parseInt(vidaUtilMeses) : undefined,
      depreciacao_acumulada: parseFloat(depreciacaoAcumulada) || 0,
      observacoes: observacoes || undefined,
    };

    if (bem) {
      onSubmit({ id: bem.id, ...data });
    } else {
      onSubmit(data as PatrimonioBemInsert);
    }
  };

  const valorContabil = (parseFloat(valorAquisicao) || 0) - (parseFloat(depreciacaoAcumulada) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{bem ? "Editar Bem" : "Novo Bem Patrimonial"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as PatrimonioBem["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_BEM_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grupo do Balanço *</Label>
              <Select value={grupoBalanco} onValueChange={setGrupoBalanco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {GRUPO_BALANCO_OPTIONS[tipo].map((grupo) => (
                    <SelectItem key={grupo} value={grupo}>
                      {grupo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Computador Dell, Veículo Fiat Strada..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Aquisição *</Label>
              <Input
                type="date"
                value={dataAquisicao}
                onChange={(e) => setDataAquisicao(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Valor de Aquisição (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={valorAquisicao}
                onChange={(e) => setValorAquisicao(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vida Útil (meses)</Label>
              <Input
                type="number"
                min="0"
                value={vidaUtilMeses}
                onChange={(e) => setVidaUtilMeses(e.target.value)}
                placeholder="Ex: 60"
              />
            </div>

            <div className="space-y-2">
              <Label>Depreciação Acumulada (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={depreciacaoAcumulada}
                onChange={(e) => setDepreciacaoAcumulada(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {valorAquisicao && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Valor contábil atual:{" "}
                <span className="font-semibold text-foreground">
                  {valorContabil.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : bem ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
