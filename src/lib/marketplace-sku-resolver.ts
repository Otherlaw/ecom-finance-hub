/**
 * MARKETPLACE SKU RESOLVER
 * 
 * Serviço de resolução de SKUs de marketplace para produtos internos.
 * Usa o mapeamento do Upseller (produto_sku_map) como fonte principal,
 * com fallback para marketplace_sku_mappings.
 * 
 * Otimizado para performance com busca em lote.
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TIPOS =============

export interface ChaveMapMarketplace {
  canal: string;
  anuncioId: string | null;
  varianteId: string | null;
  skuMarketplace: string | null;
}

export interface ResultadoMapeamento {
  skuInterno: string | null;
  produtoId: string | null;
  skuId: string | null;
  origemMapeamento: 'upseller' | 'legacy' | 'nenhum';
}

export interface MapeamentoCache {
  // Chave: canal|anuncio_id|variante_id
  porAnuncio: Map<string, { sku_interno: string; produto_id: string | null; sku_id: string | null }>;
  // Chave: canal|sku_marketplace
  porSkuMarketplace: Map<string, { produto_id: string | null; sku_id: string | null }>;
  // Chave: sku_interno
  porSkuInterno: Map<string, { produto_id: string | null; sku_id: string | null }>;
}

// Cache global de mapeamentos por empresa
const cachesPorEmpresa = new Map<string, MapeamentoCache>();

// ============= FUNÇÕES DE CACHE =============

/**
 * Carrega todos os mapeamentos de uma empresa em cache
 * Chamado uma vez antes de processar um lote grande de itens
 */
export async function carregarCacheMapeamentos(empresaId: string, canal: string): Promise<MapeamentoCache> {
  const cacheKey = `${empresaId}:${canal}`;
  
  if (cachesPorEmpresa.has(cacheKey)) {
    return cachesPorEmpresa.get(cacheKey)!;
  }

  console.log(`[SKU Resolver] Carregando cache para empresa=${empresaId}, canal=${canal}...`);

  const cache: MapeamentoCache = {
    porAnuncio: new Map(),
    porSkuMarketplace: new Map(),
    porSkuInterno: new Map(),
  };

  // 1. Carregar mapeamentos Upseller (produto_sku_map)
  const { data: upsellerMappings, error: e1 } = await supabase
    .from("produto_sku_map")
    .select("sku_interno, anuncio_id, variante_id, produto_id, sku_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canal);

  if (!e1 && upsellerMappings) {
    for (const m of upsellerMappings) {
      if (m.anuncio_id) {
        // Chave com variante (mais específica)
        const keyComVariante = `${canal}|${m.anuncio_id}|${m.variante_id || ''}`.toLowerCase();
        cache.porAnuncio.set(keyComVariante, {
          sku_interno: m.sku_interno,
          produto_id: m.produto_id,
          sku_id: m.sku_id,
        });
        
        // Chave sem variante (fallback)
        if (!m.variante_id) {
          const keySemVariante = `${canal}|${m.anuncio_id}|`.toLowerCase();
          if (!cache.porAnuncio.has(keySemVariante)) {
            cache.porAnuncio.set(keySemVariante, {
              sku_interno: m.sku_interno,
              produto_id: m.produto_id,
              sku_id: m.sku_id,
            });
          }
        }
      }
      
      // Também indexar por SKU interno
      if (m.sku_interno && (m.produto_id || m.sku_id)) {
        cache.porSkuInterno.set(m.sku_interno.toLowerCase(), {
          produto_id: m.produto_id,
          sku_id: m.sku_id,
        });
      }
    }
    console.log(`[SKU Resolver] Upseller: ${upsellerMappings.length} mapeamentos carregados`);
  }

  // 2. Carregar mapeamentos legados (marketplace_sku_mappings)
  const { data: legacyMappings, error: e2 } = await supabase
    .from("marketplace_sku_mappings")
    .select("sku_marketplace, produto_id, sku_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canal);

  if (!e2 && legacyMappings) {
    for (const m of legacyMappings) {
      if (m.sku_marketplace) {
        const key = `${canal}|${m.sku_marketplace}`.toLowerCase();
        cache.porSkuMarketplace.set(key, {
          produto_id: m.produto_id,
          sku_id: m.sku_id,
        });
      }
    }
    console.log(`[SKU Resolver] Legacy: ${legacyMappings.length} mapeamentos carregados`);
  }

  cachesPorEmpresa.set(cacheKey, cache);
  return cache;
}

/**
 * Limpa o cache de uma empresa (chamar ao importar novos mapeamentos)
 */
export function limparCacheMapeamentosPorEmpresa(empresaId?: string, canal?: string) {
  if (empresaId && canal) {
    cachesPorEmpresa.delete(`${empresaId}:${canal}`);
  } else if (empresaId) {
    // Limpar todos os canais da empresa
    for (const key of cachesPorEmpresa.keys()) {
      if (key.startsWith(`${empresaId}:`)) {
        cachesPorEmpresa.delete(key);
      }
    }
  } else {
    // Limpar tudo
    cachesPorEmpresa.clear();
  }
}

// ============= FUNÇÕES DE RESOLUÇÃO =============

/**
 * Resolve uma única chave de marketplace para produto interno
 * Usa cache carregado previamente
 */
export function resolverSkuDoCache(
  cache: MapeamentoCache,
  chave: ChaveMapMarketplace
): ResultadoMapeamento {
  const { canal, anuncioId, varianteId, skuMarketplace } = chave;
  
  // 1. Tentar por anúncio + variante (mais específico)
  if (anuncioId) {
    const keyComVariante = `${canal}|${anuncioId}|${varianteId || ''}`.toLowerCase();
    const matchComVariante = cache.porAnuncio.get(keyComVariante);
    
    if (matchComVariante) {
      return {
        skuInterno: matchComVariante.sku_interno,
        produtoId: matchComVariante.produto_id,
        skuId: matchComVariante.sku_id,
        origemMapeamento: 'upseller',
      };
    }
    
    // Fallback: tentar só por anúncio (sem variante)
    const keySemVariante = `${canal}|${anuncioId}|`.toLowerCase();
    const matchSemVariante = cache.porAnuncio.get(keySemVariante);
    
    if (matchSemVariante) {
      return {
        skuInterno: matchSemVariante.sku_interno,
        produtoId: matchSemVariante.produto_id,
        skuId: matchSemVariante.sku_id,
        origemMapeamento: 'upseller',
      };
    }
  }

  // 2. Tentar por SKU de marketplace (tabela legada)
  if (skuMarketplace) {
    const keyLegacy = `${canal}|${skuMarketplace}`.toLowerCase();
    const matchLegacy = cache.porSkuMarketplace.get(keyLegacy);
    
    if (matchLegacy && (matchLegacy.produto_id || matchLegacy.sku_id)) {
      return {
        skuInterno: skuMarketplace,
        produtoId: matchLegacy.produto_id,
        skuId: matchLegacy.sku_id,
        origemMapeamento: 'legacy',
      };
    }
    
    // Fallback: tentar interpretar skuMarketplace como sku_interno
    const matchPorSku = cache.porSkuInterno.get(skuMarketplace.toLowerCase());
    if (matchPorSku && (matchPorSku.produto_id || matchPorSku.sku_id)) {
      return {
        skuInterno: skuMarketplace,
        produtoId: matchPorSku.produto_id,
        skuId: matchPorSku.sku_id,
        origemMapeamento: 'upseller',
      };
    }
  }

  // 3. Nenhum mapeamento encontrado
  return {
    skuInterno: skuMarketplace || anuncioId,
    produtoId: null,
    skuId: null,
    origemMapeamento: 'nenhum',
  };
}

/**
 * Resolve múltiplas chaves em lote (otimizado)
 * Retorna um mapa de índice → resultado
 */
export async function resolverSkusEmLote(
  empresaId: string,
  canal: string,
  chaves: ChaveMapMarketplace[]
): Promise<Map<number, ResultadoMapeamento>> {
  // Carregar cache uma única vez
  const cache = await carregarCacheMapeamentos(empresaId, canal);
  
  const resultados = new Map<number, ResultadoMapeamento>();
  
  for (let i = 0; i < chaves.length; i++) {
    resultados.set(i, resolverSkuDoCache(cache, chaves[i]));
  }
  
  return resultados;
}

// ============= EXTRAÇÃO DE IDs DO MERCADO LIVRE =============

/**
 * Extrai ID MLB de uma string (ex: "MLB1234567" ou "1234567")
 */
export function extrairMLB(valor: string | null | undefined): string | null {
  if (!valor) return null;
  
  const str = String(valor).trim().toUpperCase();
  
  // Já é formato MLB
  const mlbMatch = str.match(/^MLB\d+$/);
  if (mlbMatch) return mlbMatch[0];
  
  // Extrair MLB de dentro de texto
  const mlbInText = str.match(/MLB\d+/);
  if (mlbInText) return mlbInText[0];
  
  // Se é só número longo, pode ser ID de anúncio Shopee
  if (/^\d{10,}$/.test(str)) return str;
  
  return null;
}

/**
 * Extrai ID de variação de uma string
 */
export function extrairVarianteId(valor: string | null | undefined): string | null {
  if (!valor) return null;
  
  const str = String(valor).trim();
  
  // Se é número, retorna como string
  if (/^\d+$/.test(str)) return str;
  
  return str || null;
}

// ============= BACKFILL DE ITENS ANTIGOS =============

/**
 * Aplica mapeamento em itens antigos que não tinham produto_id/sku_id
 */
export async function backfillItensNaoMapeados(
  empresaId: string,
  canal: string,
  limite: number = 5000
): Promise<{ atualizados: number; semMapeamento: number; erros: number }> {
  console.log(`[Backfill] Iniciando para empresa=${empresaId}, canal=${canal}...`);
  
  // Carregar cache
  const cache = await carregarCacheMapeamentos(empresaId, canal);
  
  // Buscar itens sem mapeamento
  const { data: itens, error } = await supabase
    .from("marketplace_transaction_items")
    .select(`
      id,
      sku_marketplace,
      anuncio_id,
      variante_id,
      transaction_id,
      marketplace_transactions!inner(empresa_id, canal)
    `)
    .eq("marketplace_transactions.empresa_id", empresaId)
    .eq("marketplace_transactions.canal", canal)
    .is("produto_id", null)
    .is("sku_id", null)
    .limit(limite);

  if (error) {
    console.error("[Backfill] Erro ao buscar itens:", error);
    return { atualizados: 0, semMapeamento: 0, erros: 1 };
  }

  if (!itens || itens.length === 0) {
    console.log("[Backfill] Nenhum item pendente encontrado");
    return { atualizados: 0, semMapeamento: 0, erros: 0 };
  }

  console.log(`[Backfill] Encontrados ${itens.length} itens sem mapeamento`);

  let atualizados = 0;
  let semMapeamento = 0;
  let erros = 0;

  // Processar em lotes de 100
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < itens.length; i += BATCH_SIZE) {
    const batch = itens.slice(i, i + BATCH_SIZE);
    const updates: { id: string; produto_id: string | null; sku_id: string | null }[] = [];

    for (const item of batch) {
      const resultado = resolverSkuDoCache(cache, {
        canal,
        anuncioId: item.anuncio_id || extrairMLB(item.sku_marketplace),
        varianteId: item.variante_id,
        skuMarketplace: item.sku_marketplace,
      });

      if (resultado.produtoId || resultado.skuId) {
        updates.push({
          id: item.id,
          produto_id: resultado.produtoId,
          sku_id: resultado.skuId,
        });
      } else {
        semMapeamento++;
      }
    }

    // Atualizar em lote
    if (updates.length > 0) {
      for (const upd of updates) {
        const { error: updateError } = await supabase
          .from("marketplace_transaction_items")
          .update({
            produto_id: upd.produto_id,
            sku_id: upd.sku_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", upd.id);

        if (updateError) {
          console.error("[Backfill] Erro ao atualizar item:", updateError);
          erros++;
        } else {
          atualizados++;
        }
      }
    }

    console.log(`[Backfill] Processado ${Math.min(i + BATCH_SIZE, itens.length)}/${itens.length}`);
  }

  console.log(`[Backfill] Concluído: ${atualizados} atualizados, ${semMapeamento} sem mapeamento, ${erros} erros`);
  
  return { atualizados, semMapeamento, erros };
}

/**
 * Conta itens pendentes de mapeamento para uma empresa/canal
 */
export async function contarItensPendentesMapeamento(
  empresaId: string,
  canal?: string
): Promise<number> {
  let query = supabase
    .from("marketplace_transaction_items")
    .select("id", { count: "exact", head: true })
    .is("produto_id", null)
    .is("sku_id", null);

  // Filtrar por empresa via join
  // Nota: isso requer que a transação pertença à empresa
  
  const { count, error } = await query;

  if (error) {
    console.error("[Backfill] Erro ao contar pendentes:", error);
    return 0;
  }

  return count || 0;
}
