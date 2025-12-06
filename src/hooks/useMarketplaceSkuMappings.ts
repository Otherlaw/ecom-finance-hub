/**
 * Hook para mapeamento de SKUs de marketplace - Nova Estrutura V2
 * Usa tabela produto_marketplace_map
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export interface MarketplaceSkuMapping {
  id: string;
  empresa_id: string;
  produto_id: string;
  canal: string;
  sku_marketplace: string;
  anuncio_id: string | null;
  variante_id: string | null;
  nome_loja: string | null;
  nome_anuncio: string | null;
  ativo: boolean;
  mapeado_automaticamente: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    sku: string;
  } | null;
}

interface UseMarketplaceSkuMappingsParams {
  empresaId?: string;
  canal?: string;
  apenasMapeados?: boolean;
}

// ============= HOOK PRINCIPAL =============

export function useMarketplaceSkuMappings(params?: UseMarketplaceSkuMappingsParams) {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading, refetch } = useQuery({
    queryKey: ["produto_marketplace_map", params],
    queryFn: async () => {
      let query = supabase
        .from("produto_marketplace_map")
        .select(`
          *,
          produto:produtos(id, nome, sku)
        `)
        .order("sku_marketplace", { ascending: true });

      if (params?.empresaId) query = query.eq("empresa_id", params.empresaId);
      if (params?.canal) query = query.eq("canal", params.canal);
      if (params?.apenasMapeados) query = query.eq("ativo", true);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MarketplaceSkuMapping[];
    },
  });

  const criarOuAtualizarMapping = useMutation({
    mutationFn: async (mapping: {
      empresaId: string;
      produtoId: string;
      canal: string;
      skuMarketplace: string;
      anuncioId?: string | null;
      varianteId?: string | null;
      nomeLoja?: string | null;
      nomeAnuncio?: string | null;
      mapeadoAutomaticamente?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("produto_marketplace_map")
        .upsert({
          empresa_id: mapping.empresaId,
          produto_id: mapping.produtoId,
          canal: mapping.canal,
          sku_marketplace: mapping.skuMarketplace,
          anuncio_id: mapping.anuncioId || null,
          variante_id: mapping.varianteId || null,
          nome_loja: mapping.nomeLoja || null,
          nome_anuncio: mapping.nomeAnuncio || null,
          mapeado_automaticamente: mapping.mapeadoAutomaticamente ?? false,
          ativo: true,
        }, {
          onConflict: "empresa_id,canal,sku_marketplace",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_marketplace_map"] });
    },
    onError: (error) => {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento de SKU");
    },
  });

  const removerMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_marketplace_map")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_marketplace_map"] });
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

// ============= FUNÇÕES AUXILIARES =============

/**
 * Resolve SKU do marketplace para produto interno
 */
export async function resolverSkuMarketplace(params: {
  empresaId: string;
  canal: string;
  skuMarketplace?: string | null;
  descricaoItem?: string | null;
}): Promise<{ produtoId?: string } | null> {
  const { empresaId, canal, skuMarketplace } = params;

  if (skuMarketplace) {
    const { data, error } = await supabase
      .from("produto_marketplace_map")
      .select("produto_id")
      .eq("empresa_id", empresaId)
      .eq("canal", canal)
      .eq("sku_marketplace", skuMarketplace)
      .eq("ativo", true)
      .maybeSingle();

    if (!error && data?.produto_id) {
      return { produtoId: data.produto_id };
    }
  }

  return null;
}

/**
 * Buscar mapeamento por SKU do marketplace
 */
export async function buscarMapeamentoPorSkuMarketplace(
  empresaId: string,
  canal: string,
  skuMarketplace: string
): Promise<{ produtoId: string | null } | null> {
  const { data, error } = await supabase
    .from("produto_marketplace_map")
    .select("produto_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canal)
    .eq("sku_marketplace", skuMarketplace)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    console.error("[SKU Mapping] Erro ao buscar:", error);
    return null;
  }

  if (!data) return null;

  return { produtoId: data.produto_id };
}

/**
 * Criar mapeamentos em lote
 */
export async function criarMapeamentosEmLote(
  mappings: Array<{
    empresaId: string;
    produtoId: string;
    canal: string;
    skuMarketplace: string;
    nomeAnuncio?: string;
  }>
): Promise<number> {
  if (mappings.length === 0) return 0;

  // Buscar existentes
  const skusMarketplace = mappings.map(m => m.skuMarketplace);
  const { data: existentes } = await supabase
    .from("produto_marketplace_map")
    .select("sku_marketplace")
    .eq("empresa_id", mappings[0].empresaId)
    .eq("canal", mappings[0].canal)
    .in("sku_marketplace", skusMarketplace);

  const existentesSet = new Set((existentes || []).map(e => e.sku_marketplace));
  
  // Filtrar novos
  const novos = mappings.filter(m => !existentesSet.has(m.skuMarketplace));
  
  if (novos.length === 0) return 0;

  const { error } = await supabase
    .from("produto_marketplace_map")
    .insert(
      novos.map(m => ({
        empresa_id: m.empresaId,
        produto_id: m.produtoId,
        canal: m.canal,
        sku_marketplace: m.skuMarketplace,
        nome_anuncio: m.nomeAnuncio || null,
        mapeado_automaticamente: false,
        ativo: true,
      }))
    );

  if (error) {
    console.error("[SKU Mapping] Erro ao criar em lote:", error);
    return 0;
  }

  return novos.length;
}
