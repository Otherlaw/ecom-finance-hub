import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * KPIs completos do Dashboard retornados pela RPC unificada
 * Inclui vendas, CMV, despesas operacionais e margens - tudo para o período selecionado
 */
export interface DashboardKPIs {
  // Métricas de vendas
  faturamento_bruto: number;
  receita_liquida: number;
  pedidos_unicos: number;
  total_transacoes: number;
  
  // Custos de venda
  comissao_total: number;
  tarifa_fixa_total: number;
  frete_vendedor_total: number;
  ads_total: number;
  
  // Impostos
  impostos_total: number;
  impostos_estimado: boolean;
  
  // CMV
  cmv_total: number;
  cmv_itens_com_custo: number;
  cmv_total_itens: number;
  cmv_completo: boolean;
  
  // Despesas operacionais
  despesas_operacionais_total: number;
  despesas_banco: number;
  despesas_manuais: number;
  qtd_despesas: number;
  
  // Lucros calculados
  lucro_bruto: number;
  lucro_liquido: number;
  
  // Margens percentuais
  margem_bruta_pct: number;
  margem_liquida_pct: number;
  
  // Ticket médio
  ticket_medio: number;
  
  // Por canal
  por_canal: Record<string, { bruto: number; liquido: number; pedidos: number }>;
  
  // Flags
  tem_eventos_financeiros: boolean;
}

const DEFAULT_KPIS: DashboardKPIs = {
  faturamento_bruto: 0,
  receita_liquida: 0,
  pedidos_unicos: 0,
  total_transacoes: 0,
  comissao_total: 0,
  tarifa_fixa_total: 0,
  frete_vendedor_total: 0,
  ads_total: 0,
  impostos_total: 0,
  impostos_estimado: true,
  cmv_total: 0,
  cmv_itens_com_custo: 0,
  cmv_total_itens: 0,
  cmv_completo: false,
  despesas_operacionais_total: 0,
  despesas_banco: 0,
  despesas_manuais: 0,
  qtd_despesas: 0,
  lucro_bruto: 0,
  lucro_liquido: 0,
  margem_bruta_pct: 0,
  margem_liquida_pct: 0,
  ticket_medio: 0,
  por_canal: {},
  tem_eventos_financeiros: false,
};

/**
 * Hook unificado para buscar todos os KPIs do Dashboard para QUALQUER período.
 * Substitui a combinação anterior de useDREData (mensal) + useDashboardMetrics.
 * 
 * @param periodoInicio - Data de início no formato "yyyy-MM-dd"
 * @param periodoFim - Data de fim no formato "yyyy-MM-dd"
 * @param empresaId - ID da empresa ou undefined/null para todas as empresas
 */
export function useDashboardKPIs(
  periodoInicio: string, 
  periodoFim: string,
  empresaId?: string | null
) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard-kpis-period", empresaId, periodoInicio, periodoFim],
    queryFn: async () => {
      const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;

      const { data, error } = await supabase.rpc("get_dashboard_kpis_period", {
        p_empresa_id: empresaParam,
        p_data_inicio: periodoInicio,
        p_data_fim: periodoFim,
      });

      if (error) {
        console.error("Erro ao buscar KPIs do dashboard:", error);
        throw error;
      }

      const kpis = data as unknown as DashboardKPIs | null;
      
      if (!kpis) {
        return DEFAULT_KPIS;
      }

      // Log para debug
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dashboard KPIs] Período: ${periodoInicio} a ${periodoFim}`);
        console.log(`  Faturamento: R$ ${kpis.faturamento_bruto.toFixed(2)}`);
        console.log(`  CMV: R$ ${kpis.cmv_total.toFixed(2)} (${kpis.cmv_itens_com_custo}/${kpis.cmv_total_itens} itens com custo)`);
        console.log(`  Despesas: R$ ${kpis.despesas_operacionais_total.toFixed(2)}`);
        console.log(`  Lucro Líquido: R$ ${kpis.lucro_liquido.toFixed(2)}`);
      }

      return kpis;
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const kpis = data || DEFAULT_KPIS;

  // Dados por canal formatados para gráficos
  const channelData = Object.entries(kpis.por_canal || {}).map(([canal, valores]) => ({
    channel: canal,
    valor: valores.liquido || 0,
    bruto: valores.bruto || 0,
    pedidos: valores.pedidos || 0,
  })).sort((a, b) => b.valor - a.valor);

  // Alertas de completude
  const alertas = {
    cmvIncompleto: !kpis.cmv_completo && kpis.cmv_total_itens > 0,
    semDespesas: kpis.qtd_despesas === 0,
    impostosEstimados: kpis.impostos_estimado,
  };

  return {
    kpis,
    channelData,
    alertas,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
