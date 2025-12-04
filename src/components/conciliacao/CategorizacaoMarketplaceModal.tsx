import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { useMarketplaceTransactions, MarketplaceTransaction } from "@/hooks/useMarketplaceTransactions";
import { Store, Check, X, RotateCcw, Tag, Building2 } from "lucide-react";
import { toast } from "sonner";

interface CategorizacaoMarketplaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  transaction: MarketplaceTransaction | null;
}

const CANAL_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  tiktok: "TikTok Shop",
  shein: "Shein",
  outro: "Outro",
};

export function CategorizacaoMarketplaceModal({
  open,
  onOpenChange,
  onSuccess,
  transaction,
}: CategorizacaoMarketplaceModalProps) {
  const { categorias } = useCategoriasFinanceiras();
  const { centrosCusto } = useCentrosCusto();
  const { responsaveis } = useResponsaveis();
  const { atualizarTransacao, conciliarTransacao, ignorarTransacao, reabrirTransacao } = useMarketplaceTransactions();

  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");

  useEffect(() => {
    if (transaction) {
      setCategoriaId(transaction.categoria_id || "");
      setCentroCustoId(transaction.centro_custo_id || "");
      setResponsavelId(transaction.responsavel_id || "");
    }
  }, [transaction]);

  if (!transaction) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isLoading = atualizarTransacao.isPending || conciliarTransacao.isPending || ignorarTransacao.isPending || reabrirTransacao.isPending;

  const handleSalvar = async () => {
    await atualizarTransacao.mutateAsync({
      id: transaction.id,
      categoriaId: categoriaId || undefined,
      centroCustoId: centroCustoId || undefined,
      responsavelId: responsavelId || undefined,
    });
    onSuccess?.();
    onOpenChange(false);
  };

  const handleConciliar = async () => {
    if (!categoriaId) {
      toast.error("Selecione uma categoria antes de conciliar.");
      return;
    }
    // Salvar categoria primeiro se mudou
    if (
      categoriaId !== transaction.categoria_id ||
      centroCustoId !== transaction.centro_custo_id ||
      responsavelId !== transaction.responsavel_id
    ) {
      await atualizarTransacao.mutateAsync({
        id: transaction.id,
        categoriaId: categoriaId || undefined,
        centroCustoId: centroCustoId || undefined,
        responsavelId: responsavelId || undefined,
      });
    }
    await conciliarTransacao.mutateAsync(transaction.id);
    onSuccess?.();
    onOpenChange(false);
  };

  const handleIgnorar = async () => {
    await ignorarTransacao.mutateAsync(transaction.id);
    onSuccess?.();
    onOpenChange(false);
  };

  const handleReabrir = async () => {
    await reabrirTransacao.mutateAsync(transaction.id);
    onSuccess?.();
    onOpenChange(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      importado: { variant: "outline", label: "Importado" },
      pendente: { variant: "secondary", label: "Pendente" },
      conciliado: { variant: "default", label: "Conciliado" },
      ignorado: { variant: "destructive", label: "Ignorado" },
    };
    const config = variants[status] || variants.importado;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const isConciliado = transaction.status === "conciliado";
  const isIgnorado = transaction.status === "ignorado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Categorizar Transação Marketplace
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações da transação */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">
                  {new Date(transaction.data_transacao).toLocaleDateString("pt-BR")}
                </p>
                <p className="font-medium">{transaction.descricao}</p>
                {transaction.pedido_id && (
                  <p className="text-xs text-muted-foreground">
                    Pedido: {transaction.pedido_id}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-bold ${
                    transaction.tipo_lancamento === "credito"
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction.tipo_lancamento === "credito" ? "+" : "-"}
                  {formatCurrency(transaction.valor_liquido)}
                </p>
              </div>
            </div>

            {/* Detalhes financeiros */}
            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
              <div>
                <span className="text-muted-foreground">Canal:</span>{" "}
                <span className="font-medium">{transaction.canal_venda || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Bruto:</span>{" "}
                <span className="font-medium">{formatCurrency(transaction.valor_bruto || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tarifas:</span>{" "}
                <span className="font-medium text-red-600">{formatCurrency(transaction.tarifas || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Taxas:</span>{" "}
                <span className="font-medium text-red-600">{formatCurrency(transaction.taxas || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Outros Desc.:</span>{" "}
                <span className="font-medium text-red-600">{formatCurrency(transaction.outros_descontos || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Líquido:</span>{" "}
                <span className="font-medium text-emerald-600">{formatCurrency(transaction.valor_liquido)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {getStatusBadge(transaction.status)}
              <Badge variant="outline">
                {CANAL_LABELS[transaction.canal] || transaction.canal}
              </Badge>
              <Badge variant="outline">{transaction.tipo_transacao}</Badge>
            </div>
          </div>

          {/* Campos de categorização */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Categoria Financeira
              </Label>
              <Select
                value={categoriaId}
                onValueChange={setCategoriaId}
                disabled={isConciliado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias
                    .filter((c) => c.ativo)
                    .map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        [{categoria.tipo}] {categoria.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Centro de Custo
              </Label>
              <Select
                value={centroCustoId}
                onValueChange={setCentroCustoId}
                disabled={isConciliado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {centrosCusto
                    .filter((c) => c.ativo)
                    .map((centro) => (
                      <SelectItem key={centro.id} value={centro.id}>
                        {centro.codigo ? `[${centro.codigo}] ` : ""}
                        {centro.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={responsavelId}
                onValueChange={setResponsavelId}
                disabled={isConciliado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis
                    .filter((r) => r.ativo)
                    .map((resp) => (
                      <SelectItem key={resp.id} value={resp.id}>
                        {resp.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {(isConciliado || isIgnorado) ? (
            <Button
              variant="outline"
              onClick={handleReabrir}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleIgnorar}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Ignorar
              </Button>
              <Button
                variant="secondary"
                onClick={handleSalvar}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Salvar
              </Button>
              <Button
                onClick={handleConciliar}
                disabled={isLoading || !categoriaId}
                className="w-full sm:w-auto"
              >
                <Check className="h-4 w-4 mr-2" />
                Conciliar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
