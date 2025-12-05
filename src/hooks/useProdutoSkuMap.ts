/**
 * Hook para gerenciamento de mapeamentos SKU ↔ Anúncios Marketplace (Upseller)
 * Suporta importação em lote e busca por anúncio/variação
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export interface ProdutoSkuMap {
  id: string;
  empresa_id: string;
  sku_interno: string;
  canal: string;
  loja: string | null;
  anuncio_id: string | null;
  variante_id: string | null;
  variante_nome: string | null;
  produto_id: string | null;
  sku_id: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionais
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

export interface ProdutoSkuMapInsert {
  empresa_id: string;
  sku_interno: string;
  canal: string;
  loja?: string | null;
  anuncio_id?: string | null;
  variante_id?: string | null;
  variante_nome?: string | null;
  produto_id?: string | null;
  sku_id?: string | null;
}

export interface UseProdutoSkuMapParams {
  empresaId?: string;
  canal?: string;
  apenasMapeados?: boolean;
  busca?: string;
}

// ============= HOOK PRINCIPAL =============

export function useProdutoSkuMap(params?: UseProdutoSkuMapParams) {
  const queryClient = useQueryClient();

  const { data: mapeamentos = [], isLoading, refetch } = useQuery({
    queryKey: ["produto_sku_map", params],
    queryFn: async () => {
      let query = supabase
        .from("produto_sku_map")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno),
          sku:produto_skus(id, codigo_sku, variacao)
        `)
        .order("sku_interno", { ascending: true });

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }
      if (params?.canal) {
        query = query.eq("canal", params.canal);
      }
      if (params?.apenasMapeados) {
        query = query.or("sku_id.not.is.null,produto_id.not.is.null");
      }
      if (params?.busca) {
        query = query.or(`sku_interno.ilike.%${params.busca}%,anuncio_id.ilike.%${params.busca}%,variante_nome.ilike.%${params.busca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProdutoSkuMap[];
    },
  });

  // Criar ou atualizar mapeamento único
  const salvarMapeamento = useMutation({
    mutationFn: async (mapping: ProdutoSkuMapInsert) => {
      // Upsert com ON CONFLICT para evitar duplicatas
      const { data, error } = await supabase
        .from("produto_sku_map")
        .upsert({
          empresa_id: mapping.empresa_id,
          sku_interno: mapping.sku_interno,
          canal: mapping.canal,
          loja: mapping.loja || null,
          anuncio_id: mapping.anuncio_id || null,
          variante_id: mapping.variante_id || null,
          variante_nome: mapping.variante_nome || null,
          produto_id: mapping.produto_id || null,
          sku_id: mapping.sku_id || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "empresa_id,canal,anuncio_id,variante_id",
          ignoreDuplicates: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_sku_map"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao salvar mapeamento:", error);
      toast.error("Erro ao salvar mapeamento");
    },
  });

  // Vincular produto a um mapeamento existente
  const vincularProduto = useMutation({
    mutationFn: async (params: { id: string; produtoId?: string | null; skuId?: string | null }) => {
      const { error } = await supabase
        .from("produto_sku_map")
        .update({
          produto_id: params.produtoId || null,
          sku_id: params.skuId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto vinculado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produto_sku_map"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao vincular produto:", error);
      toast.error("Erro ao vincular produto");
    },
  });

  // Remover mapeamento
  const removerMapeamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_sku_map")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapeamento removido");
      queryClient.invalidateQueries({ queryKey: ["produto_sku_map"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao remover mapeamento:", error);
      toast.error("Erro ao remover mapeamento");
    },
  });

  // Estatísticas
  const estatisticas = {
    total: mapeamentos.length,
    mapeados: mapeamentos.filter(m => m.produto_id || m.sku_id).length,
    pendentes: mapeamentos.filter(m => !m.produto_id && !m.sku_id).length,
    porCanal: mapeamentos.reduce((acc, m) => {
      acc[m.canal] = (acc[m.canal] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    mapeamentos,
    isLoading,
    refetch,
    estatisticas,
    salvarMapeamento,
    vincularProduto,
    removerMapeamento,
  };
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Importar mapeamentos em lote (para Upseller)
 */
export async function importarMapeamentosEmLote(
  mapeamentos: ProdutoSkuMapInsert[]
): Promise<{ inseridos: number; atualizados: number; erros: number }> {
  if (mapeamentos.length === 0) return { inseridos: 0, atualizados: 0, erros: 0 };

  console.log(`[Upseller Import] Iniciando importação de ${mapeamentos.length} mapeamentos...`);

  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;

  // Processar em lotes de 500
  const batchSize = 500;
  for (let i = 0; i < mapeamentos.length; i += batchSize) {
    const batch = mapeamentos.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from("produto_sku_map")
        .upsert(
          batch.map(m => ({
            empresa_id: m.empresa_id,
            sku_interno: m.sku_interno,
            canal: m.canal,
            loja: m.loja || null,
            anuncio_id: m.anuncio_id || null,
            variante_id: m.variante_id || null,
            variante_nome: m.variante_nome || null,
            produto_id: m.produto_id || null,
            sku_id: m.sku_id || null,
            updated_at: new Date().toISOString(),
          })),
          {
            onConflict: "empresa_id,canal,anuncio_id,variante_id",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        console.error(`[Upseller Import] Erro no batch ${i}-${i + batchSize}:`, error);
        erros += batch.length;
      } else {
        inseridos += batch.length; // Upsert conta como inserido
      }
    } catch (err) {
      console.error(`[Upseller Import] Exceção no batch:`, err);
      erros += batch.length;
    }
  }

  console.log(`[Upseller Import] Concluído: ${inseridos} inseridos/atualizados, ${erros} erros`);
  return { inseridos, atualizados: 0, erros };
}

/**
 * Buscar mapeamento por anúncio e variante
 * Usado durante conciliação de marketplace
 */
export async function buscarMapeamentoPorAnuncio(params: {
  empresaId: string;
  canal: string;
  anuncioId?: string | null;
  varianteId?: string | null;
  skuMarketplace?: string | null;
}): Promise<{ skuInterno: string; produtoId?: string; skuId?: string } | null> {
  const { empresaId, canal, anuncioId, varianteId, skuMarketplace } = params;

  // 1. Tentar busca por anúncio + variante (mais específico)
  if (anuncioId) {
    let query = supabase
      .from("produto_sku_map")
      .select("sku_interno, produto_id, sku_id")
      .eq("empresa_id", empresaId)
      .eq("canal", canal)
      .eq("anuncio_id", anuncioId);

    if (varianteId) {
      query = query.eq("variante_id", varianteId);
    }

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

    if (!error && data) {
      console.log(`[SKU Map] Match por anúncio: ${anuncioId}`, data);
      return {
        skuInterno: data.sku_interno,
        produtoId: data.produto_id ?? undefined,
        skuId: data.sku_id ?? undefined,
      };
    }
  }

  // 2. Fallback: buscar por SKU do marketplace na tabela antiga
  if (skuMarketplace) {
    const { data, error } = await supabase
      .from("marketplace_sku_mappings")
      .select("sku_id, produto_id")
      .eq("empresa_id", empresaId)
      .eq("canal", canal)
      .eq("sku_marketplace", skuMarketplace)
      .maybeSingle();

    if (!error && data && (data.sku_id || data.produto_id)) {
      console.log(`[SKU Map] Match por SKU marketplace: ${skuMarketplace}`, data);
      return {
        skuInterno: skuMarketplace,
        produtoId: data.produto_id ?? undefined,
        skuId: data.sku_id ?? undefined,
      };
    }
  }

  // 3. Fallback: buscar apenas por SKU interno
  if (skuMarketplace) {
    const { data, error } = await supabase
      .from("produto_sku_map")
      .select("sku_interno, produto_id, sku_id")
      .eq("empresa_id", empresaId)
      .eq("sku_interno", skuMarketplace)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      console.log(`[SKU Map] Match por SKU interno: ${skuMarketplace}`, data);
      return {
        skuInterno: data.sku_interno,
        produtoId: data.produto_id ?? undefined,
        skuId: data.sku_id ?? undefined,
      };
    }
  }

  console.log(`[SKU Map] Nenhum match encontrado para: anuncio=${anuncioId}, variante=${varianteId}, sku=${skuMarketplace}`);
  return null;
}

/**
 * Buscar mapeamentos por SKU interno
 */
export async function buscarMapeamentosPorSku(
  empresaId: string,
  skuInterno: string
): Promise<ProdutoSkuMap[]> {
  const { data, error } = await supabase
    .from("produto_sku_map")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("sku_interno", skuInterno);

  if (error) {
    console.error("[SKU Map] Erro ao buscar por SKU:", error);
    return [];
  }

  return data as ProdutoSkuMap[];
}

/**
 * Buscar mapeamentos por produto
 */
export async function buscarMapeamentosPorProduto(
  produtoId: string
): Promise<ProdutoSkuMap[]> {
  const { data, error } = await supabase
    .from("produto_sku_map")
    .select("*")
    .eq("produto_id", produtoId);

  if (error) {
    console.error("[SKU Map] Erro ao buscar por produto:", error);
    return [];
  }

  return data as ProdutoSkuMap[];
}
