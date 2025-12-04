import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

// Tipos para o Fluxo de Caixa
export interface MovimentoCaixa {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "marketplace" | "manual";
  descricao: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  categoriaTipo: string | null;
  centroCustoId: string | null;
  centroCustoNome: string | null;
  valor: number;
  empresaId: string | null;
  empresaNome: string | null;
  cartaoNome?: string | null;
  fornecedorNome?: string | null;
  clienteNome?: string | null;
  status: string;
}

export interface FluxoCaixaResumo {
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  projecao30Dias: number;
}

export interface FluxoCaixaAgregado {
  porDia: { data: string; entradas: number; saidas: number; saldo: number; saldoAcumulado: number }[];
  porCategoria: { categoria: string; tipo: string; valor: number }[];
  porCentroCusto: { centroCusto: string; valor: number }[];
}

interface UseFluxoCaixaParams {
  periodoInicio?: string; // formato YYYY-MM-DD
  periodoFim?: string;
  empresaId?: string;
}

/**
 * Hook para buscar e calcular dados do Fluxo de Caixa
 * 
 * Fonte de dados ÚNICA: tabela movimentos_financeiros (MEU)
 * 
 * Os movimentos são registrados automaticamente por:
 * - Conciliação de cartão de crédito (origem: "cartao")
 * - Pagamento de contas a pagar (origem: "contas_pagar")
 * - Recebimento de contas a receber (origem: "contas_receber")
 * - Importação de extratos bancários (origem: "banco") - futuro
 * - Lançamentos manuais (origem: "manual") - futuro
 */
export const useFluxoCaixa = ({ periodoInicio, periodoFim, empresaId }: UseFluxoCaixaParams = {}) => {
  // Buscar movimentos da tabela unificada movimentos_financeiros
  const { data: movimentosRaw, isLoading: loadingMovimentos } = useQuery({
    queryKey: ["movimentos_financeiros", periodoInicio, periodoFim, empresaId],
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
          empresa_id,
          forma_pagamento,
          cliente_nome,
          fornecedor_nome,
          observacoes,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .order("data", { ascending: true });

      // Filtro por período
      if (periodoInicio) {
        query = query.gte("data", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("data", periodoFim);
      }

      // Filtro por empresa
      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar todas as empresas para o filtro
  const { data: empresas } = useQuery({
    queryKey: ["empresas-fluxo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, razao_social, nome_fantasia")
        .eq("ativo", true)
        .order("razao_social");
      
      if (error) throw error;
      return data || [];
    },
  });

  // Converter movimentos do banco para o formato esperado pelo componente
  const movimentos = useMemo<MovimentoCaixa[]>(() => {
    if (!movimentosRaw) return [];

    return movimentosRaw.map((m: any) => ({
      id: m.id,
      data: m.data,
      tipo: m.tipo as "entrada" | "saida",
      origem: m.origem as MovimentoCaixa["origem"],
      descricao: m.descricao,
      categoriaId: m.categoria_id,
      categoriaNome: m.categoria_nome || (m.categoria as any)?.nome || null,
      categoriaTipo: (m.categoria as any)?.tipo || null,
      centroCustoId: m.centro_custo_id,
      centroCustoNome: m.centro_custo_nome || (m.centro_custo as any)?.nome || null,
      valor: Math.abs(Number(m.valor)),
      empresaId: m.empresa_id,
      empresaNome: (m.empresa as any)?.nome_fantasia || (m.empresa as any)?.razao_social || null,
      fornecedorNome: m.fornecedor_nome,
      clienteNome: m.cliente_nome,
      status: "conciliado", // Movimentos no MEU estão sempre conciliados
    }));
  }, [movimentosRaw]);

  // Calcular resumo
  const resumo = useMemo<FluxoCaixaResumo>(() => {
    const totalEntradas = movimentos
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + m.valor, 0);

    const totalSaidas = movimentos
      .filter((m) => m.tipo === "saida")
      .reduce((acc, m) => acc + m.valor, 0);

    // Saldo inicial: por enquanto assumimos zero (futuramente virá de configuração ou período anterior)
    const saldoInicial = 0;
    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    // Projeção 30 dias: média diária de saídas * 30 (simplificado)
    const diasNoPeriodo = movimentos.length > 0 ? 
      Math.max(1, Math.ceil((new Date(movimentos[movimentos.length - 1]?.data).getTime() - new Date(movimentos[0]?.data).getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const mediaDiariaSaidas = totalSaidas / diasNoPeriodo;
    const projecao30Dias = saldoFinal - (mediaDiariaSaidas * 30);

    return {
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoFinal,
      projecao30Dias,
    };
  }, [movimentos]);

  // Dados agregados para dashboard
  const agregado = useMemo<FluxoCaixaAgregado>(() => {
    // Agrupar por dia
    const porDiaMap = new Map<string, { entradas: number; saidas: number }>();
    movimentos.forEach((m) => {
      const existing = porDiaMap.get(m.data) || { entradas: 0, saidas: 0 };
      if (m.tipo === "entrada") {
        existing.entradas += m.valor;
      } else {
        existing.saidas += m.valor;
      }
      porDiaMap.set(m.data, existing);
    });

    // Converter para array com saldo acumulado
    let saldoAcumulado = 0;
    const porDia = Array.from(porDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        const saldo = values.entradas - values.saidas;
        saldoAcumulado += saldo;
        return {
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          saldo,
          saldoAcumulado,
        };
      });

    // Agrupar por categoria (apenas saídas para o gráfico principal)
    const porCategoriaMap = new Map<string, { tipo: string; valor: number }>();
    movimentos
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.categoriaNome || "Não categorizado";
        const existing = porCategoriaMap.get(key) || { tipo: m.categoriaTipo || "", valor: 0 };
        existing.valor += m.valor;
        porCategoriaMap.set(key, existing);
      });

    const porCategoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, { tipo, valor }]) => ({ categoria, tipo, valor }))
      .sort((a, b) => b.valor - a.valor);

    // Agrupar por centro de custo
    const porCCMap = new Map<string, number>();
    movimentos
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.centroCustoNome || "Sem centro de custo";
        porCCMap.set(key, (porCCMap.get(key) || 0) + m.valor);
      });

    const porCentroCusto = Array.from(porCCMap.entries())
      .map(([centroCusto, valor]) => ({ centroCusto, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      porDia,
      porCategoria,
      porCentroCusto,
    };
  }, [movimentos]);

  return {
    movimentos,
    resumo,
    agregado,
    empresas,
    isLoading: loadingMovimentos,
    hasData: movimentos.length > 0,
  };
};