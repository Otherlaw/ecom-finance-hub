import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useResponsaveis = () => {
  const queryClient = useQueryClient();

  const { data: responsaveis, isLoading } = useQuery({
    queryKey: ["responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsaveis")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const createResponsavel = useMutation({
    mutationFn: async (responsavel: any) => {
      const { data, error } = await supabase
        .from("responsaveis")
        .insert(responsavel)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
      toast.success("Responsável cadastrado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar responsável: " + error.message);
    },
  });

  const updateResponsavel = useMutation({
    mutationFn: async ({ id, ...responsavel }: any) => {
      const { data, error } = await supabase
        .from("responsaveis")
        .update(responsavel)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsaveis"] });
      toast.success("Responsável atualizado com sucesso!");
    },
    onError: (error: any) => {
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
