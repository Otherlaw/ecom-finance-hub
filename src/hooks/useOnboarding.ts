import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface OnboardingStatus {
  id: string;
  user_id: string;
  empresa_criada: boolean;
  empresa_id: string | null;
  dados_empresa_completos: boolean;
  plano_contas_revisado: boolean;
  centros_custo_revisados: boolean;
  primeira_importacao: boolean;
  onboarding_completo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  route?: string;
  action?: () => void;
}

export function useOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar status de onboarding
  const { data: status, isLoading } = useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("onboarding_status")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as OnboardingStatus | null;
    },
    enabled: !!user?.id,
  });

  // Criar status inicial se não existir
  const createStatus = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("onboarding_status")
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  // Atualizar status
  const updateStatus = useMutation({
    mutationFn: async (updates: Partial<OnboardingStatus>) => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from("onboarding_status")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  // Marcar empresa como criada
  const marcarEmpresaCriada = async (empresaId: string) => {
    await updateStatus.mutateAsync({
      empresa_criada: true,
      empresa_id: empresaId,
    });
  };

  // Marcar passo como completo
  const marcarPassoCompleto = async (passo: keyof Pick<OnboardingStatus, 
    'dados_empresa_completos' | 'plano_contas_revisado' | 'centros_custo_revisados' | 'primeira_importacao'
  >) => {
    await updateStatus.mutateAsync({ [passo]: true });
  };

  // Finalizar onboarding
  const finalizarOnboarding = async () => {
    await updateStatus.mutateAsync({ onboarding_completo: true });
    toast.success("Onboarding concluído! Bem-vindo ao ECOM Finance!");
  };

  // Calcular progresso
  const calcularProgresso = (): number => {
    if (!status) return 0;
    
    const passos = [
      status.empresa_criada,
      status.dados_empresa_completos,
      status.plano_contas_revisado,
      status.centros_custo_revisados,
      status.primeira_importacao,
    ];
    
    const completados = passos.filter(Boolean).length;
    return Math.round((completados / passos.length) * 100);
  };

  // Obter lista de passos com status
  const getPassos = (): OnboardingStep[] => {
    return [
      {
        id: "empresa",
        title: "Cadastrar Empresa",
        description: "Informe os dados básicos da sua empresa",
        completed: status?.empresa_criada ?? false,
        route: "/empresas",
      },
      {
        id: "dados_empresa",
        title: "Completar Dados da Empresa",
        description: "Adicione informações complementares (IE, endereço, contato)",
        completed: status?.dados_empresa_completos ?? false,
        route: "/empresas",
      },
      {
        id: "plano_contas",
        title: "Revisar Plano de Contas",
        description: "Verifique as categorias financeiras disponíveis",
        completed: status?.plano_contas_revisado ?? false,
        route: "/plano-de-contas",
      },
      {
        id: "centros_custo",
        title: "Revisar Centros de Custo",
        description: "Configure os centros de custo da sua operação",
        completed: status?.centros_custo_revisados ?? false,
        route: "/centros-de-custo",
      },
      {
        id: "primeira_importacao",
        title: "Primeira Importação",
        description: "Importe um extrato, fatura de cartão ou relatório de marketplace",
        completed: status?.primeira_importacao ?? false,
        route: "/conciliacao",
      },
    ];
  };

  // Obter próximo passo pendente
  const getProximoPasso = (): OnboardingStep | null => {
    const passos = getPassos();
    return passos.find(p => !p.completed) ?? null;
  };

  // Verificar se deve mostrar onboarding
  const deveExibirOnboarding = (): boolean => {
    if (!status) return false;
    return !status.onboarding_completo;
  };

  return {
    status,
    isLoading,
    progresso: calcularProgresso(),
    passos: getPassos(),
    proximoPasso: getProximoPasso(),
    deveExibirOnboarding: deveExibirOnboarding(),
    createStatus,
    updateStatus,
    marcarEmpresaCriada,
    marcarPassoCompleto,
    finalizarOnboarding,
  };
}
