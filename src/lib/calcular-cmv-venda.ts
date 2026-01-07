/**
 * Módulo para cálculo de CMV (Custo de Mercadoria Vendida) para vendas de marketplace.
 * Integra com mapeamentos de SKU e tabela de produtos para obter custo médio.
 */

import { supabase } from "@/integrations/supabase/client";

interface ItemVenda {
  id: string;
  transaction_id: string;
  sku_marketplace: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  produto_id: string | null;
}

interface ProdutoInfo {
  id: string;
  nome: string;
  sku: string;
  custo_medio: number;
}

interface CMVCalculado {
  itemId: string;
  transactionId: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  precoVendaUnitario: number | null;
  receitaTotal: number | null;
  margemBruta: number | null;
  margemPercentual: number | null;
}

interface ResultadoCMV {
  processados: CMVCalculado[];
  semMapeamento: { itemId: string; skuMarketplace: string | null; descricao: string | null }[];
  erros: { itemId: string; erro: string }[];
}

/**
 * Busca o produto interno via mapeamento de SKU de marketplace
 */
async function buscarProdutoPorMapeamento(
  empresaId: string,
  canal: string,
  skuMarketplace: string | null,
  descricaoItem: string | null
): Promise<ProdutoInfo | null> {
  if (!skuMarketplace && !descricaoItem) return null;

  // Primeiro tentar pelo sku_marketplace
  if (skuMarketplace) {
    const { data: mapping } = await supabase
      .from("produto_marketplace_map")
      .select("produto_id")
      .eq("empresa_id", empresaId)
      .eq("canal", canal)
      .eq("sku_marketplace", skuMarketplace)
      .eq("ativo", true)
      .maybeSingle();

    if (mapping?.produto_id) {
      const { data: produto } = await supabase
        .from("produtos")
        .select("id, nome, sku, custo_medio")
        .eq("id", mapping.produto_id)
        .single();

      if (produto) {
        return {
          id: produto.id,
          nome: produto.nome,
          sku: produto.sku,
          custo_medio: Number(produto.custo_medio) || 0,
        };
      }
    }
  }

  return null;
}

/**
 * Calcula CMV para um item de venda
 */
function calcularCMVItem(
  item: ItemVenda,
  produto: ProdutoInfo
): CMVCalculado {
  const quantidade = item.quantidade || 1;
  const custoUnitario = produto.custo_medio || 0;
  const custoTotal = quantidade * custoUnitario;
  
  const receitaTotal = item.preco_total ?? (item.preco_unitario ? item.preco_unitario * quantidade : null);
  const margemBruta = receitaTotal !== null ? receitaTotal - custoTotal : null;
  const margemPercentual = receitaTotal && receitaTotal > 0 ? (margemBruta! / receitaTotal) * 100 : null;

  return {
    itemId: item.id,
    transactionId: item.transaction_id,
    produtoId: produto.id,
    produtoNome: produto.nome,
    quantidade,
    custoUnitario,
    custoTotal,
    precoVendaUnitario: item.preco_unitario,
    receitaTotal,
    margemBruta,
    margemPercentual,
  };
}

/**
 * Processa CMV para uma transação de marketplace.
 * Busca os itens da transação e calcula CMV para cada um que tenha mapeamento de produto.
 */
export async function processarCMVTransacao(
  transactionId: string,
  empresaId: string,
  canal: string,
  dataTransacao: string
): Promise<ResultadoCMV> {
  const resultado: ResultadoCMV = {
    processados: [],
    semMapeamento: [],
    erros: [],
  };

  try {
    // Buscar itens da transação
    const { data: itens, error: itensError } = await supabase
      .from("marketplace_transaction_items")
      .select("id, transaction_id, sku_marketplace, descricao_item, quantidade, preco_unitario, preco_total, produto_id")
      .eq("transaction_id", transactionId);

    if (itensError) {
      console.error("[CMV] Erro ao buscar itens:", itensError);
      return resultado;
    }

    if (!itens || itens.length === 0) {
      console.log("[CMV] Nenhum item encontrado para transação:", transactionId);
      return resultado;
    }

    // Processar cada item
    for (const item of itens) {
      try {
        // Se já tem produto_id, usar diretamente
        let produtoInfo: ProdutoInfo | null = null;

        if (item.produto_id) {
          const { data: produto } = await supabase
            .from("produtos")
            .select("id, nome, sku, custo_medio")
            .eq("id", item.produto_id)
            .single();

          if (produto) {
            produtoInfo = {
              id: produto.id,
              nome: produto.nome,
              sku: produto.sku,
              custo_medio: Number(produto.custo_medio) || 0,
            };
          }
        }

        // Se não tem produto_id, buscar via mapeamento
        if (!produtoInfo) {
          produtoInfo = await buscarProdutoPorMapeamento(
            empresaId,
            canal,
            item.sku_marketplace,
            item.descricao_item
          );
        }

        if (!produtoInfo) {
          resultado.semMapeamento.push({
            itemId: item.id,
            skuMarketplace: item.sku_marketplace,
            descricao: item.descricao_item,
          });
          continue;
        }

        // Calcular CMV
        const cmvItem = calcularCMVItem(item as ItemVenda, produtoInfo);
        resultado.processados.push(cmvItem);

        // Atualizar produto_id no item se não estava preenchido
        if (!item.produto_id) {
          await supabase
            .from("marketplace_transaction_items")
            .update({ produto_id: produtoInfo.id })
            .eq("id", item.id);
        }

      } catch (itemError: any) {
        console.error("[CMV] Erro ao processar item:", item.id, itemError);
        resultado.erros.push({
          itemId: item.id,
          erro: itemError.message || "Erro desconhecido",
        });
      }
    }

    // Inserir registros de CMV no banco
    if (resultado.processados.length > 0) {
      const registrosCMV = resultado.processados.map(cmv => ({
        empresa_id: empresaId,
        produto_id: cmv.produtoId,
        armazem_id: null,
        data: dataTransacao,
        origem: "marketplace",
        canal: canal,
        quantidade: cmv.quantidade,
        custo_unitario: cmv.custoUnitario,
        custo_total: cmv.custoTotal,
        preco_venda_unitario: cmv.precoVendaUnitario,
        receita_total: cmv.receitaTotal,
        margem_bruta: cmv.margemBruta,
        margem_percentual: cmv.margemPercentual,
        referencia_id: cmv.itemId,
        observacoes: `Venda marketplace - Item ${cmv.itemId}`,
      }));

      const { error: insertError } = await supabase
        .from("cmv_registros")
        .insert(registrosCMV);

      if (insertError) {
        console.error("[CMV] Erro ao inserir registros:", insertError);
        // Não lançar erro para não interromper a conciliação
      } else {
        console.log(`[CMV] ${registrosCMV.length} registros de CMV inseridos para transação ${transactionId}`);
      }
    }

  } catch (error: any) {
    console.error("[CMV] Erro geral ao processar transação:", error);
  }

  return resultado;
}

/**
 * Processa CMV em lote para transações já conciliadas que não têm CMV registrado.
 */
export async function processarCMVEmLote(
  empresaId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  transacoesProcessadas: number;
  itensCMV: number;
  itensSemMapeamento: number;
  erros: number;
}> {
  const resultado = {
    transacoesProcessadas: 0,
    itensCMV: 0,
    itensSemMapeamento: 0,
    erros: 0,
  };

  try {
    // Buscar transações conciliadas
    const { data: transacoes, error: transError } = await supabase
      .from("marketplace_transactions")
      .select("id, empresa_id, canal, data_transacao")
      .eq("empresa_id", empresaId)
      .eq("status", "conciliado")
      .order("data_transacao", { ascending: false });

    if (transError) {
      console.error("[CMV Lote] Erro ao buscar transações:", transError);
      return resultado;
    }

    if (!transacoes || transacoes.length === 0) {
      console.log("[CMV Lote] Nenhuma transação conciliada encontrada");
      return resultado;
    }

    // Buscar IDs de transações que já têm CMV registrado (via referencia_id nos itens)
    const { data: cmvExistentes } = await supabase
      .from("cmv_registros")
      .select("referencia_id")
      .eq("empresa_id", empresaId)
      .eq("origem", "marketplace")
      .not("referencia_id", "is", null);

    const refsJaProcessadas = new Set(
      (cmvExistentes || []).map(c => c.referencia_id)
    );

    // Buscar todos os itens dessas transações
    const transacaoIds = transacoes.map(t => t.id);
    const { data: todosItens } = await supabase
      .from("marketplace_transaction_items")
      .select("id, transaction_id")
      .in("transaction_id", transacaoIds);

    // Identificar transações que ainda precisam de CMV
    const transacoesParaProcessar = transacoes.filter(t => {
      const itensTransacao = (todosItens || []).filter(i => i.transaction_id === t.id);
      // Se nenhum item dessa transação tem CMV, processar
      return itensTransacao.some(i => !refsJaProcessadas.has(i.id));
    });

    const total = transacoesParaProcessar.length;
    console.log(`[CMV Lote] ${total} transações para processar`);

    for (let i = 0; i < transacoesParaProcessar.length; i++) {
      const transacao = transacoesParaProcessar[i];
      
      const cmvResult = await processarCMVTransacao(
        transacao.id,
        transacao.empresa_id,
        transacao.canal,
        transacao.data_transacao
      );

      resultado.transacoesProcessadas++;
      resultado.itensCMV += cmvResult.processados.length;
      resultado.itensSemMapeamento += cmvResult.semMapeamento.length;
      resultado.erros += cmvResult.erros.length;

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

  } catch (error: any) {
    console.error("[CMV Lote] Erro geral:", error);
  }

  return resultado;
}

/**
 * Remove registros de CMV de uma transação (para uso na reabertura)
 */
export async function removerCMVTransacao(transactionId: string): Promise<void> {
  try {
    // Buscar IDs dos itens da transação
    const { data: itens } = await supabase
      .from("marketplace_transaction_items")
      .select("id")
      .eq("transaction_id", transactionId);

    if (!itens || itens.length === 0) return;

    const itemIds = itens.map(i => i.id);

    // Remover registros de CMV vinculados aos itens
    const { error } = await supabase
      .from("cmv_registros")
      .delete()
      .in("referencia_id", itemIds);

    if (error) {
      console.error("[CMV] Erro ao remover registros:", error);
    } else {
      console.log(`[CMV] Registros de CMV removidos para transação ${transactionId}`);
    }
  } catch (error) {
    console.error("[CMV] Erro ao remover CMV da transação:", error);
  }
}
