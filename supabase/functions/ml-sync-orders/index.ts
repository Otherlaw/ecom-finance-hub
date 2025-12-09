import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_API_URL = "https://api.mercadolibre.com";

interface MLOrder {
  id: number;
  status: string;
  date_created: string;
  date_closed: string;
  total_amount: number;
  paid_amount: number;
  currency_id: string;
  order_items: Array<{
    item: { id: string; title: string; seller_sku: string };
    quantity: number;
    unit_price: number;
  }>;
  payments: Array<{
    id: number;
    total_paid_amount: number;
    marketplace_fee: number;
    shipping_cost: number;
    transaction_amount: number;
    date_approved: string;
  }>;
  shipping: {
    id: number;
    cost: number;
  };
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

  try {
    const { empresa_id, days_back = 30 } = await req.json();

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

    console.log(`[ML Sync] Iniciando sync para empresa ${empresa_id}`);

    // Calcular período
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days_back);
    const dateFromStr = dateFrom.toISOString();

    // Buscar pedidos do ML
    const ordersUrl = `${ML_API_URL}/orders/search?seller=${tokenData.user_id_provider}&order.date_created.from=${dateFromStr}&sort=date_desc`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!ordersResponse.ok) {
      const errorText = await ordersResponse.text();
      console.error("[ML Sync] Erro ao buscar pedidos:", errorText);
      throw new Error(`Erro ao buscar pedidos: ${ordersResponse.status}`);
    }

    const ordersData = await ordersResponse.json();
    const orders: MLOrder[] = ordersData.results || [];

    console.log(`[ML Sync] Encontrados ${orders.length} pedidos`);

    // Processar cada pedido
    for (const order of orders) {
      registros_processados++;

      try {
        // Calcular valores
        const valorBruto = order.total_amount;
        const taxas = order.payments?.reduce((sum, p) => sum + (p.marketplace_fee || 0), 0) || 0;
        const frete = order.shipping?.cost || 0;
        const valorLiquido = valorBruto - taxas - frete;

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
          data_transacao: order.date_closed || order.date_created,
          descricao: `Venda #${order.id}`,
          tipo_lancamento: "credito",
          tipo_transacao: "venda",
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          taxas: taxas,
          tarifas: 0,
          outros_descontos: frete,
          referencia_externa: String(order.id),
          pedido_id: String(order.id),
          origem_extrato: "api_mercado_livre",
          status: order.status === "paid" ? "importado" : "pendente",
        };

        if (existing) {
          // Atualizar
          await supabase
            .from("marketplace_transactions")
            .update(transactionData)
            .eq("id", existing.id);
          registros_atualizados++;
        } else {
          // Inserir
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

          // Inserir itens do pedido
          if (order.order_items && newTx) {
            for (const item of order.order_items) {
              await supabase.from("marketplace_transaction_items").insert({
                transaction_id: newTx.id,
                sku_marketplace: item.item.seller_sku || item.item.id,
                descricao_item: item.item.title,
                quantidade: item.quantity,
                preco_unitario: item.unit_price,
                preco_total: item.quantity * item.unit_price,
                anuncio_id: item.item.id,
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
        next_sync_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // +30min
      })
      .eq("empresa_id", empresa_id)
      .eq("provider", "mercado_livre");

    const duracao_ms = Date.now() - startTime;

    // Registrar log
    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "sync",
      status: registros_erro > 0 ? "partial" : "success",
      mensagem: `Sync concluído: ${registros_criados} novos, ${registros_atualizados} atualizados`,
      registros_processados,
      registros_criados,
      registros_atualizados,
      registros_erro,
      duracao_ms,
      detalhes: { days_back, total_orders: orders.length },
    });

    console.log(`[ML Sync] Concluído em ${duracao_ms}ms: ${registros_criados} novos, ${registros_atualizados} atualizados, ${registros_erro} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        registros_processados,
        registros_criados,
        registros_atualizados,
        registros_erro,
        duracao_ms,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML Sync] Erro:", error);

    // Registrar log de erro
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

    // Atualizar no banco
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
