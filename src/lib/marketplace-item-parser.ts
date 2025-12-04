/**
 * PARSER DE ITENS DE MARKETPLACE
 * 
 * Extrai itens individuais (produtos) de relatórios de vendas do marketplace.
 * Usado durante importação para criar automaticamente os marketplace_transaction_items.
 */

export interface ItemVendaMarketplace {
  sku_marketplace: string;
  descricao_item: string;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  pedido_id: string | null;
}

export interface ParseItemsResult {
  items: ItemVendaMarketplace[];
  temGranularidadeItens: boolean;
}

/**
 * Parse de itens do Mercado Livre
 * Colunas esperadas: SKU, Quantidade, Preço unitário, etc.
 */
function parseMercadoLivreItems(
  headers: string[],
  values: string[],
  pedidoId: string | null
): ItemVendaMarketplace | null {
  // Procurar colunas de item
  const skuIdx = headers.findIndex(h => 
    h.includes("sku") || h.includes("código") || h.includes("anuncio") || h.includes("mlb")
  );
  const qtdIdx = headers.findIndex(h => 
    h.includes("quantidade") || h.includes("qty") || h.includes("unidades")
  );
  const descIdx = headers.findIndex(h => 
    h.includes("produto") || h.includes("título") || h.includes("item") || h.includes("description")
  );
  const precoUnitIdx = headers.findIndex(h => 
    h.includes("preço unitário") || h.includes("unit price") || h.includes("valor unitário")
  );
  const precoTotalIdx = headers.findIndex(h => 
    h.includes("preço total") || h.includes("total price") || h.includes("subtotal")
  );

  // Se não tem SKU ou quantidade, não é linha de item
  if (skuIdx < 0) return null;

  const parseValue = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const sku = values[skuIdx]?.trim();
  if (!sku) return null;

  return {
    sku_marketplace: sku,
    descricao_item: descIdx >= 0 ? values[descIdx]?.trim() || sku : sku,
    quantidade: qtdIdx >= 0 ? Math.max(1, parseInt(values[qtdIdx]) || 1) : 1,
    preco_unitario: precoUnitIdx >= 0 ? parseValue(values[precoUnitIdx]) : null,
    preco_total: precoTotalIdx >= 0 ? parseValue(values[precoTotalIdx]) : null,
    pedido_id: pedidoId,
  };
}

/**
 * Parse de itens do Shopee
 */
function parseShopeeItems(
  headers: string[],
  values: string[],
  pedidoId: string | null
): ItemVendaMarketplace | null {
  const skuIdx = headers.findIndex(h => 
    h.includes("sku do produto") || h.includes("sku referência") || h.includes("product sku")
  );
  const qtdIdx = headers.findIndex(h => 
    h.includes("quantidade") || h.includes("qty")
  );
  const descIdx = headers.findIndex(h => 
    h.includes("nome do produto") || h.includes("product name") || h.includes("título")
  );
  const precoIdx = headers.findIndex(h => 
    h.includes("preço") || h.includes("price") || h.includes("valor")
  );

  if (skuIdx < 0) return null;

  const parseValue = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const sku = values[skuIdx]?.trim();
  if (!sku) return null;

  const qtd = qtdIdx >= 0 ? Math.max(1, parseInt(values[qtdIdx]) || 1) : 1;
  const precoUnit = precoIdx >= 0 ? parseValue(values[precoIdx]) : null;

  return {
    sku_marketplace: sku,
    descricao_item: descIdx >= 0 ? values[descIdx]?.trim() || sku : sku,
    quantidade: qtd,
    preco_unitario: precoUnit,
    preco_total: precoUnit ? precoUnit * qtd : null,
    pedido_id: pedidoId,
  };
}

/**
 * Parse genérico de itens
 */
function parseGenericItems(
  headers: string[],
  values: string[],
  pedidoId: string | null
): ItemVendaMarketplace | null {
  // Tentar encontrar colunas de SKU/produto
  const skuIdx = headers.findIndex(h => 
    h.includes("sku") || h.includes("código") || h.includes("code") || h.includes("id_produto")
  );
  const qtdIdx = headers.findIndex(h => 
    h.includes("qtd") || h.includes("quantidade") || h.includes("qty") || h.includes("quantity")
  );
  const descIdx = headers.findIndex(h => 
    h.includes("produto") || h.includes("item") || h.includes("descrição") || h.includes("nome")
  );
  const precoIdx = headers.findIndex(h => 
    h.includes("preço") || h.includes("price") || h.includes("valor") || h.includes("value")
  );

  if (skuIdx < 0) return null;

  const parseValue = (val: string): number => {
    if (!val) return 0;
    const cleaned = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const sku = values[skuIdx]?.trim();
  if (!sku) return null;

  const qtd = qtdIdx >= 0 ? Math.max(1, parseInt(values[qtdIdx]) || 1) : 1;
  const preco = precoIdx >= 0 ? parseValue(values[precoIdx]) : null;

  return {
    sku_marketplace: sku,
    descricao_item: descIdx >= 0 ? values[descIdx]?.trim() || sku : sku,
    quantidade: qtd,
    preco_unitario: preco,
    preco_total: preco ? preco * qtd : null,
    pedido_id: pedidoId,
  };
}

/**
 * Detecta se o CSV tem granularidade por item (vs apenas transação)
 */
export function detectarGranularidadeItens(headers: string[]): boolean {
  const headersLower = headers.map(h => h.toLowerCase());
  
  // Se tem colunas de SKU ou quantidade por item, tem granularidade
  const temSku = headersLower.some(h => 
    h.includes("sku") || h.includes("código do produto") || h.includes("mlb")
  );
  const temQtd = headersLower.some(h => 
    h.includes("quantidade") && !h.includes("quantidade de transações")
  );
  
  return temSku || temQtd;
}

/**
 * Extrai itens de uma linha do CSV de marketplace
 */
export function extrairItemDeLinhaCSV(
  canal: string,
  headers: string[],
  values: string[],
  pedidoId: string | null
): ItemVendaMarketplace | null {
  const headersLower = headers.map(h => h.toLowerCase());
  
  switch (canal) {
    case "mercado_livre":
      return parseMercadoLivreItems(headersLower, values, pedidoId);
    case "shopee":
      return parseShopeeItems(headersLower, values, pedidoId);
    default:
      return parseGenericItems(headersLower, values, pedidoId);
  }
}

/**
 * Agrupa itens por pedido (quando CSV tem múltiplas linhas por pedido)
 */
export function agruparItensPorPedido(
  items: ItemVendaMarketplace[]
): Map<string, ItemVendaMarketplace[]> {
  const grupos = new Map<string, ItemVendaMarketplace[]>();
  
  for (const item of items) {
    const key = item.pedido_id || "sem_pedido";
    const lista = grupos.get(key) || [];
    lista.push(item);
    grupos.set(key, lista);
  }
  
  return grupos;
}

/**
 * Gera hash único para item (para idempotência)
 */
export function gerarHashItem(item: ItemVendaMarketplace, transactionId: string): string {
  const str = `${transactionId}|${item.sku_marketplace}|${item.quantidade}|${item.preco_total || 0}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
