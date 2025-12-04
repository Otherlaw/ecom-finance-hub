import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketplaceSkuMapping {
  id: string;
  empresa_id: string;
  canal: string;
  sku_marketplace: string;
  sku_id: string | null;
  produto_id: string | null;
  nome_produto_marketplace: string | null;
  mapeado_automaticamente: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    codigo_interno: string;
  } | null;
  sku?: {
    id: string;
    codigo_sku: string;
    variacao: Record<string, string> | null;
  } | null;
}

interface UseMarketplaceSkuMappingsParams {
  empresaId?: string;
  canal?: string;
  apenasMapeados?: boolean;
}

export function useMarketplaceSkuMappings(params?: UseMarketplaceSkuMappingsParams) {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading, refetch } = useQuery({
    queryKey: ["marketplace_sku_mappings", params],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_sku_mappings")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno),
          sku:produto_skus(id, codigo_sku, variacao)
        `)
        .order("sku_marketplace", { ascending: true });

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }
      if (params?.canal) {
        query = query.eq("canal", params.canal);
      }
      if (params?.apenasMapeados) {
        query = query.or("sku_id.not.is.null,produto_id.not.is.null");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketplaceSkuMapping[];
    },
  });

  const criarOuAtualizarMapping = useMutation({
    mutationFn: async (mapping: {
      empresaId: string;
      canal: string;
      skuMarketplace: string;
      skuId?: string | null;
      produtoId?: string | null;
      nomeProdutoMarketplace?: string | null;
      mapeadoAutomaticamente?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("marketplace_sku_mappings")
        .upsert({
          empresa_id: mapping.empresaId,
          canal: mapping.canal,
          sku_marketplace: mapping.skuMarketplace,
          sku_id: mapping.skuId || null,
          produto_id: mapping.produtoId || null,
          nome_produto_marketplace: mapping.nomeProdutoMarketplace || null,
          mapeado_automaticamente: mapping.mapeadoAutomaticamente ?? false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "empresa_id,canal,sku_marketplace",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_sku_mappings"] });
    },
    onError: (error) => {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento de SKU");
    },
  });

  const removerMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_sku_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_sku_mappings"] });
      toast.success("Mapeamento removido");
    },
    onError: (error) => {
      console.error("Erro ao remover mapeamento:", error);
      toast.error("Erro ao remover mapeamento");
    },
  });

  return {
    mappings,
    isLoading,
    refetch,
    criarOuAtualizarMapping,
    removerMapping,
  };
}

// ============= FUNÇÕES AUXILIARES PARA BUSCA =============

/**
 * Busca mapeamento por SKU do marketplace
 */
export async function buscarMapeamentoPorSkuMarketplace(
  empresaId: string,
  canal: string,
  skuMarketplace: string
): Promise<{ skuId: string | null; produtoId: string | null } | null> {
  const { data, error } = await supabase
    .from("marketplace_sku_mappings")
    .select("sku_id, produto_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canal)
    .eq("sku_marketplace", skuMarketplace)
    .maybeSingle();

  if (error) {
    console.error("[SKU Mapping] Erro ao buscar:", error);
    return null;
  }

  if (!data) return null;

  return {
    skuId: data.sku_id,
    produtoId: data.produto_id,
  };
}

/**
 * Cria mapeamentos em lote (para importação)
 */
export async function criarMapeamentosEmLote(
  mappings: Array<{
    empresaId: string;
    canal: string;
    skuMarketplace: string;
    nomeProdutoMarketplace?: string;
  }>
): Promise<number> {
  if (mappings.length === 0) return 0;

  // Buscar mapeamentos existentes
  const skusMarketplace = mappings.map(m => m.skuMarketplace);
  const { data: existentes } = await supabase
    .from("marketplace_sku_mappings")
    .select("sku_marketplace")
    .eq("empresa_id", mappings[0].empresaId)
    .eq("canal", mappings[0].canal)
    .in("sku_marketplace", skusMarketplace);

  const existentesSet = new Set((existentes || []).map(e => e.sku_marketplace));
  
  // Filtrar apenas novos
  const novos = mappings.filter(m => !existentesSet.has(m.skuMarketplace));
  
  if (novos.length === 0) return 0;

  const { error } = await supabase
    .from("marketplace_sku_mappings")
    .insert(
      novos.map(m => ({
        empresa_id: m.empresaId,
        canal: m.canal,
        sku_marketplace: m.skuMarketplace,
        nome_produto_marketplace: m.nomeProdutoMarketplace || null,
        mapeado_automaticamente: false,
      }))
    );

  if (error) {
    console.error("[SKU Mapping] Erro ao criar em lote:", error);
    return 0;
  }

  return novos.length;
}
