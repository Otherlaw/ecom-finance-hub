/**
 * Hook para gerenciar custos por SKU (sem precisar de produto cadastrado)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SkuCost {
  id: string;
  empresa_id: string;
  sku: string;
  canal: string;
  custo_unitario: number;
  descricao: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface UseSkuCostsParams {
  empresaId?: string | null;
}

export function useSkuCosts({ empresaId }: UseSkuCostsParams) {
  const queryClient = useQueryClient();

  // Buscar todos os custos por SKU da empresa
  const { data: skuCosts, isLoading } = useQuery({
    queryKey: ["sku-costs", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("sku_costs")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("atualizado_em", { ascending: false });

      if (error) {
        console.error("Erro ao buscar custos por SKU:", error);
        throw error;
      }

      return (data || []) as SkuCost[];
    },
    enabled: !!empresaId,
  });

  // Buscar custo de um SKU específico
  const buscarCustoSku = async (sku: string, canal: string = "Mercado Livre"): Promise<SkuCost | null> => {
    if (!empresaId || !sku) return null;

    const { data, error } = await supabase
      .from("sku_costs")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("sku", sku)
      .eq("canal", canal)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar custo do SKU:", error);
      return null;
    }

    return data as SkuCost | null;
  };

  // Criar ou atualizar custo de SKU
  const upsertSkuCost = useMutation({
    mutationFn: async ({
      sku,
      canal = "Mercado Livre",
      custoUnitario,
      descricao,
    }: {
      sku: string;
      canal?: string;
      custoUnitario: number;
      descricao?: string;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada");

      const { data, error } = await supabase
        .from("sku_costs")
        .upsert(
          {
            empresa_id: empresaId,
            sku,
            canal,
            custo_unitario: custoUnitario,
            descricao: descricao || null,
            atualizado_em: new Date().toISOString(),
          },
          {
            onConflict: "empresa_id,sku,canal",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar custo do SKU:", error);
        throw error;
      }

      return data as SkuCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sku-costs", empresaId] });
      // Invalidar queries de vendas para recalcular CMV
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["venda-itens"] });
      toast.success("Custo do SKU salvo com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao salvar custo do SKU:", error);
      toast.error("Erro ao salvar custo do SKU");
    },
  });

  // Deletar custo de SKU
  const deletarSkuCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sku_costs").delete().eq("id", id);

      if (error) {
        console.error("Erro ao deletar custo do SKU:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sku-costs", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
      queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido-resumo"] });
      toast.success("Custo do SKU removido");
    },
    onError: (error) => {
      console.error("Erro ao deletar custo do SKU:", error);
      toast.error("Erro ao remover custo do SKU");
    },
  });

  return {
    skuCosts: skuCosts || [],
    isLoading,
    buscarCustoSku,
    upsertSkuCost,
    deletarSkuCost,
  };
}
