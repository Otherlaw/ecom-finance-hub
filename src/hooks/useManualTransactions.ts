/**
 * Hook para gerenciar Manual Transactions
 * 
 * CRUD na tabela manual_transactions + sync automático com FLOW HUB.
 * Inclui fluxo de aprovação/rejeição integrado ao MEU.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";
import { FLUXO_CAIXA_KEY_PREFIX } from "@/lib/queryKeys";

export type ManualTransactionStatus = "pendente" | "aprovado" | "rejeitado";

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
  status: ManualTransactionStatus;
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
  status?: ManualTransactionStatus | "todos";
}

export function useMovimentacoesManuais(params: UseMovimentacoesManuaisParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, periodoInicio, periodoFim, tipo, status } = params;

  // Query para buscar transações manuais
  const { data: transacoes, isLoading, error, refetch } = useQuery({
    queryKey: ["manual_transactions", empresaId, periodoInicio, periodoFim, tipo, status],
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
      if (status && status !== "todos") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ManualTransaction[];
    },
  });

  // Mutation para criar transação manual (status inicial = pendente)
  const createTransaction = useMutation({
    mutationFn: async (input: ManualTransactionInput) => {
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
          status: "pendente", // Sempre inicia como pendente
        })
        .select(`
          *,
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      toast.success("Lançamento criado com sucesso! Aguardando aprovação.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar lançamento: ${error.message}`);
    },
  });

  // Mutation para atualizar transação manual
  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...input }: ManualTransactionInput & { id: string }) => {
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      toast.success("Lançamento atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar lançamento: ${error.message}`);
    },
  });

  // Mutation para excluir transação manual
  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      // 1. Remover do FLOW HUB primeiro (ignora erro se não existir)
      try {
        await removerMovimentoFinanceiro(id, "manual");
      } catch (e) {
        // Pode não existir movimento se nunca foi aprovado
      }

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
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      toast.success("Lançamento excluído com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir lançamento: ${error.message}`);
    },
  });

  /**
   * APROVAR lançamento manual:
   * 1. Valida campos obrigatórios
   * 2. Atualiza status para "aprovado"
   * 3. Registra no FLOW HUB (movimentos_financeiros)
   * 4. Invalida queries para atualizar UI
   */
  const aprovarLancamento = useMutation({
    mutationFn: async (lancamento: ManualTransaction) => {
      // Validações
      if (!lancamento.empresa_id) {
        throw new Error("Empresa não informada. Não é possível aprovar.");
      }
      if (!lancamento.valor || lancamento.valor <= 0) {
        throw new Error("Valor inválido. Não é possível aprovar.");
      }
      if (lancamento.status === "aprovado") {
        throw new Error("Este lançamento já foi aprovado.");
      }

      // 1. Atualizar status para "aprovado"
      const { data, error } = await supabase
        .from("manual_transactions")
        .update({ status: "aprovado" })
        .eq("id", lancamento.id)
        .select(`
          *,
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome)
        `)
        .single();

      if (error) throw error;

      // 2. Registrar no FLOW HUB
      await registrarMovimentoFinanceiro({
        data: data.data,
        tipo: data.tipo as "entrada" | "saida",
        origem: "manual",
        descricao: data.descricao,
        valor: Math.abs(data.valor),
        empresaId: data.empresa_id,
        referenciaId: data.id, // UUID puro, sem prefixos
        categoriaId: data.categoria_id || undefined,
        categoriaNome: data.categoria?.nome || undefined,
        centroCustoId: data.centro_custo_id || undefined,
        centroCustoNome: data.centro_custo?.nome || undefined,
        responsavelId: data.responsavel_id || undefined,
        formaPagamento: "ajuste_manual",
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["dre_data"] });
      toast.success("Lançamento aprovado e registrado no fluxo de caixa!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar lançamento: ${error.message}`);
    },
  });

  /**
   * REJEITAR lançamento manual:
   * 1. Remove do FLOW HUB (se existir)
   * 2. Atualiza status para "rejeitado"
   * 3. Invalida queries
   */
  const rejeitarLancamento = useMutation({
    mutationFn: async (lancamento: ManualTransaction) => {
      // 1. Remover do FLOW HUB primeiro (se existir movimento aprovado anteriormente)
      try {
        await removerMovimentoFinanceiro(lancamento.id, "manual");
      } catch (e) {
        // Pode não existir se nunca foi aprovado - ok continuar
      }

      // 2. Atualizar status para "rejeitado"
      const { data, error } = await supabase
        .from("manual_transactions")
        .update({ status: "rejeitado" })
        .eq("id", lancamento.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["dre_data"] });
      toast.success("Lançamento rejeitado e removido do fluxo de caixa.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao rejeitar lançamento: ${error.message}`);
    },
  });

  /**
   * REABRIR lançamento (opcional):
   * Volta status para "pendente" e remove do FLOW HUB
   */
  const reabrirLancamento = useMutation({
    mutationFn: async (lancamento: ManualTransaction) => {
      // 1. Remover do FLOW HUB se existir
      try {
        await removerMovimentoFinanceiro(lancamento.id, "manual");
      } catch (e) {
        // ok se não existir
      }

      // 2. Atualizar status para "pendente"
      const { data, error } = await supabase
        .from("manual_transactions")
        .update({ status: "pendente" })
        .eq("id", lancamento.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["dre_data"] });
      toast.success("Lançamento reaberto para revisão.");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reabrir lançamento: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    total: transacoes?.length || 0,
    totalEntradas: transacoes?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + Number(m.valor), 0) || 0,
    totalSaidas: transacoes?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + Number(m.valor), 0) || 0,
    saldo: 0,
    pendentes: transacoes?.filter((m) => m.status === "pendente").length || 0,
    aprovados: transacoes?.filter((m) => m.status === "aprovado").length || 0,
    rejeitados: transacoes?.filter((m) => m.status === "rejeitado").length || 0,
  };
  resumo.saldo = resumo.totalEntradas - resumo.totalSaidas;

  return {
    movimentacoes: transacoes || [],
    resumo,
    isLoading,
    error,
    refetch,
    // Mutations CRUD
    createMovimentacao: createTransaction,
    updateMovimentacao: updateTransaction,
    deleteMovimentacao: deleteTransaction,
    // Mutations de aprovação/rejeição
    aprovarLancamento,
    rejeitarLancamento,
    reabrirLancamento,
  };
}

// Alias para compatibilidade
export const useManualTransactions = useMovimentacoesManuais;
