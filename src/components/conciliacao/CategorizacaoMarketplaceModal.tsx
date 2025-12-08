import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  Plus,
  Package,
  DollarSign,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useMarketplaceTransactions, MarketplaceTransaction } from "@/hooks/useMarketplaceTransactions";
import { useProdutos } from "@/hooks/useProdutos";

interface CategorizacaoMarketplaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MarketplaceTransaction;
  onSuccess?: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CategorizacaoMarketplaceModal({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: CategorizacaoMarketplaceModalProps) {
  const { categorias } = useCategoriasFinanceiras();
  const { centrosCusto } = useCentrosCusto();
  const { atualizarTransacao, conciliarTransacao, ignorarTransacao, reabrirTransacao } = useMarketplaceTransactions();
  const { produtos } = useProdutos({ empresaId: transaction.empresa_id });

  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [canalVenda, setCanalVenda] = useState<string>("");
  
  const [tarifas, setTarifas] = useState<string>("0");
  const [taxas, setTaxas] = useState<string>("0");
  const [outrosDescontos, setOutrosDescontos] = useState<string>("0");

  const [novoProdutoId, setNovoProdutoId] = useState<string>("");
  const [novaQuantidade, setNovaQuantidade] = useState<string>("1");
  const [novoPrecoUnitario, setNovoPrecoUnitario] = useState<string>("");

  useEffect(() => {
    if (transaction && open) {
      setCategoriaId(transaction.categoria_id || "");
      setCentroCustoId(transaction.centro_custo_id || "");
      setCanalVenda(transaction.canal_venda || "");
      setTarifas(String(transaction.tarifas || 0));
      setTaxas(String(transaction.taxas || 0));
      setOutrosDescontos(String(transaction.outros_descontos || 0));
    }
  }, [transaction, open]);

  const categoriasAtivas = useMemo(
    () => categorias.filter((c) => c.ativo),
    [categorias]
  );

  const centrosCustoAtivos = useMemo(
    () => centrosCusto.filter((c) => c.ativo),
    [centrosCusto]
  );

  const totalDescontos = useMemo(() => {
    return (
      (parseFloat(tarifas) || 0) +
      (parseFloat(taxas) || 0) +
      (parseFloat(outrosDescontos) || 0)
    );
  }, [tarifas, taxas, outrosDescontos]);

  const parseNumber = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.replace(/[^\d.,\-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const isLoading = atualizarTransacao.isPending || conciliarTransacao.isPending || ignorarTransacao.isPending || reabrirTransacao.isPending;

  const getUpdatePayload = () => ({
    id: transaction.id,
    categoriaId: categoriaId || undefined,
    centroCustoId: centroCustoId || undefined,
    canalVenda: canalVenda || undefined,
    tarifas: parseNumber(tarifas),
    taxas: parseNumber(taxas),
    outrosDescontos: parseNumber(outrosDescontos),
  });

  const handleSalvar = async () => {
    try {
      await atualizarTransacao.mutateAsync(getUpdatePayload());
      toast.success("Transação atualizada");
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  const handleConciliar = async () => {
    try {
      await atualizarTransacao.mutateAsync(getUpdatePayload());
      await conciliarTransacao.mutateAsync(transaction.id);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao conciliar:", error);
    }
  };

  const handleIgnorar = async () => {
    try {
      await ignorarTransacao.mutateAsync(transaction.id);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao ignorar:", error);
    }
  };

  const handleReabrir = async () => {
    try {
      await reabrirTransacao.mutateAsync(transaction.id);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao reabrir:", error);
    }
  };

  const handleAdicionarItem = async () => {
    if (!novoProdutoId || !transaction) {
      toast.error("Selecione um produto");
      return;
    }
    // Feature de itens será implementada posteriormente
    toast.info("Funcionalidade de itens será implementada em breve");
    setNovoProdutoId("");
    setNovaQuantidade("1");
    setNovoPrecoUnitario("");
  };

  const handleRemoverItem = async (itemId: string) => {
    // Feature de itens será implementada posteriormente
    toast.info("Funcionalidade de itens será implementada em breve");
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Categorizar Transação Marketplace
          </DialogTitle>
          <DialogDescription>
            Pedido: {transaction.pedido_id || "N/A"} | {getStatusBadge(transaction.status)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Data</Label>
                <p className="font-medium">{transaction.data_transacao}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Canal</Label>
                <Badge variant="outline">{transaction.canal}</Badge>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <p className="text-sm">{transaction.descricao}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Badge variant={transaction.tipo_lancamento === "credito" ? "default" : "secondary"}>
                  {transaction.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                </Badge>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Líquido</Label>
                <p className={`text-lg font-bold ${transaction.tipo_lancamento === "credito" ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(transaction.valor_liquido)}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Taxas e Descontos
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edite os valores de taxas para refinar a conciliação</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tarifas">Tarifas</Label>
                  <Input
                    id="tarifas"
                    value={tarifas}
                    onChange={(e) => setTarifas(e.target.value)}
                    placeholder="0,00"
                    disabled={isConciliado || isIgnorado}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxas">Taxas</Label>
                  <Input
                    id="taxas"
                    value={taxas}
                    onChange={(e) => setTaxas(e.target.value)}
                    placeholder="0,00"
                    disabled={isConciliado || isIgnorado}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outrosDescontos">Outros Descontos</Label>
                  <Input
                    id="outrosDescontos"
                    value={outrosDescontos}
                    onChange={(e) => setOutrosDescontos(e.target.value)}
                    placeholder="0,00"
                    disabled={isConciliado || isIgnorado}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total de Descontos:</span>
                <span className="font-medium text-destructive">{formatCurrency(totalDescontos)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Categorização</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria Financeira</Label>
                  <Select
                    value={categoriaId}
                    onValueChange={setCategoriaId}
                    disabled={isConciliado || isIgnorado}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {categoriasAtivas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="centroCusto">Centro de Custo</Label>
                  <Select
                    value={centroCustoId}
                    onValueChange={setCentroCustoId}
                    disabled={isConciliado || isIgnorado}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {centrosCustoAtivos.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo ? `${c.codigo} - ` : ""}{c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Itens do Pedido
              </h4>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Nenhum item vinculado a esta transação
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {!isConciliado && !isIgnorado && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Produto</Label>
                    <Select value={novoProdutoId} onValueChange={setNovoProdutoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      value={novaQuantidade}
                      onChange={(e) => setNovaQuantidade(e.target.value)}
                      type="number"
                      min="1"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Preço Unit.</Label>
                    <Input
                      value={novoPrecoUnitario}
                      onChange={(e) => setNovoPrecoUnitario(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <Button size="icon" onClick={handleAdicionarItem} disabled={!novoProdutoId}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          {isConciliado ? (
            <Button variant="outline" onClick={handleReabrir} disabled={isLoading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir
            </Button>
          ) : isIgnorado ? (
            <Button variant="outline" onClick={handleReabrir} disabled={isLoading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar
            </Button>
          ) : (
            <>
              <Button variant="destructive" onClick={handleIgnorar} disabled={isLoading}>
                <XCircle className="h-4 w-4 mr-2" />
                Ignorar
              </Button>
              <Button variant="outline" onClick={handleSalvar} disabled={isLoading}>
                Salvar
              </Button>
              <Button onClick={handleConciliar} disabled={isLoading}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Conciliar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
