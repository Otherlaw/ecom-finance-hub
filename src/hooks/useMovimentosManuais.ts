/**
 * Hook para gerenciar Movimentações Manuais
 * 
 * Filtra apenas movimentos com origem='manual' da tabela movimentos_financeiros.
 * Usa o FLOW HUB (MEU) para criar/atualizar/excluir registros.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  criarOuAtualizarMovimentoManual, 
  excluirMovimentoManual, 
  MovimentoManualPayload 
} from "@/lib/movimentos-manuais";

export interface MovimentoManual {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: "manual";
  descricao: string;
  valor: number;
  empresaId: string;
  referenciaId: string | null;
  categoriaId: string | null;
  categoriaNome: string | null;
  centroCustoId: string | null;
  centroCustoNome: string | null;
  responsavelId: string | null;
  formaPagamento: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  // Joins
  empresa?: { id: string; razao_social: string; nome_fantasia: string | null };
  categoria?: { id: string; nome: string; tipo: string };
  centro_custo?: { id: string; nome: string; codigo: string | null };
  responsavel?: { id: string; nome: string };
}

export interface UseMovimentosManuaisParams {
  empresaId?: string;
  periodoInicio?: string;
  periodoFim?: string;
  tipo?: "entrada" | "saida" | "todos";
  categoriaId?: string;
  centroCustoId?: string;
}

export function useMovimentosManuais(params: UseMovimentosManuaisParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, periodoInicio, periodoFim, tipo, categoriaId, centroCustoId } = params;

  // Query para buscar movimentos manuais
  const { data: movimentos, isLoading, error, refetch } = useQuery({
    queryKey: ["movimentos_manuais", empresaId, periodoInicio, periodoFim, tipo, categoriaId, centroCustoId],
    queryFn: async () => {
      let query = supabase
        .from("movimentos_financeiros")
        .select(`
          id,
          data,
          tipo,
          origem,
          descricao,
          valor,
          empresa_id,
          referencia_id,
          categoria_id,
          categoria_nome,
          centro_custo_id,
          centro_custo_nome,
          responsavel_id,
          forma_pagamento,
          observacoes,
          criado_em,
          atualizado_em,
          empresa:empresas(id, razao_social, nome_fantasia),
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          responsavel:responsaveis(id, nome)
        `)
        .eq("origem", "manual")
        .order("data", { ascending: false });

      // Aplicar filtros
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
      if (categoriaId) {
        query = query.eq("categoria_id", categoriaId);
      }
      if (centroCustoId) {
        query = query.eq("centro_custo_id", centroCustoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Mapear para interface
      return (data || []).map((m: any) => ({
        id: m.id,
        data: m.data,
        tipo: m.tipo,
        origem: m.origem,
        descricao: m.descricao,
        valor: m.valor,
        empresaId: m.empresa_id,
        referenciaId: m.referencia_id,
        categoriaId: m.categoria_id,
        categoriaNome: m.categoria_nome,
        centroCustoId: m.centro_custo_id,
        centroCustoNome: m.centro_custo_nome,
        responsavelId: m.responsavel_id,
        formaPagamento: m.forma_pagamento,
        observacoes: m.observacoes,
        criadoEm: m.criado_em,
        atualizadoEm: m.atualizado_em,
        empresa: m.empresa,
        categoria: m.categoria,
        centro_custo: m.centro_custo,
        responsavel: m.responsavel,
      })) as MovimentoManual[];
    },
  });

  // Mutation para criar movimento manual
  const createMovimento = useMutation({
    mutationFn: async (payload: Omit<MovimentoManualPayload, "id" | "referenciaId">) => {
      return criarOuAtualizarMovimentoManual(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Movimentação criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar movimentação: ${error.message}`);
    },
  });

  // Mutation para atualizar movimento manual
  const updateMovimento = useMutation({
    mutationFn: async (payload: MovimentoManualPayload) => {
      if (!payload.referenciaId) {
        throw new Error("referenciaId é obrigatório para atualização");
      }
      return criarOuAtualizarMovimentoManual(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Movimentação atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar movimentação: ${error.message}`);
    },
  });

  // Mutation para excluir movimento manual
  const deleteMovimento = useMutation({
    mutationFn: async (referenciaId: string) => {
      return excluirMovimentoManual(referenciaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimentos_manuais"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Movimentação excluída com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir movimentação: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    totalEntradas: movimentos?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + m.valor, 0) || 0,
    totalSaidas: movimentos?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + m.valor, 0) || 0,
    saldo: 
      (movimentos?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + m.valor, 0) || 0) -
      (movimentos?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + m.valor, 0) || 0),
    quantidade: movimentos?.length || 0,
  };

  return {
    movimentos: movimentos || [],
    resumo,
    isLoading,
    error,
    refetch,
    hasData: (movimentos?.length || 0) > 0,
    createMovimento,
    updateMovimento,
    deleteMovimento,
  };
}
