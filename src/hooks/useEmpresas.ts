import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEmpresas = () => {
  const queryClient = useQueryClient();

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .order("razao_social");

      if (error) throw error;
      return data;
    },
  });

  const createEmpresa = useMutation({
    mutationFn: async (empresa: any) => {
      const { data, error } = await supabase
        .from("empresas")
        .insert(empresa)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa cadastrada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar empresa: " + error.message);
    },
  });

  const updateEmpresa = useMutation({
    mutationFn: async ({ id, ...empresa }: any) => {
      const { data, error } = await supabase
        .from("empresas")
        .update(empresa)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar empresa: " + error.message);
    },
  });

  return {
    empresas,
    isLoading,
    createEmpresa,
    updateEmpresa,
  };
};