import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";

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

export function useFechamentoMetrics(periodoInicio: Date, periodoFim: Date) {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id;
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fechamento-metrics', empresaId, periodoInicio.toISOString(), periodoFim.toISOString()],
    queryFn: async (): Promise<FechamentoMetrics> => {
      if (!empresaId) {
        return defaultMetrics;
      }
      
      const { data, error } = await supabase.rpc('get_fechamento_metrics', {
        p_empresa_id: empresaId,
        p_data_inicio: periodoInicio.toISOString(),
        p_data_fim: periodoFim.toISOString(),
      });
      
      if (error) {
        console.error('Erro ao buscar métricas do fechamento:', error);
        throw error;
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
