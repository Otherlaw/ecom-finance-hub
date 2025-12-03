import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContaPagar {
  id: string;
  empresa_id: string;
  fornecedor_nome: string;
  descricao: string;
  documento: string | null;
  tipo_lancamento: string;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_total: number;
  valor_pago: number;
  valor_em_aberto: number;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  recorrente: boolean;
  conciliado: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  empresa?: { id: string; razao_social: string; nome_fantasia: string | null };
  categoria?: { id: string; nome: string; tipo: string };
  centro_custo?: { id: string; nome: string };
}

export type StatusContaPagar = "em_aberto" | "parcialmente_pago" | "pago" | "vencido" | "cancelado";

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_aberto: { label: "Em Aberto", color: "bg-blue-100 text-blue-800" },
  parcialmente_pago: { label: "Parcial", color: "bg-amber-100 text-amber-800" },
  pago: { label: "Pago", color: "bg-green-100 text-green-800" },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800" },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-800" },
};

interface UseContasPagarParams {
  empresaId?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export const useContasPagar = (params: UseContasPagarParams = {}) => {
  const queryClient = useQueryClient();
  const { empresaId, status, dataInicio, dataFim } = params;

  const { data: contas, isLoading, refetch } = useQuery({
    queryKey: ["contas-a-pagar", empresaId, status, dataInicio, dataFim],
    queryFn: async () => {
      let query = supabase
        .from("contas_a_pagar")
        .select(`
          *,
          empresa:empresas(id, razao_social, nome_fantasia),
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome)
        `)
        .order("data_vencimento", { ascending: true });

      if (empresaId && empresaId !== "todas") {
        query = query.eq("empresa_id", empresaId);
      }

      if (status && status !== "todos") {
        query = query.eq("status", status);
      }

      if (dataInicio) {
        query = query.gte("data_vencimento", dataInicio);
      }

      if (dataFim) {
        query = query.lte("data_vencimento", dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ContaPagar[];
    },
  });

  const createConta = useMutation({
    mutationFn: async (conta: Omit<ContaPagar, "id" | "created_at" | "updated_at" | "empresa" | "categoria" | "centro_custo">) => {
      const { data, error } = await supabase
        .from("contas_a_pagar")
        .insert(conta)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar"] });
      toast.success("Conta cadastrada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar conta: " + error.message);
    },
  });

  const updateConta = useMutation({
    mutationFn: async ({ id, ...conta }: Partial<ContaPagar> & { id: string }) => {
      const { data, error } = await supabase
        .from("contas_a_pagar")
        .update(conta)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar"] });
      toast.success("Conta atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar conta: " + error.message);
    },
  });

  const deleteConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_a_pagar")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar"] });
      toast.success("Conta excluída com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir conta: " + error.message);
    },
  });

  const pagarConta = useMutation({
    mutationFn: async ({ id, valorPago, dataPagamento }: { id: string; valorPago: number; dataPagamento: string }) => {
      // Buscar conta atual
      const { data: contaAtual, error: fetchError } = await supabase
        .from("contas_a_pagar")
        .select("valor_total, valor_pago")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const novoValorPago = (contaAtual?.valor_pago || 0) + valorPago;
      const novoValorEmAberto = (contaAtual?.valor_total || 0) - novoValorPago;
      const novoStatus = novoValorEmAberto <= 0 ? "pago" : "parcialmente_pago";

      const { data, error } = await supabase
        .from("contas_a_pagar")
        .update({
          valor_pago: novoValorPago,
          valor_em_aberto: Math.max(0, novoValorEmAberto),
          status: novoStatus,
          data_pagamento: novoStatus === "pago" ? dataPagamento : null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas-a-pagar"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa-contas-pagar"] });
      toast.success("Pagamento registrado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao registrar pagamento: " + error.message);
    },
  });

  // Calcular resumo
  const resumo = {
    totalEmAberto: contas?.filter(c => c.status !== "pago" && c.status !== "cancelado").reduce((acc, c) => acc + c.valor_em_aberto, 0) || 0,
    totalVencido: contas?.filter(c => c.status === "vencido" || (c.status === "em_aberto" && new Date(c.data_vencimento) < new Date())).reduce((acc, c) => acc + c.valor_em_aberto, 0) || 0,
    totalPago: contas?.filter(c => c.status === "pago").reduce((acc, c) => acc + c.valor_total, 0) || 0,
    quantidade: contas?.length || 0,
  };

  return {
    contas,
    isLoading,
    refetch,
    createConta,
    updateConta,
    deleteConta,
    pagarConta,
    resumo,
  };
};
