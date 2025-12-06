/**
 * Serviço para gerenciar itens de transações de marketplace
 * 
 * Responsável por:
 * - Criar registros em marketplace_transaction_items
 * - Vincular automaticamente com produtos via mapeamento Upseller (produto_sku_map)
 * - Fallback para marketplace_sku_mappings (legado)
 */

import { supabase } from "@/integrations/supabase/client";
import { 
  carregarCacheMapeamentos, 
  resolverSkuDoCache, 
  extrairMLB,
  limparCacheMapeamentosPorEmpresa,
  type MapeamentoCache,
  type ChaveMapMarketplace,
} from "./marketplace-sku-resolver";

export interface ItemParaInserir {
  sku_marketplace: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  // Novos campos para mapeamento Upseller
  anuncio_id?: string | null;
  variante_id?: string | null;
}

export interface ResultadoCriacaoItens {
  totalItens: number;
  itensVinculados: number;
  itensSemVinculo: number;
  erros: number;
}

/**
 * Limpa o cache de mapeamentos (chamar ao trocar de empresa ou canal)
 */
export function limparCacheMapeamentos() {
  limparCacheMapeamentosPorEmpresa();
}

/**
 * Cria um novo mapeamento MLB -> SKU interno na tabela legada
 * (mantido para compatibilidade)
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

    return data.id;
  } catch (err) {
    console.warn("[Items] Erro ao criar mapeamento:", err);
    return null;
  }
}

/**
 * Cria registros de itens para uma transação de marketplace
 * Usa o novo sistema de mapeamento Upseller
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

  // Carregar cache de mapeamentos
  const cache = await carregarCacheMapeamentos(empresaId, canal);
  const itensParaInserir: any[] = [];
  const mapeamentosPendentes: Array<{
    empresaId: string;
    canal: string;
    skuMarketplace: string;
    nomeMarketplace: string | null;
  }> = [];

  for (const item of itens) {
    // Extrair anuncio_id do sku_marketplace se não fornecido
    const anuncioId = item.anuncio_id || extrairMLB(item.sku_marketplace);
    
    // Resolver mapeamento
    const mapeamento = resolverSkuDoCache(cache, {
      canal,
      anuncioId,
      varianteId: item.variante_id || null,
      skuMarketplace: item.sku_marketplace,
    });

    if (mapeamento.produtoId || mapeamento.skuId) {
      resultado.itensVinculados++;
    } else {
      resultado.itensSemVinculo++;
      
      // Criar mapeamento pendente para facilitar vinculação futura
      if (item.sku_marketplace) {
        mapeamentosPendentes.push({
          empresaId,
          canal,
          skuMarketplace: item.sku_marketplace,
          nomeMarketplace: item.descricao_item,
        });
      }
    }

    itensParaInserir.push({
      transaction_id: transactionId,
      sku_marketplace: item.sku_marketplace,
      descricao_item: item.descricao_item,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      preco_total: item.preco_total,
      anuncio_id: anuncioId,
      variante_id: item.variante_id || null,
      produto_id: mapeamento.produtoId,
      sku_id: mapeamento.skuId,
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

  // Criar mapeamentos pendentes na tabela legada (para retrocompatibilidade)
  if (mapeamentosPendentes.length > 0) {
    const mapeamentosUnicos = mapeamentosPendentes.filter((m, idx, arr) =>
      arr.findIndex(x => x.skuMarketplace === m.skuMarketplace && x.canal === m.canal) === idx
    );

    for (const m of mapeamentosUnicos) {
      await criarMapeamento({
        empresaId: m.empresaId,
        canal: m.canal,
        skuMarketplace: m.skuMarketplace,
        nomeMarketplace: m.nomeMarketplace,
        automatico: true,
      });
    }
  }

  return resultado;
}

/**
 * Cria itens para múltiplas transações em lote (OTIMIZADO)
 * Usa cache único para todos os itens, evitando N+1 queries
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

  // Carregar cache UMA VEZ para toda a operação
  const cache = await carregarCacheMapeamentos(empresaId, canal);
  console.log(`[Items Lote] Cache carregado para ${canal}`);

  const todosItensParaInserir: any[] = [];
  const mapeamentosPendentes: Map<string, { nomeMarketplace: string | null }> = new Map();

  for (const { transactionId, itens } of transacoesComItens) {
    resultadoTotal.totalItens += itens.length;

    for (const item of itens) {
      // Extrair anuncio_id do sku_marketplace se não fornecido
      const anuncioId = item.anuncio_id || extrairMLB(item.sku_marketplace);
      
      // Resolver mapeamento usando cache (sem queries adicionais)
      const mapeamento = resolverSkuDoCache(cache, {
        canal,
        anuncioId,
        varianteId: item.variante_id || null,
        skuMarketplace: item.sku_marketplace,
      });

      if (mapeamento.produtoId || mapeamento.skuId) {
        resultadoTotal.itensVinculados++;
      } else {
        resultadoTotal.itensSemVinculo++;
        
        // Guardar para criar mapeamento pendente depois
        if (item.sku_marketplace) {
          const key = `${canal}:${item.sku_marketplace}`.toLowerCase();
          if (!mapeamentosPendentes.has(key)) {
            mapeamentosPendentes.set(key, { nomeMarketplace: item.descricao_item });
          }
        }
      }

      todosItensParaInserir.push({
        transaction_id: transactionId,
        sku_marketplace: item.sku_marketplace,
        descricao_item: item.descricao_item,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_total: item.preco_total,
        anuncio_id: anuncioId,
        variante_id: item.variante_id || null,
        produto_id: mapeamento.produtoId,
        sku_id: mapeamento.skuId,
      });
    }
  }

  console.log(`[Items Lote] Preparados ${todosItensParaInserir.length} itens para inserção`);
  console.log(`[Items Lote] Vinculados: ${resultadoTotal.itensVinculados}, Sem vínculo: ${resultadoTotal.itensSemVinculo}`);

  // Inserir todos os itens em chunks de 500
  if (todosItensParaInserir.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < todosItensParaInserir.length; i += CHUNK_SIZE) {
      const chunk = todosItensParaInserir.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from("marketplace_transaction_items")
        .insert(chunk);

      if (error) {
        console.error("[Items Lote] Erro ao inserir itens:", error);
        resultadoTotal.erros += chunk.length;
      }
    }
  }

  // Criar mapeamentos pendentes em lote (ignorar duplicados)
  if (mapeamentosPendentes.size > 0) {
    const mapeamentosParaInserir = Array.from(mapeamentosPendentes.entries()).map(([key, val]) => {
      const [canalPart, skuMarketplace] = key.split(':');
      return {
        empresa_id: empresaId,
        canal: canalPart || canal,
        sku_marketplace: skuMarketplace,
        nome_produto_marketplace: val.nomeMarketplace,
        mapeado_automaticamente: true,
      };
    });

    // Inserir em chunks de 500, ignorando conflitos
    for (let i = 0; i < mapeamentosParaInserir.length; i += 500) {
      const chunk = mapeamentosParaInserir.slice(i, i + 500);
      await supabase
        .from("marketplace_sku_mappings")
        .upsert(chunk, { onConflict: "empresa_id,canal,sku_marketplace", ignoreDuplicates: true });
    }
    
    console.log(`[Items Lote] ${mapeamentosPendentes.size} mapeamentos pendentes criados`);
  }

  return resultadoTotal;
}
