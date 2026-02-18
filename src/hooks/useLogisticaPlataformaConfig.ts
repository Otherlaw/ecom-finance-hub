import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";

export interface LogisticaPlataformaConfigItem {
  id?: string;
  empresa_id: string;
  canal: string;
  tipo_envio: string;
  custo: number;
}

// Combinações gerenciadas pelo card
export const LOGISTICA_CONFIGS = [
  { canal: "Mercado Livre", tipo_envio: "flex",       label: "Flex" },
  { canal: "Mercado Livre", tipo_envio: "flex_turbo", label: "Flex Turbo" },
  { canal: "Shopee",        tipo_envio: "flex",       label: "Flex" },
  { canal: "Shopee",        tipo_envio: "flex_turbo", label: "Flex Turbo" },
] as const;

export function useLogisticaPlataformaConfig() {
  const queryClient = useQueryClient();
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaId = empresaAtiva?.id ?? null;

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["logistica-plataforma-config", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from("logistica_plataforma_config")
        .select("*")
        .eq("empresa_id", empresaId);
      if (error) throw error;
      return data as LogisticaPlataformaConfigItem[];
    },
    enabled: !!empresaId,
  });

  const salvar = useMutation({
    mutationFn: async (items: Omit<LogisticaPlataformaConfigItem, "id">[]) => {
      if (!empresaId) throw new Error("Nenhuma empresa selecionada");
      // upsert por (empresa_id, canal, tipo_envio)
      const { error } = await supabase
        .from("logistica_plataforma_config")
        .upsert(
          items.map((i) => ({ ...i, empresa_id: empresaId })),
          { onConflict: "empresa_id,canal,tipo_envio" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistica-plataforma-config", empresaId] });
      toast.success("Custos de logística salvos com sucesso");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  /** Retorna o custo para uma combinação específica */
  function getCusto(canal: string, tipo_envio: string): number {
    return configs.find((c) => c.canal === canal && c.tipo_envio === tipo_envio)?.custo ?? 0;
  }

  return { configs, isLoading, salvar, getCusto, empresaId };
}
