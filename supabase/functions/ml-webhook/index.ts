import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log("[ML Webhook] Recebido:", JSON.stringify(body));

    const { resource, topic, user_id, application_id } = body;

    if (!resource || !topic) {
      return new Response(
        JSON.stringify({ message: "Webhook recebido mas sem dados úteis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar empresas pelo user_id do ML (pode haver múltiplas empresas com mesmo user_id)
    const { data: tokenDataList, error: tokenError } = await supabase
      .from("integracao_tokens")
      .select("empresa_id, access_token")
      .eq("provider", "mercado_livre")
      .eq("user_id_provider", String(user_id));

    if (tokenError || !tokenDataList || tokenDataList.length === 0) {
      console.warn("[ML Webhook] Token não encontrado para user_id:", user_id);
      // Retornar 200 para não bloquear o ML
      return new Response(
        JSON.stringify({ message: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar para todas as empresas vinculadas ao mesmo user_id
    for (const tokenData of tokenDataList) {
      const empresa_id = tokenData.empresa_id;

      // Registrar log do webhook
      await supabase.from("integracao_logs").insert({
        empresa_id,
        provider: "mercado_livre",
        tipo: "webhook",
        status: "pending",
        mensagem: `Webhook ${topic}: ${resource}`,
        detalhes: { resource, topic, user_id, application_id },
      });

      // Processar por tipo de tópico
      switch (topic) {
        case "orders_v2":
          // Novo pedido ou atualização - buscar detalhes e salvar
          await processOrder(supabase, tokenData, resource, empresa_id);
          break;

        case "payments":
          // Atualização de pagamento
          await processPayment(supabase, tokenData, resource, empresa_id);
          break;

        case "shipments":
          // Atualização de envio
          console.log("[ML Webhook] Shipment update:", resource, "empresa:", empresa_id);
          break;

        case "claims":
          // Reclamação/mediação
          console.log("[ML Webhook] Claim:", resource, "empresa:", empresa_id);
          break;

        default:
          console.log("[ML Webhook] Tópico não tratado:", topic);
      }
    }

    return new Response(
      JSON.stringify({ message: "Webhook processado", empresas: tokenDataList.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML Webhook] Erro:", error);
    // Sempre retornar 200 para não bloquear retentativas do ML
    return new Response(
      JSON.stringify({ message: "Erro processado", error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processOrder(supabase: any, tokenData: any, resource: string, empresa_id: string) {
  try {
    // Extrair order ID do resource (ex: /orders/123456789)
    const orderId = resource.split("/").pop();
    if (!orderId) return;

    // Buscar detalhes do pedido
    const response = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!response.ok) {
      console.error("[ML Webhook] Erro ao buscar pedido:", await response.text());
      return;
    }

    const order = await response.json();

    // Calcular valores
    const valorBruto = order.total_amount;
    const taxas = order.payments?.reduce((sum: number, p: any) => sum + (p.marketplace_fee || 0), 0) || 0;
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
      origem_extrato: "webhook_mercado_livre",
      status: order.status === "paid" ? "importado" : "pendente",
    };

    if (existing) {
      await supabase
        .from("marketplace_transactions")
        .update(transactionData)
        .eq("id", existing.id);
    } else {
      const { data: newTx } = await supabase
        .from("marketplace_transactions")
        .insert(transactionData)
        .select()
        .single();

      // Inserir itens
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
    }

    // Atualizar log
    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "webhook",
      status: "success",
      mensagem: `Pedido ${order.id} processado via webhook`,
      registros_processados: 1,
      registros_criados: existing ? 0 : 1,
      registros_atualizados: existing ? 1 : 0,
    });

  } catch (err) {
    console.error("[ML Webhook] Erro ao processar pedido:", err);
  }
}

async function processPayment(supabase: any, tokenData: any, resource: string, empresa_id: string) {
  try {
    const paymentId = resource.split("/").pop();
    if (!paymentId) return;

    // Buscar detalhes do pagamento
    const response = await fetch(`https://api.mercadolibre.com/collections/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!response.ok) {
      console.error("[ML Webhook] Erro ao buscar pagamento:", await response.text());
      return;
    }

    const payment = await response.json();
    console.log("[ML Webhook] Payment details:", payment.id, payment.status);

    // Atualizar transação associada se existir
    if (payment.order_id) {
      await supabase
        .from("marketplace_transactions")
        .update({ 
          status: payment.status === "approved" ? "importado" : "pendente" 
        })
        .eq("empresa_id", empresa_id)
        .eq("pedido_id", String(payment.order_id));
    }

  } catch (err) {
    console.error("[ML Webhook] Erro ao processar pagamento:", err);
  }
}
