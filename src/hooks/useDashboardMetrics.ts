import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildUtcRangeFromStrings } from "@/lib/dateRangeUtc";

/**
 * Métricas agregadas do dashboard retornadas pela RPC
 */
export interface DashboardMetrics {
  receita_bruta: number;
  receita_liquida: number;
  total_tarifas: number;
  total_ads: number;
  total_frete_vendedor: number;
  total_frete_comprador: number;
  pedidos_unicos: number;
  total_transacoes: number;
  por_canal: Record<string, { bruto: number; liquido: number; pedidos: number }>;
}

/**
 * Hook otimizado para buscar métricas do dashboard via RPC.
 * Retorna dados agregados em uma única chamada ao invés de
 * carregar todas as transações e calcular no frontend.
 * 
 * @param periodoInicio - Data de início no formato "yyyy-MM-dd"
 * @param periodoFim - Data de fim no formato "yyyy-MM-dd"
 * @param empresaId - ID da empresa ou undefined/null para todas as empresas
 */
export function useDashboardMetrics(
  periodoInicio: string, 
  periodoFim: string,
  empresaId?: string | null
) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard-metrics", empresaId, periodoInicio, periodoFim],
    queryFn: async () => {
      // Usar helper para converter datas locais para UTC consistente
      const { startUtcIso, endUtcIsoExclusive } = buildUtcRangeFromStrings(periodoInicio, periodoFim);

      // Passa null quando empresaId é undefined/"todas" para buscar todas as empresas
      const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;

      const { data, error } = await supabase.rpc("get_dashboard_metrics", {
        p_empresa_id: empresaParam,
        p_data_inicio: startUtcIso,
        p_data_fim: endUtcIsoExclusive,
      });

      if (error) {
        console.error("Erro ao buscar métricas do dashboard:", error);
        throw error;
      }

      // RPC retorna JSONB diretamente
      const metrics = data as unknown as DashboardMetrics | null;
      
      if (!metrics) {
        return {
          receita_bruta: 0,
          receita_liquida: 0,
          total_tarifas: 0,
          total_ads: 0,
          total_frete_vendedor: 0,
          total_frete_comprador: 0,
          pedidos_unicos: 0,
          total_transacoes: 0,
          por_canal: {},
        } as DashboardMetrics;
      }

      return metrics;
    },
    staleTime: 30 * 1000, // Cache por 30 segundos
  });

  // Calcular métricas derivadas
  const metrics = data || {
    receita_bruta: 0,
    receita_liquida: 0,
    total_tarifas: 0,
    total_ads: 0,
    total_frete_vendedor: 0,
    total_frete_comprador: 0,
    pedidos_unicos: 0,
    total_transacoes: 0,
    por_canal: {},
  };

  const ticketMedio = metrics.pedidos_unicos > 0 
    ? metrics.receita_bruta / metrics.pedidos_unicos 
    : 0;

  // Dados por canal formatados para gráficos
  const channelData = Object.entries(metrics.por_canal || {}).map(([canal, valores]) => ({
    channel: canal,
    valor: valores.liquido || 0,
    bruto: valores.bruto || 0,
    pedidos: valores.pedidos || 0,
  })).sort((a, b) => b.valor - a.valor);

  return {
    metrics,
    ticketMedio,
    channelData,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
