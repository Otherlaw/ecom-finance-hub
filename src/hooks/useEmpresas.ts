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
      // 1. Obter usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 2. Criar a empresa
      const { data, error } = await supabase
        .from("empresas")
        .insert(empresa)
        .select()
        .single();

      if (error) throw error;

      // 3. Vincular usuário à empresa como "dono"
      const { error: vinculoError } = await supabase
        .from("user_empresas")
        .insert({
          user_id: user.id,
          empresa_id: data.id,
          role_na_empresa: "dono",
        });

      if (vinculoError) {
        // Rollback: excluir empresa se vínculo falhar
        await supabase.from("empresas").delete().eq("id", data.id);
        throw vinculoError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
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

  const deleteEmpresa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("empresas")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa excluída com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir empresa: " + error.message);
    },
  });

  return {
    empresas: empresas ?? [],
    isLoading,
    createEmpresa,
    updateEmpresa,
    deleteEmpresa,
  };
};