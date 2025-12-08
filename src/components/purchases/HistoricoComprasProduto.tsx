import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface HistoricoComprasProdutoProps {
  produtoId: string | null;
}

export function HistoricoComprasProduto({ produtoId }: HistoricoComprasProdutoProps) {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["historico-compras-produto", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      if (!produtoId) return [];
      
      const { data, error } = await supabase
        .from("compras_itens")
        .select(`
          *,
          compra:compras(
            id,
            fornecedor_nome,
            data_pedido,
            status
          )
        `)
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  if (!produtoId) return null;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return date;
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground animate-pulse">
        Carregando histórico...
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <History className="h-4 w-4" />
        <span>Sem compras anteriores</span>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4" />
        Últimas Compras
      </div>
      <div className="space-y-2">
        {historico.map((item: any) => (
          <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
            <div className="flex items-center gap-2">
              <span>{formatDate(item.compra?.data_pedido)}</span>
              <span className="text-muted-foreground truncate max-w-32">
                {item.compra?.fornecedor_nome}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {item.quantidade} un
              </Badge>
              <span className="font-medium">{formatCurrency(item.valor_unitario)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}