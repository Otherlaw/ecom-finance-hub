/**
 * Modal para mapear SKUs de vendas marketplace a produtos internos
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  AlertTriangle, 
  Check, 
  ChevronsUpDown, 
  Link2, 
  Package, 
  Plus, 
  Search,
  ShoppingCart 
} from "lucide-react";
import { toast } from "sonner";
import { SkuPendenteVenda, useVendasPendentes } from "@/hooks/useVendasPendentes";
import { Produto, useProdutos } from "@/hooks/useProdutos";
import { ProdutoFormModalV2, DadosIniciaisProduto } from "@/components/products/ProdutoFormModalV2";

// Formatação local para evitar dependência circular
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface VendasProductMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
}

export function VendasProductMappingModal({
  open,
  onOpenChange,
  empresaId,
}: VendasProductMappingModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSku, setSelectedSku] = useState<SkuPendenteVenda | null>(null);
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const [showProductForm, setShowProductForm] = useState(false);
  const [dadosIniciaisProduto, setDadosIniciaisProduto] = useState<DadosIniciaisProduto | null>(null);

  const { skusPendentes, resumo, mapearSkuParaProduto, isLoading: loadingSkus } = useVendasPendentes({ empresaId });
  const { produtos, isLoading: loadingProdutos } = useProdutos({ empresaId, status: "ativo", apenasRaiz: false });

  // Filtrar SKUs por termo de busca
  const skusFiltrados = skusPendentes.filter((sku) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      sku.sku_marketplace?.toLowerCase().includes(term) ||
      sku.descricao_item?.toLowerCase().includes(term)
    );
  });

  const handleSelectProduct = async (sku: SkuPendenteVenda, produto: Produto) => {
    await mapearSkuParaProduto.mutateAsync({
      empresaId,
      produtoId: produto.id,
      canal: sku.canal,
      skuMarketplace: sku.sku_marketplace,
      nomeAnuncio: sku.descricao_item || undefined,
    });

    setOpenPopovers((prev) => ({ ...prev, [sku.sku_marketplace]: false }));
  };

  // Função auxiliar para encontrar produto existente com mesmo SKU
  const findProdutoComMesmoSku = (skuMarketplace: string): Produto | undefined => {
    return produtos.find(
      p => p.sku?.toLowerCase() === skuMarketplace?.toLowerCase()
    );
  };

  const handleCreateProduct = (sku: SkuPendenteVenda) => {
    // Verificar se já existe produto com mesmo SKU
    const produtoExistente = findProdutoComMesmoSku(sku.sku_marketplace);
    
    if (produtoExistente) {
      // Produto já existe! Perguntar se deseja vincular
      toast.info(
        `Produto "${produtoExistente.nome}" já existe com SKU ${sku.sku_marketplace}.`,
        {
          action: {
            label: "Vincular agora",
            onClick: () => handleSelectProduct(sku, produtoExistente),
          },
          duration: 8000,
        }
      );
      return;
    }
    
    // Se não existir, abrir modal de criação normalmente
    setSelectedSku(sku);
    setDadosIniciaisProduto({
      sku: sku.sku_marketplace,
      nome: sku.descricao_item || sku.sku_marketplace,
      preco_venda: sku.qtd_vendas > 0 ? sku.valor_total_vendido / sku.qtd_vendas : 0,
    });
    setShowProductForm(true);
  };

  const handleProductCreated = async (novoProduto?: Produto) => {
    if (selectedSku && novoProduto) {
      await mapearSkuParaProduto.mutateAsync({
        empresaId,
        produtoId: novoProduto.id,
        canal: selectedSku.canal,
        skuMarketplace: selectedSku.sku_marketplace,
        nomeAnuncio: selectedSku.descricao_item || undefined,
      });
    }
    setShowProductForm(false);
    setSelectedSku(null);
    setDadosIniciaisProduto(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Mapear Produtos de Vendas
            </DialogTitle>
            <DialogDescription>
              Vincule SKUs do marketplace aos produtos do seu catálogo para calcular CMV e margem.
            </DialogDescription>
          </DialogHeader>

          {/* Resumo */}
          <div className="flex gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm">
                <strong>{resumo.totalSkusPendentes}</strong> SKUs pendentes
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {resumo.totalVendasAfetadas} vendas • {formatCurrency(resumo.valorTotalAfetado)}
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por SKU ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista de SKUs */}
          <ScrollArea className="h-[400px] pr-4">
            {loadingSkus ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Package className="h-8 w-8 animate-pulse" />
                  <p className="text-sm">Carregando SKUs pendentes...</p>
                </div>
              </div>
            ) : skusFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum SKU pendente de mapeamento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {skusFiltrados.map((sku) => (
                  <div
                    key={`${sku.sku_marketplace}-${sku.canal}`}
                    className="p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Info do SKU */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                            {sku.sku_marketplace}
                          </code>
                          <Badge variant="outline" className="text-xs">
                            {sku.canal}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {sku.descricao_item || "Sem descrição"}
                        </p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {sku.qtd_vendas} vendas
                          </span>
                          <span>{formatCurrency(sku.valor_total_vendido)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Ações - Sempre visíveis */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {/* Popover para selecionar produto */}
                      <Popover
                        open={openPopovers[sku.sku_marketplace]}
                        onOpenChange={(open) =>
                          setOpenPopovers((prev) => ({
                            ...prev,
                            [sku.sku_marketplace]: open,
                          }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button variant="default" size="sm" className="gap-1">
                            <Link2 className="h-4 w-4" />
                            Vincular a produto existente
                            <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar produto..." />
                            <CommandList>
                              {loadingProdutos ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  Carregando produtos...
                                </div>
                              ) : produtos.length === 0 ? (
                                <CommandEmpty>
                                  Nenhum produto cadastrado. Clique em "Criar" para adicionar um novo.
                                </CommandEmpty>
                              ) : (
                                <>
                                  <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                                  <CommandGroup heading={`Produtos (${produtos.length})`}>
                                    {produtos.map((produto) => (
                                      <CommandItem
                                        key={produto.id}
                                        value={`${produto.sku} ${produto.nome}`}
                                        onSelect={() => handleSelectProduct(sku, produto)}
                                      >
                                        <Check className="mr-2 h-4 w-4 opacity-0" />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{produto.nome}</span>
                                          <span className="text-xs text-muted-foreground">
                                            SKU: {produto.sku} • Custo: {formatCurrency(produto.custo_medio || 0)}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {/* Botão criar produto - Mostrar texto diferente se já existir produto com mesmo SKU */}
                      {(() => {
                        const produtoExistente = findProdutoComMesmoSku(sku.sku_marketplace);
                        return produtoExistente ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSelectProduct(sku, produtoExistente)}
                            className="gap-1"
                          >
                            <Link2 className="h-4 w-4" />
                            Vincular ao existente ({produtoExistente.sku})
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateProduct(sku)}
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Criar novo produto
                          </Button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de criação de produto */}
      {showProductForm && dadosIniciaisProduto && (
        <ProdutoFormModalV2
          open={showProductForm}
          onOpenChange={setShowProductForm}
          empresaId={empresaId}
          produto={null}
          dadosIniciais={dadosIniciaisProduto}
          onSuccess={handleProductCreated}
        />
      )}
    </>
  );
}
