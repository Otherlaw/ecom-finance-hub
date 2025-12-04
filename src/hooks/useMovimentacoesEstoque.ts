/**
 * Hook para gerenciamento de movimentações de estoque.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MovimentacaoEstoque, Produto } from "@/lib/motor-custos";
import { registrarEntradaEstoque, ajustarEstoque } from "@/lib/motor-custos";

// ============= TIPOS =============

export interface UseMovimentacoesEstoqueParams {
  empresaId?: string;
  produtoId?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: "entrada" | "saida";
  motivo?: string;
}

export interface MovimentacaoEstoqueComProduto extends MovimentacaoEstoque {
  produto: Pick<Produto, "id" | "nome" | "codigo_interno">;
}

// ============= HOOK PRINCIPAL =============

export function useMovimentacoesEstoque(params: UseMovimentacoesEstoqueParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, produtoId, dataInicio, dataFim, tipo, motivo } = params;

  // Query de movimentações
  const {
    data: movimentacoes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["movimentacoes_estoque", empresaId, produtoId, dataInicio, dataFim, tipo, motivo],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes_estoque")
        .select(`
          *,
          produto:produtos(id, nome, codigo_interno)
        `)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      if (produtoId) {
        query = query.eq("produto_id", produtoId);
      }

      if (dataInicio) {
        query = query.gte("data", dataInicio);
      }

      if (dataFim) {
        query = query.lte("data", dataFim);
      }

      if (tipo) {
        query = query.eq("tipo", tipo);
      }

      if (motivo) {
        query = query.eq("motivo", motivo);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar movimentações:", error);
        throw error;
      }

      return (data || []).map((m): MovimentacaoEstoqueComProduto => ({
        id: m.id,
        empresa_id: m.empresa_id,
        produto_id: m.produto_id,
        tipo: m.tipo as "entrada" | "saida",
        motivo: m.motivo as MovimentacaoEstoque["motivo"],
        origem: m.origem,
        referencia_id: m.referencia_id,
        documento: m.documento,
        data: m.data,
        quantidade: Number(m.quantidade) || 0,
        custo_unitario: Number(m.custo_unitario) || 0,
        custo_total: Number(m.custo_total) || 0,
        estoque_anterior: Number(m.estoque_anterior) || 0,
        estoque_posterior: Number(m.estoque_posterior) || 0,
        custo_medio_anterior: Number(m.custo_medio_anterior) || 0,
        custo_medio_posterior: Number(m.custo_medio_posterior) || 0,
        observacoes: m.observacoes,
        created_at: m.created_at,
        produto: m.produto as MovimentacaoEstoqueComProduto["produto"],
      }));
    },
  });

  // Registrar entrada (compra)
  const registrarEntrada = useMutation({
    mutationFn: async (input: {
      produtoId: string;
      empresaId: string;
      quantidade: number;
      custoUnitario: number;
      documento?: string;
      data: string;
      observacoes?: string;
    }) => {
      return registrarEntradaEstoque({
        produtoId: input.produtoId,
        empresaId: input.empresaId,
        quantidade: input.quantidade,
        custoUnitario: input.custoUnitario,
        origem: "compra",
        documento: input.documento,
        data: input.data,
        observacoes: input.observacoes,
      });
    },
    onSuccess: () => {
      toast.success("Entrada de estoque registrada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao registrar entrada:", error);
      toast.error(`Erro ao registrar entrada: ${error.message}`);
    },
  });

  // Ajustar estoque
  const ajustar = useMutation({
    mutationFn: async (input: {
      produtoId: string;
      empresaId: string;
      novoEstoque: number;
      novoCustoMedio?: number;
      observacoes?: string;
    }) => {
      return ajustarEstoque(
        input.produtoId,
        input.empresaId,
        input.novoEstoque,
        input.novoCustoMedio || null,
        input.observacoes
      );
    },
    onSuccess: () => {
      toast.success("Estoque ajustado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao ajustar estoque:", error);
      toast.error(`Erro ao ajustar estoque: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    totalEntradas: movimentacoes.filter((m) => m.tipo === "entrada").reduce((sum, m) => sum + m.quantidade, 0),
    totalSaidas: movimentacoes.filter((m) => m.tipo === "saida").reduce((sum, m) => sum + m.quantidade, 0),
    valorEntradas: movimentacoes.filter((m) => m.tipo === "entrada").reduce((sum, m) => sum + m.custo_total, 0),
    valorSaidas: movimentacoes.filter((m) => m.tipo === "saida").reduce((sum, m) => sum + m.custo_total, 0),
    movimentacoes: movimentacoes.length,
  };

  return {
    movimentacoes,
    isLoading,
    refetch,
    resumo,
    registrarEntrada,
    ajustar,
  };
}
