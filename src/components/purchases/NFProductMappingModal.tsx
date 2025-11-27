import { useState } from "react";
import { Search, Check, Plus, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { useToast } from "@/hooks/use-toast";
import { Purchase, PurchaseItem, formatCurrency } from "@/lib/purchases-data";
import { Product } from "@/lib/products-data";

interface NFProductMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: Purchase | null;
  products: Product[];
  onSave: (purchase: Purchase) => void;
  onCreateProduct: (item: PurchaseItem) => void;
}

export function NFProductMappingModal({
  open,
  onOpenChange,
  purchase,
  products,
  onSave,
  onCreateProduct,
}: NFProductMappingModalProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Record<string, string | undefined>>({});
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    setMappings((prev) => ({
      ...prev,
      [itemId]: productId,
    }));
    setOpenPopovers((prev) => ({ ...prev, [itemId]: false }));
  };

  const handleSave = () => {
    if (!purchase) return;

    const updatedItens = purchase.itens.map((item) => {
      const productId = mappings[item.id] || item.produtoId;
      const product = products.find((p) => p.id === productId);
      
      return {
        ...item,
        produtoId: productId,
        produtoNome: product?.nome,
        mapeado: !!productId,
      };
    });

    const updatedPurchase: Purchase = {
      ...purchase,
      itens: updatedItens,
      dataAtualizacao: new Date().toISOString().split("T")[0],
    };

    onSave(updatedPurchase);
    toast({
      title: "Mapeamento salvo",
      description: "Os itens foram vinculados aos produtos do cadastro.",
    });
    onOpenChange(false);
  };

  const unmappedCount = purchase?.itens.filter(
    (item) => !item.mapeado && !mappings[item.id]
  ).length || 0;

  if (!purchase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Mapear Itens da NF para Produtos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div>
              <div className="font-medium">NF: {purchase.numeroNF || "Sem número"}</div>
              <div className="text-sm text-muted-foreground">
                Fornecedor: {purchase.fornecedor} | Total: {formatCurrency(purchase.valorTotal)}
              </div>
            </div>
            {unmappedCount > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {unmappedCount} itens não mapeados
              </Badge>
            )}
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {purchase.itens.map((item) => {
              const currentMapping = mappings[item.id] || item.produtoId;
              const mappedProduct = products.find((p) => p.id === currentMapping);
              const isMapped = !!currentMapping;

              return (
                <div
                  key={item.id}
                  className={`p-4 border rounded-lg ${
                    isMapped ? "bg-success/5 border-success/30" : "bg-warning/5 border-warning/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {isMapped ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                        <span className="font-medium">{item.descricaoNF}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>NCM: {item.ncm || "-"}</span>
                        <span>CFOP: {item.cfop}</span>
                        <span>Qtd: {item.quantidade}</span>
                        <span>Unit: {formatCurrency(item.valorUnitario)}</span>
                        <span className="font-medium">Total: {formatCurrency(item.valorTotal)}</span>
                      </div>
                      {mappedProduct && (
                        <div className="text-sm text-success">
                          ✓ Vinculado a: {mappedProduct.nome} (SKU: {mappedProduct.codigoInterno})
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Popover
                        open={openPopovers[item.id]}
                        onOpenChange={(open) => setOpenPopovers((prev) => ({ ...prev, [item.id]: open }))}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Search className="h-4 w-4 mr-2" />
                            {isMapped ? "Alterar" : "Vincular"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="end">
                          <Command>
                            <CommandInput placeholder="Buscar produto por nome, SKU ou NCM..." />
                            <CommandList>
                              <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                              <CommandGroup>
                                {products
                                  .filter((p) => p.status === 'ativo')
                                  .map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={`${product.nome} ${product.codigoInterno} ${product.ncm}`}
                                      onSelect={() => handleProductSelect(item.id, product.id)}
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">{product.nome}</span>
                                        <span className="text-xs text-muted-foreground">
                                          SKU: {product.codigoInterno} | NCM: {product.ncm}
                                        </span>
                                      </div>
                                      {currentMapping === product.id && (
                                        <Check className="ml-auto h-4 w-4 text-success" />
                                      )}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCreateProduct(item)}
                        title="Criar novo produto"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {purchase.itens.length - unmappedCount} de {purchase.itens.length} itens mapeados
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Mapeamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
