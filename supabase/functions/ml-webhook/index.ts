import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ML Webhook - Salva "rascunho" mínimo das vendas
 * 
 * REGRAS:
 * - Webhook salva dados mínimos com tarifas/taxas como NULL (não calculado)
 * - Status = "pendente_sync" para indicar que precisa ser completado pelo sync
 * - O ml-sync-orders é o "dono" dos números reais
 * - Não usamos order.shipping.cost como frete_vendedor (incorreto)
 */

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

    // Buscar empresas pelo user_id do ML
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

    // Processar para todas as empresas vinculadas
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
      JSON.stringify({ message: "Erro processado", error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Processa pedido do webhook - salva RASCUNHO mínimo
 * 
 * IMPORTANTE:
 * - Não tentamos calcular tarifas/taxas aqui (usamos NULL)
 * - Não usamos order.shipping.cost como frete_vendedor
 * - O sync vai completar com dados reais
 */
async function processOrder(supabase: any, tokenData: any, resource: string, empresa_id: string) {
  try {
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

    // Valores básicos
    const valorBruto = order.total_amount;
    
    // RASCUNHO: não calcular tarifas/taxas aqui - deixar para o sync
    // Colocar marketplace_fee como estimativa inicial, mas sync vai corrigir
    const marketplaceFeeEstimado = order.payments?.reduce(
      (sum: number, p: any) => sum + (p.marketplace_fee || 0), 
      0
    ) || 0;
    
    // valor_liquido = valor_bruto - taxas (regra padronizada)
    const valorLiquido = valorBruto - marketplaceFeeEstimado;

    // Verificar se já existe usando a chave completa
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
      descricao: `Venda #${order.id}${order.buyer?.nickname ? ` - ${order.buyer.nickname}` : ''}`,
      tipo_lancamento: "credito",
      tipo_transacao: "venda",
      valor_bruto: valorBruto,
      valor_liquido: valorLiquido,
      taxas: marketplaceFeeEstimado, // Estimativa - sync vai corrigir
      tarifas: 0, // Sync vai preencher com valor real
      outros_descontos: 0,
      referencia_externa: String(order.id),
      pedido_id: String(order.id),
      origem_extrato: "webhook_mercado_livre",
      // Status indica que precisa ser completado pelo sync
      status: order.status === "paid" ? "pendente_sync" : "pendente",
      // NÃO preencher frete_vendedor - sync vai buscar via /shipments/{id}/costs
      frete_vendedor: 0,
      frete_comprador: 0,
      tipo_envio: null,
    };

    if (existing) {
      // Só atualiza se o status atual for pendente (não sobrescrever dados do sync)
      await supabase
        .from("marketplace_transactions")
        .update({
          ...transactionData,
          // Manter status se já foi processado pelo sync
        })
        .eq("id", existing.id)
        .in("status", ["pendente", "pendente_sync"]);
        
      console.log(`[ML Webhook] Pedido ${order.id} atualizado (já existia)`);
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
      
      console.log(`[ML Webhook] Pedido ${order.id} criado como rascunho`);
    }

    // Atualizar log
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

    // Atualizar transação associada se existir
    if (payment.order_id) {
      // Só atualiza status se for "approved" e ainda estiver pendente
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
