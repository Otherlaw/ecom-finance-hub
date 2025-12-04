/**
 * Hook para gerenciamento de produtos com integração ao Motor de Custos V1.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Produto, ChannelMapping } from "@/lib/motor-custos";

// ============= TIPOS =============

export interface ProdutoInsert {
  empresa_id: string;
  codigo_interno: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  subcategoria?: string;
  unidade_medida?: string;
  ncm?: string;
  cfop_venda?: string;
  cfop_compra?: string;
  situacao_tributaria?: string;
  fornecedor_principal_id?: string;
  fornecedor_principal_nome?: string;
  preco_venda_sugerido?: number;
  estoque_atual?: number;
  custo_medio_atual?: number;
  canais?: ChannelMapping[];
  status?: "ativo" | "inativo";
  observacoes?: string;
}

export interface ProdutoUpdate extends Partial<ProdutoInsert> {
  id: string;
}

export interface UseProdutosParams {
  empresaId?: string;
  status?: "ativo" | "inativo" | "todos";
  categoria?: string;
  busca?: string;
}

// ============= HOOK PRINCIPAL =============

export function useProdutos(params: UseProdutosParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, status = "todos", categoria, busca } = params;

  // Query principal
  const {
    data: produtos = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["produtos", empresaId, status, categoria, busca],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("*")
        .order("nome", { ascending: true });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (status && status !== "todos") {
        query = query.eq("status", status);
      }

      if (categoria) {
        query = query.eq("categoria", categoria);
      }

      if (busca) {
        query = query.or(`nome.ilike.%${busca}%,codigo_interno.ilike.%${busca}%,ncm.ilike.%${busca}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar produtos:", error);
        throw error;
      }

      // Mapear para o tipo Produto
      return (data || []).map((p): Produto => ({
        id: p.id,
        empresa_id: p.empresa_id,
        codigo_interno: p.codigo_interno,
        nome: p.nome,
        descricao: p.descricao,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        unidade_medida: p.unidade_medida,
        ncm: p.ncm,
        cfop_venda: p.cfop_venda,
        cfop_compra: p.cfop_compra,
        situacao_tributaria: p.situacao_tributaria,
        fornecedor_principal_id: p.fornecedor_principal_id,
        fornecedor_principal_nome: p.fornecedor_principal_nome,
        preco_venda_sugerido: Number(p.preco_venda_sugerido) || 0,
        estoque_atual: Number(p.estoque_atual) || 0,
        custo_medio_atual: Number(p.custo_medio_atual) || 0,
        ultima_atualizacao_custo: p.ultima_atualizacao_custo,
        canais: (p.canais as unknown as ChannelMapping[]) || [],
        status: p.status as "ativo" | "inativo",
        observacoes: p.observacoes,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
    },
  });

  // Criar produto
  const criarProduto = useMutation({
    mutationFn: async (input: ProdutoInsert) => {
      const insertData = {
        empresa_id: input.empresa_id,
        codigo_interno: input.codigo_interno,
        nome: input.nome,
        descricao: input.descricao || null,
        categoria: input.categoria || null,
        subcategoria: input.subcategoria || null,
        unidade_medida: input.unidade_medida || "un",
        ncm: input.ncm || null,
        cfop_venda: input.cfop_venda || null,
        cfop_compra: input.cfop_compra || null,
        situacao_tributaria: input.situacao_tributaria || null,
        fornecedor_principal_id: input.fornecedor_principal_id || null,
        fornecedor_principal_nome: input.fornecedor_principal_nome || null,
        preco_venda_sugerido: input.preco_venda_sugerido || 0,
        estoque_atual: input.estoque_atual || 0,
        custo_medio_atual: input.custo_medio_atual || 0,
        canais: JSON.parse(JSON.stringify(input.canais || [])),
        status: input.status || "ativo",
        observacoes: input.observacoes || null,
      };

      const { data, error } = await supabase
        .from("produtos")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Produto criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar produto:", error);
      toast.error(`Erro ao criar produto: ${error.message}`);
    },
  });

  // Atualizar produto
  const atualizarProduto = useMutation({
    mutationFn: async (input: ProdutoUpdate) => {
      const { id, canais, ...restData } = input;

      const updatePayload: Record<string, unknown> = { ...restData };
      if (canais !== undefined) {
        updatePayload.canais = canais as unknown as Record<string, unknown>[];
      }

      const { data, error } = await supabase
        .from("produtos")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar produto:", error);
      toast.error(`Erro ao atualizar produto: ${error.message}`);
    },
  });

  // Excluir produto
  const excluirProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir produto:", error);
      toast.error(`Erro ao excluir produto: ${error.message}`);
    },
  });

  // Inativar produto (soft delete)
  const inativarProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("produtos")
        .update({ status: "inativo" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto inativado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao inativar produto:", error);
      toast.error(`Erro ao inativar produto: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    total: produtos.length,
    ativos: produtos.filter((p) => p.status === "ativo").length,
    inativos: produtos.filter((p) => p.status === "inativo").length,
    valorEstoque: produtos.reduce((sum, p) => sum + p.estoque_atual * p.custo_medio_atual, 0),
    produtosComEstoque: produtos.filter((p) => p.estoque_atual > 0).length,
    produtosSemEstoque: produtos.filter((p) => p.estoque_atual <= 0).length,
  };

  return {
    produtos,
    isLoading,
    refetch,
    resumo,
    criarProduto,
    atualizarProduto,
    excluirProduto,
    inativarProduto,
  };
}

// ============= HOOK PARA BUSCAR PRODUTO ÚNICO =============

export function useProduto(id: string | null) {
  return useQuery({
    queryKey: ["produto", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar produto:", error);
        throw error;
      }

      return {
        ...data,
        estoque_atual: Number(data.estoque_atual) || 0,
        custo_medio_atual: Number(data.custo_medio_atual) || 0,
        preco_venda_sugerido: Number(data.preco_venda_sugerido) || 0,
        canais: (data.canais as unknown as ChannelMapping[]) || [],
        status: data.status as "ativo" | "inativo",
      } as Produto;
    },
  });
}
