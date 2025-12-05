import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MarketplaceRule {
  id: string;
  empresa_id: string;
  canal: string;
  texto_contem: string;
  tipo_lancamento: 'credito' | 'debito';
  tipo_transacao: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  prioridade: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  categoria?: {
    id: string;
    nome: string;
    tipo: string;
  } | null;
  centro_custo?: {
    id: string;
    nome: string;
    codigo: string | null;
  } | null;
}

export interface CategorizacaoAutomatica {
  categoria_id: string | null;
  centro_custo_id: string | null;
  tipo_transacao: string | null;
  regra_aplicada: string | null;
}

/**
 * Aplica regras de categorização automática a uma transação
 * Retorna a categorização encontrada ou null se nenhuma regra aplicável
 */
export function aplicarRegrasCategorizacao(
  regras: MarketplaceRule[],
  transacao: {
    canal: string;
    descricao: string;
    valor_liquido: number;
    tipo_lancamento?: string;
  }
): CategorizacaoAutomatica | null {
  if (!regras.length) return null;

  // Determinar tipo de lançamento baseado no valor
  const tipoLancamento = transacao.tipo_lancamento || (transacao.valor_liquido >= 0 ? 'credito' : 'debito');
  const descricaoNormalizada = transacao.descricao.toLowerCase().trim();
  const canalNormalizado = transacao.canal.toLowerCase().trim();

  // Filtrar regras aplicáveis ao canal e tipo de lançamento
  const regrasAplicaveis = regras.filter(r => 
    r.ativo &&
    r.canal.toLowerCase() === canalNormalizado &&
    r.tipo_lancamento === tipoLancamento
  );

  // Ordenar por prioridade (maior primeiro) e depois por tamanho do texto (mais específico primeiro)
  const regrasOrdenadas = regrasAplicaveis.sort((a, b) => {
    if (b.prioridade !== a.prioridade) {
      return b.prioridade - a.prioridade;
    }
    return b.texto_contem.length - a.texto_contem.length;
  });

  // Encontrar primeira regra que match
  for (const regra of regrasOrdenadas) {
    const textoNormalizado = regra.texto_contem.toLowerCase().trim();
    if (descricaoNormalizada.includes(textoNormalizado)) {
      return {
        categoria_id: regra.categoria_id,
        centro_custo_id: regra.centro_custo_id,
        tipo_transacao: regra.tipo_transacao,
        regra_aplicada: regra.texto_contem,
      };
    }
  }

  return null;
}

/**
 * Aplica regras em lote para várias transações
 */
export function aplicarRegrasEmLote(
  regras: MarketplaceRule[],
  transacoes: Array<{
    id: string;
    canal: string;
    descricao: string;
    valor_liquido: number;
    tipo_lancamento?: string;
  }>
): Map<string, CategorizacaoAutomatica> {
  const resultado = new Map<string, CategorizacaoAutomatica>();

  for (const transacao of transacoes) {
    const categorizacao = aplicarRegrasCategorizacao(regras, transacao);
    if (categorizacao) {
      resultado.set(transacao.id, categorizacao);
    }
  }

  return resultado;
}

export function useMarketplaceRules(empresaId?: string) {
  const queryClient = useQueryClient();

  const { data: regras = [], isLoading, error } = useQuery({
    queryKey: ["marketplace_rules", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_rules")
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo)
        `)
        .eq("ativo", true)
        .order("prioridade", { ascending: false });

      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketplaceRule[];
    },
    enabled: true,
  });

  // Aplicar regras a transações importadas e atualizar no banco
  const aplicarRegrasTransacoes = useMutation({
    mutationFn: async ({ 
      transactionIds, 
      empresaId: empId 
    }: { 
      transactionIds: string[]; 
      empresaId: string;
    }) => {
      if (!transactionIds.length) return { aplicadas: 0, total: 0 };

      // Buscar regras da empresa
      const { data: regrasEmpresa, error: regrasError } = await supabase
        .from("marketplace_rules")
        .select("*")
        .eq("empresa_id", empId)
        .eq("ativo", true)
        .order("prioridade", { ascending: false });

      if (regrasError) throw regrasError;
      if (!regrasEmpresa?.length) return { aplicadas: 0, total: transactionIds.length };

      // Buscar transações que foram importadas
      const { data: transacoes, error: transError } = await supabase
        .from("marketplace_transactions")
        .select("id, canal, descricao, valor_liquido, tipo_lancamento")
        .in("id", transactionIds);

      if (transError) throw transError;
      if (!transacoes?.length) return { aplicadas: 0, total: 0 };

      // Aplicar regras
      const categorizacoes = aplicarRegrasEmLote(regrasEmpresa as MarketplaceRule[], transacoes);

      // Atualizar transações que tiveram match
      let aplicadas = 0;
      for (const [id, cat] of categorizacoes) {
        const { error: updateError } = await supabase
          .from("marketplace_transactions")
          .update({
            categoria_id: cat.categoria_id,
            centro_custo_id: cat.centro_custo_id,
            tipo_transacao: cat.tipo_transacao || undefined,
          })
          .eq("id", id);

        if (!updateError) {
          aplicadas++;
        }
      }

      console.log(`[Auto-categorização] ${aplicadas}/${transacoes.length} transações categorizadas automaticamente`);
      return { aplicadas, total: transacoes.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      if (result.aplicadas > 0) {
        toast.success(`${result.aplicadas} transações categorizadas automaticamente`);
      }
    },
    onError: (error) => {
      console.error("[Auto-categorização] Erro:", error);
    },
  });

  // CRUD para regras
  const createRegra = useMutation({
    mutationFn: async (regra: Omit<MarketplaceRule, 'id' | 'created_at' | 'updated_at' | 'categoria' | 'centro_custo'>) => {
      const { data, error } = await supabase
        .from("marketplace_rules")
        .insert(regra)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_rules"] });
      toast.success("Regra criada com sucesso");
    },
    onError: (error) => {
      toast.error(`Erro ao criar regra: ${error.message}`);
    },
  });

  const updateRegra = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MarketplaceRule> & { id: string }) => {
      const { data, error } = await supabase
        .from("marketplace_rules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_rules"] });
      toast.success("Regra atualizada com sucesso");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar regra: ${error.message}`);
    },
  });

  const deleteRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_rules"] });
      toast.success("Regra excluída com sucesso");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir regra: ${error.message}`);
    },
  });

  return {
    regras,
    isLoading,
    error,
    aplicarRegrasTransacoes,
    createRegra,
    updateRegra,
    deleteRegra,
    // Funções utilitárias
    aplicarRegrasCategorizacao: (transacao: Parameters<typeof aplicarRegrasCategorizacao>[1]) => 
      aplicarRegrasCategorizacao(regras, transacao),
    aplicarRegrasEmLote: (transacoes: Parameters<typeof aplicarRegrasEmLote>[1]) =>
      aplicarRegrasEmLote(regras, transacoes),
  };
}
