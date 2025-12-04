import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos baseados na tabela movimentos_financeiros
export type MovimentoTipo = "entrada" | "saida";
export type MovimentoOrigem = "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";

export interface MovimentoFinanceiro {
  id: string;
  data: string;
  tipo: MovimentoTipo;
  origem: MovimentoOrigem;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_nome: string | null;
  centro_custo_id: string | null;
  centro_custo_nome: string | null;
  responsavel_id: string | null;
  empresa_id: string;
  referencia_id: string | null;
  forma_pagamento: string | null;
  cliente_nome: string | null;
  fornecedor_nome: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RegistrarMovimentoInput {
  data: string;
  tipo: MovimentoTipo;
  origem: MovimentoOrigem;
  descricao: string;
  valor: number;
  empresa_id: string;
  referencia_id?: string;
  categoria_id?: string;
  categoria_nome?: string;
  centro_custo_id?: string;
  centro_custo_nome?: string;
  responsavel_id?: string;
  forma_pagamento?: string;
  cliente_nome?: string;
  fornecedor_nome?: string;
  observacoes?: string;
}

interface UseMovimentosFinanceirosParams {
  periodoInicio?: string;
  periodoFim?: string;
  empresaId?: string;
  tipo?: MovimentoTipo;
  origem?: MovimentoOrigem;
}

export function useMovimentosFinanceiros(params: UseMovimentosFinanceirosParams = {}) {
  const queryClient = useQueryClient();
  const { periodoInicio, periodoFim, empresaId, tipo, origem } = params;

  // Query para buscar movimentos
  const { data: movimentos, isLoading, error, refetch } = useQuery({
    queryKey: ["movimentos_financeiros", periodoInicio, periodoFim, empresaId, tipo, origem],
    queryFn: async () => {
      let query = supabase
        .from("movimentos_financeiros")
        .select("*")
        .order("data", { ascending: false });

      if (periodoInicio) {
        query = query.gte("data", periodoInicio);
      }

      if (periodoFim) {
        query = query.lte("data", periodoFim);
      }

      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }

      if (tipo) {
        query = query.eq("tipo", tipo);
      }

      if (origem) {
        query = query.eq("origem", origem);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MovimentoFinanceiro[];
    },
  });

  // Mutation para registrar movimento via RPC
  const registrarMovimento = useMutation({
    mutationFn: async (input: RegistrarMovimentoInput) => {
      const { data, error } = await supabase.rpc("registrar_movimento_financeiro", {
        p_data: input.data,
        p_tipo: input.tipo,
        p_origem: input.origem,
        p_descricao: input.descricao,
        p_valor: input.valor,
        p_empresa_id: input.empresa_id,
        p_referencia_id: input.referencia_id || null,
        p_categoria_id: input.categoria_id || null,
        p_categoria_nome: input.categoria_nome || null,
        p_centro_custo_id: input.centro_custo_id || null,
        p_centro_custo_nome: input.centro_custo_nome || null,
        p_responsavel_id: input.responsavel_id || null,
        p_forma_pagamento: input.forma_pagamento || null,
        p_cliente_nome: input.cliente_nome || null,
        p_fornecedor_nome: input.fornecedor_nome || null,
        p_observacoes: input.observacoes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar movimento:", error);
      toast.error("Erro ao registrar movimento financeiro");
    },
  });

  // Mutation para inserir diretamente na tabela
  const inserirMovimento = useMutation({
    mutationFn: async (input: RegistrarMovimentoInput) => {
      const { data, error } = await supabase
        .from("movimentos_financeiros")
        .upsert(
          {
            data: input.data,
            tipo: input.tipo,
            origem: input.origem,
            descricao: input.descricao,
            valor: input.valor,
            empresa_id: input.empresa_id,
            referencia_id: input.referencia_id || null,
            categoria_id: input.categoria_id || null,
            categoria_nome: input.categoria_nome || null,
            centro_custo_id: input.centro_custo_id || null,
            centro_custo_nome: input.centro_custo_nome || null,
            responsavel_id: input.responsavel_id || null,
            forma_pagamento: input.forma_pagamento || null,
            cliente_nome: input.cliente_nome || null,
            fornecedor_nome: input.fornecedor_nome || null,
            observacoes: input.observacoes || null,
          },
          { onConflict: "referencia_id,origem" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao inserir movimento:", error);
      toast.error("Erro ao inserir movimento financeiro");
    },
  });

  // Mutation para excluir movimento
  const excluirMovimento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("movimentos_financeiros")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      toast.success("Movimento excluído com sucesso");
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir movimento:", error);
      toast.error("Erro ao excluir movimento");
    },
  });

  // Mutation para excluir por referência
  const excluirPorReferencia = useMutation({
    mutationFn: async ({ referenciaId, origem }: { referenciaId: string; origem: MovimentoOrigem }) => {
      const { error } = await supabase
        .from("movimentos_financeiros")
        .delete()
        .eq("referencia_id", referenciaId)
        .eq("origem", origem);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir movimento por referência:", error);
    },
  });

  // Cálculos de resumo
  const resumo = {
    totalEntradas: movimentos?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + Number(m.valor), 0) || 0,
    totalSaidas: movimentos?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + Number(m.valor), 0) || 0,
    saldoFinal: 0,
    quantidadeMovimentos: movimentos?.length || 0,
  };
  resumo.saldoFinal = resumo.totalEntradas - resumo.totalSaidas;

  return {
    movimentos: movimentos || [],
    resumo,
    isLoading,
    error,
    refetch,
    registrarMovimento: registrarMovimento.mutateAsync,
    inserirMovimento: inserirMovimento.mutateAsync,
    excluirMovimento: excluirMovimento.mutateAsync,
    excluirPorReferencia: excluirPorReferencia.mutateAsync,
    isRegistrando: registrarMovimento.isPending,
    isInserindo: inserirMovimento.isPending,
  };
}

// Função utilitária para ser usada em outros módulos
export async function registrarMovimentoFinanceiro(input: RegistrarMovimentoInput): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("movimentos_financeiros")
      .upsert(
        {
          data: input.data,
          tipo: input.tipo,
          origem: input.origem,
          descricao: input.descricao,
          valor: input.valor,
          empresa_id: input.empresa_id,
          referencia_id: input.referencia_id || null,
          categoria_id: input.categoria_id || null,
          categoria_nome: input.categoria_nome || null,
          centro_custo_id: input.centro_custo_id || null,
          centro_custo_nome: input.centro_custo_nome || null,
          responsavel_id: input.responsavel_id || null,
          forma_pagamento: input.forma_pagamento || null,
          cliente_nome: input.cliente_nome || null,
          fornecedor_nome: input.fornecedor_nome || null,
          observacoes: input.observacoes || null,
        },
        { onConflict: "referencia_id,origem" }
      )
      .select("id")
      .single();

    if (error) {
      console.error("Erro ao registrar movimento:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("Erro inesperado ao registrar movimento:", err);
    return null;
  }
}

// Função para excluir movimento por referência
export async function excluirMovimentoPorReferencia(referenciaId: string, origem: MovimentoOrigem): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("movimentos_financeiros")
      .delete()
      .eq("referencia_id", referenciaId)
      .eq("origem", origem);

    if (error) {
      console.error("Erro ao excluir movimento:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Erro inesperado ao excluir movimento:", err);
    return false;
  }
}
