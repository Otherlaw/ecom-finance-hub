import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { criarOuAtualizarMovimentoManual, excluirMovimentoManual } from "@/lib/movimentos-manuais";
import { toast } from "sonner";
import { PenLine, Trash2, Save, Loader2 } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { MovimentoManualPayload } from "@/lib/movimentos-manuais";

type MovimentacaoManualModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimento?: any | null;
  onSuccess?: () => void;
};

const FORMAS_PAGAMENTO = [
  { value: "manual", label: "Manual" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "outros", label: "Outros" },
];

export function MovimentacaoManualModal({
  open,
  onOpenChange,
  movimento,
  onSuccess,
}: MovimentacaoManualModalProps) {
  const queryClient = useQueryClient();
  const { empresas } = useEmpresas();
  const { categorias } = useCategoriasFinanceiras();
  const { centrosCusto } = useCentrosCusto();
  const { responsaveis } = useResponsaveis();

  // Form state
  const [empresaId, setEmpresaId] = useState<string>("");
  const [data, setData] = useState<string>("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("none");
  const [responsavelId, setResponsavelId] = useState<string>("none");
  const [formaPagamento, setFormaPagamento] = useState<string>("manual");
  const [observacoes, setObservacoes] = useState<string>("");

  const isEditing = !!movimento;

  // Populate form when editing
  useEffect(() => {
    if (movimento) {
      setEmpresaId(movimento.empresaId || movimento.empresa_id || "");
      setData(movimento.data || "");
      setTipo(movimento.tipo || "saida");
      setValor(String(movimento.valor || ""));
      setDescricao(movimento.descricao || "");
      setCategoriaId(movimento.categoriaId || movimento.categoria_id || "");
      setCentroCustoId(movimento.centroCustoId || movimento.centro_custo_id || "none");
      setResponsavelId(movimento.responsavelId || movimento.responsavel_id || "none");
      setFormaPagamento(movimento.formaPagamento || movimento.forma_pagamento || "manual");
      setObservacoes(movimento.observacoes || "");
    } else {
      // Reset form for new movement
      setEmpresaId(empresas?.[0]?.id || "");
      setData(new Date().toISOString().split("T")[0]);
      setTipo("saida");
      setValor("");
      setDescricao("");
      setCategoriaId("");
      setCentroCustoId("none");
      setResponsavelId("none");
      setFormaPagamento("manual");
      setObservacoes("");
    }
  }, [movimento, empresas, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!empresaId || !categoriaId || !data || !valor) {
        throw new Error("Preencha os campos obrigatórios");
      }

      const categoriaSelecionada = categorias?.find((c) => c.id === categoriaId);
      const centroSelecionado = centrosCusto?.find((c) => c.id === centroCustoId && centroCustoId !== "none");

      const payload: MovimentoManualPayload = {
        empresaId,
        data,
        tipo,
        valor: parseFloat(valor),
        descricao: descricao.trim(),
        categoriaId,
        categoriaNome: categoriaSelecionada?.nome,
        centroCustoId: centroCustoId === "none" ? null : centroCustoId,
        centroCustoNome: centroSelecionado?.nome || null,
        responsavelId: responsavelId === "none" ? null : responsavelId,
        formaPagamento,
        observacoes: observacoes.trim() || undefined,
        referenciaId: movimento?.referenciaId || movimento?.referencia_id,
      };

      await criarOuAtualizarMovimentoManual(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success(isEditing ? "Movimentação atualizada!" : "Movimentação criada!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar movimentação:", error);
      toast.error("Erro ao salvar movimentação");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const refId = movimento?.referenciaId || movimento?.referencia_id;
      if (!refId) throw new Error("Não é possível excluir esta movimentação");
      await excluirMovimentoManual(refId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Movimentação excluída!");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao excluir movimentação:", error);
      toast.error("Erro ao excluir movimentação");
    },
  });

  const handleSave = () => {
    if (!empresaId) return toast.error("Selecione uma empresa");
    if (!data) return toast.error("Informe a data");
    if (!valor || parseFloat(valor) <= 0) return toast.error("Informe um valor válido");
    if (!descricao.trim()) return toast.error("Informe uma descrição");
    if (!categoriaId) return toast.error("Selecione uma categoria");
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (!movimento?.referenciaId && !movimento?.referencia_id) {
      return toast.error("Não é possível excluir esta movimentação");
    }
    deleteMutation.mutate();
  };

  // Group categories by type
  const categoriasPorTipo = categorias?.reduce((acc, cat) => {
    if (!cat.ativo) return acc;
    if (!acc[cat.tipo]) acc[cat.tipo] = [];
    acc[cat.tipo].push(cat);
    return acc;
  }, {} as Record<string, typeof categorias>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            {isEditing ? "Editar Movimentação Manual" : "Nova Movimentação Manual"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Empresa */}
          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <RadioGroup
                value={tipo}
                onValueChange={(v) => setTipo(v as "entrada" | "saida")}
                className="flex gap-4 pt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="entrada" id="entrada" />
                  <Label htmlFor="entrada" className="text-emerald-600 cursor-pointer">
                    Entrada
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="saida" id="saida" />
                  <Label htmlFor="saida" className="text-red-600 cursor-pointer">
                    Saída
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Valor e Forma de Pagamento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <SelectItem key={fp.value} value={fp.value}>
                      {fp.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              placeholder="Ex: Ajuste de caixa, Reembolso..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria Financeira *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasPorTipo &&
                  Object.entries(categoriasPorTipo).map(([tipoCategoria, cats]) => (
                    <div key={tipoCategoria}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {tipoCategoria}
                      </div>
                      {cats?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Centro de Custo e Responsável */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {centrosCusto?.filter((c) => c.ativo).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.codigo ? `${cc.codigo} - ` : ""}{cc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {responsaveis?.filter((r) => r.ativo).map((resp) => (
                    <SelectItem key={resp.id} value={resp.id}>
                      {resp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEditing && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || saveMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || deleteMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
