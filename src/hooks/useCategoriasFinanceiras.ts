import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoriasPorTipo {
  tipo: string;
  categorias: CategoriaFinanceira[];
}

const TIPOS_ORDEM = [
  "Receitas",
  "Custos",
  "Despesas Operacionais",
  "Despesas Comercial / Marketing",
  "Despesas Administrativas / Gerais",
  "Despesas com Pessoal",
  "Despesas Financeiras",
  "Impostos Sobre o Resultado",
  "Outras Receitas / Despesas",
];

export function useCategoriasFinanceiras() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categorias, isLoading, error } = useQuery({
    queryKey: ["categorias-financeiras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .order("tipo", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as CategoriaFinanceira[];
    },
  });

  // Organize categories by tipo
  const categoriasPorTipo: CategoriasPorTipo[] = TIPOS_ORDEM
    .map((tipo) => ({
      tipo,
      categorias: (categorias || []).filter((c) => c.tipo === tipo),
    }))
    .filter((grupo) => grupo.categorias.length > 0);

  // Get all unique tipos
  const tiposDisponiveis = TIPOS_ORDEM;

  const createCategoria = useMutation({
    mutationFn: async (data: { nome: string; tipo: string; descricao?: string }) => {
      const { data: result, error } = await supabase
        .from("categorias_financeiras")
        .insert({
          nome: data.nome,
          tipo: data.tipo,
          descricao: data.descricao || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast({
        title: "Categoria criada",
        description: "A categoria foi criada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoria = useMutation({
    mutationFn: async (data: { id: string; nome: string; tipo: string; descricao?: string }) => {
      const { data: result, error } = await supabase
        .from("categorias_financeiras")
        .update({
          nome: data.nome,
          tipo: data.tipo,
          descricao: data.descricao || null,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast({
        title: "Categoria atualizada",
        description: "A categoria foi atualizada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar categoria",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("categorias_financeiras")
        .update({ ativo })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast({
        title: variables.ativo ? "Categoria ativada" : "Categoria desativada",
        description: `A categoria foi ${variables.ativo ? "ativada" : "desativada"} com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    categorias: categorias || [],
    categoriasPorTipo,
    tiposDisponiveis,
    isLoading,
    error,
    createCategoria,
    updateCategoria,
    toggleAtivo,
  };
}
