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

interface BillingDetail {
  code: string;
  amount: number;
}

interface BillingInfo {
  billing_info?: {
    details?: BillingDetail[];
  };
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

// Função para buscar billing_info de um pedido (taxas detalhadas)
async function fetchBillingInfo(
  supabase: any,
  tokenState: TokenState,
  orderId: number
): Promise<{ data: BillingInfo | null; tokenState: TokenState }> {
  try {
    const billingUrl = `${ML_API_URL}/orders/${orderId}/billing_info`;
    const { response, tokenState: updatedState } = await mlFetch(
      billingUrl,
      supabase,
      tokenState
    );

    if (!response.ok) {
      return { data: null, tokenState: updatedState };
    }

    const data = await response.json();
    return { data, tokenState: updatedState };
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar billing_info ${orderId}:`, err);
    return { data: null, tokenState };
  }
}

// Extrair taxas do billing_info (mais preciso que marketplace_fee do order)
function extractFeesFromBillingInfo(billingInfo: BillingInfo | null): { taxas: number; tarifas: number } {
  if (!billingInfo?.billing_info?.details) {
    return { taxas: 0, tarifas: 0 };
  }

  let taxas = 0; // Comissão ML (SALE_FEE)
  let tarifas = 0; // Taxa de parcelamento (FINANCING_FEE)

  for (const detail of billingInfo.billing_info.details) {
    const code = detail.code?.toUpperCase() || "";
    const amount = Math.abs(detail.amount || 0);

    if (code.includes("SALE_FEE") || code.includes("COMMISSION") || code.includes("MLF")) {
      taxas += amount;
    } else if (code.includes("FINANCING") || code.includes("INSTALLMENT")) {
      tarifas += amount;
    }
  }

  return { taxas, tarifas };
}

// Fallback: Extrair taxas diretamente do pedido quando billing_info falha
function extractFeesFromOrder(order: MLOrder): { taxas: number; tarifas: number } {
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
  let billing_falharam = 0;
  let timeout_reached = false;

  try {
    const { empresa_id, days_back = 7 } = await req.json(); // Default para 7 dias

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.log(`[ML Sync] ✓ Billing_info para taxas reais`);
    console.log(`[ML Sync] ✓ Shipping em batches com concorrência 5`);
    console.log(`[ML Sync] ========================================`);

    // ========== BUSCA SEGMENTADA POR DIA ==========
    let allOrders: MLOrder[] = [];
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
      // Verificar timeout
      if (Date.now() - startTime > TIMEOUT_MS * 0.4) {
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

    // ========== BUSCAR SHIPPING E BILLING EM LOTE COM CONCORRÊNCIA CONTROLADA ==========
    const BATCH_SIZE = 50;
    const CONCURRENCY = 5;
    
    // === SHIPPING ===
    const ordersWithShipping = allOrders.filter(o => o.shipping?.id);
    console.log(`[ML Sync] Buscando shipping para ${ordersWithShipping.length} pedidos...`);
    
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

    // === BILLING INFO (para taxas reais) ===
    console.log(`[ML Sync] Buscando billing_info para ${allOrders.length} pedidos...`);
    
    const billingMap = new Map<number, BillingInfo | null>();
    
    for (let i = 0; i < allOrders.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > TIMEOUT_MS * 0.8) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de billing_info`);
        timeout_reached = true;
        break;
      }
      
      const batch = allOrders.slice(i, i + BATCH_SIZE);
      
      const results = await mapLimit(batch, CONCURRENCY, async (order) => {
        const { data: billingData, tokenState: updatedState } = await fetchBillingInfo(
          supabase,
          tokenState,
          order.id
        );
        tokenState = updatedState;
        return { orderId: order.id, data: billingData };
      });
      
      for (const result of results) {
        if (result?.data?.billing_info?.details) {
          billingMap.set(result.orderId, result.data);
          billing_extraidos++;
        } else {
          billing_falharam++;
        }
      }
      
      console.log(`[ML Sync] 💰 Billing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} processados`);
    }

    console.log(`[ML Sync] Billing: ${billing_extraidos}✓ ${billing_falharam}✗`);

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
        
        // ========== EXTRAIR TAXAS - PRIORIZAR BILLING_INFO ==========
        const billingInfo = billingMap.get(order.id);
        let taxas = 0;
        let tarifas = 0;
        
        if (billingInfo?.billing_info?.details) {
          // Usar billing_info (mais preciso)
          const fees = extractFeesFromBillingInfo(billingInfo);
          taxas = fees.taxas;
          tarifas = fees.tarifas;
        } else {
          // Fallback: usar marketplace_fee do order + estimar parcelamento
          const fees = extractFeesFromOrder(order);
          taxas = fees.taxas;
          tarifas = fees.tarifas;
        }

        // ========== PROCESSAR SHIPPING ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = 0;

        const shippingData = shippingMap.get(order.id);
        if (shippingData) {
          const rawLogisticType = shippingData.logistic_type || "";
          tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
          freteComprador = shippingData.receiver_cost || 0;
          // CORRIGIDO: usar APENAS sender_cost, sem fallback para base_cost
          freteVendedor = shippingData.sender_cost ?? 0;
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
      mensagem: `Sync ${days_back} dias: ${registros_criados} novos, ${registros_atualizados} atualizados | Ship: ${shipping_extraidos}✓ | Bill: ${billing_extraidos}✓${timeout_reached ? ' | ⚠ Timeout' : ''}`,
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
        billing_falharam,
        timeout_reached,
        otimizado: true,
        token_auto_refresh: true,
      },
    });

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] ✅ Concluído em ${duracao_ms}ms ${timeout_reached ? '(parcial)' : ''}`);
    console.log(`[ML Sync]    ${registros_criados} novos, ${registros_atualizados} atualizados`);
    console.log(`[ML Sync]    Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);
    console.log(`[ML Sync]    Billing: ${billing_extraidos}✓ ${billing_falharam}✗`);
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
        billing_falharam,
        duracao_ms,
        days_back,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML Sync] Erro:", error);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const body = await req.clone().json();
      if (body.empresa_id) {
        await supabase.from("integracao_logs").insert({
          empresa_id: body.empresa_id,
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
