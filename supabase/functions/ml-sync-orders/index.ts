import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_API_URL = "https://api.mercadolibre.com";

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

interface PaymentFeeDetail {
  type: string;
  amount: number;
  fee_payer: string;
}

interface PaymentDetails {
  id: number;
  fee_details?: PaymentFeeDetail[];
  marketplace_fee?: number;
  financing_fee?: number;
  shipping_cost?: number;
  total_paid_amount?: number;
  transaction_amount?: number;
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

// Função para buscar detalhes do pagamento
async function fetchPaymentDetails(
  accessToken: string,
  paymentId: number
): Promise<PaymentDetails | null> {
  try {
    const paymentUrl = `${ML_API_URL}/payments/${paymentId}`;
    const paymentResponse = await fetch(paymentUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!paymentResponse.ok) {
      console.warn(`[ML Sync] ⚠ Falha ao buscar payment ${paymentId}: ${paymentResponse.status}`);
      return null;
    }

    return await paymentResponse.json();
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar payment ${paymentId}:`, err);
    return null;
  }
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
      console.warn(`[ML Sync] ⚠ Falha ao buscar shipping ${shippingId}: ${shippingResponse.status}`);
      return null;
    }

    return await shippingResponse.json();
  } catch (err) {
    console.error(`[ML Sync] ❌ Erro ao buscar shipping ${shippingId}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let registros_processados = 0;
  let registros_criados = 0;
  let registros_atualizados = 0;
  let registros_erro = 0;
  let itens_mapeados_automaticamente = 0;
  let shipping_extraidos = 0;
  let payments_enriquecidos = 0;
  let payments_falharam = 0;
  let shipping_falharam = 0;

  try {
    const { empresa_id, days_back = 7 } = await req.json();

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
    console.log(`[ML Sync] Iniciando sync para empresa ${empresa_id}`);
    console.log(`[ML Sync] Período: últimos ${days_back} dias (busca segmentada por dia)`);
    console.log(`[ML Sync] ========================================`);

    // ========== BUSCA SEGMENTADA POR DIA ==========
    let allOrders: MLOrder[] = [];
    
    for (let dayOffset = 0; dayOffset < days_back; dayOffset++) {
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
        await new Promise(resolve => setTimeout(resolve, 200));
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

    // Processar cada pedido
    for (const order of allOrders) {
      registros_processados++;

      try {
        const valorBruto = order.total_amount;
        const buyerNickname = order.buyer?.nickname || null;
        
        // ========== BUSCAR DETALHES DOS PAYMENTS ==========
        let totalMarketplaceFee = 0;  // Comissão ML (taxas)
        let totalFinancingFee = 0;     // Taxa de parcelamento (tarifas)
        let totalShippingCost = 0;     // Custo de envio via payment
        let paymentEnriched = false;

        for (const payment of order.payments || []) {
          if (payment.id) {
            const paymentDetails = await fetchPaymentDetails(accessToken, payment.id);
            
            if (paymentDetails) {
              paymentEnriched = true;
              
              // Extrair fees do breakdown detalhado
              if (paymentDetails.fee_details && paymentDetails.fee_details.length > 0) {
                for (const fee of paymentDetails.fee_details) {
                  // Fees do tipo mercadopago_fee, ml_fee, application_fee são taxas/comissões
                  if (fee.type === 'mercadopago_fee' || fee.type === 'ml_fee' || fee.type === 'application_fee') {
                    totalMarketplaceFee += fee.amount || 0;
                  }
                  // financing_fee é taxa de parcelamento
                  if (fee.type === 'financing_fee') {
                    totalFinancingFee += fee.amount || 0;
                  }
                  // shipping_fee
                  if (fee.type === 'shipping_fee') {
                    totalShippingCost += fee.amount || 0;
                  }
                }
              } else {
                // Fallback para campos diretos se fee_details não existir
                totalMarketplaceFee += paymentDetails.marketplace_fee || payment.marketplace_fee || 0;
                totalFinancingFee += paymentDetails.financing_fee || 0;
              }
              
              // Custo de envio do payment
              if (paymentDetails.shipping_cost) {
                totalShippingCost += paymentDetails.shipping_cost;
              }
              
              // Pequena pausa para não sobrecarregar API
              await new Promise(resolve => setTimeout(resolve, 50));
            } else {
              // Fallback: usar dados do order.payments
              totalMarketplaceFee += payment.marketplace_fee || 0;
              payments_falharam++;
            }
          }
        }
        
        if (paymentEnriched) {
          payments_enriquecidos++;
        }

        // ========== BUSCAR DETALHES DO SHIPPING ==========
        let tipoEnvio: string | null = null;
        let freteComprador = 0;
        let freteVendedor = 0;

        if (order.shipping?.id) {
          const shippingData = await fetchShippingDetails(accessToken, order.shipping.id);
          
          if (shippingData) {
            const rawLogisticType = shippingData.logistic_type || "";
            tipoEnvio = logisticTypeMap[rawLogisticType] || rawLogisticType || null;
            freteComprador = shippingData.receiver_cost || 0;
            freteVendedor = shippingData.sender_cost || shippingData.base_cost || order.shipping.cost || 0;
            
            if (tipoEnvio) {
              shipping_extraidos++;
            }
            
            console.log(`[ML Sync] 📦 Pedido ${order.id}: tipo_envio=${tipoEnvio}, frete_vendedor=${freteVendedor}, frete_comprador=${freteComprador}`);
          } else {
            shipping_falharam++;
            // Fallback para dados do order
            freteVendedor = order.shipping.cost || 0;
          }
          
          // Pequena pausa
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          console.warn(`[ML Sync] ⚠ Pedido ${order.id} sem shipping.id`);
        }

        // ========== CALCULAR VALORES FINAIS ==========
        // taxas = Comissão ML (marketplace_fee)
        // tarifas = Taxa de parcelamento (financing_fee)
        // outros_descontos = outros descontos eventuais (não usado por enquanto)
        // frete_vendedor = custo de envio pago pelo vendedor
        
        const taxas = totalMarketplaceFee;
        const tarifas = totalFinancingFee;
        const outrosDescontos = 0; // Reservado para outros descontos
        
        // Valor líquido = bruto - taxas - tarifas - frete vendedor
        const valorLiquido = valorBruto - taxas - tarifas - freteVendedor;

        console.log(`[ML Sync] 💰 Pedido ${order.id}: bruto=${valorBruto}, taxas=${taxas}, tarifas=${tarifas}, frete_vendedor=${freteVendedor}, líquido=${valorLiquido}`);

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
          // Atualizar registro existente com TODOS os campos
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

    // Registrar log com métricas de enriquecimento
    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "sync",
      status: registros_erro > 0 ? "partial" : "success",
      mensagem: `Sync ${days_back} dias: ${registros_criados} novos, ${registros_atualizados} atualizados | Payments: ${payments_enriquecidos}✓ ${payments_falharam}✗ | Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`,
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
        payments_enriquecidos,
        payments_falharam,
      },
    });

    console.log(`[ML Sync] ========================================`);
    console.log(`[ML Sync] ✅ Concluído em ${duracao_ms}ms`);
    console.log(`[ML Sync]    ${registros_criados} novos, ${registros_atualizados} atualizados`);
    console.log(`[ML Sync]    Payments: ${payments_enriquecidos}✓ ${payments_falharam}✗`);
    console.log(`[ML Sync]    Shipping: ${shipping_extraidos}✓ ${shipping_falharam}✗`);
    console.log(`[ML Sync]    ${itens_mapeados_automaticamente} itens mapeados`);
    console.log(`[ML Sync] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados,
        registros_criados,
        registros_atualizados,
        registros_erro,
        itens_mapeados_automaticamente,
        shipping_extraidos,
        shipping_falharam,
        payments_enriquecidos,
        payments_falharam,
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
