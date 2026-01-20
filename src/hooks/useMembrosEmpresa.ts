import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { toast } from "sonner";

interface Membro {
  user_id: string;
  email: string;
  nome: string | null;
  role_na_empresa: string;
  created_at: string;
}

interface AddMemberResult {
  success: boolean;
  error?: string;
  message?: string;
  user_id?: string;
}

export function useMembrosEmpresa() {
  const { empresaAtiva } = useEmpresaAtiva();
  const empresaSelecionada = empresaAtiva?.id;
  const queryClient = useQueryClient();

  const { data: membros, isLoading, error, refetch } = useQuery({
    queryKey: ["membros-empresa", empresaSelecionada],
    queryFn: async () => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        return [];
      }

      const { data, error } = await supabase.rpc("get_empresa_members", {
        p_empresa_id: empresaSelecionada,
      });

      if (error) throw error;
      return (data as Membro[]) || [];
    },
    enabled: !!empresaSelecionada && empresaSelecionada !== "todas",
  });

  const addMembro = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa");
      }

      const { data, error } = await supabase.rpc("add_user_to_empresa_by_email", {
        p_empresa_id: empresaSelecionada,
        p_email: email,
        p_role: role,
      });

      if (error) throw error;
      return data as unknown as AddMemberResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Membro adicionado com sucesso");
        queryClient.invalidateQueries({ queryKey: ["membros-empresa", empresaSelecionada] });
      } else {
        toast.error(result.error || "Erro ao adicionar membro");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const removeMembro = useMutation({
    mutationFn: async (userId: string) => {
      if (!empresaSelecionada || empresaSelecionada === "todas") {
        throw new Error("Selecione uma empresa");
      }

      const { data, error } = await supabase.rpc("remove_user_from_empresa", {
        p_empresa_id: empresaSelecionada,
        p_user_id: userId,
      });

      if (error) throw error;
      return data as unknown as AddMemberResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || "Membro removido com sucesso");
        queryClient.invalidateQueries({ queryKey: ["membros-empresa", empresaSelecionada] });
      } else {
        toast.error(result.error || "Erro ao remover membro");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    membros: membros || [],
    isLoading,
    error,
    refetch,
    addMembro,
    removeMembro,
  };
}
