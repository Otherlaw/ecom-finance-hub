/**
 * Hook para gerenciamento de armazéns
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============= TIPOS =============

export type TipoArmazem = 'proprio' | 'terceiro' | 'fulfillment' | 'dropship';

export interface Armazem {
  id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  tipo: TipoArmazem;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArmazemInsert {
  empresa_id: string;
  codigo: string;
  nome: string;
  endereco?: string;
  tipo?: TipoArmazem;
  ativo?: boolean;
}

export interface UseArmazensParams {
  empresaId?: string;
  apenasAtivos?: boolean;
}

// ============= HOOK PRINCIPAL =============

export function useArmazens(params: UseArmazensParams = {}) {
  const queryClient = useQueryClient();
  const { empresaId, apenasAtivos = true } = params;

  const {
    data: armazens = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["armazens", empresaId, apenasAtivos],
    queryFn: async () => {
      let query = supabase
        .from("armazens")
        .select("*")
        .order("nome", { ascending: true });

      if (empresaId) query = query.eq("empresa_id", empresaId);
      if (apenasAtivos) query = query.eq("ativo", true);

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar armazéns:", error);
        throw error;
      }

      return (data || []).map((a): Armazem => ({
        id: a.id,
        empresa_id: a.empresa_id,
        codigo: a.codigo,
        nome: a.nome,
        endereco: a.endereco,
        tipo: a.tipo as TipoArmazem,
        ativo: a.ativo,
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));
    },
  });

  // Criar armazém
  const criarArmazem = useMutation({
    mutationFn: async (input: ArmazemInsert) => {
      const { data, error } = await supabase
        .from("armazens")
        .insert({
          empresa_id: input.empresa_id,
          codigo: input.codigo,
          nome: input.nome,
          endereco: input.endereco || null,
          tipo: input.tipo || 'proprio',
          ativo: input.ativo ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Armazém criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar armazém:", error);
      toast.error(`Erro ao criar armazém: ${error.message}`);
    },
  });

  // Atualizar armazém
  const atualizarArmazem = useMutation({
    mutationFn: async (input: Partial<ArmazemInsert> & { id: string }) => {
      const { id, ...data } = input;
      const { error } = await supabase
        .from("armazens")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Armazém atualizado");
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Inativar armazém
  const inativarArmazem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("armazens")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Armazém inativado");
      queryClient.invalidateQueries({ queryKey: ["armazens"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao inativar: ${error.message}`);
    },
  });

  return {
    armazens,
    isLoading,
    refetch,
    criarArmazem,
    atualizarArmazem,
    inativarArmazem,
  };
}
