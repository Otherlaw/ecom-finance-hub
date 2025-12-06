/**
 * Serviço para gerenciar itens de transações de marketplace
 * 
 * Responsável por:
 * - Criar registros em marketplace_transaction_items
 * - Vincular automaticamente com produtos via marketplace_sku_mappings
 */

import { supabase } from "@/integrations/supabase/client";

export interface ItemParaInserir {
  sku_marketplace: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
}

export interface ResultadoCriacaoItens {
  totalItens: number;
  itensVinculados: number;
  itensSemVinculo: number;
  erros: number;
}

// Cache de mapeamentos SKU marketplace -> produto/sku interno
let cacheMapeamentos: Map<string, { produto_id: string | null; sku_id: string | null }> = new Map();
let cacheCarregado = false;

/**
 * Carrega cache de mapeamentos MLB -> SKU interno
 */
async function carregarCacheMapeamentos(empresaId: string, canal: string): Promise<void> {
  if (cacheCarregado) return;

  const { data: mapeamentos } = await supabase
    .from("marketplace_sku_mappings")
    .select("sku_marketplace, produto_id, sku_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canal);

  if (mapeamentos) {
    mapeamentos.forEach(m => {
      const key = `${canal}:${m.sku_marketplace}`.toLowerCase();
      cacheMapeamentos.set(key, {
        produto_id: m.produto_id,
        sku_id: m.sku_id,
      });
    });
  }

  cacheCarregado = true;
}

/**
 * Limpa o cache de mapeamentos (chamar ao trocar de empresa ou canal)
 */
export function limparCacheMapeamentos() {
  cacheMapeamentos.clear();
  cacheCarregado = false;
}

/**
 * Busca mapeamento para um SKU de marketplace
 */
async function buscarMapeamento(
  empresaId: string,
  canal: string,
  skuMarketplace: string
): Promise<{ produto_id: string | null; sku_id: string | null }> {
  await carregarCacheMapeamentos(empresaId, canal);

  const key = `${canal}:${skuMarketplace}`.toLowerCase();
  
  if (cacheMapeamentos.has(key)) {
    return cacheMapeamentos.get(key)!;
  }

  return { produto_id: null, sku_id: null };
}

/**
 * Cria um novo mapeamento MLB -> SKU interno (para uso futuro)
 */
export async function criarMapeamento(params: {
  empresaId: string;
  canal: string;
  skuMarketplace: string;
  produtoId?: string | null;
  skuId?: string | null;
  nomeMarketplace?: string | null;
  automatico?: boolean;
}): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("marketplace_sku_mappings")
      .insert({
        empresa_id: params.empresaId,
        canal: params.canal,
        sku_marketplace: params.skuMarketplace,
        produto_id: params.produtoId || null,
        sku_id: params.skuId || null,
        nome_produto_marketplace: params.nomeMarketplace || null,
        mapeado_automaticamente: params.automatico || false,
      })
      .select("id")
      .single();

    if (error) {
      // Se já existe, ignorar
      if (error.code === "23505") {
        return null;
      }
      console.warn("[Items] Erro ao criar mapeamento:", error);
      return null;
    }

    // Atualizar cache
    const key = `${params.canal}:${params.skuMarketplace}`.toLowerCase();
    cacheMapeamentos.set(key, {
      produto_id: params.produtoId || null,
      sku_id: params.skuId || null,
    });

    return data.id;
  } catch (err) {
    console.warn("[Items] Erro ao criar mapeamento:", err);
    return null;
  }
}

/**
 * Cria registros de itens para uma transação de marketplace
 */
export async function criarItensTransacao(
  transactionId: string,
  empresaId: string,
  canal: string,
  itens: ItemParaInserir[]
): Promise<ResultadoCriacaoItens> {
  const resultado: ResultadoCriacaoItens = {
    totalItens: itens.length,
    itensVinculados: 0,
    itensSemVinculo: 0,
    erros: 0,
  };

  if (itens.length === 0) {
    return resultado;
  }

  const itensParaInserir: any[] = [];

  for (const item of itens) {
    let produtoId: string | null = null;
    let skuId: string | null = null;

    // Se tem SKU marketplace, tentar vincular
    if (item.sku_marketplace) {
      const mapeamento = await buscarMapeamento(empresaId, canal, item.sku_marketplace);
      produtoId = mapeamento.produto_id;
      skuId = mapeamento.sku_id;

      if (produtoId || skuId) {
        resultado.itensVinculados++;
      } else {
        resultado.itensSemVinculo++;
        
        // Criar mapeamento "pendente" para facilitar vinculação futura
        await criarMapeamento({
          empresaId,
          canal,
          skuMarketplace: item.sku_marketplace,
          nomeMarketplace: item.descricao_item,
          automatico: true,
        });
      }
    } else {
      resultado.itensSemVinculo++;
    }

    itensParaInserir.push({
      transaction_id: transactionId,
      sku_marketplace: item.sku_marketplace,
      descricao_item: item.descricao_item,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      preco_total: item.preco_total,
      produto_id: produtoId,
      sku_id: skuId,
    });
  }

  // Inserir itens em lote
  if (itensParaInserir.length > 0) {
    const { error } = await supabase
      .from("marketplace_transaction_items")
      .insert(itensParaInserir);

    if (error) {
      console.error("[Items] Erro ao inserir itens:", error);
      resultado.erros = itensParaInserir.length;
    }
  }

  return resultado;
}

/**
 * Cria itens para múltiplas transações em lote
 */
export async function criarItensEmLote(
  transacoesComItens: Array<{
    transactionId: string;
    itens: ItemParaInserir[];
  }>,
  empresaId: string,
  canal: string
): Promise<ResultadoCriacaoItens> {
  const resultadoTotal: ResultadoCriacaoItens = {
    totalItens: 0,
    itensVinculados: 0,
    itensSemVinculo: 0,
    erros: 0,
  };

  // Carregar cache uma vez
  await carregarCacheMapeamentos(empresaId, canal);

  const todosItensParaInserir: any[] = [];
  const mapeamentosPendentes: Array<{
    empresaId: string;
    canal: string;
    skuMarketplace: string;
    nomeMarketplace: string | null;
  }> = [];

  for (const { transactionId, itens } of transacoesComItens) {
    resultadoTotal.totalItens += itens.length;

    for (const item of itens) {
      let produtoId: string | null = null;
      let skuId: string | null = null;

      if (item.sku_marketplace) {
        const key = `${canal}:${item.sku_marketplace}`.toLowerCase();
        const mapeamento = cacheMapeamentos.get(key);

        if (mapeamento) {
          produtoId = mapeamento.produto_id;
          skuId = mapeamento.sku_id;
        }

        if (produtoId || skuId) {
          resultadoTotal.itensVinculados++;
        } else {
          resultadoTotal.itensSemVinculo++;
          
          // Guardar para criar mapeamento pendente depois
          if (!cacheMapeamentos.has(key)) {
            mapeamentosPendentes.push({
              empresaId,
              canal,
              skuMarketplace: item.sku_marketplace,
              nomeMarketplace: item.descricao_item,
            });
            // Marcar como "em processamento" para não duplicar
            cacheMapeamentos.set(key, { produto_id: null, sku_id: null });
          }
        }
      } else {
        resultadoTotal.itensSemVinculo++;
      }

      todosItensParaInserir.push({
        transaction_id: transactionId,
        sku_marketplace: item.sku_marketplace,
        descricao_item: item.descricao_item,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_total: item.preco_total,
        produto_id: produtoId,
        sku_id: skuId,
      });
    }
  }

  // Inserir todos os itens em lote
  if (todosItensParaInserir.length > 0) {
    // Inserir em chunks de 500
    const CHUNK_SIZE = 500;
    for (let i = 0; i < todosItensParaInserir.length; i += CHUNK_SIZE) {
      const chunk = todosItensParaInserir.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from("marketplace_transaction_items")
        .insert(chunk);

      if (error) {
        console.error("[Items] Erro ao inserir itens (lote):", error);
        resultadoTotal.erros += chunk.length;
      }
    }
  }

  // Criar mapeamentos pendentes em lote (ignorar duplicados)
  if (mapeamentosPendentes.length > 0) {
    const mapeamentosUnicos = mapeamentosPendentes.filter((m, idx, arr) =>
      arr.findIndex(x => x.skuMarketplace === m.skuMarketplace && x.canal === m.canal) === idx
    );

    const mapeamentosParaInserir = mapeamentosUnicos.map(m => ({
      empresa_id: m.empresaId,
      canal: m.canal,
      sku_marketplace: m.skuMarketplace,
      nome_produto_marketplace: m.nomeMarketplace,
      mapeado_automaticamente: true,
    }));

    // Inserir em chunks de 500, ignorando conflitos
    for (let i = 0; i < mapeamentosParaInserir.length; i += 500) {
      const chunk = mapeamentosParaInserir.slice(i, i + 500);
      await supabase
        .from("marketplace_sku_mappings")
        .upsert(chunk, { onConflict: "empresa_id,canal,sku_marketplace", ignoreDuplicates: true });
    }
  }

  return resultadoTotal;
}
