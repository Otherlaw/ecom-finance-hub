import { useMemo } from "react";
import { X, Package, ShoppingCart, TrendingUp, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Product,
  ProductSalesHistory,
  ProductPurchaseHistory,
  calculateProductMetrics,
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDate,
  CANAIS_VENDA,
} from "@/lib/products-data";

interface ProductDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  salesHistory: ProductSalesHistory[];
  purchaseHistory: ProductPurchaseHistory[];
}

export function ProductDetailModal({
  open,
  onOpenChange,
  product,
  salesHistory,
  purchaseHistory,
}: ProductDetailModalProps) {
  const productSales = useMemo(() => 
    salesHistory.filter((s) => s.produtoId === product?.id),
    [salesHistory, product?.id]
  );

  const productPurchases = useMemo(() =>
    purchaseHistory.filter((p) => p.produtoId === product?.id),
    [purchaseHistory, product?.id]
  );

  const metrics = useMemo(() => {
    if (!product) return null;
    return calculateProductMetrics(product.id, salesHistory, purchaseHistory);
  }, [product, salesHistory, purchaseHistory]);

  const getChannelName = (channelId: string) => {
    return CANAIS_VENDA.find((c) => c.id === channelId)?.nome || channelId;
  };

  const getChannelColor = (channelId: string) => {
    const channel = CANAIS_VENDA.find((c) => c.id === channelId);
    return channel?.cor || "hsl(var(--muted))";
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {product.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Product Info Header */}
          <div className="flex items-start justify-between gap-4 p-4 bg-secondary/30 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">SKU:</span>
                <span className="font-mono">{product.codigoInterno}</span>
                <Badge variant={product.status === 'ativo' ? 'default' : 'secondary'}>
                  {product.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>NCM: {product.ncm}</span>
                <span>Categoria: {product.categoria}</span>
                {product.subcategoria && <span>/ {product.subcategoria}</span>}
              </div>
              {product.fornecedorPrincipalNome && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Fornecedor: </span>
                  {product.fornecedorPrincipalNome}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Custo Médio</div>
              <div className="text-lg font-bold">{formatCurrency(product.custoMedio)}</div>
              {product.precoVendaSugerido && (
                <>
                  <div className="text-sm text-muted-foreground mt-1">Preço Sugerido</div>
                  <div className="text-base font-medium text-success">
                    {formatCurrency(product.precoVendaSugerido)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ShoppingCart className="h-4 w-4" />
                  Vendas
                </div>
                <div className="mt-1 text-2xl font-bold">{formatNumber(metrics.quantidadeVendida)}</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(metrics.receitaTotal)}</div>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Package className="h-4 w-4" />
                  Compras
                </div>
                <div className="mt-1 text-2xl font-bold">{formatNumber(metrics.quantidadeComprada)}</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(metrics.custoTotal)}</div>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <TrendingUp className="h-4 w-4" />
                  Margem Média
                </div>
                <div className="mt-1 text-2xl font-bold text-success">{formatPercentage(metrics.margemMedia)}</div>
              </div>
              <div className="p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <BarChart3 className="h-4 w-4" />
                  Giro Est.
                </div>
                <div className="mt-1 text-2xl font-bold">{metrics.giroEstimado.toFixed(2)}x</div>
              </div>
            </div>
          )}

          {/* Channel Mappings */}
          {product.canais && product.canais.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Canais de Venda</h4>
              <div className="flex flex-wrap gap-2">
                {product.canais.map((canal) => (
                  <div
                    key={canal.channel}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full text-sm"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getChannelColor(canal.channel) }}
                    />
                    <span className="font-medium">{getChannelName(canal.channel)}</span>
                    <span className="text-muted-foreground">SKU: {canal.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs for History */}
          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger value="sales">Histórico de Vendas ({productSales.length})</TabsTrigger>
              <TabsTrigger value="purchases">Histórico de Compras ({productPurchases.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-4">
              {productSales.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma venda registrada para este produto
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-right">Frete</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{formatDate(sale.dataVenda)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: getChannelColor(sale.canal) }}
                              />
                              {getChannelName(sale.canal)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{sale.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(sale.receitaBruta)}</TableCell>
                          <TableCell className="text-right text-destructive">
                            -{formatCurrency(sale.comissao)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            -{formatCurrency(sale.frete)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(sale.receitaLiquida)}
                          </TableCell>
                          <TableCell className="text-right text-success">
                            {formatPercentage(sale.margem)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="purchases" className="mt-4">
              {productPurchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma compra registrada para este produto
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Vlr Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPurchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>{formatDate(purchase.dataCompra)}</TableCell>
                          <TableCell>{purchase.fornecedor}</TableCell>
                          <TableCell>{purchase.notaFiscal || "-"}</TableCell>
                          <TableCell className="text-right">{purchase.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(purchase.valorUnitario)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(purchase.valorTotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Observations */}
          {product.observacoes && (
            <div className="space-y-2">
              <h4 className="font-medium">Observações</h4>
              <p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg">
                {product.observacoes}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
