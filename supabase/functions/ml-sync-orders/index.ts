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
  order_items: Array<{
    item: { id: string; title: string; seller_sku: string; category_id?: string };
    quantity: number;
    unit_price: number;
    full_unit_price?: number;
  }>;
  payments: Array<{
    id: number;
    total_paid_amount: number;
    marketplace_fee: number;
    shipping_cost: number;
    transaction_amount: number;
    date_approved: string;
    payment_method_id?: string;
    installments?: number;
  }>;
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

interface ShippingDetails {
  logistic_type?: string;
  receiver_cost?: number;
  sender_cost?: number;
  base_cost?: number;
  status?: string;
  mode?: string;
}

// Estrutura para taxas extraídas da API de Conciliações
interface OrderFees {
  taxas: number;      // CV - Custo de Venda (comissão ML)
  tarifas: number;    // Taxa de parcelamento/financiamento
  freteVendedor: number; // CXE - Custo de Envio Vendedor
}

interface TokenState {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  user_id_provider: string;
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

// Função para buscar pedidos de um dia específico com paginação interna
async function fetchOrdersForDay(
  supabase: any,
  tokenState: TokenState,
  sellerId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<{ orders: MLOrder[]; tokenState: TokenState }> {
  const ML_MAX_OFFSET = 10000;
  const limit = 50;
  let offset = 0;
  let dayOrders: MLOrder[] = [];
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
    dayOrders = dayOrders.concat(pageOrders);
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

  return { orders: dayOrders, tokenState: currentTokenState };
}

/**
 * CORRIGIDO: Buscar custos de envio do vendedor via /shipments/{id}/costs
 * Este é o endpoint correto para obter o custo real pago pelo vendedor
 */
async function fetchShippingCosts(
  supabase: any,
  tokenState: TokenState,
  shippingId: number
): Promise<{ data: { logistic_type: string; sender_cost: number; receiver_cost: number } | null; tokenState: TokenState }> {
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
      // Fallback: se /costs não disponível, usar dados básicos
      console.log(`[ML Sync] ⚠️ /costs não disponível para shipping ${shippingId}, usando fallback`);
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
    
    // Somar custos do comprador (receiver) - para referência
    let receiverCost = 0;
    if (costsData.receiver && Array.isArray(costsData.receiver)) {
      receiverCost = costsData.receiver.reduce((sum, r) => sum + (r.cost || 0), 0);
    }

    return { 
      data: { 
        logistic_type: logisticType, 
        sender_cost: senderCost, 
        receiver_cost: receiverCost 
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
): Promise<{ feesMap: Map<string, OrderFees>; tokenState: TokenState }> {
  const feesMap = new Map<string, OrderFees>();
  let currentTokenState = tokenState;
  
  const fromStr = dateFrom.toISOString().split('T')[0];
  const toStr = dateTo.toISOString().split('T')[0];
  
  const limit = 1000;
  let offset = 0;
  let hasMore = true;
  
  console.log(`[ML Sync] 💰 Buscando API Conciliações: ${fromStr} a ${toStr}`);
  
  // Conjunto para rastrear tipos desconhecidos (evitar spam de logs)
  const tiposDesconhecidos = new Set<string>();
  
  while (hasMore) {
    try {
      const url = `${ML_API_URL}/billing/integration/details/v2/MERCADO_LIBRE?from_date=${fromStr}&to_date=${toStr}&sort_by=DATE&order_by=ASC&limit=${limit}&offset=${offset}`;
      
      const { response, tokenState: updatedState } = await mlFetch(url, supabase, currentTokenState);
      currentTokenState = updatedState;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ML Sync] ❌ Erro API Conciliações: ${response.status} - ${errorText}`);
        break;
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      console.log(`[ML Sync] 💰 Conciliações batch: ${results.length} registros (offset ${offset})`);
      
      for (const item of results) {
        const sourceId = String(item.source_id || item.order_id || '');
        if (!sourceId) continue;
        
        if (!feesMap.has(sourceId)) {
          feesMap.set(sourceId, { taxas: 0, tarifas: 0, freteVendedor: 0 });
        }
        const fees = feesMap.get(sourceId)!;
        
        const detailType = (item.detail_type || item.fee_type || '').toUpperCase();
        const amount = Math.abs(item.total || item.amount || 0);
        
        // Mapear tipos de taxa do ML para nossos campos
        switch (detailType) {
          // Comissão ML (taxas)
          case 'CV':
          case 'ML_FEE':
          case 'SALE_FEE':
          case 'MARKETPLACE_FEE':
          case 'FVF':
          case 'APPLICATION_FEE':
          case 'MERCADOPAGO_FEE':
          case 'FIXED_FEE':
          case 'VARIABLE_FEE':
            fees.taxas += amount;
            break;
            
          // Frete vendedor
          case 'CXE':
          case 'SHIPPING_FEE':
          case 'SHIPPING':
          case 'ENVIO':
          case 'SHIPPING_COST':
          case 'LOGISTIC_COST':
            fees.freteVendedor += amount;
            break;
            
          // Parcelamento/financiamento (tarifas)
          case 'FINANCING_FEE':
          case 'INSTALLMENT_FEE':
          case 'FINANCING':
          case 'INTEREST':
          case 'INSTALLMENTS_FEE':
            fees.tarifas += amount;
            break;
            
          default:
            // Logar tipos desconhecidos apenas uma vez
            if (detailType && !tiposDesconhecidos.has(detailType)) {
              tiposDesconhecidos.add(detailType);
              console.log(`[ML Sync] 📊 Tipo não mapeado: ${detailType} (valor: ${amount})`);
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
  
  // Logar resumo de tipos desconhecidos
  if (tiposDesconhecidos.size > 0) {
    console.log(`[ML Sync] 📊 Tipos de taxa não mapeados encontrados: ${Array.from(tiposDesconhecidos).join(', ')}`);
  }
  
  console.log(`[ML Sync] 💰 Conciliações: ${feesMap.size} pedidos com taxas mapeadas`);
  
  return { feesMap, tokenState: currentTokenState };
}

// Fallback: Extrair taxas diretamente do pedido quando API de Conciliações falha
function extractFeesFromOrder(order: MLOrder): OrderFees {
  let totalMarketplaceFee = 0;
  let totalFinancingFee = 0;

  for (const payment of order.payments || []) {
    totalMarketplaceFee += payment.marketplace_fee || 0;
    
    if (payment.installments && payment.installments > 1) {
      totalFinancingFee += (payment.transaction_amount || 0) * FINANCING_FEE_RATE;
    }
  }

  return {
    taxas: totalMarketplaceFee,
    tarifas: Math.round(totalFinancingFee * 100) / 100,
    freteVendedor: 0,
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

    console.log(`[ML Sync] ✓ Token renovado com sucesso, expira em: ${expiresAt}`);

    return { 
      access_token: data.access_token, 
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIMEOUT_MS = 50000;
  
  let registros_processados = 0;
  let registros_criados = 0;
  let registros_atualizados = 0;
  let registros_erro = 0;
  let itens_mapeados_automaticamente = 0;
  let shipping_extraidos = 0;
  let shipping_falharam = 0;
  let billing_extraidos = 0;
  let timeout_reached = false;

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
          error: "Esta empresa não possui integração com o Mercado Livre configurada. Acesse Integrações para conectar sua conta." 
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
    console.log(`[ML Sync] Iniciando sync OTIMIZADO para empresa ${empresa_id}`);
    console.log(`[ML Sync] Período: últimos ${days_back} dias`);
    console.log(`[ML Sync] ✓ Token renovação automática com buffer 5min`);
    console.log(`[ML Sync] ✓ Retry automático em 401`);
    console.log(`[ML Sync] ✓ API Conciliações para taxas REAIS`);
    console.log(`[ML Sync] ✓ API /shipments/costs para FRETE VENDEDOR REAL`);
    console.log(`[ML Sync] ✓ valor_liquido = valor_bruto - (taxas + tarifas)`);
    console.log(`[ML Sync] ========================================`);

    // ========== BUSCA SEGMENTADA POR DIA ==========
    let allOrders: MLOrder[] = [];
    
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days_back);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date();
    dateTo.setHours(23, 59, 59, 999);
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.3) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de pedidos`);
        timeout_reached = true;
        break;
      }
      
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayLabel = dayStart.toISOString().split('T')[0];
      console.log(`[ML Sync] 📅 Buscando pedidos de ${dayLabel}...`);
      
      const { orders: ordersOfDay, tokenState: updatedState } = await fetchOrdersForDay(
        supabase,
        tokenState, 
        tokenState.user_id_provider, 
        dayStart, 
        dayEnd
      );
      tokenState = updatedState;
      
      allOrders = allOrders.concat(ordersOfDay);
      console.log(`[ML Sync] ✓ ${dayLabel}: ${ordersOfDay.length} pedidos`);
      
      if (dayOffset < days_back - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] Total: ${allOrders.length} pedidos em ${days_back} dias`);
    console.log(`[ML Sync] ========================================`);

    // Buscar mapeamentos existentes para a empresa
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
    console.log(`[ML Sync] 💰 Buscando taxas reais da API de Conciliações...`);
    
    const { feesMap, tokenState: tokenAfterBilling } = await fetchBillingDetailsFromConciliation(
      supabase,
      tokenState,
      dateFrom,
      dateTo
    );
    tokenState = tokenAfterBilling;
    billing_extraidos = feesMap.size;

    // ========== BUSCAR SHIPPING COSTS EM LOTE ==========
    const BATCH_SIZE = 50;
    const CONCURRENCY = 5;
    
    const ordersWithShipping = allOrders.filter(o => o.shipping?.id);
    console.log(`[ML Sync] 📦 Buscando custos de envio para ${ordersWithShipping.length} pedidos...`);
    
    const shippingCostsMap = new Map<number, { logistic_type: string; sender_cost: number; receiver_cost: number }>();
    
    for (let i = 0; i < ordersWithShipping.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.6) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de shipping`);
        timeout_reached = true;
        break;
      }
      
      const batch = ordersWithShipping.slice(i, i + BATCH_SIZE);
      
      const results = await mapLimit(batch, CONCURRENCY, async (order) => {
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
      
      console.log(`[ML Sync] 📦 Shipping batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} processados`);
    }

    console.log(`[ML Sync] Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);

    // ========== PROCESSAR E SALVAR PEDIDOS ==========
    for (const order of allOrders) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.warn(`[ML Sync] ⚠ Timeout atingido, retornando resultados parciais`);
        timeout_reached = true;
        break;
      }
      
      registros_processados++;

      try {
        const valorBruto = order.total_amount;
        const buyerNickname = order.buyer?.nickname || null;
        
        // ========== EXTRAIR TAXAS - PRIORIZAR API DE CONCILIAÇÕES ==========
        const orderId = String(order.id);
        let taxas = 0;
        let tarifas = 0;
        let freteVendedorFromBilling = 0;
        
        const billingFees = feesMap.get(orderId);
        if (billingFees && (billingFees.taxas > 0 || billingFees.tarifas > 0 || billingFees.freteVendedor > 0)) {
          taxas = billingFees.taxas;
          tarifas = billingFees.tarifas;
          freteVendedorFromBilling = billingFees.freteVendedor;
        } else {
          // Fallback: usar marketplace_fee do order + estimar parcelamento
          const fees = extractFeesFromOrder(order);
          taxas = fees.taxas;
          tarifas = fees.tarifas;
        }

        // ========== PROCESSAR SHIPPING (CORRIGIDO) ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = freteVendedorFromBilling;

        const shippingCosts = shippingCostsMap.get(order.id);
        if (shippingCosts) {
          const rawLogisticType = shippingCosts.logistic_type || "";
          tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
          freteComprador = shippingCosts.receiver_cost || 0;
          
          // PRIORIZAR custo do vendedor da API /costs (mais preciso)
          if (shippingCosts.sender_cost > 0) {
            freteVendedor = shippingCosts.sender_cost;
          }
        }

        // ========== CALCULAR VALORES FINAIS (PADRONIZADO) ==========
        // REGRA: valor_liquido = valor_bruto - (taxas + tarifas)
        // NÃO descontar frete_vendedor, imposto, ads, CMV no valor_liquido
        // Esses são descontados apenas na margem de contribuição (MC) na UI
        const valorLiquido = valorBruto - taxas - tarifas;

        const dataTransacao = order.date_closed || order.date_created;

        const transactionData = {
          empresa_id,
          canal: "Mercado Livre",
          data_transacao: dataTransacao,
          descricao: `Venda #${order.id}${buyerNickname ? ` - ${buyerNickname}` : ''}`,
          tipo_lancamento: "credito",
          tipo_transacao: "venda",
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          taxas: taxas,
          tarifas: tarifas,
          outros_descontos: 0,
          referencia_externa: String(order.id),
          pedido_id: String(order.id),
          origem_extrato: "api_mercado_livre",
          status: order.status === "paid" ? "importado" : "pendente",
          tipo_envio: tipoEnvio,
          frete_comprador: freteComprador,
          frete_vendedor: freteVendedor,
        };

        // UPSERT com chave completa (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento)
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
        
        if (wasCreated) {
          registros_criados++;
          
          if (order.order_items && upsertedTx) {
            for (const item of order.order_items) {
              const skuMarketplace = item.item.seller_sku || item.item.id;
              const produtoId = mapeamentoMap.get(skuMarketplace) || null;

              if (produtoId) {
                itens_mapeados_automaticamente++;
              }

              await supabase.from("marketplace_transaction_items").insert({
                transaction_id: upsertedTx.id,
                sku_marketplace: skuMarketplace,
                descricao_item: item.item.title,
                quantidade: item.quantity,
                preco_unitario: item.unit_price,
                preco_total: item.quantity * item.unit_price,
                anuncio_id: item.item.id,
                produto_id: produtoId,
              });
            }
          }
        } else {
          registros_atualizados++;
        }
      } catch (err) {
        console.error(`[ML Sync] Erro ao processar pedido ${order.id}:`, err);
        registros_erro++;
      }
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
      mensagem: `Sync ${days_back} dias: ${registros_criados} novos, ${registros_atualizados} atualizados | Ship: ${shipping_extraidos}✓ | Billing: ${billing_extraidos} pedidos${timeout_reached ? ' | ⚠ Timeout' : ''}`,
      registros_processados,
      registros_criados,
      registros_atualizados,
      registros_erro,
      duracao_ms,
      detalhes: { 
        days_back, 
        total_orders: allOrders.length,
        itens_mapeados_automaticamente,
        shipping_extraidos,
        shipping_falharam,
        billing_extraidos,
        timeout_reached,
        otimizado: true,
        token_auto_refresh: true,
        api_conciliacoes: true,
        api_shipping_costs: true,
        valor_liquido_padronizado: true,
      },
    });

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] ✅ Concluído em ${duracao_ms}ms ${timeout_reached ? '(parcial)' : ''}`);
    console.log(`[ML Sync]    ${registros_criados} novos, ${registros_atualizados} atualizados`);
    console.log(`[ML Sync]    Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);
    console.log(`[ML Sync]    Billing (Conciliações): ${billing_extraidos} pedidos com taxas`);
    console.log(`[ML Sync]    ${itens_mapeados_automaticamente} itens mapeados`);
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
        shipping_extraidos,
        shipping_falharam,
        billing_extraidos,
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
