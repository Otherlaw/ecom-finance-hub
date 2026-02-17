import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ResumoPedidosAgregado } from "./useVendasPorPedido";
import { usePeriodoAnterior, calcularVariacao, VariacaoPeriodo, formatarLabelPeriodoAnterior } from "./usePeriodoComparativo";

/**
 * Variações de vendas em relação ao período anterior
 */
export interface VendasVariacoes {
  faturamento: VariacaoPeriodo;
  valorLiquido: VariacaoPeriodo;
  pedidos: VariacaoPeriodo;
  itens: VariacaoPeriodo;
  cmv: VariacaoPeriodo;
  comissao: VariacaoPeriodo;
  freteVendedor: VariacaoPeriodo;
  margem: VariacaoPeriodo;
  ticketMedio: VariacaoPeriodo;
}

/**
 * Hook que busca resumo de vendas do período anterior para comparação
 */
export function useVendasComparativo({
  periodoInicio,
  periodoFim,
  empresaId,
}: {
  periodoInicio: string;
  periodoFim: string;
  empresaId?: string | null;
}) {
  const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;
  
  // Desativar comparativo para períodos > 15 dias (evita timeout)
  const diasPeriodo = useMemo(() => {
    try {
      return differenceInDays(parseISO(periodoFim), parseISO(periodoInicio));
    } catch {
      return 0;
    }
  }, [periodoInicio, periodoFim]);
  const habilitarComparativo = diasPeriodo <= 15;

  // Calcular datas do período anterior
  const { inicioAnterior, fimAnterior } = usePeriodoAnterior(periodoInicio, periodoFim);
  
  // Buscar resumo do período anterior (usa V2 otimizada, desativado para períodos longos)
  const { data: resumoAnterior, isLoading: isLoadingAnterior } = useQuery({
    queryKey: ["vendas-por-pedido-resumo-anterior", empresaParam, inicioAnterior, fimAnterior],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_vendas_por_pedido_resumo_v2", {
        p_empresa_id: empresaParam,
        p_data_inicio: inicioAnterior,
        p_data_fim: fimAnterior,
      });

      if (error) {
        console.error("Erro ao buscar resumo de pedidos anterior:", error);
        return null;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      if (!resultado) return null;

      return {
        total_pedidos: Number(resultado.total_pedidos) || 0,
        total_itens: Number(resultado.total_itens) || 0,
        valor_produto_total: Number(resultado.valor_produto_total) || 0,
        comissao_total: Number(resultado.comissao_total) || 0,
        tarifa_fixa_total: Number(resultado.tarifa_fixa_total) || 0,
        frete_vendedor_total: Number(resultado.frete_vendedor_total) || 0,
        ads_total: Number(resultado.ads_total) || 0,
        impostos_total: Number(resultado.impostos_total) || 0,
        valor_liquido_total: Number(resultado.valor_liquido_total) || 0,
        cmv_total: Number(resultado.cmv_total) || 0,
        margem_contribuicao_total: Number(resultado.margem_contribuicao_total) || 0,
        pedidos_com_cmv: Number(resultado.pedidos_com_cmv) || 0,
        pedidos_sem_cmv: Number(resultado.pedidos_sem_cmv) || 0,
      } as ResumoPedidosAgregado;
    },
    enabled: habilitarComparativo,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Label de comparação
  const labelComparacao = useMemo(() => {
    return formatarLabelPeriodoAnterior(periodoInicio, periodoFim);
  }, [periodoInicio, periodoFim]);

  return {
    resumoAnterior,
    labelComparacao,
    isLoadingAnterior,
  };
}

/**
 * Calcula variações entre dois resumos de vendas
 */
export function calcularVariacoesVendas(
  resumoAtual: ResumoPedidosAgregado | null,
  resumoAnterior: ResumoPedidosAgregado | null
): VendasVariacoes {
  const atual = resumoAtual || {
    total_pedidos: 0,
    total_itens: 0,
    valor_produto_total: 0,
    comissao_total: 0,
    tarifa_fixa_total: 0,
    frete_vendedor_total: 0,
    ads_total: 0,
    impostos_total: 0,
    valor_liquido_total: 0,
    cmv_total: 0,
    margem_contribuicao_total: 0,
    pedidos_com_cmv: 0,
    pedidos_sem_cmv: 0,
  };

  const anterior = resumoAnterior || {
    total_pedidos: 0,
    total_itens: 0,
    valor_produto_total: 0,
    comissao_total: 0,
    tarifa_fixa_total: 0,
    frete_vendedor_total: 0,
    ads_total: 0,
    impostos_total: 0,
    valor_liquido_total: 0,
    cmv_total: 0,
    margem_contribuicao_total: 0,
    pedidos_com_cmv: 0,
    pedidos_sem_cmv: 0,
  };

  const ticketMedioAtual = atual.total_pedidos > 0 ? atual.valor_produto_total / atual.total_pedidos : 0;
  const ticketMedioAnterior = anterior.total_pedidos > 0 ? anterior.valor_produto_total / anterior.total_pedidos : 0;

  return {
    faturamento: calcularVariacao(atual.valor_produto_total, anterior.valor_produto_total),
    valorLiquido: calcularVariacao(atual.valor_liquido_total, anterior.valor_liquido_total),
    pedidos: calcularVariacao(atual.total_pedidos, anterior.total_pedidos),
    itens: calcularVariacao(atual.total_itens, anterior.total_itens),
    cmv: calcularVariacao(atual.cmv_total, anterior.cmv_total, true),
    comissao: calcularVariacao(
      atual.comissao_total + atual.tarifa_fixa_total,
      anterior.comissao_total + anterior.tarifa_fixa_total,
      true
    ),
    freteVendedor: calcularVariacao(atual.frete_vendedor_total, anterior.frete_vendedor_total, true),
    margem: calcularVariacao(atual.margem_contribuicao_total, anterior.margem_contribuicao_total),
    ticketMedio: calcularVariacao(ticketMedioAtual, ticketMedioAnterior),
  };
}
