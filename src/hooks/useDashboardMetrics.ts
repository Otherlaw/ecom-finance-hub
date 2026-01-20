import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
 * PADRONIZADO: Envia datas como strings DATE (YYYY-MM-DD).
 * A RPC cuida do intervalo [inicio, fim_exclusivo) internamente.
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
      // Passa null quando empresaId é undefined/"todas" para buscar todas as empresas
      const empresaParam = empresaId && empresaId !== "todas" ? empresaId : null;

      // Tenta usar a RPC otimizada (materialized view) primeiro
      // Fallback para a RPC original se a fast não estiver disponível
      let result;
      
      const { data: fastData, error: fastError } = await supabase.rpc("get_dashboard_metrics_fast", {
        p_empresa_id: empresaParam,
        p_data_inicio: periodoInicio,
        p_data_fim: periodoFim,
      });

      if (!fastError && fastData) {
        result = fastData;
      } else {
        // Fallback para RPC original
        const { data, error } = await supabase.rpc("get_dashboard_metrics", {
          p_empresa_id: empresaParam,
          p_data_inicio: periodoInicio,
          p_data_fim: periodoFim,
        });
        
        if (error) {
          console.error("Erro ao buscar métricas do dashboard:", error);
          throw error;
        }
        result = data;
      }

      // RPC retorna JSONB diretamente
      const metrics = result as unknown as DashboardMetrics | null;
      
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

      // Log para debug de períodos
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dashboard] Período: ${periodoInicio} a ${periodoFim} | Pedidos: ${metrics.pedidos_unicos} | Receita: R$ ${metrics.receita_bruta.toFixed(2)}`);
      }

      return metrics;
    },
    staleTime: 30 * 1000, // Cache por 30 segundos
    placeholderData: (previousData) => previousData, // Mantém dados anteriores durante refetch
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
