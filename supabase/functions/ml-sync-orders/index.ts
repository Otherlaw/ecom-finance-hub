import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_API_URL = "https://api.mercadolibre.com";

// Taxa média de parcelamento do ML (5-7% para parcelados)
const FINANCING_FEE_RATE = 0.05;

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
  accessToken: string,
  sellerId: string,
  dayStart: Date,
  dayEnd: Date
): Promise<MLOrder[]> {
  const ML_MAX_OFFSET = 10000;
  const limit = 50;
  let offset = 0;
  let dayOrders: MLOrder[] = [];
  let totalOrders = 0;

  const dateFromStr = dayStart.toISOString();
  const dateToStr = dayEnd.toISOString();

  do {
    const ordersUrl = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateFromStr}&order.date_created.to=${dateToStr}&sort=date_desc&offset=${offset}&limit=${limit}`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

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

  return dayOrders;
}

// Função para buscar detalhes do envio
async function fetchShippingDetails(
  accessToken: string,
  shippingId: number
): Promise<ShippingDetails | null> {
  try {
    const shippingUrl = `${ML_API_URL}/shipments/${shippingId}`;
    const shippingResponse = await fetch(shippingUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!shippingResponse.ok) {
      return null;
    }

    return await shippingResponse.json();
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar shipping ${shippingId}:`, err);
    return null;
  }
}

// Extrair taxas diretamente do pedido (SEM chamar API de payments)
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
  let timeout_reached = false;

  try {
    const { empresa_id, days_back = 3 } = await req.json(); // Default reduzido para 3 dias

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

    // Verificar se token expirou e renovar se necessário
    let accessToken = tokenData.access_token;
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log("[ML Sync] Token expirado, renovando...");
      const refreshResult = await refreshToken(supabase, tokenData);
      if (refreshResult.error) {
        return new Response(
          JSON.stringify({ error: "Erro ao renovar token", details: refreshResult.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshResult.access_token;
    }

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] Iniciando sync OTIMIZADO para empresa ${empresa_id}`);
    console.log(`[ML Sync] Período: últimos ${days_back} dias`);
    console.log(`[ML Sync] ✓ Fees extraídos do pedido (sem chamar /payments)`);
    console.log(`[ML Sync] ✓ Shipping em batches com concorrência 5`);
    console.log(`[ML Sync] ========================================`);

    // ========== BUSCA SEGMENTADA POR DIA ==========
    let allOrders: MLOrder[] = [];
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
      // Verificar timeout
      if (Date.now() - startTime > TIMEOUT_MS * 0.5) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de pedidos`);
        break;
      }
      
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayLabel = dayStart.toISOString().split('T')[0];
      console.log(`[ML Sync] 📅 Buscando pedidos de ${dayLabel}...`);
      
      const ordersOfDay = await fetchOrdersForDay(
        accessToken, 
        tokenData.user_id_provider, 
        dayStart, 
        dayEnd
      );
      
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

    // ========== BUSCAR SHIPPING EM LOTE COM CONCORRÊNCIA CONTROLADA ==========
    const ordersWithShipping = allOrders.filter(o => o.shipping?.id);
    console.log(`[ML Sync] Buscando shipping para ${ordersWithShipping.length} pedidos (concorrência: 5)...`);
    
    const shippingMap = new Map<number, ShippingDetails | null>();
    
    // Processar shipping em batches de 50 com concorrência 5
    const BATCH_SIZE = 50;
    const CONCURRENCY = 5;
    
    for (let i = 0; i < ordersWithShipping.length; i += BATCH_SIZE) {
      // Verificar timeout
      if (Date.now() - startTime > TIMEOUT_MS * 0.8) {
        console.warn(`[ML Sync] ⚠ Aproximando do timeout, parando busca de shipping`);
        timeout_reached = true;
        break;
      }
      
      const batch = ordersWithShipping.slice(i, i + BATCH_SIZE);
      
      const results = await mapLimit(batch, CONCURRENCY, async (order) => {
        const shippingData = await fetchShippingDetails(accessToken, order.shipping.id);
        return { orderId: order.id, shippingId: order.shipping.id, data: shippingData };
      });
      
      for (const result of results) {
        if (result?.data) {
          shippingMap.set(result.orderId, result.data);
          shipping_extraidos++;
        } else {
          shipping_falharam++;
        }
      }
      
      console.log(`[ML Sync] 📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} shipping processados`);
    }

    console.log(`[ML Sync] Shipping completo: ${shipping_extraidos}✓ ${shipping_falharam}✗`);

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
        
        // ========== EXTRAIR TAXAS DO PEDIDO (SEM API /payments) ==========
        const { taxas, tarifas } = extractFeesFromOrder(order);

        // ========== PROCESSAR SHIPPING ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = 0;

        const shippingData = shippingMap.get(order.id);
        if (shippingData) {
          const rawLogisticType = shippingData.logistic_type || "";
          tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
          freteComprador = shippingData.receiver_cost || 0;
          freteVendedor = shippingData.sender_cost || shippingData.base_cost || order.shipping?.cost || 0;
        } else if (order.shipping?.cost) {
          // Fallback para dados do order
          freteVendedor = order.shipping.cost;
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
      mensagem: `Sync ${days_back} dias: ${registros_criados} novos, ${registros_atualizados} atualizados | Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗${timeout_reached ? ' | ⚠ Timeout parcial' : ''}`,
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
        timeout_reached,
        otimizado: true,
      },
    });

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] ✅ Concluído em ${duracao_ms}ms ${timeout_reached ? '(parcial)' : ''}`);
    console.log(`[ML Sync]    ${registros_criados} novos, ${registros_atualizados} atualizados`);
    console.log(`[ML Sync]    Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);
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

// Função para renovar token
async function refreshToken(supabase: any, tokenData: any) {
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
      return { error: await response.text() };
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

    await supabase
      .from("integracao_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      })
      .eq("id", tokenData.id);

    return { access_token: data.access_token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
