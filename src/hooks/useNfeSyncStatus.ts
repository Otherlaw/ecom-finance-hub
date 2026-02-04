/**
 * Hook para gerenciar sincronizacao de NF-e via Distribuicao DF-e
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useNfeSyncStatus(empresaId?: string) {
  const queryClient = useQueryClient();

  // Query para buscar status
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["nfe-sync-status", empresaId],
    queryFn: async (): Promise<NfeStatusResponse> => {
      if (!empresaId) throw new Error("Empresa nao selecionada");

      // Usar fetch direto pois invoke nao suporta GET com query params
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
      // Refetch a cada 5s enquanto estiver sincronizando
      const data = query.state.data;
      if (data?.sync_state?.status === "running") {
        return 5000;
      }
      return false;
    },
  });

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

      if (error) throw error;
      if (data?.error) {
        // Incluir codigo e next_retry_at no erro se disponivel
        const err = new Error(data.error) as Error & { code?: string; next_retry_at?: string };
        err.code = data.code;
        err.next_retry_at = data.next_retry_at;
        throw err;
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Sincronizacao iniciada");
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

  // Só considera "syncing" se há certificado E (status running OU mutation pending)
  const hasCert = data?.has_certificate === true;
  const isSyncing = hasCert && (data?.sync_state?.status === "running" || startSync.isPending);
  
  // ★ RATE LIMITED: status='rate_limited' OU (status='error' COM next_retry_at no futuro)
  const nextRetryAt = data?.sync_state?.next_retry_at;
  const isRateLimited = (() => {
    if (data?.sync_state?.status === "rate_limited") return true;
    if (data?.sync_state?.status === "error" && nextRetryAt) {
      const retryDate = new Date(nextRetryAt);
      return retryDate > new Date();
    }
    return false;
  })();

  // ★ Mensagem de erro (excluir se for rate limit, pois já mostramos separadamente)
  const lastError = isRateLimited ? null : data?.sync_state?.last_error;

  return {
    status: data,
    isLoading,
    error,
    refetch,
    startSync,
    isSyncing,
    isRateLimited,
    nextRetryAt,
    lastError,
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

      // NOTA: Em producao, a criptografia deve ser feita no servidor
      // Aqui estamos passando os dados para o servidor criptografar
      // O worker externo tera a chave para descriptografar

      // Por enquanto, salvamos sem criptografia real (para demonstracao)
      // Em producao, deve-se chamar uma edge function que criptografa com CERT_MASTER_KEY

      const { data, error } = await supabase
        .from("nfe_certificates")
        .upsert(
          {
            empresa_id: empresaId,
            cnpj: params.cnpj,
            cert_pfx_encrypted: params.pfxBase64, // Em prod: criptografar
            cert_password_encrypted: params.password, // Em prod: criptografar
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
