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

      // Buscar empresa_id e canal da transação
      const { data: txData } = await supabase
        .from("marketplace_transactions")
        .select("empresa_id, canal")
        .eq("id", transactionId)
        .single();

      const empresaId = txData?.empresa_id;
      const canal = txData?.canal;

      // Coletar SKUs sem produto_id para buscar mapeamento e custos fallback
      const skusSemProduto = itemsData
        .filter((item: any) => !item.produto_id && item.sku_marketplace)
        .map((item: any) => item.sku_marketplace);

      // NOVO: Buscar mapeamentos da tabela produto_marketplace_map
      let mappingsMap: Record<string, { produto_id: string; custo_medio: number }> = {};
      if (skusSemProduto.length > 0 && empresaId) {
        const { data: mappings } = await supabase
          .from("produto_marketplace_map")
          .select(`
            sku_marketplace,
            produto_id,
            produto:produtos!produto_id (
              custo_medio
            )
          `)
          .eq("empresa_id", empresaId)
          .eq("ativo", true)
          .in("sku_marketplace", skusSemProduto);

        if (mappings) {
          mappingsMap = mappings.reduce((acc: Record<string, { produto_id: string; custo_medio: number }>, m: any) => {
            acc[m.sku_marketplace] = {
              produto_id: m.produto_id,
              custo_medio: m.produto?.custo_medio || 0,
            };
            return acc;
          }, {});
        }
      }

      // Buscar custos da tabela sku_costs para fallback final
      let skuCostsMap: Record<string, number> = {};
      const skusSemMapeamento = skusSemProduto.filter((sku: string) => !mappingsMap[sku]);
      if (skusSemMapeamento.length > 0 && empresaId) {
        const { data: skuCosts } = await supabase
          .from("sku_costs")
          .select("sku, custo_unitario")
          .eq("empresa_id", empresaId)
          .in("sku", skusSemMapeamento);

        if (skuCosts) {
          skuCostsMap = skuCosts.reduce((acc: Record<string, number>, sc: any) => {
            acc[sc.sku] = sc.custo_unitario || 0;
            return acc;
          }, {});
        }
      }

      // Transformar dados com hierarquia de custo:
      // 1) produto_id direto -> custo do produto
      // 2) produto_marketplace_map -> custo do produto mapeado
      // 3) sku_costs -> custo manual
      // 4) Fallback 0
      const itensTransformados: VendaItem[] = (itemsData || []).map((item: any) => {
        const produto = item.produto;
        const quantidade = item.quantidade || 1;
        const sku = item.sku_marketplace;
        
        let custoMedio = 0;
        let produtoId = item.produto_id;
        let produtoSku = produto?.sku || null;
        let produtoNome = produto?.nome || null;

        // Hierarquia de custo
        if (produto?.custo_medio && produto.custo_medio > 0) {
          // 1) Produto vinculado diretamente
          custoMedio = produto.custo_medio;
        } else if (sku && mappingsMap[sku]) {
          // 2) Mapeamento via produto_marketplace_map
          custoMedio = mappingsMap[sku].custo_medio;
          if (!produtoId) {
            produtoId = mappingsMap[sku].produto_id;
          }
        } else if (sku && skuCostsMap[sku]) {
          // 3) Custo manual via sku_costs
          custoMedio = skuCostsMap[sku];
        }

        // sem_custo só é true se não tem custo de nenhuma fonte
        const semCusto = custoMedio === 0;
        // sem_produto só se não tem produto_id E não tem mapeamento
        const semProduto = !produtoId && !(sku && mappingsMap[sku]);

        return {
          id: item.id,
          transaction_id: item.transaction_id,
          sku_marketplace: sku,
          anuncio_id: item.anuncio_id,
          descricao_item: item.descricao_item,
          quantidade,
          preco_unitario: item.preco_unitario || 0,
          preco_total: item.preco_total || 0,
          produto_id: produtoId,
          produto_sku: produtoSku,
          produto_nome: produtoNome,
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
