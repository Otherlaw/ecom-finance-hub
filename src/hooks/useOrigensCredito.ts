import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OrigemCredito {
  id: string;
  empresa_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrigemCreditoInsert {
  empresa_id: string;
  nome: string;
  ativo?: boolean;
}

// Origens padrão do sistema
export const ORIGENS_PADRAO = [
  { value: "compra_mercadoria", label: "Compra de Mercadoria p/ Revenda" },
  { value: "compra_insumo", label: "Compra de Insumo" },
  { value: "energia_eletrica", label: "Energia Elétrica" },
  { value: "ativo_imobilizado", label: "Ativo Imobilizado" },
  { value: "outro", label: "Outro (especificar)" },
];

export function useOrigensCredito(empresaId?: string) {
  const queryClient = useQueryClient();

  const { data: origensPersonalizadas = [], isLoading, refetch } = useQuery({
    queryKey: ["origens_credito_icms", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      const { data, error } = await supabase
        .from("origens_credito_icms")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao buscar origens de crédito:", error);
        throw error;
      }

      return (data || []) as OrigemCredito[];
    },
    enabled: !!empresaId,
  });

  const createOrigem = useMutation({
    mutationFn: async (origem: OrigemCreditoInsert) => {
      const { data, error } = await supabase
        .from("origens_credito_icms")
        .insert(origem)
        .select()
        .single();

      if (error) throw error;
      return data as OrigemCredito;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["origens_credito_icms"] });
      toast.success(`Origem "${data.nome}" criada com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar origem: ${error.message}`);
    },
  });

  const deleteOrigem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("origens_credito_icms")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["origens_credito_icms"] });
      toast.success("Origem removida com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover origem: ${error.message}`);
    },
  });

  // Combinar origens padrão com personalizadas
  const todasOrigens = [
    ...ORIGENS_PADRAO,
    ...origensPersonalizadas.map((o) => ({
      value: `custom_${o.id}`,
      label: o.nome,
      isCustom: true,
    })),
  ];

  // Função para obter o label de uma origem pelo value
  const getOrigemLabel = (value: string): string => {
    if (value.startsWith("custom_")) {
      const id = value.replace("custom_", "");
      const origem = origensPersonalizadas.find((o) => o.id === id);
      return origem?.nome || value;
    }
    const padrao = ORIGENS_PADRAO.find((o) => o.value === value);
    return padrao?.label || value;
  };

  return {
    origensPersonalizadas,
    todasOrigens,
    isLoading,
    refetch,
    createOrigem,
    deleteOrigem,
    getOrigemLabel,
  };
}
