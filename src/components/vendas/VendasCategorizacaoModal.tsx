import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { registrarMovimentoFinanceiro } from "@/lib/movimentos-financeiros";

interface VendasCategorizacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: any;
  empresaId: string;
  onSuccess: () => void;
}

export function VendasCategorizacaoModal({
  open,
  onOpenChange,
  venda,
  empresaId,
  onSuccess,
}: VendasCategorizacaoModalProps) {
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { categorias } = useCategoriasFinanceiras();
  const { centrosCusto } = useCentrosCusto();

  // Filtrar apenas categorias de receita
  const categoriasReceita = categorias?.filter(c => c.tipo === "receita" && c.ativo) || [];
  const centrosAtivos = centrosCusto?.filter(c => c.ativo) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleConciliar = async () => {
    if (!categoriaId) {
      toast.error("Selecione uma categoria financeira");
      return;
    }

    setIsLoading(true);

    try {
      // Buscar nomes da categoria e centro de custo
      const categoriaSelecionada = categoriasReceita.find(c => c.id === categoriaId);
      const centroSelecionado = centrosAtivos.find(c => c.id === centroCustoId);

      // Atualizar a transação no marketplace_transactions
      const { error: updateError } = await supabase
        .from("marketplace_transactions")
        .update({
          categoria_id: categoriaId,
          centro_custo_id: centroCustoId || null,
          status: "conciliado",
        })
        .eq("id", venda.transacao_id);

      if (updateError) throw updateError;

      // Registrar movimento financeiro no MEU
      await registrarMovimentoFinanceiro({
        data: venda.data_venda,
        tipo: "entrada",
        origem: "marketplace",
        descricao: venda.descricao || `Venda ${venda.canal} - ${venda.pedido_id}`,
        valor: venda.valor_liquido,
        empresaId,
        referenciaId: venda.transacao_id,
        categoriaId,
        categoriaNome: categoriaSelecionada?.nome,
        centroCustoId: centroCustoId || undefined,
        centroCustoNome: centroSelecionado?.nome,
      });

      toast.success("Venda conciliada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error("Erro ao conciliar:", error);
      toast.error("Erro ao conciliar venda");
    } finally {
      setIsLoading(false);
    }
  };

  if (!venda) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Conciliar Venda
          </DialogTitle>
          <DialogDescription>
            Categorize a venda antes de conciliar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo da venda */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pedido:</span>
              <span className="font-medium">{venda.pedido_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Canal:</span>
              <span className="font-medium">{venda.canal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">
                {new Date(venda.data_venda).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor Bruto:</span>
              <span className="font-medium">{formatCurrency(venda.valor_bruto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxas:</span>
              <span className="font-medium text-destructive">
                -{formatCurrency(venda.taxas + venda.tarifas)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground font-semibold">Valor Líquido:</span>
              <span className="font-bold text-primary">{formatCurrency(venda.valor_liquido)}</span>
            </div>
          </div>

          {/* Categoria Financeira */}
          <div className="space-y-2">
            <Label>Categoria Financeira *</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasReceita.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Centro de Custo */}
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select value={centroCustoId || "__none__"} onValueChange={(v) => setCentroCustoId(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um centro de custo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {centrosAtivos.map((centro) => (
                  <SelectItem key={centro.id} value={centro.id}>
                    {centro.codigo ? `${centro.codigo} - ` : ""}{centro.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConciliar} disabled={isLoading || !categoriaId}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conciliando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Conciliar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
