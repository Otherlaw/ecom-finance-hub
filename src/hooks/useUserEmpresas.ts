import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UserEmpresa {
  id: string;
  user_id: string;
  empresa_id: string;
  role_na_empresa: "dono" | "admin" | "financeiro" | "operador";
  created_at: string;
}

export function useUserEmpresas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar vínculos do usuário
  const { data: userEmpresas, isLoading } = useQuery({
    queryKey: ["user-empresas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_empresas")
        .select("*")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data as UserEmpresa[];
    },
    enabled: !!user?.id,
  });

  // Vincular usuário a empresa
  const vincularEmpresa = useMutation({
    mutationFn: async ({ 
      empresaId, 
      role = "operador" 
    }: { 
      empresaId: string; 
      role?: UserEmpresa["role_na_empresa"]; 
    }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("user_empresas")
        .insert({
          user_id: user.id,
          empresa_id: empresaId,
          role_na_empresa: role,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (error) => {
      console.error("Erro ao vincular empresa:", error);
      toast.error("Erro ao vincular empresa");
    },
  });

  // Desvincular usuário de empresa
  const desvincularEmpresa = useMutation({
    mutationFn: async (empresaId: string) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from("user_empresas")
        .delete()
        .eq("user_id", user.id)
        .eq("empresa_id", empresaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-empresas"] });
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (error) => {
      console.error("Erro ao desvincular empresa:", error);
      toast.error("Erro ao desvincular empresa");
    },
  });

  // Verificar se usuário tem acesso a uma empresa
  const temAcesso = (empresaId: string): boolean => {
    return userEmpresas?.some(ue => ue.empresa_id === empresaId) ?? false;
  };

  // Obter role do usuário em uma empresa
  const getRoleNaEmpresa = (empresaId: string): UserEmpresa["role_na_empresa"] | null => {
    const vinculo = userEmpresas?.find(ue => ue.empresa_id === empresaId);
    return vinculo?.role_na_empresa ?? null;
  };

  return {
    userEmpresas: userEmpresas ?? [],
    isLoading,
    vincularEmpresa,
    desvincularEmpresa,
    temAcesso,
    getRoleNaEmpresa,
  };
}
