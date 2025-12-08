import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FornecedorDB {
  id: string;
  empresa_id: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  regime_tributario: string | null;
  tipo: string;
  segmento: string;
  origem: string | null;
  status: string;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  contato_nome: string | null;
  contato_cargo: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  contato_celular: string | null;
  prazo_medio_dias: number | null;
  forma_pagamento_preferencial: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type FornecedorInsert = Omit<FornecedorDB, "id" | "created_at" | "updated_at">;
export type FornecedorUpdate = Partial<FornecedorInsert>;

export const useFornecedores = () => {
  const queryClient = useQueryClient();

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("razao_social");

      if (error) throw error;
      return data as FornecedorDB[];
    },
  });

  const createFornecedor = useMutation({
    mutationFn: async (fornecedor: FornecedorInsert) => {
      const { data, error } = await supabase
        .from("fornecedores")
        .insert(fornecedor)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao cadastrar fornecedor: " + error.message);
    },
  });

  const updateFornecedor = useMutation({
    mutationFn: async ({ id, ...fornecedor }: { id: string } & FornecedorUpdate) => {
      const { data, error } = await supabase
        .from("fornecedores")
        .update(fornecedor)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar fornecedor: " + error.message);
    },
  });

  const deleteFornecedor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fornecedores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover fornecedor: " + error.message);
    },
  });

  return {
    fornecedores: fornecedores || [],
    isLoading,
    createFornecedor,
    updateFornecedor,
    deleteFornecedor,
  };
};
