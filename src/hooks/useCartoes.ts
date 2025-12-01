import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useCartoes = () => {
  const queryClient = useQueryClient();

  const { data: cartoes, isLoading } = useQuery({
    queryKey: ["credit-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select(`
          *,
          empresa:empresas(id, razao_social, nome_fantasia, cnpj),
          responsavel:responsaveis(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createCartao = useMutation({
    mutationFn: async (cartao: any) => {
      const { data, error } = await supabase
        .from("credit_cards")
        .insert(cartao)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast.success("Cartão cadastrado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar cartão: " + error.message);
    },
  });

  const updateCartao = useMutation({
    mutationFn: async ({ id, ...cartao }: any) => {
      const { data, error } = await supabase
        .from("credit_cards")
        .update(cartao)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-cards"] });
      toast.success("Cartão atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar cartão: " + error.message);
    },
  });

  return {
    cartoes,
    isLoading,
    createCartao,
    updateCartao,
  };
};

export const useFaturas = (cartaoId?: string) => {
  const queryClient = useQueryClient();

  const { data: faturas, isLoading } = useQuery({
    queryKey: ["credit-card-invoices", cartaoId],
    queryFn: async () => {
      let query = supabase
        .from("credit_card_invoices")
        .select(`
          *,
          cartao:credit_cards(id, nome, instituicao_financeira, empresa:empresas(razao_social, cnpj))
        `)
        .order("mes_referencia", { ascending: false });

      if (cartaoId) {
        query = query.eq("credit_card_id", cartaoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createFatura = useMutation({
    mutationFn: async (fatura: any) => {
      const { data, error } = await supabase
        .from("credit_card_invoices")
        .insert(fatura)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-invoices"] });
      toast.success("Fatura cadastrada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar fatura: " + error.message);
    },
  });

  return {
    faturas,
    isLoading,
    createFatura,
  };
};

export const useTransacoes = (faturaId?: string) => {
  const queryClient = useQueryClient();

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["credit-card-transactions", faturaId],
    queryFn: async () => {
      let query = supabase
        .from("credit_card_transactions")
        .select(`
          *,
          fatura:credit_card_invoices(id, mes_referencia, credit_card_id),
          categoria:categorias_financeiras(id, nome),
          centro_custo:centros_de_custo(id, nome),
          responsavel:responsaveis(id, nome)
        `)
        .order("data_transacao", { ascending: false });

      if (faturaId) {
        query = query.eq("invoice_id", faturaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateTransacao = useMutation({
    mutationFn: async ({ id, ...transacao }: any) => {
      const { data, error } = await supabase
        .from("credit_card_transactions")
        .update(transacao)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-card-transactions"] });
      toast.success("Transação atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar transação: " + error.message);
    },
  });

  return {
    transacoes,
    isLoading,
    updateTransacao,
  };
};