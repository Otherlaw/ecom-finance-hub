/**
 * Hook para gerenciar Manual Transactions
 * 
 * CRUD na tabela manual_transactions + sync automático com FLOW HUB.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";

export interface ManualTransaction {
  id: string;
  empresa_id: string;
  data: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Relações
  empresa?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
  categoria?: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
  centro_custo?: {
    id: string;
    nome: string;
    codigo: string | null;
  } | null;
  responsavel?: {
    id: string;
    nome: string;
  } | null;
}

export interface ManualTransactionInput {
  empresa_id: string;
  data: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
  responsavel_id?: string | null;
  observacoes?: string | null;
}

export interface UseMovimentacoesManuaisParams {
  empresaId?: string;
  periodoInicio?: string; // yyyy-MM-dd
  periodoFim?: string;    // yyyy-MM-dd
  tipo?: "todos" | "entrada" | "saida";
}

export function useMovimentacoesManuais(params: UseMovimentacoesManuaisParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, periodoInicio, periodoFim, tipo } = params;

  // Query para buscar transações manuais
  const { data: transacoes, isLoading, error, refetch } = useQuery({
    queryKey: ["manual_transactions", empresaId, periodoInicio, periodoFim, tipo],
    queryFn: async () => {
      let query = supabase
        .from("manual_transactions")
        .select(`
          *,
          empresa:empresas(id, razao_social, nome_fantasia),
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          responsavel:responsaveis(id, nome)
        `)
        .order("data", { ascending: false });

      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }
      if (periodoInicio) {
        query = query.gte("data", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data", periodoFim);
      }
      if (tipo && tipo !== "todos") {
        query = query.eq("tipo", tipo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ManualTransaction[];
    },
  });

  // Mutation para criar transação manual
  const createTransaction = useMutation({
    mutationFn: async (input: ManualTransactionInput) => {
      // 1. Inserir na tabela manual_transactions
      const { data, error } = await supabase
        .from("manual_transactions")
        .insert({
          empresa_id: input.empresa_id,
          data: input.data,
          tipo: input.tipo,
          descricao: input.descricao,
          valor: input.valor,
          categoria_id: input.categoria_id || null,
          centro_custo_id: input.centro_custo_id || null,
          responsavel_id: input.responsavel_id || null,
          observacoes: input.observacoes || null,
        })
        .select(`
          *,
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome)
        `)
        .single();

      if (error) throw error;

      // 2. Sync com FLOW HUB
      await registrarMovimentoFinanceiro({
        data: data.data,
        tipo: data.tipo as "entrada" | "saida",
        origem: "manual",
        descricao: data.descricao,
        valor: data.valor,
        empresaId: data.empresa_id,
        referenciaId: data.id,
        categoriaId: data.categoria_id || undefined,
        categoriaNome: data.categoria?.nome,
        centroCustoId: data.centro_custo_id || undefined,
        centroCustoNome: data.centro_custo?.nome,
        responsavelId: data.responsavel_id || undefined,
        observacoes: data.observacoes || undefined,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      toast.success("Movimentação criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar movimentação: ${error.message}`);
    },
  });

  // Mutation para atualizar transação manual
  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...input }: ManualTransactionInput & { id: string }) => {
      // 1. Atualizar na tabela manual_transactions
      const { data, error } = await supabase
        .from("manual_transactions")
        .update({
          empresa_id: input.empresa_id,
          data: input.data,
          tipo: input.tipo,
          descricao: input.descricao,
          valor: input.valor,
          categoria_id: input.categoria_id || null,
          centro_custo_id: input.centro_custo_id || null,
          responsavel_id: input.responsavel_id || null,
          observacoes: input.observacoes || null,
        })
        .eq("id", id)
        .select(`
          *,
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome)
        `)
        .single();

      if (error) throw error;

      // 2. Sync com FLOW HUB (upsert via referenciaId)
      await registrarMovimentoFinanceiro({
        data: data.data,
        tipo: data.tipo as "entrada" | "saida",
        origem: "manual",
        descricao: data.descricao,
        valor: data.valor,
        empresaId: data.empresa_id,
        referenciaId: data.id,
        categoriaId: data.categoria_id || undefined,
        categoriaNome: data.categoria?.nome,
        centroCustoId: data.centro_custo_id || undefined,
        centroCustoNome: data.centro_custo?.nome,
        responsavelId: data.responsavel_id || undefined,
        observacoes: data.observacoes || undefined,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      toast.success("Movimentação atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar movimentação: ${error.message}`);
    },
  });

  // Mutation para excluir transação manual
  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      // 1. Remover do FLOW HUB primeiro
      await removerMovimentoFinanceiro(id, "manual");

      // 2. Excluir da tabela manual_transactions
      const { error } = await supabase
        .from("manual_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      toast.success("Movimentação excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir movimentação: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    totalEntradas: transacoes?.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + Number(t.valor), 0) || 0,
    totalSaidas: transacoes?.filter((t) => t.tipo === "saida").reduce((acc, t) => acc + Number(t.valor), 0) || 0,
    saldo: 
      (transacoes?.filter((t) => t.tipo === "entrada").reduce((acc, t) => acc + Number(t.valor), 0) || 0) -
      (transacoes?.filter((t) => t.tipo === "saida").reduce((acc, t) => acc + Number(t.valor), 0) || 0),
    quantidade: transacoes?.length || 0,
  };

  return {
    movimentacoes: transacoes || [],
    resumo,
    isLoading,
    error,
    refetch,
    hasData: (transacoes?.length || 0) > 0,
    createMovimentacao: createTransaction,
    updateMovimentacao: updateTransaction,
    deleteMovimentacao: deleteTransaction,
  };
}

// Alias para compatibilidade
export const useManualTransactions = useMovimentacoesManuais;
