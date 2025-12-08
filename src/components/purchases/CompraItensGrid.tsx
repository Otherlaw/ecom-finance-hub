import { Package, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompraItem } from "@/hooks/useCompras";
import { useProduto } from "@/hooks/useProdutos";

interface CompraItensGridProps {
  itens: CompraItem[];
}

function ItemCard({ item }: { item: CompraItem }) {
  const { data: produto } = useProduto(item.produto_id);
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="flex gap-4 p-4 border rounded-lg bg-background">
      {/* Imagem */}
      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {produto?.imagem_url ? (
          <img 
            src={produto.imagem_url} 
            alt={produto.nome} 
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageOff className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      
      {/* Detalhes */}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.descricao_nf}</div>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-2 mt-1">
          {produto?.sku && (
            <Badge variant="outline" className="font-mono text-xs">
              SKU: {produto.sku}
            </Badge>
          )}
          {item.ncm && (
            <Badge variant="outline" className="font-mono text-xs">
              NCM: {item.ncm}
            </Badge>
          )}
          {!item.mapeado && (
            <Badge variant="secondary" className="bg-warning/20 text-warning">
              Sem vínculo
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-muted-foreground">Qtd: <strong className="text-foreground">{item.quantidade}</strong></span>
          <span className="text-muted-foreground">Unit: <strong className="text-foreground">{formatCurrency(item.valor_unitario)}</strong></span>
          <span className="text-muted-foreground">Total: <strong className="text-foreground">{formatCurrency(item.valor_total)}</strong></span>
        </div>
        {item.quantidade_recebida > 0 && (
          <div className="text-xs text-green-600 mt-1">
            Recebido: {item.quantidade_recebida} de {item.quantidade}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompraItensGrid({ itens }: CompraItensGridProps) {
  if (itens.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum item nesta compra</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground mb-3">
        {itens.length} {itens.length === 1 ? 'item' : 'itens'} no pedido
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {itens.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}