/**
 * Hook para gerenciar SKUs de produtos (Motor de Estoque V1)
 * Controle de estoque e custo médio por SKU/variação
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ============= TIPOS =============

export interface ProdutoSKU {
  id: string;
  produto_id: string;
  empresa_id: string;
  codigo_sku: string;
  variacao: Record<string, string>;
  estoque_atual: number;
  custo_medio_atual: number;
  ultima_atualizacao_custo: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    codigo_interno: string;
    categoria: string | null;
    unidade_medida: string;
  };
}

export interface ProdutoSKUInsert {
  produto_id: string;
  empresa_id: string;
  codigo_sku: string;
  variacao?: Record<string, string>;
  estoque_atual?: number;
  custo_medio_atual?: number;
  ativo?: boolean;
  observacoes?: string;
}

export interface ProdutoSKUUpdate {
  codigo_sku?: string;
  variacao?: Record<string, string>;
  estoque_atual?: number;
  custo_medio_atual?: number;
  ultima_atualizacao_custo?: string;
  ativo?: boolean;
  observacoes?: string;
}

export interface UseProdutoSkusParams {
  empresaId?: string;
  produtoId?: string;
  apenasAtivos?: boolean;
  busca?: string;
}

// ============= HOOK PRINCIPAL =============

export function useProdutoSkus(params: UseProdutoSkusParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, produtoId, apenasAtivos = true, busca } = params;

  // Query para listar SKUs
  const { data: skus, isLoading, refetch } = useQuery({
    queryKey: ["produto_skus", empresaId, produtoId, apenasAtivos, busca],
    queryFn: async () => {
      let query = supabase
        .from("produto_skus")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno, categoria, unidade_medida)
        `)
        .order("created_at", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (produtoId) {
        query = query.eq("produto_id", produtoId);
      }

      if (apenasAtivos) {
        query = query.eq("ativo", true);
      }

      if (busca) {
        query = query.or(`codigo_sku.ilike.%${busca}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar SKUs:", error);
        throw error;
      }

      return (data || []) as ProdutoSKU[];
    },
  });

  // Mutation para criar SKU
  const criarSKU = useMutation({
    mutationFn: async (input: ProdutoSKUInsert) => {
      const { data, error } = await supabase
        .from("produto_skus")
        .insert({
          produto_id: input.produto_id,
          empresa_id: input.empresa_id,
          codigo_sku: input.codigo_sku,
          variacao: input.variacao || {},
          estoque_atual: input.estoque_atual || 0,
          custo_medio_atual: input.custo_medio_atual || 0,
          ativo: input.ativo ?? true,
          observacoes: input.observacoes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      toast({
        title: "SKU criado",
        description: "A variação/SKU foi cadastrada com sucesso.",
      });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar SKU:", error);
      toast({
        title: "Erro ao criar SKU",
        description: error.message.includes("duplicate")
          ? "Já existe um SKU com este código para este produto."
          : error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar SKU
  const atualizarSKU = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: ProdutoSKUUpdate }) => {
      const { data, error } = await supabase
        .from("produto_skus")
        .update(dados)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      toast({
        title: "SKU atualizado",
        description: "Os dados do SKU foram atualizados.",
      });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar SKU:", error);
      toast({
        title: "Erro ao atualizar SKU",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para inativar SKU
  const inativarSKU = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_skus")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      toast({
        title: "SKU inativado",
        description: "O SKU foi marcado como inativo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao inativar SKU",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para excluir SKU
  const excluirSKU = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produto_skus")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      toast({
        title: "SKU excluído",
        description: "O SKU foi removido permanentemente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir SKU",
        description: error.message.includes("foreign")
          ? "Este SKU possui movimentações e não pode ser excluído. Inative-o em vez disso."
          : error.message,
        variant: "destructive",
      });
    },
  });

  // Resumo de estoque
  const resumo = {
    totalSkus: skus?.length || 0,
    skusAtivos: skus?.filter(s => s.ativo).length || 0,
    estoqueTotal: skus?.reduce((sum, s) => sum + Number(s.estoque_atual || 0), 0) || 0,
    valorEstoque: skus?.reduce((sum, s) => sum + (Number(s.estoque_atual || 0) * Number(s.custo_medio_atual || 0)), 0) || 0,
  };

  return {
    skus: skus || [],
    isLoading,
    refetch,
    resumo,
    criarSKU,
    atualizarSKU,
    inativarSKU,
    excluirSKU,
  };
}

// ============= HOOK PARA SKU INDIVIDUAL =============

export function useProdutoSku(skuId: string | undefined) {
  const { data: sku, isLoading } = useQuery({
    queryKey: ["produto_sku", skuId],
    queryFn: async () => {
      if (!skuId) return null;

      const { data, error } = await supabase
        .from("produto_skus")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno, categoria, unidade_medida)
        `)
        .eq("id", skuId)
        .maybeSingle();

      if (error) throw error;
      return data as ProdutoSKU | null;
    },
    enabled: !!skuId,
  });

  return { sku, isLoading };
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Busca SKU por código
 */
export async function buscarSkuPorCodigo(
  produtoId: string,
  codigoSku: string
): Promise<ProdutoSKU | null> {
  const { data, error } = await supabase
    .from("produto_skus")
    .select("*")
    .eq("produto_id", produtoId)
    .eq("codigo_sku", codigoSku)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar SKU:", error);
    return null;
  }

  return data as ProdutoSKU | null;
}

/**
 * Lista SKUs de um produto específico
 */
export async function listarSkusDoProduto(produtoId: string): Promise<ProdutoSKU[]> {
  const { data, error } = await supabase
    .from("produto_skus")
    .select("*")
    .eq("produto_id", produtoId)
    .eq("ativo", true)
    .order("codigo_sku");

  if (error) {
    console.error("Erro ao listar SKUs:", error);
    return [];
  }

  return (data || []) as ProdutoSKU[];
}
