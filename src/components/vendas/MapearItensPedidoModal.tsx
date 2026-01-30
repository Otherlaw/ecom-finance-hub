/**
 * Modal para mapear itens de um pedido específico
 * Mostra os itens já sincronizados que ainda não têm produto vinculado
 * Permite criar mapeamento com as informações vindas da API
 */

import { useState } from "react";
import { Link2, Package, Check, AlertTriangle, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { useMarketplaceSkuMappings } from "@/hooks/useMarketplaceSkuMappings";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { extractMlDraftItemsFromRawOrder } from "@/lib/marketplace-raw-order";

interface ItemPendente {
  id: string;
  sku_marketplace: string | null;
  anuncio_id: string | null;
  variante_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
  produto_id: string | null;
}

type ItemPendenteComOrigem = ItemPendente & {
  origem: "itens_sincronizados" | "rascunho_raw_order";
};

interface MapearItensPedidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  pedidoId: string;
  canal: string;
  onSuccess?: () => void;
}

export function MapearItensPedidoModal({
  open,
  onOpenChange,
  empresaId,
  pedidoId,
  canal,
  onSuccess,
}: MapearItensPedidoModalProps) {
  const queryClient = useQueryClient();
  const [mapeamentos, setMapeamentos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [popoverAberto, setPopoverAberto] = useState<string | null>(null);

  const { produtos, isLoading: loadingProdutos } = useProdutos({ 
    empresaId, 
    status: "ativo" 
  });
  
  const { criarOuAtualizarMapping } = useMarketplaceSkuMappings({ empresaId });

  // Buscar itens do pedido que precisam de mapeamento
  const { data: itensPendentes = [], isLoading: loadingItens } = useQuery({
    queryKey: ["itens-pendentes-mapeamento", pedidoId, empresaId],
    queryFn: async () => {
      // Primeiro buscar a transaction_id
      const { data: txData, error: txError } = await supabase
        .from("marketplace_transactions")
        .select("id, raw_order")
        .eq("pedido_id", pedidoId)
        .eq("empresa_id", empresaId)
        .eq("tipo_transacao", "venda")
        .limit(1)
        .maybeSingle();

      if (txError) {
        console.error("Erro ao buscar transação do pedido:", txError);
      }

      if (!txData) return [];

      // Buscar itens sem produto_id
      const { data: itens, error } = await supabase
        .from("marketplace_transaction_items")
        .select("id, sku_marketplace, anuncio_id, variante_id, descricao_item, quantidade, preco_unitario, produto_id")
        .eq("transaction_id", txData.id);

      if (error) {
        console.error("Erro ao buscar itens:", error);
        return [];
      }

      const itensPersistidos = ((itens || []) as ItemPendente[]).map((i) => ({
        ...i,
        origem: "itens_sincronizados" as const,
      }));

      // Fallback: se ainda não existem itens persistidos, tenta montar um rascunho
      // a partir do payload bruto (raw_order) para o usuário conseguir mapear com contexto.
      if (itensPersistidos.length === 0 && txData.raw_order) {
        const draft = extractMlDraftItemsFromRawOrder(txData.raw_order).map((d, idx) => ({
          id: `draft-${txData.id}-${idx}`,
          sku_marketplace: d.sku_marketplace,
          anuncio_id: d.anuncio_id,
          variante_id: d.variante_id,
          descricao_item: d.descricao_item,
          quantidade: d.quantidade,
          preco_unitario: d.preco_unitario,
          produto_id: null,
          origem: "rascunho_raw_order" as const,
        }));

        if (draft.length > 0) return draft;
      }

      return itensPersistidos;
    },
    enabled: open && !!pedidoId && !!empresaId,
  });

  // Separar itens mapeados e não mapeados
  const itensNaoMapeados = (itensPendentes as ItemPendenteComOrigem[]).filter(i => !i.produto_id && i.sku_marketplace);
  const itensMapeados = itensPendentes.filter(i => i.produto_id);

  const handleSelectProduto = (itemId: string, produtoId: string) => {
    setMapeamentos(prev => ({ ...prev, [itemId]: produtoId }));
    setPopoverAberto(null);
  };

  const handleSalvar = async () => {
    const mapeamentosParaSalvar = Object.entries(mapeamentos).filter(([_, produtoId]) => produtoId);
    
    if (mapeamentosParaSalvar.length === 0) {
      toast.error("Selecione pelo menos um produto para mapear");
      return;
    }

    setSalvando(true);

    try {
      for (const [itemId, produtoId] of mapeamentosParaSalvar) {
        const item = itensPendentes.find(i => i.id === itemId);
        if (!item || !item.sku_marketplace) continue;

        // Criar mapeamento na tabela produto_marketplace_map
        await criarOuAtualizarMapping.mutateAsync({
          empresaId,
          canal,
          skuMarketplace: item.sku_marketplace,
          anuncioId: item.anuncio_id || null,
          varianteId: item.variante_id || null,
          nomeAnuncio: item.descricao_item || null,
          produtoId,
          mapeadoAutomaticamente: false,
        });

        // Se o item já existe em marketplace_transaction_items, atualiza diretamente.
        // Se for rascunho (draft-*), apenas salva o mapeamento: um trigger/backfill
        // deve propagar quando os itens sincronizarem.
        if (!itemId.startsWith("draft-")) {
          await supabase
            .from("marketplace_transaction_items")
            .update({ produto_id: produtoId })
            .eq("id", itemId);
        }
      }

      const usouRascunho = (itensPendentes as ItemPendenteComOrigem[]).some((i) => i.origem === "rascunho_raw_order");
      toast.success(
        usouRascunho
          ? `${mapeamentosParaSalvar.length} mapeamento(s) salvos. Os itens serão vinculados automaticamente quando sincronizarem.`
          : `${mapeamentosParaSalvar.length} mapeamento(s) criado(s) com sucesso!`
      );
      
      // Invalidar queries para atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["venda-itens"] });
      queryClient.invalidateQueries({ queryKey: ["itens-pendentes-mapeamento"] });
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar mapeamentos:", error);
      toast.error("Erro ao salvar mapeamentos");
    } finally {
      setSalvando(false);
    }
  };

  const getProdutoSelecionado = (itemId: string) => {
    const produtoId = mapeamentos[itemId];
    if (!produtoId) return null;
    return produtos.find(p => p.id === produtoId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapear Itens do Pedido #{pedidoId}
          </DialogTitle>
          <DialogDescription>
            Vincule os SKUs do marketplace aos produtos internos para calcular CMV e margem
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          {loadingItens ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando itens...</span>
            </div>
          ) : itensPendentes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhum item encontrado</p>
              <p className="text-sm mt-1">
                Este pedido ainda não trouxe itens suficientes para mapear.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Itens não mapeados */}
              {itensNaoMapeados.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      Itens pendentes de mapeamento ({itensNaoMapeados.length})
                    </span>
                  </div>

                  {(itensPendentes as ItemPendenteComOrigem[]).some((i) => i.origem === "rascunho_raw_order") && (
                    <p className="text-xs text-muted-foreground">
                      Mostrando rascunho do pedido (título/variação/SKU) para você mapear agora.
                    </p>
                  )}
                  
                  {itensNaoMapeados.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border rounded-lg bg-amber-500/5 border-amber-500/20 space-y-3"
                    >
                      {/* Informações do item vindas da API */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-2">
                          {item.sku_marketplace && (
                            <Badge variant="outline" className="font-mono text-xs">
                              SKU: {item.sku_marketplace}
                            </Badge>
                          )}
                          {item.anuncio_id && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              MLB: {item.anuncio_id}
                            </Badge>
                          )}
                          {item.variante_id && (
                            <Badge variant="secondary" className="text-xs">
                              Var: {item.variante_id}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          {item.descricao_item || "Sem descrição"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Qtd: {item.quantidade} × {item.preco_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>

                      {/* Seletor de produto */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Vincular ao produto:
                        </label>
                        <Popover 
                          open={popoverAberto === item.id} 
                          onOpenChange={(open) => setPopoverAberto(open ? item.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {getProdutoSelecionado(item.id) ? (
                                <div className="flex items-center gap-2 truncate">
                                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="truncate">{getProdutoSelecionado(item.id)?.nome}</span>
                                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                                    ({getProdutoSelecionado(item.id)?.sku})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Selecionar produto...</span>
                              )}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nome ou SKU..." />
                              <CommandList>
                                {loadingProdutos ? (
                                  <div className="p-4 text-center text-sm text-muted-foreground">
                                    Carregando produtos...
                                  </div>
                                ) : produtos.length === 0 ? (
                                  <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                                ) : (
                                  <CommandGroup>
                                    {produtos.map((produto) => (
                                      <CommandItem
                                        key={produto.id}
                                        value={`${produto.sku} ${produto.nome}`}
                                        onSelect={() => handleSelectProduto(item.id, produto.id)}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            mapeamentos[item.id] === produto.id
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span className="font-medium">{produto.nome}</span>
                                          <span className="text-xs text-muted-foreground">
                                            SKU: {produto.sku} • Custo: {(produto.custo_medio || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Separador */}
              {itensNaoMapeados.length > 0 && itensMapeados.length > 0 && (
                <Separator className="my-4" />
              )}

              {/* Itens já mapeados */}
              {itensMapeados.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Itens já mapeados ({itensMapeados.length})
                    </span>
                  </div>
                  
                  {itensMapeados.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-lg bg-emerald-500/5 border-emerald-500/20"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.sku_marketplace}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-emerald-600 font-medium">Mapeado</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {item.descricao_item}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvar} 
            disabled={salvando || Object.keys(mapeamentos).length === 0}
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Salvar Mapeamentos ({Object.keys(mapeamentos).length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
