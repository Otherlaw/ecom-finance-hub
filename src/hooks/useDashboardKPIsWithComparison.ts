import { useMemo } from "react";
import { useDashboardKPIs, DashboardKPIs } from "./useDashboardKPIs";
import { usePeriodoAnterior, calcularVariacao, VariacaoPeriodo, formatarLabelPeriodoAnterior } from "./usePeriodoComparativo";

/**
 * KPIs com variação em relação ao período anterior
 */
export interface DashboardKPIsComVariacao {
  // KPIs atuais
  kpis: DashboardKPIs;
  
  // Variações calculadas
  variacoes: {
    faturamento: VariacaoPeriodo;
    lucroLiquido: VariacaoPeriodo;
    margemBruta: VariacaoPeriodo;
    margemLiquida: VariacaoPeriodo;
    pedidos: VariacaoPeriodo;
    ticketMedio: VariacaoPeriodo;
    cmv: VariacaoPeriodo;
    despesas: VariacaoPeriodo;
    comissoes: VariacaoPeriodo;
    freteVendedor: VariacaoPeriodo;
    ads: VariacaoPeriodo;
  };
  
  // Label do período de comparação
  labelComparacao: string;
  
  // KPIs do período anterior (para referência)
  kpisAnterior: DashboardKPIs | null;
}

/**
 * Hook que busca KPIs do período atual E do período anterior,
 * calculando automaticamente as variações percentuais.
 */
export function useDashboardKPIsWithComparison(
  periodoInicio: string,
  periodoFim: string,
  empresaId?: string | null
) {
  // Calcular datas do período anterior
  const { inicioAnterior, fimAnterior } = usePeriodoAnterior(periodoInicio, periodoFim);
  
  // Buscar KPIs do período atual
  const {
    kpis: kpisAtual,
    channelData,
    alertas,
    isLoading: isLoadingAtual,
    isFetching: isFetchingAtual,
    error: errorAtual,
    refetch,
  } = useDashboardKPIs(periodoInicio, periodoFim, empresaId);
  
  // Buscar KPIs do período anterior
  const {
    kpis: kpisAnterior,
    isLoading: isLoadingAnterior,
    isFetching: isFetchingAnterior,
    error: errorAnterior,
  } = useDashboardKPIs(inicioAnterior, fimAnterior, empresaId);
  
  // Calcular variações
  const variacoes = useMemo(() => {
    return {
      faturamento: calcularVariacao(
        kpisAtual.faturamento_bruto,
        kpisAnterior.faturamento_bruto
      ),
      lucroLiquido: calcularVariacao(
        kpisAtual.lucro_liquido,
        kpisAnterior.lucro_liquido
      ),
      margemBruta: calcularVariacao(
        kpisAtual.margem_bruta_pct,
        kpisAnterior.margem_bruta_pct
      ),
      margemLiquida: calcularVariacao(
        kpisAtual.margem_liquida_pct,
        kpisAnterior.margem_liquida_pct
      ),
      pedidos: calcularVariacao(
        kpisAtual.pedidos_unicos,
        kpisAnterior.pedidos_unicos
      ),
      ticketMedio: calcularVariacao(
        kpisAtual.ticket_medio,
        kpisAnterior.ticket_medio
      ),
      cmv: calcularVariacao(
        kpisAtual.cmv_total,
        kpisAnterior.cmv_total,
        true // Menos CMV pode ser bom, mas depende do volume
      ),
      despesas: calcularVariacao(
        kpisAtual.despesas_operacionais_total,
        kpisAnterior.despesas_operacionais_total,
        true // Menos despesas é bom
      ),
      comissoes: calcularVariacao(
        kpisAtual.comissao_total + kpisAtual.tarifa_fixa_total,
        kpisAnterior.comissao_total + kpisAnterior.tarifa_fixa_total,
        true // Menos comissão é bom
      ),
      freteVendedor: calcularVariacao(
        kpisAtual.frete_vendedor_total,
        kpisAnterior.frete_vendedor_total,
        true // Menos frete é bom
      ),
      ads: calcularVariacao(
        kpisAtual.ads_total,
        kpisAnterior.ads_total,
        true // Menos ads pode ser bom, mas depende do ROI
      ),
    };
  }, [kpisAtual, kpisAnterior]);
  
  // Label de comparação
  const labelComparacao = useMemo(() => {
    return formatarLabelPeriodoAnterior(periodoInicio, periodoFim);
  }, [periodoInicio, periodoFim]);
  
  return {
    kpis: kpisAtual,
    kpisAnterior,
    variacoes,
    labelComparacao,
    channelData,
    alertas,
    isLoading: isLoadingAtual || isLoadingAnterior,
    isFetching: isFetchingAtual || isFetchingAnterior,
    error: errorAtual || errorAnterior,
    refetch,
  };
}
