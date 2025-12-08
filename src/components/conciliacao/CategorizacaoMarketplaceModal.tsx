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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useResponsaveis } from "@/hooks/useResponsaveis";
import { useMarketplaceTransactions, MarketplaceTransaction } from "@/hooks/useMarketplaceTransactions";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { Store, Check, X, RotateCcw, Tag, Building2, Receipt, Package, Plus, Trash2 } from "lucide-react";
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

const CANAL_OPTIONS = [
  { value: "mercado_livre", label: "Mercado Livre" },
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "tiktok", label: "TikTok Shop" },
  { value: "shein", label: "Shein" },
  { value: "outro", label: "Outro" },
];

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
  const { produtos } = useProdutos();
  const [itens, setItens] = useState<any[]>([]);
  const itensResumo = { totalItens: itens.length, quantidadeTotal: 0, valorTotal: 0, custoEstimado: 0 };

  const [categoriaId, setCategoriaId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  
  // Novos campos editáveis
  const [canalVenda, setCanalVenda] = useState<string>("");
  const [tarifas, setTarifas] = useState<string>("");
  const [taxas, setTaxas] = useState<string>("");
  const [outrosDescontos, setOutrosDescontos] = useState<string>("");

  // Estado para adicionar novo item
  const [novoProdutoId, setNovoProdutoId] = useState<string>("");
  const [novaQuantidade, setNovaQuantidade] = useState<string>("1");
  const [novoPrecoUnitario, setNovoPrecoUnitario] = useState<string>("");

  useEffect(() => {
    if (transaction) {
      setCategoriaId(transaction.categoria_id || "");
      setCentroCustoId(transaction.centro_custo_id || "");
      setResponsavelId(transaction.responsavel_id || "");
      setCanalVenda(transaction.canal_venda || "");
      setTarifas(transaction.tarifas?.toString() || "");
      setTaxas(transaction.taxas?.toString() || "");
      setOutrosDescontos(transaction.outros_descontos?.toString() || "");
    }
  }, [transaction]);

  // Limpar formulário de novo item quando modal fecha
  useEffect(() => {
    if (!open) {
      setNovoProdutoId("");
      setNovaQuantidade("1");
      setNovoPrecoUnitario("");
    }
  }, [open]);

  if (!transaction) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const parseNumber = (value: string): number => {
    if (!value) return 0;
    const str = String(value).trim();
    
    // Rejeitar datas
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str) || /^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
      return 0;
    }
    
    // Remove R$, espaços
    let cleaned = str.replace(/[R$€£¥\s]/gi, "");
    
    // Lógica brasileiro vs americano
    const numPontos = (cleaned.match(/\./g) || []).length;
    const numVirgulas = (cleaned.match(/,/g) || []).length;
    
    if (numPontos > 1) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (numVirgulas === 1 && numPontos === 1) {
      const posVirgula = cleaned.lastIndexOf(",");
      const posPonto = cleaned.lastIndexOf(".");
      if (posVirgula > posPonto) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (numVirgulas === 1) {
      cleaned = cleaned.replace(",", ".");
    }
    
    cleaned = cleaned.replace(/[^\d.\-]/g, "");
    const num = parseFloat(cleaned);
    
    // Rejeitar números absurdos (possível data mal interpretada)
    if (isNaN(num) || Math.abs(num) > 100000000) return 0;
    
    return num;
  };

  const isLoading = atualizarTransacao.isPending || conciliarTransacao.isPending || ignorarTransacao.isPending || reabrirTransacao.isPending;

  const getUpdatePayload = () => ({
    id: transaction.id,
    categoriaId: categoriaId || undefined,
    centroCustoId: centroCustoId || undefined,
    responsavelId: responsavelId || undefined,
    canalVenda: canalVenda || undefined,
    tarifas: parseNumber(tarifas),
    taxas: parseNumber(taxas),
    outrosDescontos: parseNumber(outrosDescontos),
  });

  const handleSalvar = async () => {
    await atualizarTransacao.mutateAsync(getUpdatePayload());
    onSuccess?.();
    onOpenChange(false);
  };

  const handleConciliar = async () => {
    if (!categoriaId) {
      toast.error("Selecione uma categoria antes de conciliar.");
      return;
    }
    // Salvar categoria e campos primeiro se houve mudanças
    const hasChanges =
      categoriaId !== transaction.categoria_id ||
      centroCustoId !== transaction.centro_custo_id ||
      responsavelId !== transaction.responsavel_id ||
      canalVenda !== (transaction.canal_venda || "") ||
      parseNumber(tarifas) !== (transaction.tarifas || 0) ||
      parseNumber(taxas) !== (transaction.taxas || 0) ||
      parseNumber(outrosDescontos) !== (transaction.outros_descontos || 0);

    if (hasChanges) {
      await atualizarTransacao.mutateAsync(getUpdatePayload());
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

  const handleAdicionarItem = async () => {
    if (!novoProdutoId || !transaction) {
      toast.error("Selecione um produto");
      return;
    }
    const quantidade = parseFloat(novaQuantidade) || 1;
    const precoUnitario = parseNumber(novoPrecoUnitario) || null;
    const precoTotal = precoUnitario ? precoUnitario * quantidade : null;

    await adicionarItem.mutateAsync({
      transaction_id: transaction.id,
      produto_id: novoProdutoId,
      quantidade,
      preco_unitario: precoUnitario,
      preco_total: precoTotal,
    });

    // Limpar formulário
    setNovoProdutoId("");
    setNovaQuantidade("1");
    setNovoPrecoUnitario("");
  };

  const handleRemoverItem = async (itemId: string) => {
    await removerItem.mutateAsync(itemId);
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
  const isReadOnly = isConciliado || isIgnorado;

  // Cálculo do total de descontos
  const totalDescontos = parseNumber(tarifas) + parseNumber(taxas) + parseNumber(outrosDescontos);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Resumo financeiro */}
            <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
              <div>
                <span className="text-muted-foreground">Bruto:</span>{" "}
                <span className="font-medium">{formatCurrency(transaction.valor_bruto || 0)}</span>
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

          {/* Campos de tarifas editáveis */}
          <div className="space-y-4 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <Receipt className="h-4 w-4" />
              Tarifas e Descontos
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Canal de Venda</Label>
                <Select
                  value={canalVenda}
                  onValueChange={setCanalVenda}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tarifas (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={tarifas}
                  onChange={(e) => setTarifas(e.target.value)}
                  disabled={isReadOnly}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Taxas (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={taxas}
                  onChange={(e) => setTaxas(e.target.value)}
                  disabled={isReadOnly}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Outros Descontos (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={outrosDescontos}
                  onChange={(e) => setOutrosDescontos(e.target.value)}
                  disabled={isReadOnly}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
              <span className="text-sm text-muted-foreground">Total de Descontos:</span>
              <span className="font-medium text-destructive">{formatCurrency(totalDescontos)}</span>
            </div>
          </div>

          {/* Seção de Itens/Produtos (para controle de estoque e CMV) */}
          <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Package className="h-4 w-4" />
                Itens Vendidos (Estoque/CMV)
              </div>
              {itensResumo.totalItens > 0 && (
                <Badge variant="secondary">
                  {itensResumo.totalItens} {itensResumo.totalItens === 1 ? "item" : "itens"}
                </Badge>
              )}
            </div>

            {/* Lista de itens existentes */}
            {itens.length > 0 && (
              <div className="space-y-2">
                {itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-background rounded border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.produto?.nome || item.sku?.codigo_sku || item.sku_marketplace || "Produto não vinculado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {item.quantidade}
                        {item.preco_unitario && ` × ${formatCurrency(item.preco_unitario)}`}
                        {item.preco_total && ` = ${formatCurrency(item.preco_total)}`}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoverItem(item.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Resumo de CMV estimado */}
                {itensResumo.custoEstimado > 0 && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    CMV Estimado: {formatCurrency(itensResumo.custoEstimado)}
                  </div>
                )}
              </div>
            )}

            {/* Formulário para adicionar item */}
            {!isReadOnly && (
              <div className="space-y-2 pt-2 border-t border-primary/20">
                <Label className="text-xs">Adicionar Produto</Label>
                <div className="flex gap-2">
                  <Select
                    value={novoProdutoId}
                    onValueChange={setNovoProdutoId}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Selecione produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos
                        .filter((p) => p.status === "ativo")
                        .map((produto) => (
                          <SelectItem key={produto.id} value={produto.id}>
                            [{produto.sku}] {produto.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Qtd"
                    value={novaQuantidade}
                    onChange={(e) => setNovaQuantidade(e.target.value)}
                    className="w-16 h-9"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Preço"
                    value={novoPrecoUnitario}
                    onChange={(e) => setNovoPrecoUnitario(e.target.value)}
                    className="w-24 h-9"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleAdicionarItem}
                    disabled={isLoading || !novoProdutoId}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vincule produtos para baixa automática de estoque e cálculo de CMV ao conciliar.
                </p>
              </div>
            )}

            {itens.length === 0 && isReadOnly && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum produto vinculado a esta transação
              </p>
            )}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
