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

      // 2. Usar RPC para atualizar itens históricos de forma eficiente
      const { data: atualizados, error: errorRpc } = await supabase.rpc(
        'mapear_sku_para_produto',
        {
          p_empresa_id: params.empresaId,
          p_produto_id: params.produtoId,
          p_canal: params.canal,
          p_sku_marketplace: params.skuMarketplace
        }
      );

      if (errorRpc) throw errorRpc;

      return { atualizados: atualizados || 0 };
    },
    onSuccess: (result) => {
      toast.success(`SKU mapeado! ${result.atualizados} itens históricos atualizados. Novas vendas deste SKU já virão mapeadas.`);
      // Invalidar todas as queries relacionadas para atualizar a UI e recalcular CMV
      queryClient.invalidateQueries({ queryKey: ["vendas-skus-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["produto_marketplace_map"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["venda-itens"] }); // Recarga itens expandidos
      queryClient.invalidateQueries({ queryKey: ["pedido-transaction-id"] }); // Recarga transaction_id
      queryClient.invalidateQueries({ queryKey: ["marketplace-transaction-items"] });
    },
    onError: (error) => {
      console.error("Erro ao mapear SKU:", error);
      toast.error("Erro ao mapear SKU para produto");
    },
  });

  // NOVO: Reprocessar mapeamentos existentes para itens órfãos
  const reprocessarMapeamentos = useMutation({
    mutationFn: async (empresaId: string) => {
      // 1. Buscar todos os mapeamentos ativos
      const { data: mapeamentos, error: errorMap } = await supabase
        .from("produto_marketplace_map")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true);

      if (errorMap) throw errorMap;

      if (!mapeamentos || mapeamentos.length === 0) {
        return { totalAtualizados: 0, mapeamentosProcessados: 0 };
      }

      let totalAtualizados = 0;

      // 2. Para cada mapeamento, usar RPC para atualizar itens órfãos
      for (const map of mapeamentos) {
        const { data: atualizados } = await supabase.rpc(
          'mapear_sku_para_produto',
          {
            p_empresa_id: empresaId,
            p_produto_id: map.produto_id,
            p_canal: map.canal,
            p_sku_marketplace: map.sku_marketplace
          }
        );

        totalAtualizados += atualizados || 0;
      }

      return { totalAtualizados, mapeamentosProcessados: mapeamentos.length };
    },
    onSuccess: (result) => {
      if (result.totalAtualizados > 0) {
        toast.success(`${result.totalAtualizados} itens atualizados com mapeamentos existentes`);
      } else {
        toast.info("Nenhum item órfão encontrado para atualizar");
      }
      queryClient.invalidateQueries({ queryKey: ["vendas-skus-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
    },
    onError: (error) => {
      console.error("Erro ao reprocessar mapeamentos:", error);
      toast.error("Erro ao reprocessar mapeamentos");
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
    reprocessarMapeamentos,
  };
}
