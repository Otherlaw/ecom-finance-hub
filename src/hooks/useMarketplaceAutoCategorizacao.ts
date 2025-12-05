/**
 * Hook para Categorização Automática de Marketplace
 * 
 * Fornece mutations e funções para automatizar a categorização
 * de transações de marketplace.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  processarCategorizacaoAutomatica,
  reprocessarTransacoesAntigas,
  aplicarCategorizacaoAutomatica,
  limparCaches,
  type TransacaoParaCategorizacao,
  type CategorizacaoAutomatica,
} from "@/lib/marketplace-auto-categorization";
import { supabase } from "@/integrations/supabase/client";

interface ProcessarTransacoesResult {
  categorizadas: number;
  atualizadas: number;
  erros: number;
}

interface ReprocessarAntigasResult {
  total: number;
  categorizadas: number;
  atualizadas: number;
  erros: number;
}

export function useMarketplaceAutoCategorizacao() {
  const queryClient = useQueryClient();

  // Mutation para processar transações recém-importadas
  const processarTransacoesImportadas = useMutation<
    ProcessarTransacoesResult,
    Error,
    { transactionIds: string[]; empresaId: string }
  >({
    mutationFn: async ({ transactionIds, empresaId }) => {
      if (!transactionIds.length) {
        return { categorizadas: 0, atualizadas: 0, erros: 0 };
      }

      // Buscar transações pelo ID
      const { data: transacoes, error } = await supabase
        .from("marketplace_transactions")
        .select("id, canal, descricao, valor_liquido, valor_bruto, tipo_transacao, tipo_lancamento")
        .in("id", transactionIds);

      if (error) throw error;
      if (!transacoes?.length) {
        return { categorizadas: 0, atualizadas: 0, erros: 0 };
      }

      // Cast tipo_lancamento para tipo correto
      const transacoesTyped: TransacaoParaCategorizacao[] = transacoes.map(t => ({
        ...t,
        tipo_lancamento: t.tipo_lancamento as 'credito' | 'debito' | undefined,
      }));

      return await processarCategorizacaoAutomatica(transacoesTyped);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      
      if (result.atualizadas > 0) {
        toast.success(
          `${result.atualizadas} transações categorizadas e conciliadas automaticamente`,
          { duration: 5000 }
        );
      }
    },
    onError: (error) => {
      console.error("[Auto-Cat] Erro:", error);
      toast.error("Erro ao processar categorização automática");
    },
  });

  // Mutation para reprocessar transações antigas
  const reprocessarAntigas = useMutation<
    ReprocessarAntigasResult,
    Error,
    { empresaId?: string; onProgress?: (fase: string, processadas: number, total: number) => void }
  >({
    mutationFn: async ({ empresaId, onProgress }) => {
      // Limpar caches antes de reprocessar
      limparCaches();
      return await reprocessarTransacoesAntigas(empresaId, onProgress);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      queryClient.invalidateQueries({ queryKey: ["centros-de-custo"] });
      
      if (result.total === 0) {
        toast.info("Nenhuma transação pendente de categorização encontrada");
      } else if (result.atualizadas > 0) {
        toast.success(
          `Reprocessamento concluído: ${result.atualizadas} de ${result.total} transações atualizadas`,
          { duration: 5000 }
        );
      } else {
        toast.warning(
          `Reprocessamento concluído: ${result.total} transações analisadas, mas nenhuma categorizada`,
          { duration: 5000 }
        );
      }
    },
    onError: (error) => {
      console.error("[Auto-Cat] Erro ao reprocessar:", error);
      toast.error("Erro ao reprocessar transações antigas");
    },
  });

  // Função para categorizar uma única transação (síncrona para uso em loops)
  const categorizarTransacao = async (
    transacao: TransacaoParaCategorizacao
  ): Promise<CategorizacaoAutomatica | null> => {
    return await aplicarCategorizacaoAutomatica(transacao);
  };

  // Função para verificar se uma transação pode ser auto-categorizada
  const verificarCategorizacaoDisponivel = async (
    transacao: TransacaoParaCategorizacao
  ): Promise<boolean> => {
    const resultado = await aplicarCategorizacaoAutomatica(transacao);
    return resultado !== null && resultado.categoria_id !== null;
  };

  return {
    // Mutations
    processarTransacoesImportadas,
    reprocessarAntigas,
    
    // Funções utilitárias
    categorizarTransacao,
    verificarCategorizacaoDisponivel,
    limparCaches,
    
    // Estados
    isProcessing: processarTransacoesImportadas.isPending || reprocessarAntigas.isPending,
  };
}
