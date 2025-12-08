/**
 * Hook para gerenciamento de estoque - Nova Estrutura V2
 * Estoque por produto + armazém
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export interface Estoque {
  id: string;
  empresa_id: string;
  produto_id: string;
  armazem_id: string;
  quantidade: number;
  quantidade_reservada: number;
  quantidade_disponivel: number | null;
  custo_medio: number;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
  ponto_reposicao: number | null;
  localizacao: string | null;
  lote: string | null;
  validade: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    sku: string;
    tipo: string;
  } | null;
  armazem?: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
}

export interface MovimentacaoEstoque {
  id: string;
  empresa_id: string;
  produto_id: string;
  armazem_id: string;
  tipo: 'entrada' | 'saida' | 'transferencia' | 'ajuste';
  motivo: string;
  origem: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  estoque_anterior: number;
  estoque_posterior: number;
  custo_medio_anterior: number;
  custo_medio_posterior: number;
  armazem_destino_id: string | null;
  documento: string | null;
  referencia_id: string | null;
  observacoes: string | null;
  created_at: string;
  // Joins
  produto?: {
    id: string;
    nome: string;
    sku: string;
  } | null;
  armazem?: {
    id: string;
    nome: string;
    codigo: string;
  } | null;
}

export interface UseEstoqueParams {
  empresaId?: string;
  produtoId?: string;
  armazemId?: string;
  apenasDisponiveis?: boolean;
}

// ============= HOOK PRINCIPAL =============

export function useEstoque(params: UseEstoqueParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, produtoId, armazemId, apenasDisponiveis } = params;

  const {
    data: estoques = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["estoque", empresaId, produtoId, armazemId, apenasDisponiveis],
    queryFn: async () => {
      let query = supabase
        .from("estoque")
        .select(`
          *,
          produto:produtos(id, nome, sku, tipo),
          armazem:armazens!estoque_armazem_id_fkey(id, nome, codigo)
        `)
        .order("created_at", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (produtoId) query = query.eq("produto_id", produtoId);
      if (armazemId) query = query.eq("armazem_id", armazemId);
      if (apenasDisponiveis) query = query.gt("quantidade", 0);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar estoque:", error);
        throw error;
      }

      return (data || []).map((e): Estoque => ({
        id: e.id,
        empresa_id: e.empresa_id,
        produto_id: e.produto_id,
        armazem_id: e.armazem_id,
        quantidade: Number(e.quantidade) || 0,
        quantidade_reservada: Number(e.quantidade_reservada) || 0,
        quantidade_disponivel: e.quantidade_disponivel != null ? Number(e.quantidade_disponivel) : null,
        custo_medio: Number(e.custo_medio) || 0,
        estoque_minimo: e.estoque_minimo != null ? Number(e.estoque_minimo) : null,
        estoque_maximo: e.estoque_maximo != null ? Number(e.estoque_maximo) : null,
        ponto_reposicao: e.ponto_reposicao != null ? Number(e.ponto_reposicao) : null,
        localizacao: e.localizacao,
        lote: e.lote,
        validade: e.validade,
        created_at: e.created_at,
        updated_at: e.updated_at,
        produto: e.produto as Estoque["produto"],
        armazem: e.armazem as Estoque["armazem"],
      }));
    },
  });

  // Ajustar estoque
  const ajustarEstoque = useMutation({
    mutationFn: async (input: {
      empresaId: string;
      produtoId: string;
      armazemId: string;
      novaQuantidade: number;
      custoUnitario?: number;
      motivo: string;
      observacoes?: string;
    }) => {
      // Buscar estoque atual
      const { data: estoqueAtual } = await supabase
        .from("estoque")
        .select("*")
        .eq("produto_id", input.produtoId)
        .eq("armazem_id", input.armazemId)
        .maybeSingle();

      const quantidadeAnterior = Number(estoqueAtual?.quantidade) || 0;
      const custoMedioAnterior = Number(estoqueAtual?.custo_medio) || 0;
      const diferenca = input.novaQuantidade - quantidadeAnterior;
      
      // Calcular novo custo médio se for entrada com custo informado
      let novoCustoMedio = custoMedioAnterior;
      const custoInformado = input.custoUnitario || custoMedioAnterior;
      
      if (diferenca > 0 && custoInformado > 0) {
        // Entrada: recalcular custo médio ponderado
        const valorAnterior = quantidadeAnterior * custoMedioAnterior;
        const valorEntrada = diferenca * custoInformado;
        novoCustoMedio = input.novaQuantidade > 0 
          ? (valorAnterior + valorEntrada) / input.novaQuantidade 
          : custoInformado;
      } else if (diferenca < 0) {
        // Saída: manter custo médio
        novoCustoMedio = custoMedioAnterior;
      } else if (custoInformado > 0 && quantidadeAnterior === 0) {
        // Primeira entrada
        novoCustoMedio = custoInformado;
      }

      // Upsert no estoque
      const { error: estoqueError } = await supabase
        .from("estoque")
        .upsert({
          empresa_id: input.empresaId,
          produto_id: input.produtoId,
          armazem_id: input.armazemId,
          quantidade: input.novaQuantidade,
          custo_medio: novoCustoMedio,
        }, {
          onConflict: "produto_id,armazem_id",
        });

      if (estoqueError) throw estoqueError;

      // Registrar movimentação
      const { error: movError } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          empresa_id: input.empresaId,
          produto_id: input.produtoId,
          armazem_id: input.armazemId,
          tipo: 'ajuste',
          motivo: input.motivo,
          origem: 'ajuste_manual',
          quantidade: Math.abs(diferenca),
          custo_unitario: custoInformado,
          custo_total: Math.abs(diferenca) * custoInformado,
          estoque_anterior: quantidadeAnterior,
          estoque_posterior: input.novaQuantidade,
          custo_medio_anterior: custoMedioAnterior,
          custo_medio_posterior: novoCustoMedio,
          observacoes: input.observacoes,
        });

      if (movError) throw movError;
    },
    onSuccess: () => {
      toast.success("Estoque ajustado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao ajustar estoque:", error);
      toast.error(`Erro ao ajustar estoque: ${error.message}`);
    },
  });

  // Resumo
  const resumo = {
    totalItens: estoques.length,
    quantidadeTotal: estoques.reduce((sum, e) => sum + e.quantidade, 0),
    valorTotal: estoques.reduce((sum, e) => sum + e.quantidade * e.custo_medio, 0),
    abaixoMinimo: estoques.filter(e => e.estoque_minimo && e.quantidade < e.estoque_minimo).length,
    zerados: estoques.filter(e => e.quantidade <= 0).length,
  };

  return {
    estoques,
    isLoading,
    refetch,
    resumo,
    ajustarEstoque,
  };
}

// ============= HOOK PARA MOVIMENTAÇÕES =============

export function useMovimentacoesEstoque(params: UseEstoqueParams & { dataInicio?: string; dataFim?: string } = {}) {
  const { empresaId, produtoId, armazemId, dataInicio, dataFim } = params;

  return useQuery({
    queryKey: ["movimentacoes_estoque", empresaId, produtoId, armazemId, dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes_estoque")
        .select(`
          *,
          produto:produtos(id, nome, sku),
          armazem:armazens!movimentacoes_estoque_armazem_id_fkey(id, nome, codigo)
        `)
        .order("created_at", { ascending: false });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (produtoId) query = query.eq("produto_id", produtoId);
      if (armazemId) query = query.eq("armazem_id", armazemId);
      if (dataInicio) query = query.gte("created_at", dataInicio);
      if (dataFim) query = query.lte("created_at", dataFim);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar movimentações:", error);
        throw error;
      }

      return (data || []).map((m): MovimentacaoEstoque => ({
        id: m.id,
        empresa_id: m.empresa_id,
        produto_id: m.produto_id,
        armazem_id: m.armazem_id,
        tipo: m.tipo as MovimentacaoEstoque["tipo"],
        motivo: m.motivo,
        origem: m.origem,
        quantidade: Number(m.quantidade) || 0,
        custo_unitario: Number(m.custo_unitario) || 0,
        custo_total: Number(m.custo_total) || 0,
        estoque_anterior: Number(m.estoque_anterior) || 0,
        estoque_posterior: Number(m.estoque_posterior) || 0,
        custo_medio_anterior: Number(m.custo_medio_anterior) || 0,
        custo_medio_posterior: Number(m.custo_medio_posterior) || 0,
        armazem_destino_id: m.armazem_destino_id,
        documento: m.documento,
        referencia_id: m.referencia_id,
        observacoes: m.observacoes,
        created_at: m.created_at,
        produto: m.produto as MovimentacaoEstoque["produto"],
        armazem: m.armazem as MovimentacaoEstoque["armazem"],
      }));
    },
  });
}
