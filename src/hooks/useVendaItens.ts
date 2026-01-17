import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipo para itens de uma venda/transação específica
 */
export interface VendaItem {
  id: string;
  transaction_id: string;
  sku_marketplace: string | null;
  anuncio_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  produto_id: string | null;
  // Dados do produto vinculado
  produto_sku: string | null;
  produto_nome: string | null;
  custo_medio: number;
  // Campos calculados
  custo_total: number;
  sem_produto: boolean;
  sem_custo: boolean;
}

/**
 * Hook para carregar itens de uma transação específica sob demanda.
 * Use quando o usuário expandir uma linha na tabela de vendas.
 */
export function useVendaItens(transactionId: string | null) {
  const { data: itens, isLoading, error } = useQuery({
    queryKey: ["venda-itens", transactionId],
    queryFn: async () => {
      if (!transactionId) return [];

      const { data, error } = await supabase
        .from("marketplace_transaction_items")
        .select(`
          id,
          transaction_id,
          sku_marketplace,
          anuncio_id,
          descricao_item,
          quantidade,
          preco_unitario,
          preco_total,
          produto_id,
          produto:produtos!produto_id (
            id,
            sku,
            nome,
            custo_medio
          )
        `)
        .eq("transaction_id", transactionId);

      if (error) {
        console.error("Erro ao buscar itens da venda:", error);
        throw error;
      }

      // Transformar dados
      const itensTransformados: VendaItem[] = (data || []).map((item: any) => {
        const produto = item.produto;
        const custoMedio = produto?.custo_medio || 0;
        const quantidade = item.quantidade || 1;

        return {
          id: item.id,
          transaction_id: item.transaction_id,
          sku_marketplace: item.sku_marketplace,
          anuncio_id: item.anuncio_id,
          descricao_item: item.descricao_item,
          quantidade,
          preco_unitario: item.preco_unitario || 0,
          preco_total: item.preco_total || 0,
          produto_id: item.produto_id,
          produto_sku: produto?.sku || null,
          produto_nome: produto?.nome || null,
          custo_medio: custoMedio,
          custo_total: custoMedio * quantidade,
          sem_produto: !item.produto_id,
          sem_custo: custoMedio === 0,
        };
      });

      return itensTransformados;
    },
    enabled: !!transactionId,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  return {
    itens: itens || [],
    isLoading,
    error,
  };
}
