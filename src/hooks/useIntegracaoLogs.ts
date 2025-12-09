import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Tipos baseados na estrutura real da tabela integracao_logs
export type IntegracaoLogStatus = "success" | "error" | "pending";

export interface IntegracaoLog {
  id: string;
  empresa_id: string;
  provider: string;
  tipo: string;
  status: IntegracaoLogStatus;
  registros_processados: number | null;
  registros_criados: number | null;
  registros_atualizados: number | null;
  registros_erro: number | null;
  mensagem: string | null;
  duracao_ms: number | null;
  detalhes: Record<string, unknown> | null;
  created_at: string;
}

export interface IntegracaoLogsFilters {
  provider?: string;
  periodo?: "7d" | "30d" | "90d";
}

interface UseIntegracaoLogsResult {
  logs: IntegracaoLog[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook para buscar logs de integração com filtros
 * @param empresaId - ID da empresa para filtrar logs
 * @param filters - Filtros opcionais (provider, período)
 */
export function useIntegracaoLogs(
  empresaId: string | undefined,
  filters: IntegracaoLogsFilters = {}
): UseIntegracaoLogsResult {
  const [logs, setLogs] = useState<IntegracaoLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calcula a data de início baseado no período selecionado
  const calcularDataInicio = useCallback((periodo: string): Date => {
    const hoje = new Date();
    switch (periodo) {
      case "7d":
        return new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!empresaId) {
      setLogs([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calcula data de início do período
      const dataInicio = calcularDataInicio(filters.periodo || "30d");

      // Monta a query base
      let query = supabase
        .from("integracao_logs")
        .select("*")
        .eq("empresa_id", empresaId)
        .gte("created_at", dataInicio.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      // Aplica filtro de provider se informado
      if (filters.provider && filters.provider !== "todos") {
        query = query.eq("provider", filters.provider);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      setLogs((data as IntegracaoLog[]) || []);
    } catch (err) {
      console.error("Erro ao buscar logs de integração:", err);
      setError("Não foi possível carregar o histórico de sincronizações.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId, filters.provider, filters.periodo, calcularDataInicio]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    isLoading,
    error,
    refetch: fetchLogs,
  };
}
