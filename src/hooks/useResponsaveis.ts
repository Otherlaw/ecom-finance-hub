import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Responsavel {
  id: string;
  nome: string;
  funcao?: string | null;
  email?: string | null;
  ativo: boolean;
  empresa_id: string;
  created_at: string;
  updated_at: string;
}

interface ResponsavelInsert {
  nome: string;
  funcao?: string | null;
  email?: string | null;
  ativo?: boolean;
  empresa_id: string;
}

interface ResponsavelUpdate extends Partial<ResponsavelInsert> {
  id: string;
}

export const useResponsaveis = (empresaId?: string) => {
  const queryClient = useQueryClient();

  const { data: responsaveis, isLoading } = useQuery({
    queryKey: ["responsaveis", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      // Filter by empresa_id if provided
      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Responsavel[];
    },
  });

  const createResponsavel = useMutation({
    mutationFn: async (responsavel: ResponsavelInsert) => {
      const { data, error } = await supabase
        .from("responsaveis")
        .insert(responsavel)
        .select()
        .single();

      if (error) throw error;
      return data as Responsavel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
      toast.success("Responsável cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao cadastrar responsável: " + error.message);
    },
  });

  const updateResponsavel = useMutation({
    mutationFn: async ({ id, ...responsavel }: ResponsavelUpdate) => {
      const { data, error } = await supabase
        .from("responsaveis")
        .update(responsavel)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Responsavel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
      toast.success("Responsável atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar responsável: " + error.message);
    },
  });

  return {
    responsaveis,
    isLoading,
    createResponsavel,
    updateResponsavel,
  };
};
