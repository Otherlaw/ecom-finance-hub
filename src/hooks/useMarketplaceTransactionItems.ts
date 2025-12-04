/**
 * Hook para gerenciar itens de transações de marketplace.
 * Permite vincular produtos/SKUs a vendas para controle de estoque e CMV.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export interface MarketplaceTransactionItem {
  id: string;
  transaction_id: string;
  produto_id: string | null;
  sku_id: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  sku_marketplace: string | null;
  descricao_item: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    codigo_interno: string;
    custo_medio_atual: number;
  } | null;
  sku?: {
    id: string;
    codigo_sku: string;
    variacao: Record<string, string>;
    custo_medio_atual: number;
  } | null;
}

export interface MarketplaceTransactionItemInsert {
  transaction_id: string;
  produto_id?: string | null;
  sku_id?: string | null;
  quantidade: number;
  preco_unitario?: number | null;
  preco_total?: number | null;
  sku_marketplace?: string | null;
  descricao_item?: string | null;
}

export interface UseMarketplaceTransactionItemsParams {
  transactionId?: string;
}

// ============= HOOK PRINCIPAL =============

export function useMarketplaceTransactionItems(params?: UseMarketplaceTransactionItemsParams) {
  const queryClient = useQueryClient();
  const { transactionId } = params || {};

  // Query de itens
  const { data: itens = [], isLoading, refetch } = useQuery({
    queryKey: ["marketplace_transaction_items", transactionId],
    enabled: !!transactionId,
    queryFn: async () => {
      if (!transactionId) return [];

      const { data, error } = await supabase
        .from("marketplace_transaction_items")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno, custo_medio_atual),
          sku:produto_skus(id, codigo_sku, variacao, custo_medio_atual)
        `)
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((item): MarketplaceTransactionItem => ({
        id: item.id,
        transaction_id: item.transaction_id,
        produto_id: item.produto_id,
        sku_id: item.sku_id,
        quantidade: Number(item.quantidade) || 1,
        preco_unitario: item.preco_unitario ? Number(item.preco_unitario) : null,
        preco_total: item.preco_total ? Number(item.preco_total) : null,
        sku_marketplace: item.sku_marketplace,
        descricao_item: item.descricao_item,
        created_at: item.created_at,
        updated_at: item.updated_at,
        produto: item.produto as MarketplaceTransactionItem["produto"],
        sku: item.sku ? {
          ...item.sku,
          variacao: (item.sku.variacao as Record<string, string>) || {},
        } : null,
      }));
    },
  });

  // Adicionar item
  const adicionarItem = useMutation({
    mutationFn: async (input: MarketplaceTransactionItemInsert) => {
      // Validar que tem pelo menos produto ou SKU ou sku_marketplace
      if (!input.produto_id && !input.sku_id && !input.sku_marketplace) {
        throw new Error("É necessário informar produto, SKU ou SKU do marketplace");
      }

      const { data, error } = await supabase
        .from("marketplace_transaction_items")
        .insert({
          transaction_id: input.transaction_id,
          produto_id: input.produto_id || null,
          sku_id: input.sku_id || null,
          quantidade: input.quantidade,
          preco_unitario: input.preco_unitario ?? null,
          preco_total: input.preco_total ?? null,
          sku_marketplace: input.sku_marketplace || null,
          descricao_item: input.descricao_item || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transaction_items", transactionId] });
      toast.success("Item adicionado à transação");
    },
    onError: (error: Error) => {
      console.error("Erro ao adicionar item:", error);
      toast.error(`Erro ao adicionar item: ${error.message}`);
    },
  });

  // Atualizar item
  const atualizarItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketplaceTransactionItemInsert> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.produto_id !== undefined) updateData.produto_id = updates.produto_id || null;
      if (updates.sku_id !== undefined) updateData.sku_id = updates.sku_id || null;
      if (updates.quantidade !== undefined) updateData.quantidade = updates.quantidade;
      if (updates.preco_unitario !== undefined) updateData.preco_unitario = updates.preco_unitario ?? null;
      if (updates.preco_total !== undefined) updateData.preco_total = updates.preco_total ?? null;
      if (updates.sku_marketplace !== undefined) updateData.sku_marketplace = updates.sku_marketplace || null;
      if (updates.descricao_item !== undefined) updateData.descricao_item = updates.descricao_item || null;

      const { data, error } = await supabase
        .from("marketplace_transaction_items")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transaction_items", transactionId] });
      toast.success("Item atualizado");
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar item:", error);
      toast.error(`Erro ao atualizar item: ${error.message}`);
    },
  });

  // Remover item
  const removerItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_transaction_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transaction_items", transactionId] });
      toast.success("Item removido");
    },
    onError: (error: Error) => {
      console.error("Erro ao remover item:", error);
      toast.error(`Erro ao remover item: ${error.message}`);
    },
  });

  // Resumo calculado
  const resumo = {
    totalItens: itens.length,
    quantidadeTotal: itens.reduce((acc, item) => acc + item.quantidade, 0),
    valorTotal: itens.reduce((acc, item) => acc + (item.preco_total || 0), 0),
    custoEstimado: itens.reduce((acc, item) => {
      const custoUnitario = item.sku?.custo_medio_atual || item.produto?.custo_medio_atual || 0;
      return acc + (custoUnitario * item.quantidade);
    }, 0),
    itensVinculados: itens.filter(item => item.produto_id || item.sku_id).length,
    itensSemVinculo: itens.filter(item => !item.produto_id && !item.sku_id).length,
  };

  return {
    itens,
    isLoading,
    refetch,
    resumo,
    adicionarItem,
    atualizarItem,
    removerItem,
  };
}
