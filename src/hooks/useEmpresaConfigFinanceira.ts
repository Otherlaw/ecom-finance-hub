import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmpresaConfigFinanceira {
  empresa_id: string;
  aliquota_imposto_vendas: number;
  aliquota_icms: number;
  aliquota_pis_cofins: number;
}

export interface EmpresaLogisticaConfig {
  empresa_id: string;
  flex_custo: number;
  flex_turbo_custo: number;
}

export function useEmpresaConfigFinanceira(empresaId: string | null) {
  const queryClient = useQueryClient();

  const { data: configFiscal, isLoading: loadingFiscal } = useQuery({
    queryKey: ["empresa-config-fiscal", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("empresas_config_fiscal")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaConfigFinanceira | null;
    },
    enabled: !!empresaId,
  });

  const { data: configLogistica, isLoading: loadingLogistica } = useQuery({
    queryKey: ["empresa-config-logistica", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("empresa_logistica_config")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data as EmpresaLogisticaConfig | null;
    },
    enabled: !!empresaId,
  });

  const salvarConfigFiscal = useMutation({
    mutationFn: async (config: Partial<EmpresaConfigFinanceira> & { empresa_id: string }) => {
      const { error } = await supabase
        .from("empresas_config_fiscal")
        .upsert(config, { onConflict: "empresa_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa-config-fiscal", empresaId] });
      toast.success("Configuração fiscal salva com sucesso");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const salvarConfigLogistica = useMutation({
    mutationFn: async (config: Partial<EmpresaLogisticaConfig> & { empresa_id: string }) => {
      const { error } = await supabase
        .from("empresa_logistica_config")
        .upsert(config, { onConflict: "empresa_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa-config-logistica", empresaId] });
      toast.success("Configuração de logística salva com sucesso");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  return {
    configFiscal,
    configLogistica,
    isLoading: loadingFiscal || loadingLogistica,
    salvarConfigFiscal,
    salvarConfigLogistica,
  };
}
