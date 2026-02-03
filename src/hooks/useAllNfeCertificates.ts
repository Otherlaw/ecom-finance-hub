/**
 * Hook para buscar certificados de NF-e de todas as empresas do usuário
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfeCertificateSummary {
  id: string;
  empresa_id: string;
  cnpj: string;
  ambiente: string;
  uf: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAllNfeCertificates(empresaIds?: string[]) {
  return useQuery({
    queryKey: ["nfe-certificates-all", empresaIds],
    queryFn: async () => {
      if (!empresaIds || empresaIds.length === 0) return [];

      const { data, error } = await supabase
        .from("nfe_certificates")
        .select("id, empresa_id, cnpj, ambiente, uf, is_active, created_at, updated_at")
        .in("empresa_id", empresaIds)
        .eq("is_active", true);

      if (error) throw error;
      return data as NfeCertificateSummary[];
    },
    enabled: !!empresaIds && empresaIds.length > 0,
  });
}

export function useCertificateByEmpresa(empresaId?: string) {
  return useQuery({
    queryKey: ["nfe-certificate", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const { data, error } = await supabase
        .from("nfe_certificates")
        .select("id, empresa_id, cnpj, ambiente, uf, is_active, created_at, updated_at")
        .eq("empresa_id", empresaId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as NfeCertificateSummary | null;
    },
    enabled: !!empresaId,
  });
}
