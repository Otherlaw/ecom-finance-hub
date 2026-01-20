import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Colaborador {
  id: string;
  user_id: string;
  empresa_id: string;
  role_na_empresa: "dono" | "admin" | "financeiro" | "operador";
  created_at: string;
  profile?: {
    id: string;
    nome: string | null;
    email: string | null;
  };
}

export const ROLES_LABELS: Record<string, string> = {
  dono: "Dono",
  admin: "Administrador",
  financeiro: "Financeiro",
  operador: "Operador",
};

export function useColaboradores(empresaId?: string) {
  const queryClient = useQueryClient();

  // Buscar colaboradores da empresa
  const { data: colaboradores, isLoading } = useQuery({
    queryKey: ["colaboradores", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("user_empresas")
        .select(`
          id,
          user_id,
          empresa_id,
          role_na_empresa,
          created_at
        `)
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao buscar colaboradores:", error);
        throw error;
      }

      // Buscar profiles separadamente para evitar problemas de FK
      const userIds = (data || []).map((d) => d.user_id);
      
      let profilesMap: Record<string, { id: string; nome: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p;
            return acc;
          }, {} as typeof profilesMap);
        }
      }

      // Combinar dados
      return (data || []).map((item) => ({
        ...item,
        profile: profilesMap[item.user_id] || null,
      })) as Colaborador[];
    },
    enabled: !!empresaId,
  });

  // Adicionar colaborador via Edge Function
  const adicionarColaborador = useMutation({
    mutationFn: async ({
      email,
      empresaId,
      role,
    }: {
      email: string;
      empresaId: string;
      role: Colaborador["role_na_empresa"];
    }) => {
      const { data, error } = await supabase.functions.invoke("add-user-to-empresa", {
        body: {
          email,
          empresa_id: empresaId,
          role_na_empresa: role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success(data.message || "Colaborador adicionado com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Erro ao adicionar colaborador:", error);
      toast.error(error.message || "Erro ao adicionar colaborador");
    },
  });

  // Atualizar role de colaborador
  const atualizarRole = useMutation({
    mutationFn: async ({
      vinculoId,
      novoRole,
    }: {
      vinculoId: string;
      novoRole: Colaborador["role_na_empresa"];
    }) => {
      const { error } = await supabase
        .from("user_empresas")
        .update({ role_na_empresa: novoRole })
        .eq("id", vinculoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Permissão atualizada!");
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar role:", error);
      toast.error("Erro ao atualizar permissão");
    },
  });

  // Remover colaborador
  const removerColaborador = useMutation({
    mutationFn: async (vinculoId: string) => {
      const { error } = await supabase
        .from("user_empresas")
        .delete()
        .eq("id", vinculoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      toast.success("Colaborador removido!");
    },
    onError: (error: Error) => {
      console.error("Erro ao remover colaborador:", error);
      toast.error("Erro ao remover colaborador");
    },
  });

  return {
    colaboradores: colaboradores ?? [],
    isLoading,
    adicionarColaborador,
    atualizarRole,
    removerColaborador,
  };
}
