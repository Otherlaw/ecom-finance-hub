import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";

export interface MarketplaceTransaction {
  id: string;
  empresa_id: string;
  canal: string;
  conta_nome: string | null;
  pedido_id: string | null;
  referencia_externa: string | null;
  data_transacao: string;
  data_repasse: string | null;
  tipo_transacao: string;
  descricao: string;
  valor_bruto: number | null;
  valor_liquido: number;
  tipo_lancamento: string;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  origem_arquivo: string | null;
  criado_em: string;
  atualizado_em: string;
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
  empresa?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
}

export interface MarketplaceTransactionInsert {
  empresa_id: string;
  canal: string;
  conta_nome?: string;
  pedido_id?: string;
  referencia_externa?: string;
  data_transacao: string;
  data_repasse?: string;
  tipo_transacao: string;
  descricao: string;
  valor_bruto?: number;
  valor_liquido: number;
  tipo_lancamento: string;
  status?: string;
  categoria_id?: string;
  centro_custo_id?: string;
  responsavel_id?: string;
  origem_arquivo?: string;
}

interface UseMarketplaceTransactionsParams {
  empresaId?: string;
  canal?: string;
  periodoInicio?: string;
  periodoFim?: string;
  status?: "todos" | "importado" | "pendente" | "conciliado" | "ignorado";
}

export function useMarketplaceTransactions(params?: UseMarketplaceTransactionsParams) {
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ["marketplace_transactions", params],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_transactions")
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .order("data_transacao", { ascending: false });

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }

      if (params?.canal) {
        query = query.eq("canal", params.canal);
      }

      if (params?.periodoInicio) {
        query = query.gte("data_transacao", params.periodoInicio);
      }

      if (params?.periodoFim) {
        query = query.lte("data_transacao", params.periodoFim);
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as MarketplaceTransaction[];
    },
  });

  const importTransactionsMutation = useMutation({
    mutationFn: async (transactionsToImport: MarketplaceTransactionInsert[]) => {
      // Buscar referências existentes para evitar duplicatas
      const referencias = transactionsToImport
        .filter(t => t.referencia_externa)
        .map(t => t.referencia_externa);

      let existingRefs: string[] = [];
      if (referencias.length > 0) {
        const { data: existing } = await supabase
          .from("marketplace_transactions")
          .select("referencia_externa")
          .in("referencia_externa", referencias as string[]);
        
        existingRefs = (existing || []).map(e => e.referencia_externa).filter(Boolean) as string[];
      }

      // Filtrar transações que não são duplicatas
      const newTransactions = transactionsToImport.filter(
        t => !t.referencia_externa || !existingRefs.includes(t.referencia_externa)
      );

      if (newTransactions.length === 0) {
        return { imported: 0, skipped: transactionsToImport.length };
      }

      const { error } = await supabase
        .from("marketplace_transactions")
        .insert(newTransactions);

      if (error) throw error;

      return { 
        imported: newTransactions.length, 
        skipped: transactionsToImport.length - newTransactions.length 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      toast.success(`${result.imported} transações importadas. ${result.skipped} duplicadas ignoradas.`);
    },
    onError: (error) => {
      console.error("Erro ao importar transações:", error);
      toast.error("Erro ao importar transações do marketplace");
    },
  });

  const categorizarMutation = useMutation({
    mutationFn: async ({
      id,
      categoriaId,
      centroCustoId,
      responsavelId,
    }: {
      id: string;
      categoriaId?: string;
      centroCustoId?: string;
      responsavelId?: string;
    }) => {
      const { data, error } = await supabase
        .from("marketplace_transactions")
        .update({
          categoria_id: categoriaId || null,
          centro_custo_id: centroCustoId || null,
          responsavel_id: responsavelId || null,
          status: "pendente",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      toast.success("Transação categorizada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao categorizar transação:", error);
      toast.error("Erro ao categorizar transação");
    },
  });

  const conciliarMutation = useMutation({
    mutationFn: async (id: string) => {
      // Buscar transação completa
      const { data: transacao, error: fetchError } = await supabase
        .from("marketplace_transactions")
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo)
        `)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Atualizar status
      const { error: updateError } = await supabase
        .from("marketplace_transactions")
        .update({
          status: "conciliado",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Registrar no FLOW HUB
      const tipo = transacao.tipo_lancamento === "credito" ? "entrada" : "saida";
      
      await registrarMovimentoFinanceiro({
        data: transacao.data_transacao,
        tipo,
        origem: "marketplace",
        descricao: `[${transacao.canal?.toUpperCase()}] ${transacao.descricao}${transacao.pedido_id ? ` - Pedido: ${transacao.pedido_id}` : ""}`,
        valor: Math.abs(transacao.valor_liquido),
        empresaId: transacao.empresa_id,
        referenciaId: transacao.id,
        categoriaId: transacao.categoria_id || undefined,
        categoriaNome: transacao.categoria?.nome,
        centroCustoId: transacao.centro_custo_id || undefined,
        centroCustoNome: transacao.centro_custo?.nome,
        responsavelId: transacao.responsavel_id || undefined,
        formaPagamento: "marketplace",
      });

      return transacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Transação conciliada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao conciliar transação:", error);
      toast.error("Erro ao conciliar transação");
    },
  });

  const ignorarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("marketplace_transactions")
        .update({
          status: "ignorado",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      toast.success("Transação ignorada");
    },
    onError: (error) => {
      console.error("Erro ao ignorar transação:", error);
      toast.error("Erro ao ignorar transação");
    },
  });

  const reabrirMutation = useMutation({
    mutationFn: async (id: string) => {
      // Buscar transação para verificar status anterior
      const { data: transacao, error: fetchError } = await supabase
        .from("marketplace_transactions")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Se estava conciliada, remover do FLOW HUB
      if (transacao.status === "conciliado") {
        await removerMovimentoFinanceiro(id, "marketplace");
      }

      // Atualizar status
      const { error } = await supabase
        .from("marketplace_transactions")
        .update({
          status: "pendente",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Transação reaberta");
    },
    onError: (error) => {
      console.error("Erro ao reabrir transação:", error);
      toast.error("Erro ao reabrir transação");
    },
  });

  // Contadores
  const contadores = {
    total: transactions.length,
    importados: transactions.filter(t => t.status === "importado").length,
    pendentes: transactions.filter(t => t.status === "pendente").length,
    conciliados: transactions.filter(t => t.status === "conciliado").length,
    ignorados: transactions.filter(t => t.status === "ignorado").length,
  };

  return {
    transactions,
    isLoading,
    refetch,
    contadores,
    importTransactions: importTransactionsMutation.mutateAsync,
    isImporting: importTransactionsMutation.isPending,
    categorizar: categorizarMutation.mutateAsync,
    isCategorizando: categorizarMutation.isPending,
    conciliar: conciliarMutation.mutateAsync,
    isConciliando: conciliarMutation.isPending,
    ignorar: ignorarMutation.mutateAsync,
    isIgnorando: ignorarMutation.isPending,
    reabrir: reabrirMutation.mutateAsync,
    isReabrindo: reabrirMutation.isPending,
  };
}
