import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { format } from "date-fns";

export interface FechamentoMetrics {
  marketplace: {
    total_transacoes: number;
    total_creditos: number;
    total_debitos: number;
    total_bruto: number;
    total_tarifas: number;
    total_taxas: number;
    total_frete_comprador: number;
    total_frete_vendedor: number;
    total_custo_ads: number;
    conciliadas: number;
    pendentes: number;
  };
  por_canal: Record<string, {
    receita_bruta: number;
    receita_liquida: number;
    tarifas: number;
    total_transacoes: number;
  }>;
}

const defaultMetrics: FechamentoMetrics = {
  marketplace: {
    total_transacoes: 0,
    total_creditos: 0,
    total_debitos: 0,
    total_bruto: 0,
    total_tarifas: 0,
    total_taxas: 0,
    total_frete_comprador: 0,
    total_frete_vendedor: 0,
    total_custo_ads: 0,
    conciliadas: 0,
    pendentes: 0,
  },
  por_canal: {},
};

/**
 * Hook para buscar métricas de fechamento mensal via RPC.
 * 
 * PADRONIZADO: Envia datas como strings DATE (YYYY-MM-DD).
 * A RPC cuida do intervalo [inicio, fim_exclusivo) internamente.
 * 
 * @param periodoInicio - Data de início do período
 * @param periodoFim - Data de fim do período
 */
export function useFechamentoMetrics(periodoInicio: Date, periodoFim: Date) {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;
  
  // Converter para formato DATE (YYYY-MM-DD)
  const dataInicioStr = format(periodoInicio, "yyyy-MM-dd");
  const dataFimStr = format(periodoFim, "yyyy-MM-dd");
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fechamento-metrics', empresaId, dataInicioStr, dataFimStr],
    queryFn: async (): Promise<FechamentoMetrics> => {
      if (!empresaId) {
        return defaultMetrics;
      }
      
      // SIMPLIFICADO: Envia datas como strings DATE diretamente
      // A RPC converte para TIMESTAMPTZ e aplica [inicio, fim_exclusivo)
      const { data, error } = await supabase.rpc('get_fechamento_metrics', {
        p_empresa_id: empresaId,
        p_data_inicio: dataInicioStr,
        p_data_fim: dataFimStr,
      });
      
      if (error) {
        console.error('Erro ao buscar métricas do fechamento:', error);
        throw error;
      }
      
      // Log para debug de períodos
      if (process.env.NODE_ENV === 'development') {
        const parsed = data as unknown as FechamentoMetrics;
        console.log(`[Fechamento] Período: ${dataInicioStr} a ${dataFimStr} | Transações: ${parsed?.marketplace?.total_transacoes || 0}`);
      }
      
      // Safely parse the JSON response
      if (data && typeof data === 'object' && 'marketplace' in data && 'por_canal' in data) {
        return data as unknown as FechamentoMetrics;
      }
      
      return defaultMetrics;
    },
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
  
  return {
    metrics: data || defaultMetrics,
    isLoading,
    error,
    refetch,
  };
}
