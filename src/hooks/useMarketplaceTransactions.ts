import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from "@/lib/movimentos-financeiros";
import { processarCMVTransacao, removerCMVTransacao, processarCMVEmLote } from "@/lib/calcular-cmv-venda";
import { FLUXO_CAIXA_KEY_PREFIX } from "@/lib/queryKeys";

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
  hash_duplicidade: string | null;
  criado_em: string;
  atualizado_em: string;
  // Campos adicionais de vendas
  tipo_envio: string | null;
  frete_comprador: number | null;
  frete_vendedor: number | null;
  custo_ads: number | null;
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

export interface DuplicateGroup {
  hash: string;
  count: number;
  transactions: MarketplaceTransaction[];
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

export interface ImportResult {
  importadas: number;
  duplicadas: number;
  insertedIds: string[];
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
    ImportResult,
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
  processarCMVLote: UseMutationResult<{
    transacoesProcessadas: number;
    itensCMV: number;
    itensSemMapeamento: number;
    erros: number;
  }, Error, string, unknown>;
  duplicatas: DuplicateGroup[];
  isDuplicatesLoading: boolean;
  refetchDuplicates: () => void;
  excluirDuplicatas: UseMutationResult<{ deleted: number }, Error, string[], unknown>;
}

export function useMarketplaceTransactions(params?: UseMarketplaceTransactionsParams): UseMarketplaceTransactionsReturn {
  const queryClient = useQueryClient();

  const { data: transacoes = [], isLoading, refetch } = useQuery({
    queryKey: ["marketplace_transactions", params],
    queryFn: async () => {
      // Função auxiliar para buscar com paginação (Supabase limita a 1000 por requisição)
      const fetchAllPages = async (): Promise<MarketplaceTransaction[]> => {
        const PAGE_SIZE = 1000;
        let allData: MarketplaceTransaction[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from("marketplace_transactions")
            .select(`
              *,
              categoria:categorias_financeiras(id, nome, tipo),
              centro_custo:centros_de_custo(id, nome, codigo),
              empresa:empresas(id, razao_social, nome_fantasia)
            `)
            .order("data_transacao", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

          if (params?.empresaId) {
            query = query.eq("empresa_id", params.empresaId);
          }

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
            query = query.neq("status", "ignorado");
          }

          const { data, error } = await query;

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...(data as MarketplaceTransaction[])];
            from += PAGE_SIZE;
            // Se retornou menos que PAGE_SIZE, não há mais páginas
            hasMore = data.length === PAGE_SIZE;
          } else {
            hasMore = false;
          }

          // Limite de segurança: máximo 50.000 registros
          if (allData.length >= 50000) {
            hasMore = false;
          }
        }

        return allData;
      };

      return await fetchAllPages();
    },
  });

  const BATCH_SIZE = 500;

  // Função determinística para gerar referência única de duplicidade
  // Combina: empresa, canal, data, pedido, tipo_lancamento, valor e descrição truncada
  // DEVE SER IDÊNTICA À DO ImportarMarketplaceModal
  const buildMarketplaceRef = (t: MarketplaceTransactionInsert): string => {
    const base = [
      t.empresa_id,
      t.canal,
      t.data_transacao || '',
      t.pedido_id || '',
      t.tipo_lancamento || '',
      Number(t.valor_liquido || 0).toFixed(2),
      (t.descricao || '').substring(0, 60),
    ].join('|');
    
    return base.substring(0, 100);
  };

  // Função auxiliar para inserir transações em lotes com verificação de duplicidade
  const insertMarketplaceTransactionsInBatches = async (
    registros: MarketplaceTransactionInsert[],
    onProgress?: (percent: number) => void
  ): Promise<{ importadas: number; duplicadas: number; insertedIds: string[] }> => {
    if (!registros.length) {
      console.log("[Importação Marketplace] Nenhum registro para importar");
      return { importadas: 0, duplicadas: 0, insertedIds: [] };
    }

    console.log("[Importação Marketplace] Iniciando processamento de", registros.length, "registros");

    // 1. Gerar refs para todos os registros (usar referencia_externa)
    const registrosComRef = registros.map(r => ({
      ...r,
      referencia_externa: buildMarketplaceRef(r),
    }));

    // 2. Buscar refs existentes no banco em lotes de 10.000 para arquivos grandes
    const HASH_BATCH_SIZE = 10000;
    const refsSet = new Set<string>();
    const allRefs = registrosComRef.map(r => r.referencia_externa);
    
    // Extrair empresa_id e canal do primeiro registro para filtrar duplicatas
    const empresaIdFiltro = registros[0]?.empresa_id;
    const canalFiltro = registros[0]?.canal;
    
    for (let i = 0; i < allRefs.length; i += HASH_BATCH_SIZE) {
      const refBatch = allRefs.slice(i, i + HASH_BATCH_SIZE);
      
      let query = supabase
        .from("marketplace_transactions")
        .select("referencia_externa")
        .in("referencia_externa", refBatch);
      
      // Filtrar por empresa e canal para garantir consistência com a prévia
      if (empresaIdFiltro) {
        query = query.eq("empresa_id", empresaIdFiltro);
      }
      if (canalFiltro) {
        query = query.eq("canal", canalFiltro);
      }
      
      const { data: refsExistentes } = await query;
      
      (refsExistentes || []).forEach(h => {
        if (h.referencia_externa) refsSet.add(h.referencia_externa);
      });
    }

    // 3. Filtrar apenas registros novos
    const registrosNovos = registrosComRef.filter(r => !refsSet.has(r.referencia_externa));
    const duplicadas = registrosComRef.length - registrosNovos.length;

    console.log("[Importação Marketplace] Estatísticas de duplicidade:", {
      totalRecebidos: registros.length,
      refsExistentes: refsSet.size,
      duplicadas,
      registrosNovos: registrosNovos.length,
    });

    if (registrosNovos.length === 0) {
      console.log("[Importação Marketplace] Todas as transações são duplicadas");
      return { importadas: 0, duplicadas, insertedIds: [] };
    }

    let importadas = 0;
    const total = registrosNovos.length;
    const insertedIds: string[] = [];

    for (let i = 0; i < registrosNovos.length; i += BATCH_SIZE) {
      const batch = registrosNovos.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const { data, error } = await supabase
        .from("marketplace_transactions")
        .insert(batch)
        .select("id");

      if (error) {
        // Se for erro de duplicidade, ignorar e continuar
        if (error.code === "23505") {
          console.warn("[Importação Marketplace] Duplicidades ignoradas no lote", batchNum, "- continuando...");
          continue;
        }
        console.error("[Importação Marketplace] Erro ao inserir lote", batchNum, error);
        throw error;
      }

      const inseridas = data?.length ?? batch.length;
      importadas += inseridas;
      
      // Coletar IDs inseridos
      if (data) {
        insertedIds.push(...data.map(d => d.id));
      }

      if (onProgress) {
        const processed = Math.min(i + batch.length, total);
        const percent = Math.round((processed / total) * 100);
        onProgress(percent);
      }

      // Log de progresso a cada 10 lotes
      if (batchNum % 10 === 0) {
        console.log(`[Importação Marketplace] Lote ${batchNum}: ${importadas} inseridas até agora`);
      }
    }

    console.log("[Importação Marketplace] RESULTADO FINAL:", {
      totalRecebidos: registros.length,
      duplicadas,
      importadas,
      insertedIds: insertedIds.length,
    });

    return { importadas, duplicadas, insertedIds };
  };

  const importarTransacoes = useMutation({
    mutationFn: async ({ transacoes, onProgress }: { transacoes: MarketplaceTransactionInsert[]; onProgress?: (percent: number) => void }): Promise<ImportResult> => {
      if (!transacoes || transacoes.length === 0) {
        return { importadas: 0, duplicadas: 0, insertedIds: [] };
      }

      console.log(
        "[Importação Marketplace] Iniciando importação",
        transacoes.length,
        "registros"
      );

      // 5% inicial só pra barra não começar em zero
      if (onProgress) onProgress(5);

      const { importadas, duplicadas, insertedIds } = await insertMarketplaceTransactionsInBatches(
        transacoes,
        onProgress
      );

      console.log(
        "[Importação Marketplace] Finalizado. Registros importados:",
        importadas,
        "| Duplicados ignorados:",
        duplicadas
      );

      // Garante 100% no final
      if (onProgress) onProgress(100);

      return { importadas, duplicadas, insertedIds };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_transaction_items"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });

      if (result?.importadas && result?.duplicadas) {
        toast.success(
          `${result.importadas} transações importadas (${result.duplicadas} duplicadas ignoradas)`
        );
      } else if (result?.importadas) {
        toast.success(
          `${result.importadas} transações de marketplace importadas com sucesso`
        );
      } else if (result?.duplicadas) {
        toast.info(
          `Nenhuma transação nova - ${result.duplicadas} duplicadas ignoradas`
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
        tipo: "entrada",
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

      // Processar CMV para itens com mapeamento de produto
      const cmvResult = await processarCMVTransacao(
        transacao.id,
        transacao.empresa_id,
        transacao.canal,
        transacao.data_transacao
      );

      console.log(`[Conciliação Marketplace] Transação ${transacao.id} conciliada. CMV: ${cmvResult.processados.length} itens, ${cmvResult.semMapeamento.length} sem mapeamento`);

      return transacao as MarketplaceTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_por_produto"] });
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

      // Se estava conciliada, remover do FLOW HUB e CMV
      if (transacao.status === "conciliado") {
        await removerMovimentoFinanceiro(id, "marketplace");
        await removerCMVTransacao(id);
        console.log(`[Reabertura Marketplace] Transação ${id} reaberta, CMV removido`);
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
      queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produto_skus"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_por_produto"] });
      toast.success("Transação reaberta");
    },
    onError: (error) => {
      console.error("Erro ao reabrir transação:", error);
      toast.error("Erro ao reabrir transação");
    },
  });

  // Processamento de CMV em lote para transações já conciliadas
  const processarCMVLote = useMutation({
    mutationFn: async (empresaId: string) => {
      return await processarCMVEmLote(empresaId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["cmv_registros"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_resumo"] });
      queryClient.invalidateQueries({ queryKey: ["cmv_por_produto"] });
      
      if (result.itensCMV > 0) {
        toast.success(
          `CMV processado: ${result.itensCMV} itens de ${result.transacoesProcessadas} transações` +
          (result.itensSemMapeamento > 0 ? ` (${result.itensSemMapeamento} sem mapeamento)` : "")
        );
      } else if (result.transacoesProcessadas === 0) {
        toast.info("Nenhuma transação pendente de CMV encontrada");
      } else {
        toast.warning(`${result.transacoesProcessadas} transações processadas, mas nenhum item com mapeamento de produto`);
      }
    },
    onError: (error) => {
      console.error("Erro ao processar CMV em lote:", error);
      toast.error("Erro ao processar CMV em lote");
    },
  });

  // Resumo calculado
  const totalTarifas = transacoes.reduce((acc, t) => acc + (t.tarifas || 0), 0);
  const totalTaxas = transacoes.reduce((acc, t) => acc + (t.taxas || 0), 0);
  const totalOutrosDescontos = transacoes.reduce((acc, t) => acc + (t.outros_descontos || 0), 0);

  // Contagem separada para "importado" e "pendente"
  const importadas = transacoes.filter(t => t.status === "importado").length;
  const pendentesStatus = transacoes.filter(t => t.status === "pendente").length;
  
  const resumo: MarketplaceResumo = {
    total: transacoes.length,
    importadas,
    // IMPORTANTE: pendentes agora inclui TANTO "pendente" QUANTO "importado" 
    // pois ambos representam transações não conciliadas
    pendentes: importadas + pendentesStatus,
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

  // Query para buscar transações duplicadas (mesmo hash)
  const duplicatesQuery = useQuery({
    queryKey: ["marketplace_duplicates", params?.empresaId],
    queryFn: async () => {
      // Buscar todas as transações com hash
      let query = supabase
        .from("marketplace_transactions")
        .select("id, hash_duplicidade, data_transacao, descricao, valor_liquido, canal, pedido_id, status, criado_em")
        .not("hash_duplicidade", "is", null)
        .order("hash_duplicidade")
        .order("criado_em", { ascending: true });

      if (params?.empresaId) {
        query = query.eq("empresa_id", params.empresaId);
      }

      const { data, error } = await query.limit(50000);
      if (error) throw error;

      // Agrupar por hash e identificar duplicatas
      const hashGroups = new Map<string, typeof data>();
      
      for (const t of data || []) {
        if (!t.hash_duplicidade) continue;
        const existing = hashGroups.get(t.hash_duplicidade) || [];
        existing.push(t);
        hashGroups.set(t.hash_duplicidade, existing);
      }

      // Retornar apenas grupos com mais de 1 transação
      const duplicates: DuplicateGroup[] = [];
      hashGroups.forEach((transactions, hash) => {
        if (transactions.length > 1) {
          duplicates.push({
            hash,
            count: transactions.length,
            transactions: transactions as unknown as MarketplaceTransaction[],
          });
        }
      });

      return duplicates;
    },
    enabled: true,
  });

  // Mutation para excluir transações duplicadas
  const excluirDuplicatas = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return { deleted: 0 };

      const { error } = await supabase
        .from("marketplace_transactions")
        .delete()
        .in("id", ids);

      if (error) throw error;
      return { deleted: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace_duplicates"] });
      toast.success(`${result.deleted} transações duplicadas removidas`);
    },
    onError: (error) => {
      console.error("Erro ao excluir duplicatas:", error);
      toast.error("Erro ao excluir transações duplicadas");
    },
  });

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
    processarCMVLote,
    duplicatas: duplicatesQuery.data || [],
    isDuplicatesLoading: duplicatesQuery.isLoading,
    refetchDuplicates: duplicatesQuery.refetch,
    excluirDuplicatas,
  };
}
