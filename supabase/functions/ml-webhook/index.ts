import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ML Webhook - Salva "rascunho" mínimo das vendas
 * 
 * VALIDAÇÃO DE ASSINATURA:
 * - Usa webhook_secret salvo em integracao_config por empresa
 * - Busca empresa(s) via user_id do payload → integracao_tokens
 * - Para cada empresa, busca webhook_secret em integracao_config
 * - Valida HMAC SHA-256 conforme docs ML
 * - Se nenhuma empresa tiver secret configurado → 503
 * - Se assinatura inválida para todas as empresas → 401
 * 
 * REGRAS DE DADOS:
 * - Webhook salva dados mínimos com tarifas/taxas como NULL (não calculado)
 * - Status = "pendente_sync" para indicar que precisa ser completado pelo sync
 * - O ml-sync-orders é o "dono" dos números reais
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Ler body cru e headers de assinatura
    const rawBody = await req.text();
    const xSignature = req.headers.get("x-signature") || "";
    const xRequestId = req.headers.get("x-request-id") || "";

    // 2) Extrair ts e hash da assinatura: "ts=...,v1=..."
    const tsPart = xSignature.split(",").find((p: string) => p.trim().startsWith("ts="));
    const hashPart = xSignature.split(",").find((p: string) => p.trim().startsWith("v1="));
    const ts = tsPart ? tsPart.split("=")[1] : "";
    const receivedHash = hashPart ? hashPart.split("=")[1] : "";

    if (!ts || !receivedHash) {
      console.warn("[ML Webhook] Assinatura ausente no header X-Signature");
      return new Response(
        JSON.stringify({ message: "Assinatura ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Parsear body para extrair user_id (necessário para descobrir empresa)
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[ML Webhook] Body não é JSON válido");
      return new Response(
        JSON.stringify({ message: "Body inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ML Webhook] Recebido:", JSON.stringify(body));

    const { resource, topic, user_id, application_id } = body;

    if (!user_id) {
      console.warn("[ML Webhook] user_id ausente no payload");
      return new Response(
        JSON.stringify({ message: "user_id ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Buscar empresas pelo user_id do ML
    const { data: tokenDataList, error: tokenError } = await supabase
      .from("integracao_tokens")
      .select("empresa_id, access_token")
      .eq("provider", "mercado_livre")
      .eq("user_id_provider", String(user_id));

    if (tokenError || !tokenDataList || tokenDataList.length === 0) {
      console.warn("[ML Webhook] Token não encontrado para user_id:", user_id);
      return new Response(
        JSON.stringify({ message: "Usuário não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) Para cada empresa, buscar webhook_secret e tentar validar assinatura
    let signatureValid = false;
    let anySecretConfigured = false;

    for (const tokenData of tokenDataList) {
      const { data: configRow } = await supabase
        .from("integracao_config")
        .select("webhook_secret")
        .eq("empresa_id", tokenData.empresa_id)
        .eq("provider", "mercado_livre")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const secret = configRow?.webhook_secret;
      if (!secret || secret.length === 0) {
        console.warn(`[ML Webhook] webhook_secret não configurado para empresa ${tokenData.empresa_id}`);
        continue;
      }

      anySecretConfigured = true;

      // Validar HMAC SHA-256 conforme docs ML
      const manifest = `id:${xRequestId};ts:${ts};${rawBody}`;
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
      const expectedHash = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (expectedHash === receivedHash) {
        signatureValid = true;
        break;
      }
    }

    // Fallback: tentar env var global ML_WEBHOOK_SECRET (compatibilidade)
    if (!signatureValid) {
      const globalSecret = Deno.env.get("ML_WEBHOOK_SECRET");
      if (globalSecret && globalSecret.length > 0) {
        anySecretConfigured = true;
        const manifest = `id:${xRequestId};ts:${ts};${rawBody}`;
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(globalSecret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
        const expectedHash = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (expectedHash === receivedHash) {
          signatureValid = true;
        }
      }
    }

    if (!anySecretConfigured) {
      console.error("[ML Webhook] Nenhum webhook_secret configurado (nem por empresa, nem global)");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!signatureValid) {
      console.warn("[ML Webhook] Assinatura inválida para todas as empresas/secrets");
      return new Response(
        JSON.stringify({ message: "Assinatura inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[ML Webhook] Assinatura validada com sucesso");

    if (!resource || !topic) {
      return new Response(
        JSON.stringify({ message: "Webhook recebido mas sem dados úteis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) Processar para todas as empresas vinculadas
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

      switch (topic) {
        case "orders_v2":
          await processOrder(supabase, tokenData, resource, empresa_id);
          break;

        case "payments":
          await processPayment(supabase, tokenData, resource, empresa_id);
          break;

        case "shipments":
          console.log("[ML Webhook] Shipment update:", resource, "empresa:", empresa_id);
          break;

        case "claims":
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
    return new Response(
      JSON.stringify({ message: "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Processa pedido do webhook - salva RASCUNHO mínimo
 */
async function processOrder(supabase: any, tokenData: any, resource: string, empresa_id: string) {
  try {
    const orderId = resource.split("/").pop();
    if (!orderId) return;

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

    const valorBruto = order.total_amount;
    const marketplaceFeeEstimado = order.payments?.reduce(
      (sum: number, p: any) => sum + (p.marketplace_fee || 0), 
      0
    ) || 0;
    const valorLiquido = valorBruto - marketplaceFeeEstimado;

    const { data: existing } = await supabase
      .from("marketplace_transactions")
      .select("id")
      .eq("empresa_id", empresa_id)
      .eq("referencia_externa", String(order.id))
      .eq("canal", "Mercado Livre")
      .eq("tipo_transacao", "venda")
      .eq("tipo_lancamento", "credito")
      .maybeSingle();

    const transactionData = {
      empresa_id,
      canal: "Mercado Livre",
      data_transacao: order.date_closed || order.date_created,
      descricao: `Venda #${order.pack_id || order.id}${order.buyer?.nickname ? ` - ${order.buyer.nickname}` : ''}`,
      tipo_lancamento: "credito",
      tipo_transacao: "venda",
      valor_bruto: valorBruto,
      valor_liquido: valorLiquido,
      taxas: marketplaceFeeEstimado,
      tarifas: 0,
      outros_descontos: 0,
      referencia_externa: String(order.id),
      pedido_id: String(order.pack_id || order.id),
      pack_id: order.pack_id ? String(order.pack_id) : null,
      origem_extrato: "webhook_mercado_livre",
      status: order.status === "paid" ? "pendente_sync" : "pendente",
      frete_vendedor: 0,
      frete_comprador: 0,
      tipo_envio: null,
      raw_order: order,
    };

    if (existing) {
      await supabase
        .from("marketplace_transactions")
        .update(transactionData)
        .eq("id", existing.id)
        .in("status", ["pendente", "pendente_sync"]);
      console.log(`[ML Webhook] Pedido ${order.id} atualizado (já existia)`);
    } else {
      const { data: newTx } = await supabase
        .from("marketplace_transactions")
        .insert(transactionData)
        .select()
        .single();

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
      console.log(`[ML Webhook] Pedido ${order.id} criado como rascunho`);
    }

    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "webhook",
      status: "success",
      mensagem: `Pedido ${order.id} salvo como rascunho via webhook`,
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

    if (payment.order_id) {
      if (payment.status === "approved") {
        await supabase
          .from("marketplace_transactions")
          .update({ status: "pendente_sync" })
          .eq("empresa_id", empresa_id)
          .eq("pedido_id", String(payment.order_id))
          .in("status", ["pendente"]);
      }
    }

  } catch (err) {
    console.error("[ML Webhook] Erro ao processar pagamento:", err);
  }
}
