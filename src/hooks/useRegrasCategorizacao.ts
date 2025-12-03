import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegraCategorizacao {
  id: string;
  estabelecimento_pattern: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  uso_count: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SugestaoCategorizacao {
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  confianca: number; // 0-100 based on usage count
  regra_id: string;
}

// Normaliza o nome do estabelecimento para matching
function normalizeEstabelecimento(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, " ") // Normaliza espaços
    .trim();
}

export function useRegrasCategorizacao() {
  const queryClient = useQueryClient();

  const { data: regras, isLoading } = useQuery({
    queryKey: ["regras-categorizacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regras_categorizacao")
        .select("*")
        .eq("ativo", true)
        .order("uso_count", { ascending: false });

      if (error) throw error;
      return data as RegraCategorizacao[];
    },
  });

  // Busca sugestão para um estabelecimento específico
  const getSugestao = (estabelecimento: string | null): SugestaoCategorizacao | null => {
    if (!estabelecimento || !regras?.length) return null;

    const normalizado = normalizeEstabelecimento(estabelecimento);
    
    // Busca match exato primeiro
    let melhorMatch = regras.find(
      (r) => normalizeEstabelecimento(r.estabelecimento_pattern) === normalizado
    );

    // Se não encontrou exato, busca por similaridade (contém)
    if (!melhorMatch) {
      melhorMatch = regras.find((r) => {
        const pattern = normalizeEstabelecimento(r.estabelecimento_pattern);
        return normalizado.includes(pattern) || pattern.includes(normalizado);
      });
    }

    if (!melhorMatch) return null;

    // Calcula confiança baseada no uso (max 100%)
    const confianca = Math.min(100, melhorMatch.uso_count * 20);

    return {
      categoria_id: melhorMatch.categoria_id,
      centro_custo_id: melhorMatch.centro_custo_id,
      responsavel_id: melhorMatch.responsavel_id,
      confianca,
      regra_id: melhorMatch.id,
    };
  };

  // Busca sugestões para múltiplas transações
  const getSugestoes = (
    transacoes: Array<{ id: string; estabelecimento: string | null }>
  ): Map<string, SugestaoCategorizacao> => {
    const sugestoes = new Map<string, SugestaoCategorizacao>();

    transacoes.forEach((t) => {
      const sugestao = getSugestao(t.estabelecimento);
      if (sugestao) {
        sugestoes.set(t.id, sugestao);
      }
    });

    return sugestoes;
  };

  // Aprende com uma categorização
  const aprenderCategorizacao = useMutation({
    mutationFn: async (data: {
      estabelecimento: string;
      categoria_id: string | null;
      centro_custo_id: string | null;
      responsavel_id: string | null;
    }) => {
      if (!data.estabelecimento) return;

      const pattern = normalizeEstabelecimento(data.estabelecimento);
      
      // Verifica se já existe regra para este padrão
      const { data: existente } = await supabase
        .from("regras_categorizacao")
        .select("*")
        .eq("estabelecimento_pattern", pattern)
        .maybeSingle();

      if (existente) {
        // Atualiza regra existente e incrementa uso
        const { error } = await supabase
          .from("regras_categorizacao")
          .update({
            categoria_id: data.categoria_id,
            centro_custo_id: data.centro_custo_id,
            responsavel_id: data.responsavel_id,
            uso_count: existente.uso_count + 1,
          })
          .eq("id", existente.id);

        if (error) throw error;
      } else {
        // Cria nova regra
        const { error } = await supabase
          .from("regras_categorizacao")
          .insert({
            estabelecimento_pattern: pattern,
            categoria_id: data.categoria_id,
            centro_custo_id: data.centro_custo_id,
            responsavel_id: data.responsavel_id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao"] });
    },
  });

  // Incrementa uso de uma regra existente
  const incrementarUso = useMutation({
    mutationFn: async (regraId: string) => {
      const { data: regra } = await supabase
        .from("regras_categorizacao")
        .select("uso_count")
        .eq("id", regraId)
        .single();

      if (regra) {
        await supabase
          .from("regras_categorizacao")
          .update({ uso_count: regra.uso_count + 1 })
          .eq("id", regraId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regras-categorizacao"] });
    },
  });

  return {
    regras: regras || [],
    isLoading,
    getSugestao,
    getSugestoes,
    aprenderCategorizacao,
    incrementarUso,
  };
}
