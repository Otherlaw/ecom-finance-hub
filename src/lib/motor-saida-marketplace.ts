/**
 * MOTOR DE SAÍDA DE ESTOQUE - MARKETPLACE
 * 
 * Integra transações de marketplace conciliadas com o motor de estoque e CMV.
 * Usa as funções existentes de saída de estoque por Produto ou SKU.
 */

import { supabase } from "@/integrations/supabase/client";
import { registrarSaidaEstoque, type SaidaEstoqueInput } from "./motor-custos";
import { registrarSaidaEstoqueSKU, type SaidaEstoqueSKUInput } from "./motor-estoque-sku";
import { buscarMapeamentoPorSkuMarketplace } from "@/hooks/useMarketplaceSkuMappings";

// ============= TIPOS =============

export interface MarketplaceTransactionItem {
  id: string;
  transaction_id: string;
  produto_id: string | null;
  sku_id: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  sku_marketplace: string | null;
  descricao_item: string | null;
}

export interface ProcessarSaidaMarketplaceParams {
  transactionId: string;
  empresaId: string;
  dataVenda: string;
  canal: string;
  pedidoId?: string | null;
}

export interface ProcessarSaidaMarketplaceResult {
  processados: number;
  erros: number;
  movimentacaoIds: string[];
  cmvIds: string[];
  mensagens: string[];
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Verifica idempotência: se já foram processadas saídas para esta transação
 */
async function verificarIdempotencia(transactionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("movimentacoes_estoque")
    .select("id")
    .eq("origem", "marketplace")
    .eq("referencia_id", transactionId)
    .limit(1);

  if (error) {
    console.error("[Motor Saída Marketplace] Erro ao verificar idempotência:", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Busca itens vinculados a uma transação de marketplace
 * e tenta vincular automaticamente via mapeamento de SKU
 */
async function buscarItensTransacao(
  transactionId: string,
  empresaId: string,
  canal: string
): Promise<MarketplaceTransactionItem[]> {
  const { data, error } = await supabase
    .from("marketplace_transaction_items")
    .select("*")
    .eq("transaction_id", transactionId);

  if (error) {
    console.error("[Motor Saída Marketplace] Erro ao buscar itens:", error);
    return [];
  }

  const itens: MarketplaceTransactionItem[] = [];
  
  for (const item of data || []) {
    const itemProcessado: MarketplaceTransactionItem = {
      id: item.id,
      transaction_id: item.transaction_id,
      produto_id: item.produto_id,
      sku_id: item.sku_id,
      quantidade: Number(item.quantidade) || 1,
      preco_unitario: item.preco_unitario ? Number(item.preco_unitario) : null,
      preco_total: item.preco_total ? Number(item.preco_total) : null,
      sku_marketplace: item.sku_marketplace,
      descricao_item: item.descricao_item,
    };

    // Se não tem vinculação mas tem sku_marketplace, tentar buscar mapeamento
    if (!itemProcessado.produto_id && !itemProcessado.sku_id && itemProcessado.sku_marketplace) {
      const mapeamento = await buscarMapeamentoPorSkuMarketplace(
        empresaId,
        canal,
        itemProcessado.sku_marketplace
      );

      if (mapeamento) {
        itemProcessado.sku_id = mapeamento.skuId;
        itemProcessado.produto_id = mapeamento.produtoId;

        // Atualizar o item no banco com a vinculação encontrada
        if (mapeamento.skuId || mapeamento.produtoId) {
          await supabase
            .from("marketplace_transaction_items")
            .update({
              sku_id: mapeamento.skuId,
              produto_id: mapeamento.produtoId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          console.log(
            `[Motor Saída Marketplace] Item ${item.id} vinculado automaticamente via mapeamento SKU ${itemProcessado.sku_marketplace}`
          );
        }
      }
    }

    itens.push(itemProcessado);
  }

  return itens;
}

// ============= FUNÇÃO PRINCIPAL =============

/**
 * Processa saída de estoque para uma transação de marketplace conciliada.
 * 
 * Para cada item da transação:
 * - Tenta vincular automaticamente via mapeamento de SKU
 * - Se tiver sku_id: usa registrarSaidaEstoqueSKU
 * - Se tiver apenas produto_id: usa registrarSaidaEstoque
 * - Se não tiver vinculação: ignora com log
 * 
 * Idempotente: não processa se já houver movimentações para esta transação.
 */
export async function processarSaidaEstoqueMarketplace(
  params: ProcessarSaidaMarketplaceParams
): Promise<ProcessarSaidaMarketplaceResult> {
  const { transactionId, empresaId, dataVenda, canal, pedidoId } = params;
  
  const result: ProcessarSaidaMarketplaceResult = {
    processados: 0,
    erros: 0,
    movimentacaoIds: [],
    cmvIds: [],
    mensagens: [],
  };

  // 1. Verificar idempotência
  const jaProcessado = await verificarIdempotencia(transactionId);
  if (jaProcessado) {
    result.mensagens.push(`Transação ${transactionId} já possui movimentações de estoque. Ignorando.`);
    console.log(`[Motor Saída Marketplace] Transação ${transactionId} já processada (idempotência)`);
    return result;
  }

  // 2. Buscar itens da transação (com auto-vinculação via mapeamento)
  const itens = await buscarItensTransacao(transactionId, empresaId, canal);
  
  if (itens.length === 0) {
    result.mensagens.push("Nenhum item de produto vinculado a esta transação. Saída de estoque não processada.");
    console.warn(`[Motor Saída Marketplace] Transação ${transactionId} sem itens vinculados`);
    return result;
  }

  // 3. Processar cada item
  for (const item of itens) {
    try {
      // Priorizar SKU sobre Produto
      if (item.sku_id) {
        // Saída por SKU
        const saidaInput: SaidaEstoqueSKUInput = {
          skuId: item.sku_id,
          empresaId,
          quantidade: item.quantidade,
          origem: "marketplace",
          referenciaId: transactionId,
          data: dataVenda,
          precoVendaUnitario: item.preco_unitario ?? undefined,
          receitaTotal: item.preco_total ?? undefined,
          canal,
          observacoes: pedidoId ? `Pedido: ${pedidoId}` : undefined,
        };

        const { movimentacaoId, cmvId } = await registrarSaidaEstoqueSKU(saidaInput);
        result.movimentacaoIds.push(movimentacaoId);
        result.cmvIds.push(cmvId);
        result.processados++;
        
      } else if (item.produto_id) {
        // Saída por Produto
        const saidaInput: SaidaEstoqueInput = {
          produtoId: item.produto_id,
          empresaId,
          quantidade: item.quantidade,
          origem: "marketplace",
          referenciaId: transactionId,
          data: dataVenda,
          precoVendaUnitario: item.preco_unitario ?? undefined,
          receitaTotal: item.preco_total ?? undefined,
          canal,
          observacoes: pedidoId ? `Pedido: ${pedidoId}` : undefined,
        };

        const { movimentacaoId, cmvId } = await registrarSaidaEstoque(saidaInput);
        result.movimentacaoIds.push(movimentacaoId);
        result.cmvIds.push(cmvId);
        result.processados++;
        
      } else {
        // Sem vinculação
        result.mensagens.push(`Item ${item.id} sem produto/SKU vinculado. SKU marketplace: ${item.sku_marketplace || 'N/A'}`);
        console.warn(`[Motor Saída Marketplace] Item ${item.id} sem vinculação de produto`);
      }
    } catch (error) {
      result.erros++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.mensagens.push(`Erro ao processar item ${item.id}: ${errorMsg}`);
      console.error(`[Motor Saída Marketplace] Erro ao processar item ${item.id}:`, error);
    }
  }

  console.log(
    `[Motor Saída Marketplace] Transação ${transactionId}: ${result.processados} itens processados, ${result.erros} erros`
  );

  return result;
}

// ============= REVERSÃO =============

/**
 * Reverte saídas de estoque de uma transação de marketplace (ao reabrir).
 * 
 * Remove movimentações e registros de CMV, e restaura saldos de estoque.
 */
export async function reverterSaidaEstoqueMarketplace(
  transactionId: string
): Promise<{ revertidos: number; erros: string[] }> {
  const result = { revertidos: 0, erros: [] as string[] };

  try {
    // 1. Buscar movimentações de estoque desta transação
    const { data: movimentacoes, error: movError } = await supabase
      .from("movimentacoes_estoque")
      .select("id, produto_id, sku_id, quantidade, custo_total")
      .eq("origem", "marketplace")
      .eq("referencia_id", transactionId)
      .eq("tipo", "saida");

    if (movError) {
      result.erros.push(`Erro ao buscar movimentações: ${movError.message}`);
      return result;
    }

    if (!movimentacoes || movimentacoes.length === 0) {
      console.log(`[Motor Saída Marketplace] Nenhuma movimentação para reverter da transação ${transactionId}`);
      return result;
    }

    // 2. Para cada movimentação, restaurar estoque
    for (const mov of movimentacoes) {
      try {
        const quantidade = Number(mov.quantidade) || 0;

        if (mov.sku_id) {
          // Reverter SKU
          const { data: sku, error: skuError } = await supabase
            .from("produto_skus")
            .select("estoque_atual, produto_id")
            .eq("id", mov.sku_id)
            .single();

          if (!skuError && sku) {
            const novoEstoque = Number(sku.estoque_atual || 0) + quantidade;
            
            await supabase
              .from("produto_skus")
              .update({ 
                estoque_atual: novoEstoque,
                ultima_atualizacao_custo: new Date().toISOString(),
              })
              .eq("id", mov.sku_id);

            // Sincronizar produto pai
            if (sku.produto_id) {
              await sincronizarEstoqueProdutoPai(sku.produto_id);
            }
          }
        } else if (mov.produto_id) {
          // Reverter Produto diretamente
          const { data: produto, error: prodError } = await supabase
            .from("produtos")
            .select("estoque_atual")
            .eq("id", mov.produto_id)
            .single();

          if (!prodError && produto) {
            const novoEstoque = Number(produto.estoque_atual || 0) + quantidade;
            
            await supabase
              .from("produtos")
              .update({ 
                estoque_atual: novoEstoque,
                ultima_atualizacao_custo: new Date().toISOString(),
              })
              .eq("id", mov.produto_id);
          }
        }

        result.revertidos++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.erros.push(`Erro ao reverter movimentação ${mov.id}: ${errMsg}`);
      }
    }

    // 3. Remover registros de CMV
    const { error: cmvError } = await supabase
      .from("cmv_registros")
      .delete()
      .eq("origem", "marketplace")
      .eq("referencia_id", transactionId);

    if (cmvError) {
      result.erros.push(`Erro ao remover CMV: ${cmvError.message}`);
    }

    // 4. Remover movimentações de estoque
    const { error: delMovError } = await supabase
      .from("movimentacoes_estoque")
      .delete()
      .eq("origem", "marketplace")
      .eq("referencia_id", transactionId);

    if (delMovError) {
      result.erros.push(`Erro ao remover movimentações: ${delMovError.message}`);
    }

    console.log(
      `[Motor Saída Marketplace] Transação ${transactionId}: ${result.revertidos} movimentações revertidas`
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.erros.push(`Erro geral na reversão: ${errMsg}`);
    console.error(`[Motor Saída Marketplace] Erro ao reverter transação ${transactionId}:`, error);
  }

  return result;
}

/**
 * Helper para sincronizar estoque do produto pai após reversão de SKU
 */
async function sincronizarEstoqueProdutoPai(produtoId: string): Promise<void> {
  const { data: skus, error } = await supabase
    .from("produto_skus")
    .select("estoque_atual, custo_medio_atual")
    .eq("produto_id", produtoId)
    .eq("ativo", true);

  if (error) {
    console.error("[Motor Saída Marketplace] Erro ao sincronizar produto pai:", error);
    return;
  }

  const estoqueTotal = (skus || []).reduce((sum, s) => sum + Number(s.estoque_atual || 0), 0);
  const valorTotal = (skus || []).reduce(
    (sum, s) => sum + (Number(s.estoque_atual || 0) * Number(s.custo_medio_atual || 0)),
    0
  );
  const custoMedioProduto = estoqueTotal > 0 ? valorTotal / estoqueTotal : 0;

  await supabase
    .from("produtos")
    .update({
      estoque_atual: estoqueTotal,
      custo_medio_atual: Math.round(custoMedioProduto * 100) / 100,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", produtoId);
}
