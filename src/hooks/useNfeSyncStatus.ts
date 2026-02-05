/**
 * Hook para gerenciar sincronizacao de NF-e via Distribuicao DF-e
 * Com suporte a realtime, reset de sync travada e deteccao de timeout
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

type InvokeErrorShape = {
  error?: string;
  code?: string;
  next_retry_at?: string | null;
  started_at?: string;
};

function parseInvokeError(err: unknown): Error & { code?: string; next_retry_at?: string } {
  try {
    // supabase-js retorna FunctionsHttpError com `context` contendo status/body
    const anyErr = err as {
      message?: string;
      context?: { status?: number; body?: unknown };
    };

    // Body pode vir como objeto ou string JSON
    let body: InvokeErrorShape | undefined;
    if (anyErr?.context?.body) {
      if (typeof anyErr.context.body === "string") {
        try {
          body = JSON.parse(anyErr.context.body);
        } catch {
          body = undefined;
        }
      } else {
        body = anyErr.context.body as InvokeErrorShape;
      }
    }

    const msg = body?.error || anyErr?.message || "Erro ao chamar função";
    const e = new Error(msg) as Error & { code?: string; next_retry_at?: string };
    e.code = body?.code;
    if (body?.next_retry_at) e.next_retry_at = body.next_retry_at;
    return e;
  } catch {
    // Fallback seguro se algo der errado no parse
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Error(msg) as Error & { code?: string; next_retry_at?: string };
  }
}

export interface NfeCertificate {
  cnpj: string;
  ambiente: string;
  uf: string;
  updated_at: string;
}

export interface NfeSyncState {
  status: "idle" | "running" | "error" | "completed" | "rate_limited";
  ult_nsu: number;
  max_nsu: number;
  last_sync_at: string | null;
  last_error: string | null;
  documents_fetched: number;
  credits_created: number;
  next_retry_at: string | null;
  updated_at?: string;
}

export interface NfeSyncLog {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface NfeDocument {
  access_key: string;
  nsu: number | null;
  schema_type: string | null;
  issue_date: string | null;
  total_value: number | null;
  processed: boolean;
  created_at: string;
}

export interface NfeStatusResponse {
  has_certificate: boolean;
  certificate: NfeCertificate | null;
  sync_state: NfeSyncState;
  stats: {
    total_documents: number;
    total_credits_from_sync: number;
  };
  recent_documents: NfeDocument[];
  logs: NfeSyncLog[];
}

// Timeout para considerar sync travada (em minutos)
const SYNC_STUCK_THRESHOLD_MINUTES = 3;

export function useNfeSyncStatus(empresaId?: string) {
  const queryClient = useQueryClient();
  const [isStuck, setIsStuck] = useState(false);

  // Query para buscar status
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["nfe-sync-status", empresaId],
    queryFn: async (): Promise<NfeStatusResponse> => {
      if (!empresaId) throw new Error("Empresa nao selecionada");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) throw new Error("Nao autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL nao configurado");

      console.debug("[NfeSyncStatus] Buscando status para empresa:", empresaId);

      const response = await fetch(
        `${supabaseUrl}/functions/v1/nfe-status?empresa_id=${encodeURIComponent(empresaId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        console.error("[NfeSyncStatus] Erro na resposta:", errData);
        throw new Error(errData.error || "Erro ao buscar status");
      }

      return response.json();
    },
    enabled: !!empresaId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Refetch mais frequente enquanto sincronizando
      if (data?.sync_state?.status === "running") {
        return 3000; // 3s durante sync
      }
      return 30000; // 30s quando idle
    },
  });

  // Detectar sync travada (running por muito tempo sem updates)
  useEffect(() => {
    if (data?.sync_state?.status === "running" && data?.sync_state?.updated_at) {
      const lastUpdate = new Date(data.sync_state.updated_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;
      
      setIsStuck(diffMinutes > SYNC_STUCK_THRESHOLD_MINUTES);
    } else {
      setIsStuck(false);
    }
  }, [data?.sync_state]);

  // Subscription realtime para nfe_sync_state
  useEffect(() => {
    if (!empresaId) return;

    console.debug("[NfeSyncStatus] Iniciando subscription realtime");

    const channel = supabase
      .channel(`nfe-sync-${empresaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nfe_sync_state",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          console.debug("[NfeSyncStatus] Realtime update:", payload);
          // Invalidar cache para refetch
          queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nfe_sync_logs",
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload) => {
          console.debug("[NfeSyncStatus] Novo log:", payload);
          // Invalidar cache para mostrar novos logs
          queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
        }
      )
      .subscribe();

    return () => {
      console.debug("[NfeSyncStatus] Removendo subscription");
      supabase.removeChannel(channel);
    };
  }, [empresaId, queryClient]);

  // Mutation para iniciar sincronizacao
  const startSync = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa nao selecionada");

      const { data, error } = await supabase.functions.invoke("nfe-sync-request", {
        body: {
          empresa_id: empresaId,
          action: "start",
        },
      });

      if (error) throw parseInvokeError(error);
      if (data?.error) {
        const err = new Error(data.error) as Error & { code?: string; next_retry_at?: string };
        err.code = data.code;
        err.next_retry_at = data.next_retry_at;
        throw err;
      }
      
      return data;
    },
    onSuccess: (data) => {
      toast.success("Sincronizacao iniciada em background");
      console.debug("[NfeSyncStatus] Sync iniciada:", data);
      queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
    },
    onError: (error: Error & { code?: string; next_retry_at?: string }) => {
      if (error.message.includes("NO_CERTIFICATE") || error.code === "NO_CERTIFICATE") {
        toast.error("Nenhum certificado A1 cadastrado. Configure um certificado primeiro.");
      } else if (error.code === "RATE_LIMITED" || error.message.includes("Rate limited")) {
        toast.warning(error.message);
      } else if (error.code === "SYNC_RUNNING" || error.message.includes("em andamento")) {
        toast.info(error.message);
      } else {
        toast.error(`Erro ao iniciar sincronizacao: ${error.message}`);
      }
    },
  });

  // Mutation para resetar sync travada
  const resetSync = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa nao selecionada");

      const { data, error } = await supabase.functions.invoke("nfe-sync-request", {
        body: {
          empresa_id: empresaId,
          action: "reset",
        },
      });

      if (error) throw parseInvokeError(error);
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      toast.success("Sincronizacao resetada. Voce pode tentar novamente.");
      setIsStuck(false);
      queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao resetar: ${error.message}`);
    },
  });

  // Calcular estados derivados
  const hasCert = data?.has_certificate === true;
  const isSyncing = hasCert && (data?.sync_state?.status === "running" || startSync.isPending);
  
  // Rate limited: status='rate_limited' OU (status='error' COM next_retry_at no futuro)
  const nextRetryAt = data?.sync_state?.next_retry_at;
  const isRateLimited = useMemo(() => {
    if (data?.sync_state?.status === "rate_limited") return true;
    if (data?.sync_state?.status === "error" && nextRetryAt) {
      const retryDate = new Date(nextRetryAt);
      return retryDate > new Date();
    }
    return false;
  }, [data?.sync_state?.status, nextRetryAt]);

  // Mensagem de erro (excluir se for rate limit)
  const lastError = isRateLimited ? null : data?.sync_state?.last_error;

  // Calcular tempo restante para retry
  const getTimeUntilRetry = useMemo(() => {
    if (!nextRetryAt) return null;
    const retryDate = new Date(nextRetryAt);
    const now = new Date();
    const diffMs = retryDate.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    
    const diffMinutes = Math.ceil(diffMs / 60000);
    if (diffMinutes >= 60) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}min`;
    }
    return `${diffMinutes} min`;
  }, [nextRetryAt]);

  return {
    status: data,
    isLoading,
    error,
    refetch,
    startSync,
    resetSync,
    isSyncing,
    isRateLimited,
    nextRetryAt,
    lastError,
    isStuck,
    timeUntilRetry: getTimeUntilRetry,
  };
}

// Hook separado para gerenciar certificados
export function useNfeCertificates(empresaId?: string) {
  const queryClient = useQueryClient();

  // Buscar certificado ativo
  const { data: certificate, isLoading } = useQuery({
    queryKey: ["nfe-certificate", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const { data, error } = await supabase
        .from("nfe_certificates")
        .select("id, cnpj, is_active, ambiente, uf, created_at, updated_at")
        .eq("empresa_id", empresaId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Mutation para adicionar/atualizar certificado
  const saveCertificate = useMutation({
    mutationFn: async (params: {
      cnpj: string;
      pfxBase64: string;
      password: string;
      ambiente: "producao" | "homologacao";
      uf: string;
    }) => {
      if (!empresaId) throw new Error("Empresa nao selecionada");

      const { data, error } = await supabase
        .from("nfe_certificates")
        .upsert(
          {
            empresa_id: empresaId,
            cnpj: params.cnpj,
            cert_pfx_encrypted: params.pfxBase64,
            cert_password_encrypted: params.password,
            ambiente: params.ambiente,
            uf: params.uf,
            is_active: true,
          },
          { onConflict: "empresa_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Certificado salvo com sucesso");
      queryClient.invalidateQueries({ queryKey: ["nfe-certificate", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar certificado: ${error.message}`);
    },
  });

  // Mutation para remover certificado
  const removeCertificate = useMutation({
    mutationFn: async (certificateId: string) => {
      const { error } = await supabase
        .from("nfe_certificates")
        .update({ is_active: false })
        .eq("id", certificateId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Certificado removido");
      queryClient.invalidateQueries({ queryKey: ["nfe-certificate", empresaId] });
      queryClient.invalidateQueries({ queryKey: ["nfe-sync-status", empresaId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover certificado: ${error.message}`);
    },
  });

  return {
    certificate,
    isLoading,
    saveCertificate,
    removeCertificate,
    hasCertificate: !!certificate,
  };
}
