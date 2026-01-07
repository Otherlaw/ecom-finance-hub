import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { fluxoCaixaKey } from "@/lib/queryKeys";

// Tipos para o Fluxo de Caixa
export interface MovimentoCaixa {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  origem: "cartao" | "banco" | "contas_pagar" | "contas_receber" | "manual" | "marketplace";
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
  referenciaId?: string | null;
  isManual: boolean;
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
  periodoInicio?: string;
  periodoFim?: string;
  empresaId?: string;
}

/**
 * Hook para Fluxo de Caixa usando Motor de Entrada Unificada (MEU)
 */
export const useFluxoCaixa = ({ periodoInicio, periodoFim, empresaId }: UseFluxoCaixaParams = {}) => {
  const { data: movimentosRaw, isLoading } = useQuery({
    queryKey: fluxoCaixaKey(periodoInicio, periodoFim, empresaId),
    queryFn: async () => {
      let query = supabase
        .from("movimentos_financeiros")
        .select(`*, categoria:categorias_financeiras(id, nome, tipo), empresa:empresas(id, razao_social, nome_fantasia)`)
        .order("data", { ascending: true });

      if (periodoInicio) query = query.gte("data", periodoInicio);
      if (periodoFim) query = query.lte("data", periodoFim);
      if (empresaId && empresaId !== "todas") query = query.eq("empresa_id", empresaId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: empresas } = useQuery({
    queryKey: ["empresas-fluxo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, razao_social, nome_fantasia").eq("ativo", true).order("razao_social");
      if (error) throw error;
      return data || [];
    },
  });

  const movimentos = useMemo<MovimentoCaixa[]>(() => {
    if (!movimentosRaw) return [];
    return movimentosRaw.map((m: any): MovimentoCaixa => ({
      id: m.id, data: m.data, tipo: m.tipo, origem: m.origem, descricao: m.descricao,
      categoriaId: m.categoria_id, categoriaNome: m.categoria_nome || m.categoria?.nome,
      categoriaTipo: m.categoria?.tipo, centroCustoId: m.centro_custo_id, centroCustoNome: m.centro_custo_nome,
      valor: Math.abs(m.valor), empresaId: m.empresa_id,
      empresaNome: m.empresa?.nome_fantasia || m.empresa?.razao_social,
      fornecedorNome: m.fornecedor_nome, clienteNome: m.cliente_nome, status: "conciliado",
      referenciaId: m.referencia_id,
      isManual: m.origem === "manual",
    }));
  }, [movimentosRaw]);

  const resumo = useMemo<FluxoCaixaResumo>(() => {
    const totalEntradas = movimentos.filter(m => m.tipo === "entrada").reduce((acc, m) => acc + m.valor, 0);
    const totalSaidas = movimentos.filter(m => m.tipo === "saida").reduce((acc, m) => acc + m.valor, 0);
    const saldoFinal = totalEntradas - totalSaidas;
    const dias = movimentos.length > 0 ? Math.max(1, Math.ceil((new Date(movimentos[movimentos.length-1]?.data).getTime() - new Date(movimentos[0]?.data).getTime()) / 86400000)) : 1;
    return { saldoInicial: 0, totalEntradas, totalSaidas, saldoFinal, projecao30Dias: saldoFinal - (totalSaidas/dias)*30 };
  }, [movimentos]);

  const agregado = useMemo<FluxoCaixaAgregado>(() => {
    const porDiaMap = new Map<string, { entradas: number; saidas: number }>();
    movimentos.forEach(m => {
      const e = porDiaMap.get(m.data) || { entradas: 0, saidas: 0 };
      m.tipo === "entrada" ? e.entradas += m.valor : e.saidas += m.valor;
      porDiaMap.set(m.data, e);
    });
    let saldoAcum = 0;
    const porDia = Array.from(porDiaMap.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([data, v]) => {
      const saldo = v.entradas - v.saidas; saldoAcum += saldo;
      return { data, entradas: v.entradas, saidas: v.saidas, saldo, saldoAcumulado: saldoAcum };
    });
    const porCatMap = new Map<string, { tipo: string; valor: number }>();
    movimentos.filter(m => m.tipo === "saida").forEach(m => {
      const k = m.categoriaNome || "Não categorizado";
      const e = porCatMap.get(k) || { tipo: m.categoriaTipo || "", valor: 0 };
      e.valor += m.valor; porCatMap.set(k, e);
    });
    const porCategoria = Array.from(porCatMap.entries()).map(([cat, {tipo, valor}]) => ({categoria: cat, tipo, valor})).sort((a,b) => b.valor - a.valor);
    const porCCMap = new Map<string, number>();
    movimentos.filter(m => m.tipo === "saida").forEach(m => { const k = m.centroCustoNome || "Sem CC"; porCCMap.set(k, (porCCMap.get(k)||0) + m.valor); });
    const porCentroCusto = Array.from(porCCMap.entries()).map(([cc, valor]) => ({centroCusto: cc, valor})).sort((a,b) => b.valor - a.valor);
    return { porDia, porCategoria, porCentroCusto };
  }, [movimentos]);

  return { movimentos, resumo, agregado, empresas, isLoading, hasData: movimentos.length > 0 };
};
