/**
 * Modal para mapear CMV/custo de um SKU específico
 * Permite vincular a produto existente OU informar custo direto
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, DollarSign, Link2, Package } from "lucide-react";
import { toast } from "sonner";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { useSkuCosts } from "@/hooks/useSkuCosts";
import { VendaItem } from "@/hooks/useVendaItens";
import { supabase } from "@/integrations/supabase/client";

interface MapearCmvModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  item: VendaItem;
  canal?: string;
  onSuccess?: () => void;
}

export function MapearCmvModal({
  open,
  onOpenChange,
  empresaId,
  item,
  canal = "Mercado Livre",
  onSuccess,
}: MapearCmvModalProps) {
  const [tab, setTab] = useState<"produto" | "custo">("custo");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [openProdutoPopover, setOpenProdutoPopover] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { produtos, isLoading: loadingProdutos } = useProdutos({
    empresaId,
    status: "ativo",
    apenasRaiz: false,
  });

  const { upsertSkuCost, buscarCustoSku } = useSkuCosts({ empresaId });

  // Buscar custo existente ao abrir o modal
  useEffect(() => {
    if (open && item.sku_marketplace) {
      buscarCustoSku(item.sku_marketplace, canal).then((custo) => {
        if (custo) {
          setCustoUnitario(custo.custo_unitario.toString());
        }
      });
    }
  }, [open, item.sku_marketplace, canal]);

  // Limpar estado ao fechar
  useEffect(() => {
    if (!open) {
      setCustoUnitario("");
      setSelectedProduto(null);
    }
  }, [open]);

  const handleSalvarCusto = async () => {
    const custo = parseFloat(custoUnitario.replace(",", "."));

    if (isNaN(custo) || custo < 0) {
      toast.error("Informe um custo válido");
      return;
    }

    if (!item.sku_marketplace) {
      toast.error("SKU não disponível para este item");
      return;
    }

    setSalvando(true);

    try {
      await upsertSkuCost.mutateAsync({
        sku: item.sku_marketplace,
        canal,
        custoUnitario: custo,
        descricao: item.descricao_item || undefined,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao salvar custo:", error);
    } finally {
      setSalvando(false);
    }
  };

  const handleVincularProduto = async () => {
    if (!selectedProduto) {
      toast.error("Selecione um produto");
      return;
    }

    if (!item.sku_marketplace) {
      toast.error("SKU não disponível para este item");
      return;
    }

    setSalvando(true);

    try {
      // Criar mapeamento via RPC
      const { error } = await supabase.rpc("mapear_sku_para_produto", {
        p_empresa_id: empresaId,
        p_produto_id: selectedProduto.id,
        p_canal: canal,
        p_sku_marketplace: item.sku_marketplace,
        p_nome_anuncio: item.descricao_item || null,
      });

      if (error) throw error;

      toast.success("Produto vinculado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao vincular produto:", error);
      toast.error("Erro ao vincular produto");
    } finally {
      setSalvando(false);
    }
  };

  const sku = item.sku_marketplace || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Mapear CMV
          </DialogTitle>
          <DialogDescription>
            Defina o custo para calcular a margem de contribuição deste item.
          </DialogDescription>
        </DialogHeader>

        {/* Info do item */}
        <div className="bg-muted/50 p-3 rounded-lg space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {sku}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {canal}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.descricao_item || "Sem descrição"}
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span>Qtd: {item.quantidade}</span>
            <span>
              Preço unit.:{" "}
              {item.preco_unitario.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "produto" | "custo")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="custo" className="gap-1">
              <DollarSign className="h-4 w-4" />
              Custo Direto
            </TabsTrigger>
            <TabsTrigger value="produto" className="gap-1">
              <Link2 className="h-4 w-4" />
              Vincular Produto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custo" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="custo">Custo Unitário (R$)</Label>
              <Input
                id="custo"
                type="text"
                placeholder="0,00"
                value={custoUnitario}
                onChange={(e) => setCustoUnitario(e.target.value)}
                className="text-lg"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Este custo será usado para calcular o CMV de todas as vendas com o SKU{" "}
                <code className="bg-muted px-1 rounded">{sku}</code>
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarCusto} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar Custo"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="produto" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Selecione o Produto</Label>
              <Popover open={openProdutoPopover} onOpenChange={setOpenProdutoPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openProdutoPopover}
                    className="w-full justify-between"
                  >
                    {selectedProduto ? (
                      <span className="truncate">{selectedProduto.nome}</span>
                    ) : (
                      <span className="text-muted-foreground">Buscar produto...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
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
                              onSelect={() => {
                                setSelectedProduto(produto);
                                setOpenProdutoPopover(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedProduto?.id === produto.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{produto.nome}</span>
                                <span className="text-xs text-muted-foreground">
                                  SKU: {produto.sku} • Custo:{" "}
                                  {(produto.custo_medio || 0).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
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

              {selectedProduto && (
                <div className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedProduto.nome}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <span>SKU: {selectedProduto.sku}</span>
                    <span className="mx-2">•</span>
                    <span>
                      Custo médio:{" "}
                      {(selectedProduto.custo_medio || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                O custo médio do produto será usado para calcular o CMV
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleVincularProduto} disabled={salvando || !selectedProduto}>
                {salvando ? "Salvando..." : "Vincular Produto"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
