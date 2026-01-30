import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export type RoleType = "admin" | "financeiro" | "socio" | "operador";

export interface Usuario {
  id: string;
  email: string;
  nome: string | null;
  role: RoleType;
  empresas: { id: string; razao_social: string; role_na_empresa: string }[];
  created_at: string;
}

export function useUsuarios() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  // Buscar usuários - APENAS para admins globais
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      // Verificação de segurança: apenas admins podem listar todos os usuários
      if (!isAdmin) {
        console.warn("Tentativa de acesso à lista de usuários sem permissão de admin");
        return [];
      }

      // Buscar todos os profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, created_at");

      if (profilesError) throw profilesError;

      // Buscar roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Buscar vínculos com empresas
      const { data: userEmpresas, error: empresasError } = await supabase
        .from("user_empresas")
        .select("user_id, empresa_id, role_na_empresa, empresas(id, razao_social)");

      if (empresasError) throw empresasError;

      // Montar objeto de usuários
      const usuariosMap = new Map<string, Usuario>();

      profiles?.forEach((profile) => {
        usuariosMap.set(profile.id, {
          id: profile.id,
          email: profile.email || "",
          nome: profile.nome,
          role: "operador", // default
          empresas: [],
          created_at: profile.created_at,
        });
      });

      // Adicionar roles
      roles?.forEach((r) => {
        const user = usuariosMap.get(r.user_id);
        if (user) {
          user.role = r.role as RoleType;
        }
      });

      // Adicionar empresas
      userEmpresas?.forEach((ue) => {
        const user = usuariosMap.get(ue.user_id);
        if (user && ue.empresas) {
          const empresa = ue.empresas as { id: string; razao_social: string };
          user.empresas.push({
            id: empresa.id,
            razao_social: empresa.razao_social,
            role_na_empresa: ue.role_na_empresa,
          });
        }
      });

      return Array.from(usuariosMap.values());
    },
  });

  // Atualizar role do usuário
  const atualizarRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: RoleType }) => {
      // Verificar se já existe role
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Inserir
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Perfil atualizado com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar role:", error);
      toast.error("Erro ao atualizar perfil");
    },
  });

  // Atualizar empresas do usuário
  const atualizarEmpresas = useMutation({
    mutationFn: async ({ 
      userId, 
      empresaIds,
      roleNaEmpresa = "operador"
    }: { 
      userId: string; 
      empresaIds: string[];
      roleNaEmpresa?: string;
    }) => {
      // Remover vínculos antigos
      const { error: deleteError } = await supabase
        .from("user_empresas")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Inserir novos vínculos
      if (empresaIds.length > 0) {
        const inserts = empresaIds.map((empresaId) => ({
          user_id: userId,
          empresa_id: empresaId,
          role_na_empresa: roleNaEmpresa,
        }));

        const { error: insertError } = await supabase
          .from("user_empresas")
          .insert(inserts);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast.success("Empresas atualizadas com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao atualizar empresas:", error);
      toast.error("Erro ao atualizar empresas");
    },
  });

  // Excluir usuário (admin global apenas)
  const excluirUsuario = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-auth-user", {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });

      const empresasExcluidas = data?.empresas_deletadas?.length || 0;
      const msg = empresasExcluidas > 0
        ? `Usuário e ${empresasExcluidas} empresa(s) excluídos com sucesso`
        : "Usuário excluído com sucesso";
      
      toast.success(msg);
    },
    onError: (error: Error) => {
      console.error("Erro ao excluir usuário:", error);
      toast.error("Erro ao excluir usuário: " + error.message);
    },
  });

  return {
    usuarios: usuarios ?? [],
    isLoading,
    atualizarRole,
    atualizarEmpresas,
    excluirUsuario,
  };
}
