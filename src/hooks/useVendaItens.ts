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

      // Buscar itens da transação
      const { data: itemsData, error: itemsError } = await supabase
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

      if (itemsError) {
        console.error("Erro ao buscar itens da venda:", itemsError);
        throw itemsError;
      }

      if (!itemsData || itemsData.length === 0) return [];

      // Buscar empresa_id da transação para lookup de sku_costs
      const { data: txData } = await supabase
        .from("marketplace_transactions")
        .select("empresa_id")
        .eq("id", transactionId)
        .single();

      const empresaId = txData?.empresa_id;

      // Coletar SKUs sem produto_id para buscar custos fallback
      const skusSemProduto = itemsData
        .filter((item: any) => !item.produto_id && item.sku_marketplace)
        .map((item: any) => item.sku_marketplace);

      // Buscar custos da tabela sku_costs para fallback
      let skuCostsMap: Record<string, number> = {};
      if (skusSemProduto.length > 0 && empresaId) {
        const { data: skuCosts } = await supabase
          .from("sku_costs")
          .select("sku, custo_unitario")
          .eq("empresa_id", empresaId)
          .in("sku", skusSemProduto);

        if (skuCosts) {
          skuCostsMap = skuCosts.reduce((acc: Record<string, number>, sc: any) => {
            acc[sc.sku] = sc.custo_unitario || 0;
            return acc;
          }, {});
        }
      }

      // Transformar dados com hierarquia de custo: produto_id > sku_costs
      const itensTransformados: VendaItem[] = (itemsData || []).map((item: any) => {
        const produto = item.produto;
        const quantidade = item.quantidade || 1;
        
        // Hierarquia de custo: produto vinculado > sku_costs > 0
        let custoMedio = 0;
        if (produto?.custo_medio && produto.custo_medio > 0) {
          custoMedio = produto.custo_medio;
        } else if (item.sku_marketplace && skuCostsMap[item.sku_marketplace]) {
          custoMedio = skuCostsMap[item.sku_marketplace];
        }

        // sem_custo só é true se não tem custo de nenhuma fonte
        const semCusto = custoMedio === 0;
        // sem_produto só se não tem produto_id
        const semProduto = !item.produto_id;

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
          sem_produto: semProduto,
          sem_custo: semCusto,
        };
      });

      return itensTransformados;
    },
    enabled: !!transactionId,
    staleTime: 30 * 1000, // Cache por 30 segundos para permitir refresh rápido após mapeamento
    refetchOnWindowFocus: false,
  });

  return {
    itens: itens || [],
    isLoading,
    error,
  };
}
