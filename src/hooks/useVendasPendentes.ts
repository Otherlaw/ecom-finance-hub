/**
 * Hook para buscar SKUs de vendas marketplace sem produto vinculado
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SkuPendenteVenda {
  sku_marketplace: string;
  descricao_item: string | null;
  canal: string;
  qtd_vendas: number;
  valor_total_vendido: number;
}

interface UseVendasPendentesParams {
  empresaId?: string;
  canal?: string;
}

export function useVendasPendentes(params?: UseVendasPendentesParams) {
  const queryClient = useQueryClient();

  // Buscar SKUs únicos sem produto vinculado
  const { data: skusPendentes = [], isLoading, refetch } = useQuery({
    queryKey: ["vendas-skus-pendentes", params?.empresaId, params?.canal],
    queryFn: async () => {
      // Buscar itens sem produto_id
      let query = supabase
        .from("marketplace_transaction_items")
        .select(`
          sku_marketplace,
          descricao_item,
          preco_total,
          quantidade,
          transaction_id,
          marketplace_transactions!inner(empresa_id, canal)
        `)
        .is("produto_id", null)
        .not("sku_marketplace", "is", null);

      const { data, error } = await query;
      
      if (error) {
        console.error("Erro ao buscar SKUs pendentes:", error);
        throw error;
      }

      // Agrupar por SKU+canal
      const agrupado = new Map<string, SkuPendenteVenda>();
      
      for (const item of data || []) {
        const transaction = item.marketplace_transactions as any;
        
        // Filtrar por empresa se especificado
        if (params?.empresaId && transaction?.empresa_id !== params.empresaId) {
          continue;
        }
        
        // Filtrar por canal se especificado
        if (params?.canal && params.canal !== "todos" && transaction?.canal !== params.canal) {
          continue;
        }

        const key = `${item.sku_marketplace}|${transaction?.canal || ""}`;
        
        if (agrupado.has(key)) {
          const existing = agrupado.get(key)!;
          existing.qtd_vendas += Number(item.quantidade) || 1;
          existing.valor_total_vendido += Number(item.preco_total) || 0;
        } else {
          agrupado.set(key, {
            sku_marketplace: item.sku_marketplace || "",
            descricao_item: item.descricao_item,
            canal: transaction?.canal || "",
            qtd_vendas: Number(item.quantidade) || 1,
            valor_total_vendido: Number(item.preco_total) || 0,
          });
        }
      }

      // Converter para array e ordenar por quantidade de vendas
      return Array.from(agrupado.values())
        .sort((a, b) => b.qtd_vendas - a.qtd_vendas);
    },
  });

  // Mapear SKU para produto e atualizar itens históricos
  const mapearSkuParaProduto = useMutation({
    mutationFn: async (params: {
      empresaId: string;
      produtoId: string;
      canal: string;
      skuMarketplace: string;
      nomeAnuncio?: string;
    }) => {
      // 1. Criar mapeamento em produto_marketplace_map
      const { error: errorMap } = await supabase
        .from("produto_marketplace_map")
        .upsert({
          empresa_id: params.empresaId,
          produto_id: params.produtoId,
          canal: params.canal,
          sku_marketplace: params.skuMarketplace,
          nome_anuncio: params.nomeAnuncio || null,
          mapeado_automaticamente: false,
          ativo: true,
        }, {
          onConflict: "empresa_id,canal,sku_marketplace",
        });

      if (errorMap) throw errorMap;

      // 2. Buscar todas as transações da empresa/canal
      const { data: transacoesIds, error: errorTrans } = await supabase
        .from("marketplace_transactions")
        .select("id")
        .eq("empresa_id", params.empresaId)
        .eq("canal", params.canal);

      if (errorTrans) throw errorTrans;

      if (!transacoesIds || transacoesIds.length === 0) {
        return { atualizados: 0 };
      }

      // 3. Atualizar todos os itens históricos com esse SKU
      const { data: itensAtualizados, error: errorUpdate } = await supabase
        .from("marketplace_transaction_items")
        .update({ produto_id: params.produtoId })
        .eq("sku_marketplace", params.skuMarketplace)
        .is("produto_id", null)
        .in("transaction_id", transacoesIds.map(t => t.id))
        .select("id");

      if (errorUpdate) throw errorUpdate;

      return { atualizados: itensAtualizados?.length || 0 };
    },
    onSuccess: (result) => {
      toast.success(`SKU mapeado! ${result.atualizados} itens atualizados`);
      queryClient.invalidateQueries({ queryKey: ["vendas-skus-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["produto_marketplace_map"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
    },
    onError: (error) => {
      console.error("Erro ao mapear SKU:", error);
      toast.error("Erro ao mapear SKU para produto");
    },
  });

  // Resumo
  const resumo = {
    totalSkusPendentes: skusPendentes.length,
    totalVendasAfetadas: skusPendentes.reduce((acc, s) => acc + s.qtd_vendas, 0),
    valorTotalAfetado: skusPendentes.reduce((acc, s) => acc + s.valor_total_vendido, 0),
  };

  return {
    skusPendentes,
    isLoading,
    refetch,
    resumo,
    mapearSkuParaProduto,
  };
}
