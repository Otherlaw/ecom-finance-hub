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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, ArrowUpDown } from "lucide-react";
import { useProdutos } from "@/hooks/useProdutos";
import { useArmazens } from "@/hooks/useArmazens";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useEstoque } from "@/hooks/useEstoque";

interface AjusteEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MOTIVOS_AJUSTE = [
  "Inventário físico",
  "Correção de erro",
  "Perda/Avaria",
  "Entrada manual",
  "Doação",
  "Consumo interno",
  "Outro",
];

export function AjusteEstoqueModal({
  open,
  onOpenChange,
  onSuccess,
}: AjusteEstoqueModalProps) {
  const { empresas = [] } = useEmpresas();
  const { produtos = [] } = useProdutos();
  const { armazens = [] } = useArmazens();
  const { estoques, ajustarEstoque } = useEstoque();

  const [empresaId, setEmpresaId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [armazemId, setArmazemId] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Buscar estoque atual do produto/armazém selecionado
  const estoqueAtual = estoques.find(
    (e) => e.produto_id === produtoId && e.armazem_id === armazemId
  );
  const quantidadeAtual = estoqueAtual?.quantidade || 0;

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setEmpresaId(empresas[0]?.id || "");
      setProdutoId("");
      setArmazemId("");
      setNovaQuantidade("");
      setMotivo("");
      setObservacoes("");
    }
  }, [open, empresas]);

  const handleSubmit = async () => {
    if (!empresaId || !produtoId || !armazemId || !novaQuantidade || !motivo) {
      return;
    }

    await ajustarEstoque.mutateAsync({
      empresaId,
      produtoId,
      armazemId,
      novaQuantidade: Number(novaQuantidade),
      motivo,
      observacoes: observacoes || undefined,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  const isValid =
    empresaId && produtoId && armazemId && novaQuantidade !== "" && motivo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Ajustar Estoque
          </DialogTitle>
          <DialogDescription>
            Faça ajustes manuais na quantidade em estoque de um produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Empresa */}
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa *</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label htmlFor="produto">Produto *</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {produtos.map((prod) => (
                  <SelectItem key={prod.id} value={prod.id}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {prod.sku}
                    </span>
                    {prod.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Armazém */}
          <div className="space-y-2">
            <Label htmlFor="armazem">Armazém *</Label>
            <Select value={armazemId} onValueChange={setArmazemId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o armazém" />
              </SelectTrigger>
              <SelectContent>
                {armazens.map((arm) => (
                  <SelectItem key={arm.id} value={arm.id}>
                    {arm.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade Atual e Nova */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade Atual</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">{quantidadeAtual}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="novaQuantidade">Nova Quantidade *</Label>
              <Input
                id="novaQuantidade"
                type="number"
                min="0"
                step="1"
                value={novaQuantidade}
                onChange={(e) => setNovaQuantidade(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Diferença */}
          {novaQuantidade !== "" && (
            <div className="p-3 rounded-lg bg-secondary/50">
              <span className="text-sm text-muted-foreground">Diferença: </span>
              <span
                className={`font-medium ${
                  Number(novaQuantidade) - quantidadeAtual > 0
                    ? "text-green-600"
                    : Number(novaQuantidade) - quantidadeAtual < 0
                    ? "text-red-600"
                    : ""
                }`}
              >
                {Number(novaQuantidade) - quantidadeAtual > 0 ? "+" : ""}
                {Number(novaQuantidade) - quantidadeAtual}
              </span>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do Ajuste *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_AJUSTE.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais sobre o ajuste..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || ajustarEstoque.isPending}
          >
            {ajustarEstoque.isPending ? "Salvando..." : "Confirmar Ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
