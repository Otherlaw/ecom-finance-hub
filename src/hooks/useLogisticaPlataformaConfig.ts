import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LogisticaPlataformaConfig {
  id: string;
  empresa_id: string;
  canal: string;      // 'Mercado Livre' | 'Shopee'
  tipo_envio: string; // 'flex' | 'flex_turbo'
  custo: number;
  atualizado_em: string;
}

export const CANAIS_LOGISTICA = ["Mercado Livre", "Shopee"] as const;
export const TIPOS_ENVIO_FLEX = ["flex", "flex_turbo"] as const;

export function useLogisticaPlataformaConfig(empresaId: string | null) {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ["logistica-plataforma-config", empresaId],
    queryFn: async () => {
      if (!empresaId) return [] as LogisticaPlataformaConfig[];
      const { data, error } = await supabase
        .from("logistica_plataforma_config" as any)
        .select("*")
        .eq("empresa_id", empresaId)
        .order("canal")
        .order("tipo_envio");
      if (error) throw error;
      return ((data as unknown) || []) as LogisticaPlataformaConfig[];
    },
    enabled: !!empresaId,
  });

  /** Retorna custo para canal+tipo específico (0 se não configurado) */
  const getCusto = (canal: string, tipoEnvio: string): number => {
    if (!configs) return 0;
    return configs.find(c => c.canal === canal && c.tipo_envio === tipoEnvio)?.custo ?? 0;
  };

  const salvarCusto = useMutation({
    mutationFn: async ({
      canal,
      tipo_envio,
      custo,
    }: {
      canal: string;
      tipo_envio: string;
      custo: number;
    }) => {
      if (!empresaId) throw new Error("Empresa não selecionada");
      const { error } = await supabase
        .from("logistica_plataforma_config" as any)
        .upsert(
          {
            empresa_id: empresaId,
            canal,
            tipo_envio,
            custo,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: "empresa_id,canal,tipo_envio" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistica-plataforma-config", empresaId] });
      toast.success("Custo de logística salvo");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  /** Salva um mapa completo {canal_tipoenvio: custo} de uma vez */
  const salvarTodos = useMutation({
    mutationFn: async (
      rows: { canal: string; tipo_envio: string; custo: number }[]
    ) => {
      if (!empresaId) throw new Error("Empresa não selecionada");
      const payload = rows.map(r => ({
        empresa_id: empresaId,
        canal: r.canal,
        tipo_envio: r.tipo_envio,
        custo: r.custo,
        atualizado_em: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("logistica_plataforma_config" as any)
        .upsert(payload, { onConflict: "empresa_id,canal,tipo_envio" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["logistica-plataforma-config", empresaId] });
      toast.success("Configurações de logística salvas");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  return {
    configs: configs || [],
    isLoading,
    getCusto,
    salvarCusto,
    salvarTodos,
  };
}
