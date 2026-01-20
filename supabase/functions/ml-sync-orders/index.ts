import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_API_URL = "https://api.mercadolibre.com";

// Taxa média de parcelamento do ML (5-7% para parcelados)
const FINANCING_FEE_RATE = 0.05;

// Buffer de 5 minutos para renovar token antes de expirar
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

// Mapear logistic_type para tipo_envio amigável
const logisticTypeMap: Record<string, string> = {
  "fulfillment": "full",
  "xd_drop_off": "flex",
  "self_service": "coleta",
  "cross_docking": "flex",
  "drop_off": "coleta",
  "custom": "retirada",
  "not_specified": "coleta",
};

// Interface COMPLETA do pedido ML (com todos os campos que precisamos)
interface MLOrderItem {
  item: {
    id: string;
    title: string;
    seller_sku?: string;
    seller_custom_field?: string;
    category_id?: string;
    variation_id?: number;
  };
  quantity: number;
  unit_price: number;
  full_unit_price?: number;
  sale_fee?: number;
  listing_type_id?: string;
  manufacturing_days?: number;
}

interface MLPayment {
  id: number;
  total_paid_amount: number;
  marketplace_fee: number;
  shipping_cost: number;
  transaction_amount: number;
  date_approved: string;
  payment_method_id?: string;
  installments?: number;
  coupon_amount?: number;
  financing_fee?: number;
  taxes_amount?: number;
  overpaid_amount?: number;
}

interface MLOrder {
  id: number;
  status: string;
  date_created: string;
  date_closed: string;
  date_last_updated: string;
  total_amount: number;
  paid_amount: number;
  currency_id: string;
  tags?: string[];
  buyer?: {
    id: number;
    nickname: string;
  };
  seller?: {
    id: number;
    nickname?: string;
  };
  order_items: MLOrderItem[];
  payments: MLPayment[];
  shipping: {
    id: number;
    cost: number;
    logistic_type?: string;
  };
}

// Interface para custos de envio da API /shipments/{id}/costs
interface ShippingCosts {
  receiver: Array<{ cost: number; cost_type: string }>;
  senders: Array<{ cost: number; cost_type: string; site?: string }>;
}

// Dados brutos de shipping costs para auditoria
interface RawShippingCosts {
  logistic_type: string;
  sender_cost: number;
  receiver_cost: number;
  raw_senders?: any[];
  raw_receiver?: any[];
}

// Estrutura para taxas extraídas da API de Conciliações
interface OrderFees {
  comissao: number;
  tarifaFixa: number;
  tarifaFinanceira: number;
  freteVendedor: number;
  origemFallback?: boolean;
  origemListingPrices?: boolean;
}

interface TokenState {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  user_id_provider: string;
}

// Cache de listing_prices por listing_type_id e category_id
interface ListingPriceInfo {
  fixed_fee: number;
  financing_add_on_fee: number;
  sale_fee_pct: number;
}

// Cache global para evitar chamadas repetidas
const listingPricesCache = new Map<string, ListingPriceInfo>();

// Resultado minimalista da busca (apenas IDs)
interface OrderSearchResult {
  id: number;
}

// ============= HELPER: RENOVAÇÃO AUTOMÁTICA DE TOKEN =============

async function getValidAccessToken(
  supabase: any, 
  tokenState: TokenState
): Promise<{ access_token: string; tokenState: TokenState } | { error: string }> {
  const now = Date.now();
  const exp = tokenState.expires_at ? new Date(tokenState.expires_at).getTime() : 0;
  
  if (exp && (exp - now) > TOKEN_BUFFER_MS) {
    return { access_token: tokenState.access_token, tokenState };
  }

  console.log("[ML Sync] 🔄 Token expira em < 5 min, renovando automaticamente...");
  
  const refreshResult = await refreshToken(supabase, tokenState);
  
  if ('error' in refreshResult) {
    return { error: refreshResult.error };
  }
  
  const updatedTokenState: TokenState = {
    ...tokenState,
    access_token: refreshResult.access_token,
    refresh_token: refreshResult.refresh_token || tokenState.refresh_token,
    expires_at: refreshResult.expires_at,
  };
  
  return { access_token: refreshResult.access_token, tokenState: updatedTokenState };
}

async function mlFetch(
  url: string,
  supabase: any,
  tokenState: TokenState,
  init: RequestInit = {}
): Promise<{ response: Response; tokenState: TokenState }> {
  const tokenResult = await getValidAccessToken(supabase, tokenState);
  
  if ('error' in tokenResult) {
    throw new Error(`Erro ao obter token: ${tokenResult.error}`);
  }
  
  let currentTokenState = tokenResult.tokenState;
  let accessToken = tokenResult.access_token;
  
  let response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 401) {
    console.log("[ML Sync] ⚠️ 401 recebido, forçando refresh e retry...");
    
    const forceTokenState: TokenState = {
      ...currentTokenState,
      expires_at: new Date(0).toISOString(),
    };
    
    const retryResult = await getValidAccessToken(supabase, forceTokenState);
    
    if ('error' in retryResult) {
      throw new Error(`Erro ao renovar token após 401: ${retryResult.error}`);
    }
    
    currentTokenState = retryResult.tokenState;
    accessToken = retryResult.access_token;
    
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    console.log(`[ML Sync] ✓ Retry executado, status: ${response.status}`);
  }
  
  return { response, tokenState: currentTokenState };
}

// Utility: processar items em paralelo com limite de concorrência
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await fn(items[index]);
      } catch (err) {
        console.error(`[mapLimit] Erro no item ${index}:`, err);
        results[index] = null as R;
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * NOVA FUNÇÃO: Buscar lista de IDs de pedidos via /orders/search (apenas IDs)
 */
async function fetchOrderIds(
  supabase: any,
  tokenState: TokenState,
  sellerId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<{ orderIds: number[]; tokenState: TokenState }> {
  const ML_MAX_OFFSET = 10000;
  const limit = 50;
  let offset = 0;
  let allIds: number[] = [];
  let totalOrders = 0;
  let currentTokenState = tokenState;

  const dateFromStr = dayStart.toISOString();
  const dateToStr = dayEnd.toISOString();

  do {
    const ordersUrl = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateFromStr}&order.date_created.to=${dateToStr}&sort=date_desc&offset=${offset}&limit=${limit}`;
    
    const { response: ordersResponse, tokenState: updatedState } = await mlFetch(
      ordersUrl,
      supabase,
      currentTokenState
    );
    currentTokenState = updatedState;

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error(`[ML Sync] Erro ao buscar pedidos do dia ${dayStart.toISOString().split('T')[0]}: ${ordersResponse.status} - ${errorText}`);
      break;
    }

    const ordersData = await ordersResponse.json();
    const pageOrders = ordersData.results || [];
    
    // Extrair apenas os IDs
    for (const order of pageOrders) {
      allIds.push(order.id);
    }
    
    totalOrders = ordersData.paging?.total || 0;
    offset += limit;
    
    if (offset >= ML_MAX_OFFSET) {
      console.warn(`[ML Sync] ⚠ Limite da API atingido para dia ${dayStart.toISOString().split('T')[0]}`);
      break;
    }
    
    if (offset < totalOrders) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (offset < totalOrders);

  return { orderIds: allIds, tokenState: currentTokenState };
}

/**
 * NOVA FUNÇÃO: Buscar payload COMPLETO de um pedido via GET /orders/{order_id}
 * Este endpoint retorna sale_fee, seller_sku, seller_custom_field, category_id, listing_type_id
 */
async function fetchOrderDetails(
  supabase: any,
  tokenState: TokenState,
  orderId: number
): Promise<{ order: MLOrder | null; tokenState: TokenState; hasIssues: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    const orderUrl = `${ML_API_URL}/orders/${orderId}`;
    const { response, tokenState: updatedState } = await mlFetch(orderUrl, supabase, tokenState);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ML Sync] ❌ Erro ao buscar pedido ${orderId}: ${response.status} - ${errorText}`);
      issues.push(`fetch_error:${response.status}`);
      return { order: null, tokenState: updatedState, hasIssues: true, issues };
    }
    
    const orderData = await response.json();
    
    // Validar se tem payments
    if (!orderData.payments || orderData.payments.length === 0) {
      issues.push("sem_payments");
      console.warn(`[ML Sync] ⚠️ Pedido ${orderId}: sem payments`);
    }
    
    // Validar se tem order_items com SKU
    let temSkuValido = false;
    if (orderData.order_items && orderData.order_items.length > 0) {
      for (const item of orderData.order_items) {
        const sku = item.item?.seller_custom_field || item.item?.seller_sku;
        if (sku && sku.trim() !== "") {
          temSkuValido = true;
          break;
        }
      }
      if (!temSkuValido) {
        issues.push("sem_seller_sku");
        console.warn(`[ML Sync] ⚠️ Pedido ${orderId}: sem seller_sku ou seller_custom_field`);
      }
    } else {
      issues.push("sem_order_items");
      console.warn(`[ML Sync] ⚠️ Pedido ${orderId}: sem order_items`);
    }
    
    return { 
      order: orderData as MLOrder, 
      tokenState: updatedState, 
      hasIssues: issues.length > 0, 
      issues 
    };
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar pedido ${orderId}:`, err);
    issues.push("exception");
    return { order: null, tokenState, hasIssues: true, issues };
  }
}

/**
 * Buscar custos de envio do vendedor via /shipments/{id}/costs
 */
async function fetchShippingCosts(
  supabase: any,
  tokenState: TokenState,
  shippingId: number
): Promise<{ data: RawShippingCosts | null; tokenState: TokenState }> {
  try {
    // Primeiro, buscar dados básicos do shipment para logistic_type
    const shippingUrl = `${ML_API_URL}/shipments/${shippingId}`;
    const { response: shippingResponse, tokenState: state1 } = await mlFetch(
      shippingUrl,
      supabase,
      tokenState
    );

    let logisticType = "";
    if (shippingResponse.ok) {
      const shippingData = await shippingResponse.json();
      logisticType = shippingData.logistic_type || "";
    }

    // Agora buscar os CUSTOS reais via /costs
    const costsUrl = `${ML_API_URL}/shipments/${shippingId}/costs`;
    const { response: costsResponse, tokenState: state2 } = await mlFetch(
      costsUrl,
      supabase,
      state1
    );

    if (!costsResponse.ok) {
      return { 
        data: { logistic_type: logisticType, sender_cost: 0, receiver_cost: 0 }, 
        tokenState: state2 
      };
    }

    const costsData: ShippingCosts = await costsResponse.json();
    
    // Somar todos os custos do vendedor (senders)
    let senderCost = 0;
    if (costsData.senders && Array.isArray(costsData.senders)) {
      senderCost = costsData.senders.reduce((sum, s) => sum + (s.cost || 0), 0);
    }
    
    // Somar custos do comprador (receiver)
    let receiverCost = 0;
    if (costsData.receiver && Array.isArray(costsData.receiver)) {
      receiverCost = costsData.receiver.reduce((sum, r) => sum + (r.cost || 0), 0);
    }

    return { 
      data: { 
        logistic_type: logisticType, 
        sender_cost: senderCost, 
        receiver_cost: receiverCost,
        raw_senders: costsData.senders,
        raw_receiver: costsData.receiver,
      }, 
      tokenState: state2 
    };
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar shipping costs ${shippingId}:`, err);
    return { data: null, tokenState };
  }
}

/**
 * Buscar taxas detalhadas da API de Conciliações do ML
 */
async function fetchBillingDetailsFromConciliation(
  supabase: any,
  tokenState: TokenState,
  dateFrom: Date,
  dateTo: Date
): Promise<{ feesMap: Map<string, OrderFees>; tokenState: TokenState; billingAvailable: boolean }> {
  const feesMap = new Map<string, OrderFees>();
  let currentTokenState = tokenState;
  let billingAvailable = true;
  
  const fromStr = dateFrom.toISOString().split('T')[0];
  const toStr = dateTo.toISOString().split('T')[0];
  
  const limit = 1000;
  let offset = 0;
  let hasMore = true;
  
  console.log(`[ML Sync] 💰 Buscando API Conciliações: ${fromStr} a ${toStr}`);
  
  const tiposDesconhecidos = new Set<string>();
  
  while (hasMore) {
    try {
      const url = `${ML_API_URL}/billing/integration/details/v2/MERCADO_LIBRE?from_date=${fromStr}&to_date=${toStr}&sort_by=DATE&order_by=ASC&limit=${limit}&offset=${offset}`;
      
      const { response, tokenState: updatedState } = await mlFetch(url, supabase, currentTokenState);
      currentTokenState = updatedState;
      
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          console.warn(`[ML Sync] ⚠️ API Conciliações: ${response.status} - Sem permissão, usando fallback`);
          billingAvailable = false;
          break;
        }
        const errorText = await response.text();
        console.error(`[ML Sync] ❌ Erro API Conciliações: ${response.status} - ${errorText}`);
        break;
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      for (const item of results) {
        const orderId = item.order_id ? String(item.order_id) : null;
        const paymentId = item.source_id ? String(item.source_id) : null;
        const primaryKey = orderId || paymentId || '';
        
        if (!primaryKey) continue;
        
        if (!feesMap.has(primaryKey)) {
          feesMap.set(primaryKey, { comissao: 0, tarifaFixa: 0, tarifaFinanceira: 0, freteVendedor: 0 });
        }
        const fees = feesMap.get(primaryKey)!;
        
        const detailType = (item.detail_type || item.fee_type || '').toUpperCase();
        const amount = Math.abs(item.total || item.amount || 0);
        
        switch (detailType) {
          case 'CV':
          case 'ML_FEE':
          case 'SALE_FEE':
          case 'MARKETPLACE_FEE':
          case 'FVF':
          case 'APPLICATION_FEE':
          case 'MERCADOPAGO_FEE':
          case 'VARIABLE_FEE':
            fees.comissao += amount;
            break;
          case 'FIXED_FEE':
          case 'TF':
          case 'LISTING_FEE':
            fees.tarifaFixa += amount;
            break;
          case 'CXE':
          case 'SHIPPING_FEE':
          case 'SHIPPING':
          case 'ENVIO':
          case 'SHIPPING_COST':
          case 'LOGISTIC_COST':
            fees.freteVendedor += amount;
            break;
          case 'FINANCING_FEE':
          case 'INSTALLMENT_FEE':
          case 'FINANCING':
          case 'INTEREST':
          case 'INSTALLMENTS_FEE':
          case 'MF':
            fees.tarifaFinanceira += amount;
            break;
          default:
            if (detailType && !tiposDesconhecidos.has(detailType)) {
              tiposDesconhecidos.add(detailType);
            }
        }
        
        if (paymentId && paymentId !== orderId) {
          if (!feesMap.has(paymentId)) {
            feesMap.set(paymentId, { ...fees });
          }
        }
      }
      
      const paging = data.paging || {};
      hasMore = results.length === limit && (offset + limit) < (paging.total || 100000);
      offset += limit;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (err) {
      console.error(`[ML Sync] ❌ Erro ao buscar conciliações:`, err);
      break;
    }
  }
  
  if (tiposDesconhecidos.size > 0) {
    console.log(`[ML Sync] 📊 Tipos não mapeados: ${Array.from(tiposDesconhecidos).join(', ')}`);
  }
  
  console.log(`[ML Sync] 💰 Conciliações: ${feesMap.size} pedidos com taxas (disponível: ${billingAvailable})`);
  
  return { feesMap, tokenState: currentTokenState, billingAvailable };
}

/**
 * Buscar preços/tarifas de um listing_type_id via /sites/MLB/listing_prices
 * Retorna fixed_fee e financing_add_on_fee estimados
 */
async function fetchListingPrices(
  categoryId: string,
  listingTypeId: string,
  price: number
): Promise<ListingPriceInfo | null> {
  const cacheKey = `${categoryId}_${listingTypeId}_${Math.floor(price / 50) * 50}`;
  
  if (listingPricesCache.has(cacheKey)) {
    return listingPricesCache.get(cacheKey)!;
  }
  
  try {
    // API pública, não precisa de auth
    const url = `${ML_API_URL}/sites/MLB/listing_prices?category_id=${categoryId}&listing_type_id=${listingTypeId}&price=${price}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`[ML Sync] ⚠️ listing_prices indisponível para ${listingTypeId}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Extrair tarifas do response
    // Formato: { sale_fee_amount, currency_id, sale_fee_details: { fixed_fee, variable_fee, financing_add_on_fee } }
    let fixedFee = 0;
    let financingAddOnFee = 0;
    let saleFeeAmount = data.sale_fee_amount || 0;
    
    if (data.sale_fee_details) {
      fixedFee = data.sale_fee_details.fixed_fee || 0;
      financingAddOnFee = data.sale_fee_details.financing_add_on_fee || 0;
    }
    
    const result: ListingPriceInfo = {
      fixed_fee: fixedFee,
      financing_add_on_fee: financingAddOnFee,
      sale_fee_pct: price > 0 ? (saleFeeAmount / price) : 0,
    };
    
    listingPricesCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar listing_prices:`, err);
    return null;
  }
}

/**
 * Extrair taxas do payload COMPLETO do pedido
 * Usa sale_fee dos order_items + dados de payments
 * AGORA inclui estimativa de tarifa_fixa via listing_prices
 */
async function extractFeesFromFullOrder(
  order: MLOrder,
  usarListingPrices: boolean = true
): Promise<OrderFees> {
  let comissao = 0;
  let tarifaFixa = 0;
  let tarifaFinanceira = 0;
  let origemFallback = false;
  let origemListingPrices = false;

  // 1. PRIORIDADE: Somar sale_fee de cada item (mais preciso - é a COMISSÃO VARIÁVEL)
  let totalSaleFee = 0;
  for (const item of order.order_items || []) {
    if (item.sale_fee && item.sale_fee > 0) {
      totalSaleFee += item.sale_fee * item.quantity;
    }
  }

  // 2. Usar marketplace_fee dos payments como fallback para comissão
  let totalMarketplaceFee = 0;
  let totalFinancingFee = 0;
  for (const payment of order.payments || []) {
    totalMarketplaceFee += payment.marketplace_fee || 0;
    
    // Calcular taxa de parcelamento
    if (payment.installments && payment.installments > 1) {
      if (payment.financing_fee && payment.financing_fee > 0) {
        totalFinancingFee += payment.financing_fee;
      } else {
        totalFinancingFee += (payment.transaction_amount || 0) * FINANCING_FEE_RATE;
      }
    }
  }

  // Usar sale_fee se disponível, senão marketplace_fee
  if (totalSaleFee > 0) {
    comissao = totalSaleFee;
  } else if (totalMarketplaceFee > 0) {
    comissao = totalMarketplaceFee;
  } else if (order.total_amount > 0) {
    const ESTIMATED_RATE = 0.14;
    comissao = Math.round(order.total_amount * ESTIMATED_RATE * 100) / 100;
    origemFallback = true;
    console.log(`[ML Sync] ⚠️ Pedido ${order.id}: comissão estimada 14% = R$${comissao.toFixed(2)}`);
  }

  tarifaFinanceira = Math.round(totalFinancingFee * 100) / 100;

  // 3. NOVO: Estimar tarifa_fixa via listing_prices se não temos do billing
  if (usarListingPrices && order.order_items && order.order_items.length > 0) {
    let totalFixedFee = 0;
    let totalFinancingAddOn = 0;
    
    for (const item of order.order_items) {
      const categoryId = item.item.category_id;
      const listingTypeId = item.listing_type_id;
      const itemPrice = item.unit_price * item.quantity;
      
      if (categoryId && listingTypeId) {
        const priceInfo = await fetchListingPrices(categoryId, listingTypeId, itemPrice);
        if (priceInfo) {
          totalFixedFee += priceInfo.fixed_fee * item.quantity;
          totalFinancingAddOn += priceInfo.financing_add_on_fee * item.quantity;
          origemListingPrices = true;
        }
      }
    }
    
    if (totalFixedFee > 0) {
      tarifaFixa = Math.round(totalFixedFee * 100) / 100;
      console.log(`[ML Sync] 📊 Pedido ${order.id}: tarifa_fixa estimada via listing_prices = R$${tarifaFixa.toFixed(2)}`);
    }
    
    // Adicionar financing_add_on_fee à tarifa financeira se não tínhamos
    if (totalFinancingAddOn > 0 && tarifaFinanceira === 0) {
      tarifaFinanceira = Math.round(totalFinancingAddOn * 100) / 100;
    }
  }

  return {
    comissao,
    tarifaFixa,
    tarifaFinanceira,
    freteVendedor: 0,
    origemFallback,
    origemListingPrices,
  };
}

// Função para renovar token
async function refreshToken(supabase: any, tokenData: TokenState): Promise<{ access_token: string; refresh_token: string; expires_at: string } | { error: string }> {
  const ML_APP_ID = Deno.env.get("ML_APP_ID");
  const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

  if (!ML_APP_ID || !ML_CLIENT_SECRET) {
    return { error: "Credenciais não configuradas" };
  }

  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: ML_APP_ID,
        client_secret: ML_CLIENT_SECRET,
        refresh_token: tokenData.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ML Sync] ❌ Erro ao renovar token: ${response.status} - ${errorText}`);
      return { error: errorText };
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

    await supabase
      .from("integracao_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    console.log(`[ML Sync] ✓ Token renovado, expira em: ${expiresAt}`);

    return { 
      access_token: data.access_token, 
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

/**
 * NOVA FUNÇÃO: Logar issues de pedidos em integracao_logs
 */
async function logOrderIssues(
  supabase: any,
  empresaId: string,
  issues: Array<{ orderId: number; issues: string[] }>
) {
  if (issues.length === 0) return;

  const semPayments = issues.filter(i => i.issues.includes("sem_payments"));
  const semSku = issues.filter(i => i.issues.includes("sem_seller_sku"));
  const fetchErrors = issues.filter(i => i.issues.some(is => is.startsWith("fetch_error")));

  const mensagem = [
    semPayments.length > 0 ? `${semPayments.length} pedidos sem payments` : null,
    semSku.length > 0 ? `${semSku.length} pedidos sem seller_sku` : null,
    fetchErrors.length > 0 ? `${fetchErrors.length} erros de fetch` : null,
  ].filter(Boolean).join(", ");

  if (mensagem) {
    await supabase.from("integracao_logs").insert({
      empresa_id: empresaId,
      provider: "mercado_livre",
      tipo: "data_quality",
      status: "warning",
      mensagem: `Dados incompletos: ${mensagem}`,
      detalhes: {
        sem_payments: semPayments.map(i => i.orderId),
        sem_seller_sku: semSku.map(i => i.orderId),
        fetch_errors: fetchErrors.map(i => ({ orderId: i.orderId, errors: i.issues })),
      },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 50000;
  const BATCH_SIZE_ORDERS = 5; // Processar 5 pedidos por vez para evitar rate limit
  
  let registros_processados = 0;
  let registros_criados = 0;
  let registros_atualizados = 0;
  let registros_erro = 0;
  let itens_mapeados_automaticamente = 0;
  let shipping_extraidos = 0;
  let shipping_falharam = 0;
  let billing_extraidos = 0;
  let eventos_criados = 0;
  let pedidos_com_sale_fee = 0;
  let pedidos_com_listing_prices = 0;
  let timeout_reached = false;
  let batch_id: string | null = null;
  const orderIssues: Array<{ orderId: number; issues: string[] }> = [];

  try {
    const body = await req.json();
    const { empresa_id, days_back = 7, auto_sync = false } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============= MODO AUTO_SYNC =============
    if (auto_sync) {
      console.log(`[ML Sync] ========================================`);
      console.log(`[ML Sync] 🔄 MODO AUTO_SYNC: Sincronizando todas as empresas...`);
      console.log(`[ML Sync] ========================================`);

      const { data: allTokens, error: tokensError } = await supabase
        .from("integracao_tokens")
        .select("empresa_id")
        .eq("provider", "mercado_livre");

      if (tokensError || !allTokens || allTokens.length === 0) {
        console.log(`[ML Sync] Nenhuma empresa com token ML encontrada`);
        return new Response(
          JSON.stringify({ success: true, message: "Nenhuma empresa com integração ML ativa", empresas_sync: 0 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const empresaIds = [...new Set(allTokens.map(t => t.empresa_id))];
      console.log(`[ML Sync] ${empresaIds.length} empresa(s) encontrada(s) com integração ML`);

      const resultados: Array<{ empresa_id: string; success: boolean; criados: number; atualizados: number; error?: string }> = [];

      for (const empId of empresaIds) {
        try {
          console.log(`[ML Sync] 📦 Iniciando sync para empresa ${empId}...`);
          
          const response = await fetch(`${supabaseUrl}/functions/v1/ml-sync-orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ empresa_id: empId, days_back: days_back || 1 }),
          });

          const result = await response.json();
          resultados.push({
            empresa_id: empId,
            success: result.success ?? false,
            criados: result.registros_criados ?? 0,
            atualizados: result.registros_atualizados ?? 0,
            error: result.error,
          });
          
          console.log(`[ML Sync] ✓ Empresa ${empId}: ${result.registros_criados ?? 0} novos, ${result.registros_atualizados ?? 0} atualizados`);
        } catch (err) {
          console.error(`[ML Sync] ✗ Erro na empresa ${empId}:`, err);
          resultados.push({
            empresa_id: empId,
            success: false,
            criados: 0,
            atualizados: 0,
            error: err instanceof Error ? err.message : "Erro desconhecido",
          });
        }
      }

      const totalCriados = resultados.reduce((sum, r) => sum + r.criados, 0);
      const totalAtualizados = resultados.reduce((sum, r) => sum + r.atualizados, 0);
      const empresasSucesso = resultados.filter(r => r.success).length;

      console.log(`[ML Sync] ========================================`);
      console.log(`[ML Sync] ✅ AUTO_SYNC concluído: ${empresasSucesso}/${empresaIds.length} empresas`);
      console.log(`[ML Sync]    Total: ${totalCriados} novos, ${totalAtualizados} atualizados`);
      console.log(`[ML Sync] ========================================`);

      return new Response(
        JSON.stringify({
          success: true,
          auto_sync: true,
          empresas_sync: empresaIds.length,
          empresas_sucesso: empresasSucesso,
          total_criados: totalCriados,
          total_atualizados: totalAtualizados,
          resultados,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= MODO NORMAL =============
    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from("integracao_tokens")
      .select("*")
      .eq("empresa_id", empresa_id)
      .eq("provider", "mercado_livre")
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Sync] Token não encontrado para empresa:", empresa_id, tokenError);
      return new Response(
        JSON.stringify({ 
          error: "Esta empresa não possui integração com o Mercado Livre configurada." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tokenState: TokenState = {
      id: tokenData.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      user_id_provider: tokenData.user_id_provider,
    };

    const initialTokenResult = await getValidAccessToken(supabase, tokenState);
    
    if ('error' in initialTokenResult) {
      return new Response(
        JSON.stringify({ error: "Erro ao obter token válido", details: initialTokenResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    tokenState = initialTokenResult.tokenState;

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] Iniciando sync V3 para empresa ${empresa_id}`);
    console.log(`[ML Sync] Período: últimos ${days_back} dias`);
    console.log(`[ML Sync] ✓ GET /orders/{id} para payload COMPLETO`);
    console.log(`[ML Sync] ✓ sale_fee, seller_sku, category_id, listing_type_id`);
    console.log(`[ML Sync] ✓ Processamento em lotes de ${BATCH_SIZE_ORDERS}`);
    console.log(`[ML Sync] ========================================`);

    // ========== CRIAR BATCH DE IMPORTAÇÃO ==========
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days_back);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date();
    dateTo.setHours(23, 59, 59, 999);

    const { data: batchData, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        empresa_id,
        canal: "Mercado Livre",
        tipo_importacao: "sync_api",
        periodo_inicio: dateFrom.toISOString().split('T')[0],
        periodo_fim: dateTo.toISOString().split('T')[0],
        status: "processando",
        metadados: { days_back, source: "ml-sync-orders", version: "v3-full-payload" },
      })
      .select()
      .single();

    if (!batchError && batchData) {
      batch_id = batchData.id;
      console.log(`[ML Sync] 📦 Batch criado: ${batch_id}`);
    }

    // ========== FASE 1: BUSCAR IDs DE PEDIDOS ==========
    let allOrderIds: number[] = [];
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.2) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout na busca de IDs`);
        timeout_reached = true;
        break;
      }
      
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayLabel = dayStart.toISOString().split('T')[0];
      
      const { orderIds, tokenState: updatedState } = await fetchOrderIds(
        supabase,
        tokenState, 
        tokenState.user_id_provider, 
        dayStart, 
        dayEnd
      );
      tokenState = updatedState;
      
      allOrderIds = allOrderIds.concat(orderIds);
      console.log(`[ML Sync] 📅 ${dayLabel}: ${orderIds.length} IDs`);
      
      if (dayOffset < days_back - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] Total: ${allOrderIds.length} pedidos para buscar detalhes`);
    console.log(`[ML Sync] ========================================`);

    // ========== FASE 2: BUSCAR DETALHES COMPLETOS EM LOTES ==========
    const allOrders: MLOrder[] = [];
    
    console.log(`[ML Sync] 📦 Buscando payload completo em lotes de ${BATCH_SIZE_ORDERS}...`);
    
    for (let i = 0; i < allOrderIds.length; i += BATCH_SIZE_ORDERS) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.5) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de detalhes`);
        timeout_reached = true;
        break;
      }
      
      const batchIds = allOrderIds.slice(i, i + BATCH_SIZE_ORDERS);
      
      const results = await mapLimit(batchIds, BATCH_SIZE_ORDERS, async (orderId) => {
        const { order, tokenState: updatedState, hasIssues, issues } = await fetchOrderDetails(
          supabase,
          tokenState,
          orderId
        );
        tokenState = updatedState;
        
        if (hasIssues && issues.length > 0) {
          orderIssues.push({ orderId, issues });
        }
        
        return order;
      });
      
      for (const order of results) {
        if (order) {
          allOrders.push(order);
        }
      }
      
      // Rate limiting entre batches
      if (i + BATCH_SIZE_ORDERS < allOrderIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if ((i / BATCH_SIZE_ORDERS) % 10 === 0) {
        console.log(`[ML Sync] 📦 Detalhes: ${Math.min(i + BATCH_SIZE_ORDERS, allOrderIds.length)}/${allOrderIds.length}`);
      }
    }

    console.log(`[ML Sync] ✓ ${allOrders.length} pedidos com payload completo`);

    // ========== BUSCAR NOME DA CONTA DO VENDEDOR ==========
    let contaNome: string | null = null;
    try {
      const userUrl = `${ML_API_URL}/users/${tokenState.user_id_provider}`;
      const { response: userResponse, tokenState: userTokenState } = await mlFetch(
        userUrl,
        supabase,
        tokenState
      );
      tokenState = userTokenState;
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        contaNome = userData.nickname || userData.first_name || `ML-${tokenState.user_id_provider}`;
        console.log(`[ML Sync] 👤 Conta: ${contaNome}`);
      } else {
        contaNome = `ML-${tokenState.user_id_provider}`;
      }
    } catch (err) {
      contaNome = `ML-${tokenState.user_id_provider}`;
    }

    // Buscar mapeamentos existentes
    const { data: mapeamentosExistentes } = await supabase
      .from("produto_marketplace_map")
      .select("sku_marketplace, produto_id")
      .eq("empresa_id", empresa_id)
      .eq("canal", "Mercado Livre")
      .eq("ativo", true);

    const mapeamentoMap = new Map<string, string>();
    mapeamentosExistentes?.forEach(m => {
      mapeamentoMap.set(m.sku_marketplace, m.produto_id);
    });

    console.log(`[ML Sync] ${mapeamentoMap.size} mapeamentos de produtos ativos`);

    // ========== BUSCAR TAXAS DA API DE CONCILIAÇÕES ==========
    console.log(`[ML Sync] 💰 Buscando taxas da API de Conciliações...`);
    
    const { feesMap, tokenState: tokenAfterBilling, billingAvailable } = await fetchBillingDetailsFromConciliation(
      supabase,
      tokenState,
      dateFrom,
      dateTo
    );
    tokenState = tokenAfterBilling;
    billing_extraidos = feesMap.size;
    
    if (!billingAvailable) {
      console.log(`[ML Sync] ⚠️ API Conciliações indisponível, usando sale_fee/marketplace_fee`);
      
      // Logar em integracao_logs
      await supabase.from("integracao_logs").insert({
        empresa_id,
        provider: "mercado_livre",
        tipo: "api_status",
        status: "warning",
        mensagem: "API Conciliações retornou 403/401, usando fallback de sale_fee e marketplace_fee",
      });
    }

    // ========== BUSCAR SHIPPING COSTS ==========
    const SHIPPING_BATCH = 50;
    const SHIPPING_CONCURRENCY = 5;
    
    const ordersWithShipping = allOrders.filter(o => o.shipping?.id);
    console.log(`[ML Sync] 📦 Buscando custos de envio para ${ordersWithShipping.length} pedidos...`);
    
    const shippingCostsMap = new Map<number, RawShippingCosts>();
    
    for (let i = 0; i < ordersWithShipping.length; i += SHIPPING_BATCH) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.7) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de shipping`);
        timeout_reached = true;
        break;
      }
      
      const batch = ordersWithShipping.slice(i, i + SHIPPING_BATCH);
      
      const results = await mapLimit(batch, SHIPPING_CONCURRENCY, async (order) => {
        const { data: costsData, tokenState: updatedState } = await fetchShippingCosts(
          supabase,
          tokenState,
          order.shipping.id
        );
        tokenState = updatedState;
        return { orderId: order.id, data: costsData };
      });
      
      for (const result of results) {
        if (result?.data) {
          shippingCostsMap.set(result.orderId, result.data);
          shipping_extraidos++;
        } else {
          shipping_falharam++;
        }
      }
    }

    console.log(`[ML Sync] Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);

    // ========== PROCESSAR E SALVAR PEDIDOS ==========
    for (const order of allOrders) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn(`[ML Sync] ⚠ Timeout atingido`);
        timeout_reached = true;
        break;
      }
      
      registros_processados++;

      try {
        const valorBruto = order.total_amount;
        const buyerNickname = order.buyer?.nickname || null;
        
        // ========== EXTRAIR TAXAS ==========
        const orderId = String(order.id);
        let comissao = 0;
        let tarifaFixa = 0;
        let tarifaFinanceira = 0;
        let freteVendedorFromBilling = 0;
        let usouFallback = false;
        let usouSaleFee = false;
        let usouListingPrices = false;
        
        const billingFees = feesMap.get(orderId);
        if (billingAvailable && billingFees && (billingFees.comissao > 0 || billingFees.tarifaFixa > 0)) {
          comissao = billingFees.comissao;
          tarifaFixa = billingFees.tarifaFixa;
          tarifaFinanceira = billingFees.tarifaFinanceira;
          freteVendedorFromBilling = billingFees.freteVendedor;
        } else {
          // Usar novo extrator que prioriza sale_fee + listing_prices
          const fees = await extractFeesFromFullOrder(order, true);
          comissao = fees.comissao;
          tarifaFixa = fees.tarifaFixa;
          tarifaFinanceira = fees.tarifaFinanceira;
          usouFallback = fees.origemFallback ?? false;
          usouListingPrices = fees.origemListingPrices ?? false;
          
          // Verificar se veio de sale_fee
          let totalSaleFee = 0;
          for (const item of order.order_items || []) {
            if (item.sale_fee && item.sale_fee > 0) {
              totalSaleFee += item.sale_fee * item.quantity;
            }
          }
          if (totalSaleFee > 0) {
            usouSaleFee = true;
            pedidos_com_sale_fee++;
          }
          if (usouListingPrices) {
            pedidos_com_listing_prices++;
          }
        }

        // ========== PROCESSAR SHIPPING ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = freteVendedorFromBilling;

        const shippingCosts = shippingCostsMap.get(order.id);
        if (shippingCosts) {
          const rawLogisticType = shippingCosts.logistic_type || "";
          tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
          freteComprador = shippingCosts.receiver_cost || 0;
          
          if (freteVendedor === 0 && shippingCosts.sender_cost > 0) {
            freteVendedor = shippingCosts.sender_cost;
          }
        }

        // ========== CALCULAR VALORES ==========
        const taxasLegado = comissao + tarifaFinanceira;
        const tarifasLegado = tarifaFixa;
        const valorLiquido = valorBruto - taxasLegado - tarifasLegado - freteVendedor;

        const taxasFoiEstimada = usouFallback;
        const fretePendente = freteVendedor === 0 && ordersWithShipping.some(o => o.id === order.id);

        let statusEnriquecimento = "completo";
        if (taxasFoiEstimada) statusEnriquecimento = "pendente_taxas_estimadas";
        else if (fretePendente) statusEnriquecimento = "pendente_frete";

        const dataTransacao = order.date_closed || order.date_created;

        // Raw order para auditoria
        const rawOrder = {
          id: order.id,
          status: order.status,
          date_created: order.date_created,
          date_closed: order.date_closed,
          total_amount: order.total_amount,
          paid_amount: order.paid_amount,
          buyer_id: order.buyer?.id,
          payments_count: order.payments?.length || 0,
          items_count: order.order_items?.length || 0,
          tags: order.tags,
        };

        // Raw fees para auditoria
        const rawFees = billingFees ? {
          source: "api_conciliacoes",
          comissao: billingFees.comissao,
          tarifaFixa: billingFees.tarifaFixa,
          tarifaFinanceira: billingFees.tarifaFinanceira,
          freteVendedor: billingFees.freteVendedor,
        } : {
          source: usouListingPrices ? "listing_prices" : (usouSaleFee ? "sale_fee_items" : "api_orders_fallback"),
          sale_fee_total: order.order_items?.reduce((sum, i) => sum + (i.sale_fee || 0) * i.quantity, 0) || 0,
          marketplace_fee_sum: order.payments?.reduce((sum, p) => sum + (p.marketplace_fee || 0), 0) || 0,
          tarifa_fixa_estimada: usouListingPrices ? tarifaFixa : null,
          estimated: usouFallback,
          from_listing_prices: usouListingPrices,
        };

        const transactionData = {
          empresa_id,
          canal: "Mercado Livre",
          conta_nome: contaNome,
          seller_id: tokenState.user_id_provider,
          shipment_id: order.shipping?.id ? String(order.shipping.id) : null,
          data_transacao: dataTransacao,
          descricao: `Venda #${order.id}${buyerNickname ? ` - ${buyerNickname}` : ''}`,
          tipo_lancamento: "credito",
          tipo_transacao: "venda",
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          taxas: taxasFoiEstimada ? null : taxasLegado,
          tarifas: tarifasLegado,
          outros_descontos: 0,
          referencia_externa: String(order.id),
          pedido_id: String(order.id),
          origem_extrato: "api_mercado_livre",
          status: order.status === "paid" ? "importado" : "pendente",
          tipo_envio: tipoEnvio,
          frete_comprador: freteComprador,
          frete_vendedor: fretePendente ? null : freteVendedor,
          raw_order: rawOrder,
          raw_fees: rawFees,
          raw_shipping_costs: shippingCosts ? {
            logistic_type: shippingCosts.logistic_type,
            sender_cost: shippingCosts.sender_cost,
            receiver_cost: shippingCosts.receiver_cost,
            raw_senders: shippingCosts.raw_senders,
            raw_receiver: shippingCosts.raw_receiver,
          } : null,
          status_enriquecimento: statusEnriquecimento,
        };

        // UPSERT
        const { data: upsertedTx, error: upsertError } = await supabase
          .from("marketplace_transactions")
          .upsert(transactionData, {
            onConflict: "empresa_id,canal,referencia_externa,tipo_transacao,tipo_lancamento",
            ignoreDuplicates: false,
          })
          .select()
          .single();

        if (upsertError) {
          console.error(`[ML Sync] Erro ao upsert pedido ${order.id}:`, upsertError);
          registros_erro++;
          continue;
        }

        const wasCreated = upsertedTx && new Date(upsertedTx.criado_em).getTime() === new Date(upsertedTx.atualizado_em).getTime();

        // ========== GRAVAR EVENTOS FINANCEIROS ==========
        const eventosFinanceiros: Array<{
          empresa_id: string;
          canal: string;
          event_id: string;
          pedido_id: string;
          conta_nome: string | null;
          tipo_evento: string;
          data_evento: string;
          valor: number;
          descricao: string;
          origem: string;
          metadados?: any;
        }> = [];

        // Determinar origem para eventos
        let origemEventos = "api_orders";
        if (billingAvailable && billingFees) {
          origemEventos = "api_conciliacoes";
        } else if (usouListingPrices) {
          origemEventos = "estimado_listing_prices";
        } else if (usouSaleFee) {
          origemEventos = "sale_fee";
        }

        if (comissao > 0) {
          eventosFinanceiros.push({
            empresa_id,
            canal: "Mercado Livre",
            event_id: `order_${order.id}_comissao`,
            pedido_id: String(order.id),
            conta_nome: contaNome,
            tipo_evento: "comissao",
            data_evento: dataTransacao,
            valor: -comissao,
            descricao: `Comissão ML pedido #${order.id}`,
            origem: origemEventos,
            metadados: usouFallback ? { fallback: true } : (usouSaleFee ? { from_sale_fee: true } : null),
          });
        }

        if (tarifaFixa > 0) {
          eventosFinanceiros.push({
            empresa_id,
            canal: "Mercado Livre",
            event_id: `order_${order.id}_tarifa_fixa`,
            pedido_id: String(order.id),
            conta_nome: contaNome,
            tipo_evento: "tarifa_fixa",
            data_evento: dataTransacao,
            valor: -tarifaFixa,
            descricao: `Tarifa fixa pedido #${order.id}`,
            origem: usouListingPrices ? "estimado_listing_prices" : origemEventos,
            metadados: usouListingPrices ? { estimado: true, from_listing_prices: true } : null,
          });
        }

        if (tarifaFinanceira > 0) {
          eventosFinanceiros.push({
            empresa_id,
            canal: "Mercado Livre",
            event_id: `order_${order.id}_tarifa_financeira`,
            pedido_id: String(order.id),
            conta_nome: contaNome,
            tipo_evento: "tarifa_financeira",
            data_evento: dataTransacao,
            valor: -tarifaFinanceira,
            descricao: `Tarifa financeira pedido #${order.id}`,
            origem: origemEventos,
          });
        }

        if (freteVendedor > 0) {
          eventosFinanceiros.push({
            empresa_id,
            canal: "Mercado Livre",
            event_id: `order_${order.id}_frete_vendedor`,
            pedido_id: String(order.id),
            conta_nome: contaNome,
            tipo_evento: "frete_vendedor",
            data_evento: dataTransacao,
            valor: -freteVendedor,
            descricao: `Frete vendedor pedido #${order.id}`,
            origem: "api_shipping_costs",
          });
        }

        if (freteComprador > 0) {
          eventosFinanceiros.push({
            empresa_id,
            canal: "Mercado Livre",
            event_id: `order_${order.id}_frete_comprador`,
            pedido_id: String(order.id),
            conta_nome: contaNome,
            tipo_evento: "frete_comprador",
            data_evento: dataTransacao,
            valor: freteComprador,
            descricao: `Frete comprador pedido #${order.id}`,
            origem: "api_shipping_costs",
          });
        }

        if (eventosFinanceiros.length > 0) {
          const { error: eventsError } = await supabase
            .from("marketplace_financial_events")
            .upsert(eventosFinanceiros, {
              onConflict: "empresa_id,canal,event_id",
              ignoreDuplicates: false,
            });

          if (eventsError) {
            console.error(`[ML Sync] Erro ao salvar eventos pedido ${order.id}:`, eventsError);
          } else {
            eventos_criados += eventosFinanceiros.length;
          }
        }
        
        if (wasCreated) {
          registros_criados++;
        } else {
          registros_atualizados++;
        }

        // ========== SINCRONIZAR ITENS ==========
        if (upsertedTx && order.order_items && order.order_items.length > 0) {
          // Deletar itens existentes
          const { error: deleteError } = await supabase
            .from("marketplace_transaction_items")
            .delete()
            .eq("transaction_id", upsertedTx.id);

          if (deleteError) {
            console.error(`[ML Sync] Erro ao deletar itens do pedido ${order.id}:`, deleteError);
          }

          // Inserir itens com dados completos
          const itensParaInserir = order.order_items.map((item) => {
            // PRIORIDADE: seller_custom_field > seller_sku > item.id
            const skuMarketplace = item.item.seller_custom_field || item.item.seller_sku || item.item.id;
            const produtoId = mapeamentoMap.get(skuMarketplace) || null;

            if (produtoId) {
              itens_mapeados_automaticamente++;
            }

            return {
              transaction_id: upsertedTx.id,
              sku_marketplace: skuMarketplace,
              descricao_item: item.item.title,
              quantidade: item.quantity,
              preco_unitario: item.unit_price,
              preco_total: item.quantity * item.unit_price,
              anuncio_id: item.item.id,
              produto_id: produtoId,
              batch_id: batch_id,
              // Novos campos do payload completo
              sale_fee: item.sale_fee || null,
              category_id: item.item.category_id || null,
              listing_type_id: item.listing_type_id || null,
            };
          });

          const { error: insertError } = await supabase
            .from("marketplace_transaction_items")
            .insert(itensParaInserir);

          if (insertError) {
            console.error(`[ML Sync] Erro ao inserir itens do pedido ${order.id}:`, insertError);
          }
        }
      } catch (err) {
        console.error(`[ML Sync] Erro ao processar pedido ${order.id}:`, err);
        registros_erro++;
      }
    }

    // ========== LOGAR ISSUES DE PEDIDOS ==========
    await logOrderIssues(supabase, empresa_id, orderIssues);

    // ========== ATUALIZAR BATCH ==========
    if (batch_id) {
      await supabase
        .from("import_batches")
        .update({
          total_registros: registros_processados,
          registros_criados,
          registros_atualizados,
          registros_ignorados: registros_erro,
          status: timeout_reached ? "parcial" : (registros_erro > 0 ? "parcial" : "concluido"),
          finalizado_em: new Date().toISOString(),
          metadados: {
            days_back,
            shipping_extraidos,
            billing_extraidos,
            itens_mapeados_automaticamente,
            eventos_criados,
            pedidos_com_sale_fee,
            pedidos_com_listing_prices,
            timeout_reached,
            version: "v4-listing-prices",
          },
        })
        .eq("id", batch_id);
      
      console.log(`[ML Sync] 📦 Batch ${batch_id} finalizado`);
    }

    // Atualizar config com última sync
    await supabase
      .from("integracao_config")
      .update({ 
        last_sync_at: new Date().toISOString(),
        next_sync_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .eq("empresa_id", empresa_id)
      .eq("provider", "mercado_livre");

    const duracao_ms = Date.now() - startTime;

    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "sync",
      status: timeout_reached ? "partial" : (registros_erro > 0 ? "partial" : "success"),
      mensagem: `Sync V4 ${days_back} dias: ${registros_criados} novos, ${registros_atualizados} atualizados | sale_fee: ${pedidos_com_sale_fee} | listing_prices: ${pedidos_com_listing_prices} | Eventos: ${eventos_criados}${timeout_reached ? ' | ⚠ Timeout' : ''}`,
      registros_processados,
      registros_criados,
      registros_atualizados,
      registros_erro,
      duracao_ms,
      detalhes: { 
        days_back, 
        total_order_ids: allOrderIds.length,
        total_orders_fetched: allOrders.length,
        pedidos_com_sale_fee,
        pedidos_com_listing_prices,
        itens_mapeados_automaticamente,
        shipping_extraidos,
        shipping_falharam,
        billing_extraidos,
        eventos_criados,
        issues_count: orderIssues.length,
        timeout_reached,
        version: "v4-listing-prices",
      },
    });

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] ✅ Concluído em ${duracao_ms}ms ${timeout_reached ? '(parcial)' : ''}`);
    console.log(`[ML Sync]    ${registros_criados} novos, ${registros_atualizados} atualizados`);
    console.log(`[ML Sync]    Pedidos com sale_fee: ${pedidos_com_sale_fee}`);
    console.log(`[ML Sync]    Pedidos com listing_prices: ${pedidos_com_listing_prices}`);
    console.log(`[ML Sync]    Eventos: ${eventos_criados}`);
    console.log(`[ML Sync]    Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);
    console.log(`[ML Sync]    Billing: ${billing_extraidos} pedidos`);
    console.log(`[ML Sync]    Issues: ${orderIssues.length} pedidos com dados incompletos`);
    console.log(`[ML Sync] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        partial: timeout_reached,
        registros_processados,
        registros_criados,
        registros_atualizados,
        registros_erro,
        itens_mapeados_automaticamente,
        eventos_criados,
        pedidos_com_sale_fee,
        pedidos_com_listing_prices,
        shipping_extraidos,
        shipping_falharam,
        billing_extraidos,
        issues_count: orderIssues.length,
        duracao_ms,
        days_back,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML Sync] Erro:", error);

    const errorSupabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const errorSupabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const errorSupabase = createClient(errorSupabaseUrl, errorSupabaseKey);

    try {
      const errBody = await req.clone().json();
      if (errBody.empresa_id) {
        await errorSupabase.from("integracao_logs").insert({
          empresa_id: errBody.empresa_id,
          provider: "mercado_livre",
          tipo: "sync",
          status: "error",
          mensagem: error instanceof Error ? error.message : "Erro desconhecido",
          duracao_ms: Date.now() - startTime,
        });
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
