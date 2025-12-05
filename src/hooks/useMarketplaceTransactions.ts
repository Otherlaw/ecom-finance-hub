import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";
import { processarSaidaEstoqueMarketplace, reverterSaidaEstoqueMarketplace } from "@/lib/motor-saida-marketplace";
import { validarEstoqueMarketplaceAntesConciliar } from "@/lib/validacao-estoque-marketplace";

// ============= HELPER DE MENSAGEM DE ERRO =============
function construirMensagemDeErro(validacao: {
  ok: boolean;
  erros: {
    itemId: string;
    motivo: string;
    skuMarketplace?: string | null;
    produtoId?: string | null;
    skuId?: string | null;
    estoqueAtual?: number;
    quantidadeNecessaria?: number;
  }[];
}): string {
  if (validacao.ok || validacao.erros.length === 0) {
    return "Validação OK";
  }

  const linhas = validacao.erros.map((e) => {
    const sku = e.skuMarketplace ? `SKU: ${e.skuMarketplace}` : (e.skuId || e.produtoId || "Item");
    if (e.motivo === "Estoque insuficiente") {
      return `• ${sku} - Estoque: ${e.estoqueAtual ?? 0}, Necessário: ${e.quantidadeNecessaria ?? 1}`;
    }
    return `• ${sku} - ${e.motivo}`;
  });

  return `Estoque insuficiente para ${validacao.erros.length} item(s):\n${linhas.join("\n")}`;
}

export interface MarketplaceTransaction {
  id: string;
  empresa_id: string;
  canal: string;
  canal_venda: string | null;
  conta_nome: string | null;
  pedido_id: string | null;
  referencia_externa: string | null;
  data_transacao: string;
  data_repasse: string | null;
  tipo_transacao: string;
  descricao: string;
  valor_bruto: number | null;
  tarifas: number | null;
  taxas: number | null;
  outros_descontos: number | null;
  valor_liquido: number;
  tipo_lancamento: string;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  responsavel_id: string | null;
  origem_extrato: string | null;
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
  canal_venda?: string;
  conta_nome?: string;
  pedido_id?: string | null;
  referencia_externa?: string;
  data_transacao: string;
  data_repasse?: string | null;
  tipo_transacao: string;
  descricao: string;
  valor_bruto?: number;
  tarifas?: number;
  taxas?: number;
  outros_descontos?: number;
  valor_liquido: number;
  tipo_lancamento: string;
  status?: string;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
  responsavel_id?: string | null;
  origem_extrato?: string;
  origem_arquivo?: string;
}

export interface TransactionWithItems {
  transaction: MarketplaceTransactionInsert;
  itens: Array<{
    sku_marketplace: string;
    descricao_item: string;
    quantidade: number;
    preco_unitario: number | null;
    preco_total: number | null;
    pedido_id: string | null;
  }>;
}

interface UseMarketplaceTransactionsParams {
  empresaId?: string;
  canal?: string;
  marketplace?: string; // alias para canal
  periodoInicio?: string;
  periodoFim?: string;
  status?: "todos" | "importado" | "pendente" | "conciliado" | "ignorado";
}

interface MarketplaceResumo {
  total: number;
  importadas: number;
  pendentes: number;
  conciliadas: number;
  ignoradas: number;
  totalCreditos: number;
  totalDebitos: number;
  totalTarifas: number;
  totalTaxas: number;
  totalOutrosDescontos: number;
  totalDescontos: number; // soma de tarifas + taxas + outros_descontos
}

interface UseMarketplaceTransactionsReturn {
  transacoes: MarketplaceTransaction[];
  resumo: MarketplaceResumo;
  isLoading: boolean;
  refetch: () => void;
  importarTransacoes: UseMutationResult<
    { importadas: number },
    Error,
    { transacoes: MarketplaceTransactionInsert[]; onProgress?: (percent: number) => void },
    unknown
  >;
  atualizarTransacao: UseMutationResult<MarketplaceTransaction, Error, {
    id: string;
    categoriaId?: string;
    centroCustoId?: string;
    responsavelId?: string;
  }, unknown>;
  conciliarTransacao: UseMutationResult<MarketplaceTransaction, Error, string | { id: string; forcarConciliacao?: boolean }, unknown>;
  ignorarTransacao: UseMutationResult<void, Error, string, unknown>;
  reabrirTransacao: UseMutationResult<void, Error, string, unknown>;
}

export function useMarketplaceTransactions(params?: UseMarketplaceTransactionsParams): UseMarketplaceTransactionsReturn {
  const queryClient = useQueryClient();

  const { data: transacoes = [], isLoading, refetch } = useQuery({
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

      // Aceita tanto 'canal' quanto 'marketplace' como parâmetro
      const canalFiltro = params?.canal || params?.marketplace;
      if (canalFiltro) {
        query = query.eq("canal", canalFiltro);
      }

      if (params?.periodoInicio) {
        query = query.gte("data_transacao", params.periodoInicio);
      }

      if (params?.periodoFim) {
        query = query.lte("data_transacao", params.periodoFim);
      }

      if (params?.status && params.status !== "todos") {
        query = query.eq("status", params.status);
      } else {
        // Quando status é "todos" ou não especificado, exclui ignorados por padrão
        query = query.neq("status", "ignorado");
      }

      // Remover limite padrão de 1000 do Supabase - buscar até 50.000 registros
      query = query.limit(50000);

      const { data, error } = await query;

      if (error) throw error;
      return data as MarketplaceTransaction[];
    },
  });

  const BATCH_SIZE = 500;

  // Função auxiliar para inserir transações em lotes com callback de progresso
  const insertMarketplaceTransactionsInBatches = async (
    registros: MarketplaceTransactionInsert[],
    onProgress?: (percent: number) => void
  ): Promise<{ importadas: number }> => {
    if (!registros.length) {
      return { importadas: 0 };
    }

    let importadas = 0;
    const total = registros.length;

    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from("marketplace_transactions")
        .insert(batch)
        .select();

      if (error) {
        console.error(
          "[Importação Marketplace] Erro ao inserir lote",
          Math.floor(i / BATCH_SIZE) + 1,
          error
        );
        throw error;
      }

      const inseridas = data?.length ?? batch.length;
      importadas += inseridas;

      if (onProgress) {
        const processed = Math.min(i + batch.length, total);
        const percent = Math.round((processed / total) * 100);
        onProgress(percent);
      }
    }

    return { importadas };
  };

  const importarTransacoes = useMutation({
    mutationFn: async ({ transacoes, onProgress }: { transacoes: MarketplaceTransactionInsert[]; onProgress?: (percent: number) => void }) => {
      if (!transacoes || transacoes.length === 0) {
        return { importadas: 0 };
      }

      console.log(
        "[Importação Marketplace] Iniciando importação",
        transacoes.length,
        "registros"
      );

      // 5% inicial só pra barra não começar em zero
      if (onProgress) onProgress(5);

      const { importadas } = await insertMarketplaceTransactionsInBatches(
        transacoes,
        onProgress
      );

      console.log(
        "[Importação Marketplace] Finalizado. Registros importados:",
        importadas
      );

      // Garante 100% no final
      if (onProgress) onProgress(100);

      return { importadas };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_transaction_items"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });

      if (result?.importadas) {
        toast.success(
          `${result.importadas} transações de marketplace importadas com sucesso`
        );
      } else {
        toast.success("Nenhuma transação nova para importar");
      }
    },
    onError: (error) => {
      console.error("[Importação Marketplace] Erro:", error);
      toast.error("Erro ao importar relatório de marketplace");
    },
  });

  const atualizarTransacao = useMutation({
    mutationFn: async ({
      id,
      categoriaId,
      centroCustoId,
      responsavelId,
      canalVenda,
      tarifas,
      taxas,
      outrosDescontos,
    }: {
      id: string;
      categoriaId?: string;
      centroCustoId?: string;
      responsavelId?: string;
      canalVenda?: string;
      tarifas?: number;
      taxas?: number;
      outrosDescontos?: number;
    }) => {
      const updateData: Record<string, any> = {
        categoria_id: categoriaId || null,
        centro_custo_id: centroCustoId || null,
        responsavel_id: responsavelId || null,
        status: "pendente",
        atualizado_em: new Date().toISOString(),
      };

      // Adicionar campos opcionais apenas se fornecidos
      if (canalVenda !== undefined) updateData.canal_venda = canalVenda || null;
      if (tarifas !== undefined) updateData.tarifas = tarifas ?? 0;
      if (taxas !== undefined) updateData.taxas = taxas ?? 0;
      if (outrosDescontos !== undefined) updateData.outros_descontos = outrosDescontos ?? 0;

      const { data, error } = await supabase
        .from("marketplace_transactions")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          categoria:categorias_financeiras(id, nome, tipo),
          centro_custo:centros_de_custo(id, nome, codigo),
          empresa:empresas(id, razao_social, nome_fantasia)
        `)
        .single();

      if (error) throw error;
      return data as MarketplaceTransaction;
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

  const conciliarTransacao = useMutation({
    mutationFn: async (params: string | { id: string; forcarConciliacao?: boolean }) => {
      const id = typeof params === 'string' ? params : params.id;
      const forcarConciliacao = typeof params === 'string' ? false : params.forcarConciliacao ?? false;
      
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

      // VALIDAÇÃO DE ESTOQUE (a menos que forçada)
      if (!forcarConciliacao) {
        const validacao = await validarEstoqueMarketplaceAntesConciliar({
          transactionId: id,
          empresaId: transacao.empresa_id,
        });
        if (!validacao.ok) {
          const msg = construirMensagemDeErro(validacao);
          throw new Error(msg);
        }
      }

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
      const categoriaNome = transacao.categoria?.nome;
      const centroCustoNome = transacao.centro_custo?.nome;
      
      await registrarMovimentoFinanceiro({
        data: transacao.data_transacao,
        tipo: "entrada", // Marketplace sempre entrada
        origem: "marketplace",
        descricao: transacao.descricao,
        valor: Math.abs(transacao.valor_liquido ?? transacao.valor_bruto ?? 0),
        empresaId: transacao.empresa_id,
        referenciaId: transacao.id,
        categoriaId: transacao.categoria_id ?? undefined,
        categoriaNome,
        centroCustoId: transacao.centro_custo_id ?? undefined,
        centroCustoNome: centroCustoNome ?? undefined,
        responsavelId: transacao.responsavel_id ?? undefined,
        formaPagamento: "marketplace",
      });

      // MOTOR DE SAÍDA DE ESTOQUE - Processar itens vinculados
      const estoqueResult = await processarSaidaEstoqueMarketplace({
        transactionId: transacao.id,
        empresaId: transacao.empresa_id,
        dataVenda: transacao.data_transacao,
        canal: transacao.canal,
        pedidoId: transacao.pedido_id,
      });

      // Log do resultado (não bloqueia conciliação se não houver itens)
      if (estoqueResult.processados > 0) {
        console.log(`[Conciliação Marketplace] ${estoqueResult.processados} itens de estoque processados`);
      }
      if (estoqueResult.erros > 0) {
        console.warn(`[Conciliação Marketplace] ${estoqueResult.erros} erros no processamento de estoque`);
      }

      return transacao as MarketplaceTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      // Invalidar queries de estoque e CMV
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_sku_mappings"] });
      toast.success("Transação conciliada com sucesso");
    },
    onError: (error) => {
      console.error("Erro ao conciliar transação:", error);
      toast.error("Erro ao conciliar transação");
    },
  });

  const ignorarTransacao = useMutation({
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

  const reabrirTransacao = useMutation({
    mutationFn: async (id: string) => {
      // Buscar transação para verificar status anterior
      const { data: transacao, error: fetchError } = await supabase
        .from("marketplace_transactions")
        .select("status")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // Se estava conciliada, remover do FLOW HUB e reverter estoque
      if (transacao.status === "conciliado") {
        // Remover movimento financeiro
        await removerMovimentoFinanceiro(id, "marketplace");

        // MOTOR DE SAÍDA DE ESTOQUE - Reverter saídas
        const estoqueResult = await reverterSaidaEstoqueMarketplace(id);
        
        if (estoqueResult.revertidos > 0) {
          console.log(`[Reabertura Marketplace] ${estoqueResult.revertidos} movimentações de estoque revertidas`);
        }
        if (estoqueResult.erros.length > 0) {
          console.warn(`[Reabertura Marketplace] Erros na reversão:`, estoqueResult.erros);
        }
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
      // Invalidar queries de estoque e CMV
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      toast.success("Transação reaberta");
    },
    onError: (error) => {
      console.error("Erro ao reabrir transação:", error);
      toast.error("Erro ao reabrir transação");
    },
  });

  // Resumo calculado
  const totalTarifas = transacoes.reduce((acc, t) => acc + (t.tarifas || 0), 0);
  const totalTaxas = transacoes.reduce((acc, t) => acc + (t.taxas || 0), 0);
  const totalOutrosDescontos = transacoes.reduce((acc, t) => acc + (t.outros_descontos || 0), 0);

  const resumo: MarketplaceResumo = {
    total: transacoes.length,
    importadas: transacoes.filter(t => t.status === "importado").length,
    pendentes: transacoes.filter(t => t.status === "pendente").length,
    conciliadas: transacoes.filter(t => t.status === "conciliado").length,
    ignoradas: transacoes.filter(t => t.status === "ignorado").length,
    totalCreditos: transacoes
      .filter(t => t.tipo_lancamento === "credito")
      .reduce((acc, t) => acc + t.valor_liquido, 0),
    totalDebitos: transacoes
      .filter(t => t.tipo_lancamento === "debito")
      .reduce((acc, t) => acc + t.valor_liquido, 0),
    totalTarifas,
    totalTaxas,
    totalOutrosDescontos,
    totalDescontos: totalTarifas + totalTaxas + totalOutrosDescontos,
  };

  return {
    transacoes,
    resumo,
    isLoading,
    refetch,
    importarTransacoes,
    atualizarTransacao,
    conciliarTransacao,
    ignorarTransacao,
    reabrirTransacao,
  };
}
