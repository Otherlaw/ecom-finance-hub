import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CentroCusto {
  id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  ativo: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CentroCustoHierarquico extends CentroCusto {
  children: CentroCustoHierarquico[];
  level: number;
  fullPath: string;
}

export function useCentrosCusto() {
  const queryClient = useQueryClient();

  const { data: centrosCusto = [], isLoading, error } = useQuery({
    queryKey: ["centros-de-custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_de_custo")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      return data as CentroCusto[];
    },
  });

  // Organizar em estrutura hierárquica
  const centrosHierarquicos = organizarHierarquia(centrosCusto);

  // Lista flat com indentação para selects
  const centrosFlat = flattenHierarquia(centrosHierarquicos);

  // Apenas centros principais (sem parent)
  const centrosPrincipais = centrosCusto.filter(c => !c.parent_id);

  // Criar novo centro de custo
  const createCentroCusto = useMutation({
    mutationFn: async (data: { nome: string; codigo?: string; descricao?: string; parent_id?: string }) => {
      const { data: result, error } = await supabase
        .from("centros_de_custo")
        .insert({
          nome: data.nome,
          codigo: data.codigo || null,
          descricao: data.descricao || null,
          parent_id: data.parent_id || null,
          ativo: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-de-custo"] });
      toast.success("Centro de custo criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar centro de custo: " + error.message);
    },
  });

  // Atualizar centro de custo
  const updateCentroCusto = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; nome?: string; codigo?: string; descricao?: string; ativo?: boolean; parent_id?: string | null }) => {
      const { error } = await supabase
        .from("centros_de_custo")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-de-custo"] });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Toggle ativo/inativo
  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("centros_de_custo")
        .update({ ativo })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centros-de-custo"] });
      toast.success("Status atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });

  return {
    centrosCusto,
    centrosHierarquicos,
    centrosFlat,
    centrosPrincipais,
    isLoading,
    error,
    createCentroCusto,
    updateCentroCusto,
    toggleAtivo,
  };
}

// Função auxiliar para organizar em hierarquia
function organizarHierarquia(centros: CentroCusto[]): CentroCustoHierarquico[] {
  const map = new Map<string, CentroCustoHierarquico>();
  const roots: CentroCustoHierarquico[] = [];

  // Criar mapa de todos os centros
  centros.forEach(centro => {
    map.set(centro.id, { ...centro, children: [], level: 0, fullPath: centro.nome });
  });

  // Organizar hierarquia
  centros.forEach(centro => {
    const node = map.get(centro.id)!;
    if (centro.parent_id && map.has(centro.parent_id)) {
      const parent = map.get(centro.parent_id)!;
      node.level = parent.level + 1;
      node.fullPath = `${parent.fullPath} > ${centro.nome}`;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Ordenar children por nome
  const sortChildren = (nodes: CentroCustoHierarquico[]) => {
    nodes.sort((a, b) => a.nome.localeCompare(b.nome));
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

// Função para flatten a hierarquia para uso em selects
function flattenHierarquia(nodes: CentroCustoHierarquico[], result: CentroCustoHierarquico[] = []): CentroCustoHierarquico[] {
  nodes.forEach(node => {
    result.push(node);
    if (node.children.length > 0) {
      flattenHierarquia(node.children, result);
    }
  });
  return result;
}
