import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos para bens patrimoniais
export interface PatrimonioBem {
  id: string;
  empresa_id: string;
  tipo: "investimento" | "imobilizado" | "intangivel";
  grupo_balanco: string;
  descricao: string;
  data_aquisicao: string;
  valor_aquisicao: number;
  vida_util_meses?: number;
  valor_residual?: number;
  depreciacao_acumulada: number;
  ativo: boolean;
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface PatrimonioBemInsert {
  empresa_id: string;
  tipo: "investimento" | "imobilizado" | "intangivel";
  grupo_balanco: string;
  descricao: string;
  data_aquisicao: string;
  valor_aquisicao: number;
  vida_util_meses?: number;
  valor_residual?: number;
  depreciacao_acumulada?: number;
  ativo?: boolean;
  observacoes?: string;
}

// Tipos para movimentos de PL
export interface PLMovimento {
  id: string;
  empresa_id: string;
  data_referencia: string;
  tipo: "saldo_inicial" | "aporte_socio" | "retirada_socio" | "ajuste_pl" | "reserva_lucros" | "distribuicao_lucros" | "lucro_prejuizo_periodo";
  grupo_pl: "capital_social" | "reservas" | "lucros_acumulados";
  descricao?: string;
  valor: number;
  criado_em: string;
  atualizado_em: string;
}

export interface PLMovimentoInsert {
  empresa_id: string;
  data_referencia: string;
  tipo: PLMovimento["tipo"];
  grupo_pl: PLMovimento["grupo_pl"];
  descricao?: string;
  valor: number;
}

// Totais calculados
export interface TotaisBens {
  totalInvestimentos: number;
  totalImobilizado: number;
  totalIntangivel: number;
}

export interface SaldosPL {
  capitalSocial: number;
  reservas: number;
  lucrosAcumulados: number;
}

// Labels para exibição
export const TIPO_BEM_LABELS: Record<PatrimonioBem["tipo"], string> = {
  investimento: "Investimento",
  imobilizado: "Imobilizado",
  intangivel: "Intangível",
};

export const GRUPO_BALANCO_OPTIONS: Record<PatrimonioBem["tipo"], string[]> = {
  investimento: ["Participações Societárias", "Títulos e Valores Mobiliários", "Outros Investimentos"],
  imobilizado: ["Máquinas e Equipamentos", "Móveis e Utensílios", "Veículos", "Edificações", "Terrenos", "Instalações", "Outros Imobilizados"],
  intangivel: ["Softwares", "Marcas e Patentes", "Direitos de Uso", "Fundo de Comércio", "Outros Intangíveis"],
};

export const TIPO_MOVIMENTO_LABELS: Record<PLMovimento["tipo"], string> = {
  saldo_inicial: "Saldo Inicial",
  aporte_socio: "Aporte de Sócio",
  retirada_socio: "Retirada de Sócio",
  ajuste_pl: "Ajuste de PL",
  reserva_lucros: "Reserva de Lucros",
  distribuicao_lucros: "Distribuição de Lucros",
  lucro_prejuizo_periodo: "Lucro/Prejuízo do Período",
};

export const GRUPO_PL_LABELS: Record<PLMovimento["grupo_pl"], string> = {
  capital_social: "Capital Social",
  reservas: "Reservas",
  lucros_acumulados: "Lucros Acumulados",
};

export function usePatrimonio(empresaId?: string) {
  const queryClient = useQueryClient();

  // ========== BENS PATRIMONIAIS ==========
  
  const bensQuery = useQuery({
    queryKey: ["patrimonio-bens", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      
      const { data, error } = await supabase
        .from("patrimonio_bens")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("data_aquisicao", { ascending: false });

      if (error) throw error;
      return data as PatrimonioBem[];
    },
    enabled: !!empresaId,
  });

  const createBemMutation = useMutation({
    mutationFn: async (bem: PatrimonioBemInsert) => {
      const { data, error } = await supabase
        .from("patrimonio_bens")
        .insert(bem)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-bens"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Bem cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar bem: " + error.message);
    },
  });

  const updateBemMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PatrimonioBem> & { id: string }) => {
      const { data, error } = await supabase
        .from("patrimonio_bens")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-bens"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Bem atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar bem: " + error.message);
    },
  });

  const deleteBemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patrimonio_bens")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-bens"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Bem excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir bem: " + error.message);
    },
  });

  // ========== MOVIMENTOS PL ==========

  const movimentosPLQuery = useQuery({
    queryKey: ["patrimonio-pl-movimentos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("patrimonio_pl_movimentos")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("data_referencia", { ascending: false });

      if (error) throw error;
      return data as PLMovimento[];
    },
    enabled: !!empresaId,
  });

  const createMovimentoPLMutation = useMutation({
    mutationFn: async (movimento: PLMovimentoInsert) => {
      const { data, error } = await supabase
        .from("patrimonio_pl_movimentos")
        .insert(movimento)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-pl-movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Movimento registrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao registrar movimento: " + error.message);
    },
  });

  const updateMovimentoPLMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PLMovimento> & { id: string }) => {
      const { data, error } = await supabase
        .from("patrimonio_pl_movimentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-pl-movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Movimento atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar movimento: " + error.message);
    },
  });

  const deleteMovimentoPLMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patrimonio_pl_movimentos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimonio-pl-movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["balanco-patrimonial"] });
      toast.success("Movimento excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir movimento: " + error.message);
    },
  });

  // ========== CÁLCULOS ==========

  const calcularTotaisBens = (): TotaisBens => {
    const bens = bensQuery.data || [];
    const bensAtivos = bens.filter(b => b.ativo);

    const totalInvestimentos = bensAtivos
      .filter(b => b.tipo === "investimento")
      .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

    const totalImobilizado = bensAtivos
      .filter(b => b.tipo === "imobilizado")
      .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

    const totalIntangivel = bensAtivos
      .filter(b => b.tipo === "intangivel")
      .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

    return { totalInvestimentos, totalImobilizado, totalIntangivel };
  };

  const calcularSaldosPL = (): SaldosPL => {
    const movimentos = movimentosPLQuery.data || [];

    const capitalSocial = movimentos
      .filter(m => m.grupo_pl === "capital_social")
      .reduce((acc, m) => acc + m.valor, 0);

    const reservas = movimentos
      .filter(m => m.grupo_pl === "reservas")
      .reduce((acc, m) => acc + m.valor, 0);

    const lucrosAcumulados = movimentos
      .filter(m => m.grupo_pl === "lucros_acumulados")
      .reduce((acc, m) => acc + m.valor, 0);

    return { capitalSocial, reservas, lucrosAcumulados };
  };

  // Valor contábil de um bem (para exibição na tabela)
  const calcularValorContabil = (bem: PatrimonioBem): number => {
    return bem.valor_aquisicao - (bem.depreciacao_acumulada || 0);
  };

  return {
    // Bens
    bens: bensQuery.data || [],
    bensLoading: bensQuery.isLoading,
    createBem: createBemMutation.mutate,
    updateBem: updateBemMutation.mutate,
    deleteBem: deleteBemMutation.mutate,
    isCreatingBem: createBemMutation.isPending,
    isUpdatingBem: updateBemMutation.isPending,
    isDeletingBem: deleteBemMutation.isPending,

    // Movimentos PL
    movimentosPL: movimentosPLQuery.data || [],
    movimentosPLLoading: movimentosPLQuery.isLoading,
    createMovimentoPL: createMovimentoPLMutation.mutate,
    updateMovimentoPL: updateMovimentoPLMutation.mutate,
    deleteMovimentoPL: deleteMovimentoPLMutation.mutate,
    isCreatingMovimentoPL: createMovimentoPLMutation.isPending,
    isUpdatingMovimentoPL: updateMovimentoPLMutation.isPending,
    isDeletingMovimentoPL: deleteMovimentoPLMutation.isPending,

    // Cálculos
    calcularTotaisBens,
    calcularSaldosPL,
    calcularValorContabil,

    // Loading geral
    isLoading: bensQuery.isLoading || movimentosPLQuery.isLoading,
  };
}
