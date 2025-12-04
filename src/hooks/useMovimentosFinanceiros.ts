/**
 * Hook para buscar movimentos financeiros da tabela centralizada (MEU)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MovimentoFinanceiro {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";
  descricao: string;
  valor: number;
  categoriaId: string | null;
  categoriaNome: string | null;
  centroCustoId: string | null;
  centroCustoNome: string | null;
  responsavelId: string | null;
  empresaId: string;
  referenciaId: string | null;
  formaPagamento: string | null;
  clienteNome: string | null;
  fornecedorNome: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  // Join opcional
  empresa?: { id: string; razao_social: string; nome_fantasia: string | null };
  categoria?: { id: string; nome: string; tipo: string };
  centro_custo?: { id: string; nome: string };
}

interface UseMovimentosFinanceirosParams {
  periodoInicio?: string; // formato YYYY-MM-DD
  periodoFim?: string;
  empresaId?: string;
  tipo?: "entrada" | "saida";
  origem?: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";
}

export function useMovimentosFinanceiros(params: UseMovimentosFinanceirosParams = {}) {
  const { periodoInicio, periodoFim, empresaId, tipo, origem } = params;

  const { data: movimentos, isLoading, refetch } = useQuery({
    queryKey: ["movimentos_financeiros", periodoInicio, periodoFim, empresaId, tipo, origem],
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
          categoria_id,
          categoria_nome,
          centro_custo_id,
          centro_custo_nome,
          responsavel_id,
          empresa_id,
          referencia_id,
          forma_pagamento,
          cliente_nome,
          fornecedor_nome,
          observacoes,
          criado_em,
          atualizado_em,
          empresa:empresas(id, razao_social, nome_fantasia),
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome)
        `)
        .order("data", { ascending: false });

      // Filtros
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

      // Mapeia para interface
      return (data || []).map((m: any): MovimentoFinanceiro => ({
        id: m.id,
        data: m.data,
        tipo: m.tipo,
        origem: m.origem,
        descricao: m.descricao,
        valor: m.valor,
        categoriaId: m.categoria_id,
        categoriaNome: m.categoria_nome,
        centroCustoId: m.centro_custo_id,
        centroCustoNome: m.centro_custo_nome,
        responsavelId: m.responsavel_id,
        empresaId: m.empresa_id,
        referenciaId: m.referencia_id,
        formaPagamento: m.forma_pagamento,
        clienteNome: m.cliente_nome,
        fornecedorNome: m.fornecedor_nome,
        observacoes: m.observacoes,
        criadoEm: m.criado_em,
        atualizadoEm: m.atualizado_em,
        empresa: m.empresa,
        categoria: m.categoria,
        centro_custo: m.centro_custo,
      }));
    },
  });

  // Resumo
  const resumo = {
    totalEntradas: movimentos?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + m.valor, 0) || 0,
    totalSaidas: movimentos?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + m.valor, 0) || 0,
    saldo: (movimentos?.filter((m) => m.tipo === "entrada").reduce((acc, m) => acc + m.valor, 0) || 0) -
           (movimentos?.filter((m) => m.tipo === "saida").reduce((acc, m) => acc + m.valor, 0) || 0),
    quantidade: movimentos?.length || 0,
  };

  return {
    movimentos: movimentos || [],
    resumo,
    isLoading,
    refetch,
    hasData: (movimentos?.length || 0) > 0,
  };
}
