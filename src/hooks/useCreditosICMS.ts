import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TipoCreditoICMS, OrigemCredito, StatusCredito } from "@/lib/icms-data";

export interface CreditoICMSDB {
  id: string;
  empresa_id: string;
  tipo_credito: TipoCreditoICMS;
  origem_credito: OrigemCredito;
  status_credito: StatusCredito;
  chave_acesso: string | null;
  numero_nf: string | null;
  ncm: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  uf_origem: string | null;
  cfop: string | null;
  aliquota_icms: number;
  valor_icms_destacado: number;
  percentual_aproveitamento: number;
  valor_credito_bruto: number;
  valor_ajustes: number;
  valor_credito: number;
  data_lancamento: string;
  data_competencia: string;
  observacoes: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  empresas?: {
    razao_social: string;
    regime_tributario: string;
  };
}

export interface CreditoICMSInsert {
  empresa_id: string;
  tipo_credito: TipoCreditoICMS;
  origem_credito: OrigemCredito;
  status_credito?: StatusCredito;
  chave_acesso?: string | null;
  numero_nf?: string | null;
  ncm: string;
  descricao: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
  uf_origem?: string | null;
  cfop?: string | null;
  aliquota_icms?: number;
  valor_icms_destacado?: number;
  percentual_aproveitamento?: number;
  valor_credito_bruto?: number;
  valor_ajustes?: number;
  valor_credito: number;
  data_lancamento?: string;
  data_competencia: string;
  observacoes?: string | null;
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
}

export interface CreditoICMSUpdate extends Partial<CreditoICMSInsert> {
  id: string;
}

export function useCreditosICMS(empresaId?: string) {
  const queryClient = useQueryClient();

  // Fetch all credits with optional empresa filter
  const { data: creditos = [], isLoading, refetch } = useQuery({
    queryKey: ["creditos_icms", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("creditos_icms")
        .select(`
          *,
          empresas:empresa_id (
            razao_social,
            regime_tributario
          )
        `)
        .order("data_lancamento", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching creditos ICMS:", error);
        throw error;
      }

      return (data || []) as CreditoICMSDB[];
    },
  });

  // Get existing access keys for duplicate checking
  const existingKeys = creditos
    .filter((c) => c.chave_acesso)
    .map((c) => c.chave_acesso as string);

  // Create single credit
  const createCredito = useMutation({
    mutationFn: async (credito: CreditoICMSInsert) => {
      const { data, error } = await supabase
        .from("creditos_icms")
        .insert(credito)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos_icms"] });
      toast.success("Crédito de ICMS cadastrado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating credito:", error);
      toast.error("Erro ao cadastrar crédito de ICMS.");
    },
  });

  // Create multiple credits (for XML import)
  const createMultipleCreditos = useMutation({
    mutationFn: async (creditos: CreditoICMSInsert[]) => {
      if (creditos.length === 0) return [];

      const { data, error } = await supabase
        .from("creditos_icms")
        .insert(creditos)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["creditos_icms"] });
      toast.success(`${data?.length || 0} crédito(s) de ICMS importados com sucesso!`);
    },
    onError: (error) => {
      console.error("Error creating multiple creditos:", error);
      toast.error("Erro ao importar créditos de ICMS.");
    },
  });

  // Update credit
  const updateCredito = useMutation({
    mutationFn: async ({ id, ...credito }: CreditoICMSUpdate) => {
      const { data, error } = await supabase
        .from("creditos_icms")
        .update(credito)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos_icms"] });
      toast.success("Crédito de ICMS atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating credito:", error);
      toast.error("Erro ao atualizar crédito de ICMS.");
    },
  });

  // Delete credit
  const deleteCredito = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("creditos_icms")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos_icms"] });
      toast.success("Crédito de ICMS excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting credito:", error);
      toast.error("Erro ao excluir crédito de ICMS.");
    },
  });

  return {
    creditos,
    isLoading,
    refetch,
    existingKeys,
    createCredito,
    createMultipleCreditos,
    updateCredito,
    deleteCredito,
  };
}
