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

/**
 * Obtém um access_token válido, renovando se necessário (buffer de 5 min)
 * IMPORTANTE: Salva o novo refresh_token no banco (o ML pode devolver um novo)
 */
async function getValidAccessToken(
  supabase: any, 
  tokenState: TokenState
): Promise<{ access_token: string; tokenState: TokenState } | { error: string }> {
  const now = Date.now();
  const exp = tokenState.expires_at ? new Date(tokenState.expires_at).getTime() : 0;
  
  // Se token expira em mais de 5 minutos, usar o atual
  if (exp && (exp - now) > TOKEN_BUFFER_MS) {
    return { access_token: tokenState.access_token, tokenState };
  }

  console.log("[ML Sync] 🔄 Token expira em < 5 min, renovando automaticamente...");
  
  const refreshResult = await refreshToken(supabase, tokenState);
  
  if ('error' in refreshResult) {
    return { error: refreshResult.error };
  }
  
  // Retornar estado atualizado
  const updatedTokenState: TokenState = {
    ...tokenState,
    access_token: refreshResult.access_token,
    refresh_token: refreshResult.refresh_token || tokenState.refresh_token,
    expires_at: refreshResult.expires_at,
  };
  
  return { access_token: refreshResult.access_token, tokenState: updatedTokenState };
}

/**
 * Wrapper para fetch do ML com retry automático em 401
 * Se receber 401, força refresh do token e tenta novamente 1 vez
 */
async function mlFetch(
  url: string,
  supabase: any,
  tokenState: TokenState,
  init: RequestInit = {}
): Promise<{ response: Response; tokenState: TokenState }> {
  // Obter token válido (com buffer de 5 min)
  const tokenResult = await getValidAccessToken(supabase, tokenState);
  
  if ('error' in tokenResult) {
    throw new Error(`Erro ao obter token: ${tokenResult.error}`);
  }
  
  let currentTokenState = tokenResult.tokenState;
  let accessToken = tokenResult.access_token;
  
  // Primeira tentativa
  let response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  // Se 401, tentar refresh e retry 1x
  if (response.status === 401) {
    console.log("[ML Sync] ⚠️ 401 recebido, forçando refresh e retry...");
    
    // Forçar refresh (ignorar expires_at)
    const forceTokenState: TokenState = {
      ...currentTokenState,
      expires_at: new Date(0).toISOString(), // Forçar expiração
    };
    
    const retryResult = await getValidAccessToken(supabase, forceTokenState);
    
    if ('error' in retryResult) {
      throw new Error(`Erro ao renovar token após 401: ${retryResult.error}`);
    }
    
    currentTokenState = retryResult.tokenState;
    accessToken = retryResult.access_token;
    
    // Retry da requisição
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
    
    // LIMITE DA API
    if (offset >= ML_MAX_OFFSET) {
      console.warn(`[ML Sync] ⚠ Limite da API atingido para dia ${dayStart.toISOString().split('T')[0]}`);
      break;
    }
    
    // Pequena pausa
    if (offset < totalOrders) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (offset < totalOrders);

  return { orders: dayOrders, tokenState: currentTokenState };
}

// Função para buscar detalhes do envio
async function fetchShippingDetails(
  supabase: any,
  tokenState: TokenState,
  shippingId: number
): Promise<{ data: ShippingDetails | null; tokenState: TokenState }> {
  try {
    const shippingUrl = `${ML_API_URL}/shipments/${shippingId}`;
    const { response: shippingResponse, tokenState: updatedState } = await mlFetch(
      shippingUrl,
      supabase,
      tokenState
    );

    if (!shippingResponse.ok) {
      return { data: null, tokenState: updatedState };
    }

    const data = await shippingResponse.json();
    return { data, tokenState: updatedState };
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar shipping ${shippingId}:`, err);
    return { data: null, tokenState };
  }
}

/**
 * Buscar taxas detalhadas da API de Conciliações do ML
 * Endpoint: /billing/integration/details/v2/MERCADO_LIBRE
 * Retorna: CV (comissão), CXE (frete vendedor), taxas de parcelamento, etc
 */
async function fetchBillingDetailsFromConciliation(
  supabase: any,
  tokenState: TokenState,
  dateFrom: Date,
  dateTo: Date
): Promise<{ feesMap: Map<string, OrderFees>; tokenState: TokenState }> {
  const feesMap = new Map<string, OrderFees>();
  let currentTokenState = tokenState;
  
  // Formatar datas para a API (YYYY-MM-DD)
  const fromStr = dateFrom.toISOString().split('T')[0];
  const toStr = dateTo.toISOString().split('T')[0];
  
  const limit = 1000;
  let offset = 0;
  let hasMore = true;
  
  console.log(`[ML Sync] 💰 Buscando API Conciliações: ${fromStr} a ${toStr}`);
  
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
      
      // Processar cada registro de conciliação
      for (const item of results) {
        // source_id pode ser order_id ou payment_id dependendo do tipo
        const sourceId = String(item.source_id || item.order_id || '');
        if (!sourceId) continue;
        
        // Obter ou criar entrada no mapa
        if (!feesMap.has(sourceId)) {
          feesMap.set(sourceId, { taxas: 0, tarifas: 0, freteVendedor: 0 });
        }
        const fees = feesMap.get(sourceId)!;
        
        const detailType = item.detail_type || item.fee_type || '';
        const amount = Math.abs(item.total || item.amount || 0);
        
        // Mapear tipos de taxa do ML para nossos campos
        // CV = Custo de Venda (comissão ML)
        // CXE = Custo de Envio por conta do vendedor
        // ML_FEE, SALE_FEE = comissão
        // FINANCING_FEE, INSTALLMENT_FEE = parcelamento
        switch (detailType.toUpperCase()) {
          case 'CV':
          case 'ML_FEE':
          case 'SALE_FEE':
          case 'MARKETPLACE_FEE':
          case 'FVF': // Fixed Variable Fee (comissão fixa + variável)
            fees.taxas += amount;
            break;
            
          case 'CXE':
          case 'SHIPPING_FEE':
          case 'SHIPPING':
          case 'ENVIO':
            fees.freteVendedor += amount;
            break;
            
          case 'FINANCING_FEE':
          case 'INSTALLMENT_FEE':
          case 'FINANCING':
          case 'INTEREST':
            fees.tarifas += amount;
            break;
            
          // Outros tipos que podem ser comissão
          case 'APPLICATION_FEE':
          case 'MERCADOPAGO_FEE':
            fees.taxas += amount;
            break;
        }
      }
      
      // Verificar se há mais páginas
      const paging = data.paging || {};
      hasMore = results.length === limit && (offset + limit) < (paging.total || 100000);
      offset += limit;
      
      // Pausa entre requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (err) {
      console.error(`[ML Sync] ❌ Erro ao buscar conciliações:`, err);
      break;
    }
  }
  
  console.log(`[ML Sync] 💰 Conciliações: ${feesMap.size} pedidos com taxas mapeadas`);
  
  return { feesMap, tokenState: currentTokenState };
}

// Fallback: Extrair taxas diretamente do pedido quando API de Conciliações falha
function extractFeesFromOrder(order: MLOrder): OrderFees {
  let totalMarketplaceFee = 0;
  let totalFinancingFee = 0;

  for (const payment of order.payments || []) {
    // marketplace_fee já vem no pedido (comissão ML)
    totalMarketplaceFee += payment.marketplace_fee || 0;
    
    // Estimar taxa de parcelamento baseado em installments
    if (payment.installments && payment.installments > 1) {
      // Taxa média de ~5% para parcelamento acima de 1x
      totalFinancingFee += (payment.transaction_amount || 0) * FINANCING_FEE_RATE;
    }
  }

  return {
    taxas: totalMarketplaceFee,
    tarifas: Math.round(totalFinancingFee * 100) / 100, // arredondar para 2 casas
    freteVendedor: 0, // Não disponível no order, vem do shipping
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

    // IMPORTANTE: Salvar o novo refresh_token (o ML pode devolver um novo)
    await supabase
      .from("integracao_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token, // NOVO refresh_token
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
  const TIMEOUT_MS = 50000; // 50 segundos (deixa margem de 10s antes do timeout do Supabase)
  
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

    // ============= MODO AUTO_SYNC: Sincroniza TODAS as empresas com tokens válidos =============
    if (auto_sync) {
      console.log(`[ML Sync] ========================================`);
      console.log(`[ML Sync] 🔄 MODO AUTO_SYNC: Sincronizando todas as empresas...`);
      console.log(`[ML Sync] ========================================`);

      // Buscar todas as empresas com tokens ML válidos
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
          
          // Fazer chamada recursiva para cada empresa (sem auto_sync para evitar loop infinito)
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

    // ============= MODO NORMAL: Sincroniza uma empresa específica =============
    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    }

    // Reutiliza supabase já criado acima

    // Buscar token
    const { data: tokenData, error: tokenError } = await supabase
      .from("integracao_tokens")
      .select("*")
      .eq("empresa_id", empresa_id)
      .eq("provider", "mercado_livre")
      .single();

    if (tokenError || !tokenData) {
      console.error("[ML Sync] Token não encontrado:", tokenError);
      return new Response(
        JSON.stringify({ error: "Token do Mercado Livre não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar estado inicial do token
    let tokenState: TokenState = {
      id: tokenData.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      user_id_provider: tokenData.user_id_provider,
    };

    // Obter token válido antes de iniciar (com buffer de 5 min)
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
    console.log(`[ML Sync] ✓ Shipping em batches com concorrência 5`);
    console.log(`[ML Sync] ========================================`);

    // ========== BUSCA SEGMENTADA POR DIA ==========
    let allOrders: MLOrder[] = [];
    
    // Calcular período total para API de Conciliações
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days_back);
    dateFrom.setHours(0, 0, 0, 0);
    
    const dateTo = new Date();
    dateTo.setHours(23, 59, 59, 999);
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
      // Verificar timeout
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
      
      // Pausa entre dias
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

    // ========== BUSCAR SHIPPING EM LOTE COM CONCORRÊNCIA CONTROLADA ==========
    const BATCH_SIZE = 50;
    const CONCURRENCY = 5;
    
    const ordersWithShipping = allOrders.filter(o => o.shipping?.id);
    console.log(`[ML Sync] 📦 Buscando shipping para ${ordersWithShipping.length} pedidos...`);
    
    const shippingMap = new Map<number, ShippingDetails | null>();
    
    for (let i = 0; i < ordersWithShipping.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.6) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de shipping`);
        timeout_reached = true;
        break;
      }
      
      const batch = ordersWithShipping.slice(i, i + BATCH_SIZE);
      
      // Processar batch com concorrência
      const results = await mapLimit(batch, CONCURRENCY, async (order) => {
        const { data: shippingData, tokenState: updatedState } = await fetchShippingDetails(
          supabase,
          tokenState,
          order.shipping.id
        );
        tokenState = updatedState;
        return { orderId: order.id, data: shippingData };
      });
      
      for (const result of results) {
        if (result?.data) {
          shippingMap.set(result.orderId, result.data);
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
      // Verificar timeout
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
        
        // Tentar obter do mapa de conciliações
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

        // ========== PROCESSAR SHIPPING ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = freteVendedorFromBilling; // Pode vir da API de Conciliações

        const shippingData = shippingMap.get(order.id);
        if (shippingData) {
          const rawLogisticType = shippingData.logistic_type || "";
          tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
          freteComprador = shippingData.receiver_cost || 0;
          
          // Se não veio da API de Conciliações, usar sender_cost do shipping
          if (freteVendedor === 0) {
            freteVendedor = shippingData.sender_cost ?? 0;
          }
        }

        // ========== CALCULAR VALORES FINAIS ==========
        const outrosDescontos = 0;
        const valorLiquido = valorBruto - taxas - tarifas - freteVendedor;

        // Usar date_closed (com horário) como data da transação
        const dataTransacao = order.date_closed || order.date_created;

        // Verificar se já existe
        const { data: existing } = await supabase
          .from("marketplace_transactions")
          .select("id")
          .eq("empresa_id", empresa_id)
          .eq("referencia_externa", String(order.id))
          .eq("canal", "Mercado Livre")
          .single();

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
          outros_descontos: outrosDescontos,
          referencia_externa: String(order.id),
          pedido_id: String(order.id),
          origem_extrato: "api_mercado_livre",
          status: order.status === "paid" ? "importado" : "pendente",
          tipo_envio: tipoEnvio,
          frete_comprador: freteComprador,
          frete_vendedor: freteVendedor,
        };

        if (existing) {
          // Atualizar registro existente
          const { error: updateError } = await supabase
            .from("marketplace_transactions")
            .update(transactionData)
            .eq("id", existing.id);
          
          if (updateError) {
            console.error(`[ML Sync] Erro ao atualizar pedido ${order.id}:`, updateError);
            registros_erro++;
          } else {
            registros_atualizados++;
          }
        } else {
          // Inserir novo registro
          const { data: newTx, error: insertError } = await supabase
            .from("marketplace_transactions")
            .insert(transactionData)
            .select()
            .single();

          if (insertError) {
            console.error("[ML Sync] Erro ao inserir:", insertError);
            registros_erro++;
            continue;
          }

          // Inserir itens do pedido COM MAPEAMENTO AUTOMÁTICO
          if (order.order_items && newTx) {
            for (const item of order.order_items) {
              const skuMarketplace = item.item.seller_sku || item.item.id;
              
              // Buscar mapeamento existente
              const produtoId = mapeamentoMap.get(skuMarketplace) || null;

              if (produtoId) {
                itens_mapeados_automaticamente++;
              }

              await supabase.from("marketplace_transaction_items").insert({
                transaction_id: newTx.id,
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

          registros_criados++;
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

    // Registrar log
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
