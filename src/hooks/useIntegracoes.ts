import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos
export interface IntegracaoToken {
  id: string;
  empresa_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scope: string | null;
  user_id_provider: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegracaoConfig {
  id: string;
  empresa_id: string;
  provider: string;
  ativo: boolean;
  sync_frequency_minutes: number;
  last_sync_at: string | null;
  next_sync_at: string | null;
  auto_categorize: boolean;
  auto_reconcile: boolean;
  webhook_enabled: boolean;
  webhook_secret: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegracaoLog {
  id: string;
  empresa_id: string;
  provider: string;
  tipo: string;
  status: string;
  mensagem: string | null;
  registros_processados: number;
  registros_criados: number;
  registros_atualizados: number;
  registros_erro: number;
  detalhes: Record<string, unknown>;
  duracao_ms: number | null;
  created_at: string;
}

export type Provider = "mercado_livre" | "shopee" | "nubank" | "itau" | "pluggy";

export interface IntegracaoStatus {
  provider: Provider;
  connected: boolean;
  config: IntegracaoConfig | null;
  token: IntegracaoToken | null;
  lastSync: IntegracaoLog | null;
}

interface UseIntegracoesParams {
  empresaId?: string;
}

export const useIntegracoes = ({ empresaId }: UseIntegracoesParams = {}) => {
  const queryClient = useQueryClient();

  // Buscar tokens
  const { data: tokens, isLoading: loadingTokens } = useQuery({
    queryKey: ["integracao_tokens", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("integracao_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IntegracaoToken[];
    },
    enabled: !!empresaId,
  });

  // Buscar configurações
  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["integracao_config", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("integracao_config")
        .select("*")
        .order("created_at", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IntegracaoConfig[];
    },
    enabled: !!empresaId,
  });

  // Buscar logs recentes
  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["integracao_logs", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("integracao_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as IntegracaoLog[];
    },
    enabled: !!empresaId,
  });

  // Status consolidado por provider
  const getIntegracaoStatus = (provider: Provider): IntegracaoStatus => {
    const token = tokens?.find((t) => t.provider === provider) || null;
    const config = configs?.find((c) => c.provider === provider) || null;
    const lastSync = logs?.find(
      (l) => l.provider === provider && l.tipo === "sync"
    ) || null;

    return {
      provider,
      connected: !!token && (!token.expires_at || new Date(token.expires_at) > new Date()),
      config,
      token,
      lastSync,
    };
  };

  // Criar/atualizar configuração
  const upsertConfig = useMutation({
    mutationFn: async (data: Partial<IntegracaoConfig> & { empresa_id: string; provider: string }) => {
      const { data: result, error } = await supabase
        .from("integracao_config")
        .upsert(data as any, { onConflict: "empresa_id,provider" })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracao_config"] });
      toast.success("Configuração salva!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar configuração: " + error.message);
    },
  });

  // Desconectar integração (remove token)
  const disconnect = useMutation({
    mutationFn: async ({ empresaId, provider }: { empresaId: string; provider: Provider }) => {
      const { error } = await supabase
        .from("integracao_tokens")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("provider", provider);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracao_tokens"] });
      queryClient.invalidateQueries({ queryKey: ["integracao_config"] });
      toast.success("Integração desconectada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao desconectar: " + error.message);
    },
  });

  // Registrar log
  const addLog = useMutation({
    mutationFn: async (data: Omit<IntegracaoLog, "id" | "created_at">) => {
      const { data: result, error } = await supabase
        .from("integracao_logs")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracao_logs"] });
    },
  });

  // Iniciar OAuth do Mercado Livre
  const startMercadoLivreOAuth = async (empresaId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("ml-oauth-start", {
        body: { empresa_id: empresaId },
      });

      if (error) throw error;
      
      if (data?.auth_url) {
        // Abrir popup de autorização
        const popup = window.open(data.auth_url, "ml-oauth", "width=600,height=700");
        
        // Listener para mensagem do popup quando OAuth completar
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === "ML_OAUTH_SUCCESS") {
            // Refetch dados para atualizar UI
            queryClient.invalidateQueries({ queryKey: ["integracao_tokens"] });
            queryClient.invalidateQueries({ queryKey: ["integracao_config"] });
            toast.success("Mercado Livre conectado com sucesso!");
            window.removeEventListener("message", handleMessage);
          }
        };
        
        window.addEventListener("message", handleMessage);
        
        // Fallback: monitorar fechamento do popup
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handleMessage);
            // Refetch de qualquer forma quando popup fechar
            queryClient.invalidateQueries({ queryKey: ["integracao_tokens"] });
            queryClient.invalidateQueries({ queryKey: ["integracao_config"] });
          }
        }, 500);
      }
      
      return data;
    } catch (error) {
      console.error("Erro ao iniciar OAuth ML:", error);
      toast.error("Erro ao conectar com Mercado Livre");
      throw error;
    }
  };

  // Sincronizar manualmente
  const syncManually = useMutation({
    mutationFn: async ({ empresaId, provider }: { empresaId: string; provider: Provider }) => {
      const functionName = provider === "mercado_livre" ? "ml-sync-orders" : `${provider}-sync`;
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { empresa_id: empresaId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["integracao_logs"] });
      queryClient.invalidateQueries({ queryKey: ["integracao_config"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      toast.success(`Sincronização concluída: ${data?.registros_processados || 0} registros`);
    },
    onError: (error: Error) => {
      toast.error("Erro na sincronização: " + error.message);
    },
  });

  return {
    tokens,
    configs,
    logs,
    isLoading: loadingTokens || loadingConfigs || loadingLogs,
    getIntegracaoStatus,
    upsertConfig,
    disconnect,
    addLog,
    startMercadoLivreOAuth,
    syncManually,
  };
};
