/**
 * NFe Sync Request Edge Function
 * Endpoint para disparar sincronizacao manual ou atualizar estado
 * Agora chama o worker externo via HTTP
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequestPayload {
  empresa_id: string;
  action?: "start" | "update_state" | "complete" | "error";
  // Campos para update_state
  ult_nsu?: number;
  max_nsu?: number;
  documents_fetched?: number;
  credits_created?: number;
  error_message?: string;
}

// Helper para registrar log
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logSync(
  supabase: any,
  empresaId: string,
  level: "info" | "warn" | "error" | "debug",
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    await supabase.from("nfe_sync_logs").insert({
      empresa_id: empresaId,
      level,
      message,
      meta: meta || null,
    });
  } catch (e) {
    console.error("Erro ao registrar log:", e);
  }
}

// Helper para atualizar estado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateState(
  supabase: any,
  empresaId: string,
  updates: Record<string, unknown>
) {
  const { error } = await supabase
    .from("nfe_sync_state")
    .upsert(
      {
        empresa_id: empresaId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" }
    );
  if (error) console.error("Erro ao atualizar estado:", error);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Autenticar usuario via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Token invalido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;
    console.log(`Sync request de usuario: ${userId}`);

    // Parse payload
    const payload: SyncRequestPayload = await req.json();
    const action = payload.action || "start";

    if (!payload.empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Usar service role para operacoes de escrita
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verificar se usuario tem acesso a empresa
    const { data: userEmpresa, error: accessError } = await supabase
      .from("user_empresas")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", payload.empresa_id)
      .maybeSingle();

    if (accessError || !userEmpresa) {
      return new Response(
        JSON.stringify({ error: "Acesso negado a esta empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se empresa tem certificado cadastrado
    const { data: certificate } = await supabaseAdmin
      .from("nfe_certificates")
      .select("id, is_active, ambiente")
      .eq("empresa_id", payload.empresa_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!certificate && action === "start") {
      return new Response(
        JSON.stringify({ 
          error: "Nenhum certificado A1 ativo encontrado para esta empresa",
          code: "NO_CERTIFICATE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "start") {
      // Verificar se worker URL esta configurado
      const workerUrl = Deno.env.get("NFE_WORKER_URL");
      if (!workerUrl) {
        const errorMsg = "Worker nao configurado. Configure a variavel NFE_WORKER_URL.";
        await updateState(supabaseAdmin, payload.empresa_id, {
          status: "error",
          last_error: errorMsg,
        });
        await logSync(supabaseAdmin, payload.empresa_id, "error", errorMsg);
        
        return new Response(
          JSON.stringify({ 
            error: errorMsg,
            code: "WORKER_NOT_CONFIGURED"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se ja existe sync em andamento
      const { data: currentState } = await supabaseAdmin
        .from("nfe_sync_state")
        .select("*")
        .eq("empresa_id", payload.empresa_id)
        .maybeSingle();

      if (currentState?.status === "running") {
        // Verificar timeout (30 min)
        const lastUpdate = new Date(currentState.updated_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;

        if (diffMinutes < 30) {
          return new Response(
            JSON.stringify({ 
              error: "Sincronizacao ja em andamento",
              state: currentState
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Se passou de 30 min, consideramos timeout e reiniciamos
        await logSync(supabaseAdmin, payload.empresa_id, "warn", "Sync anterior expirou (timeout 30min), reiniciando");
      }

      // Atualizar estado para running
      await updateState(supabaseAdmin, payload.empresa_id, {
        status: "running",
        last_error: null,
      });

      await logSync(supabaseAdmin, payload.empresa_id, "info", "Sincronizacao iniciada pelo usuario", { user_id: userId });

      // Chamar o worker externo
      await logSync(supabaseAdmin, payload.empresa_id, "info", `Chamando worker externo: ${workerUrl}`);

      try {
        const workerResponse = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            empresa_id: payload.empresa_id,
          }),
        });

        const workerData = await workerResponse.json().catch(() => ({}));

        if (!workerResponse.ok) {
          const errorMsg = workerData.error || `Worker retornou status ${workerResponse.status}`;
          await updateState(supabaseAdmin, payload.empresa_id, {
            status: "error",
            last_error: errorMsg,
          });
          await logSync(supabaseAdmin, payload.empresa_id, "error", `Erro do worker: ${errorMsg}`, { 
            status: workerResponse.status,
            response: workerData 
          });

          return new Response(
            JSON.stringify({ 
              error: errorMsg,
              code: "WORKER_ERROR"
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logSync(supabaseAdmin, payload.empresa_id, "info", "Worker respondeu com sucesso", { 
          response: workerData 
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Sincronizacao iniciada",
            status: "running",
            worker_response: workerData
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchError: unknown) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : "Erro ao conectar ao worker";
        await updateState(supabaseAdmin, payload.empresa_id, {
          status: "error",
          last_error: `Falha ao conectar ao worker: ${errorMsg}`,
        });
        await logSync(supabaseAdmin, payload.empresa_id, "error", `Falha ao conectar ao worker: ${errorMsg}`);

        return new Response(
          JSON.stringify({ 
            error: `Falha ao conectar ao worker: ${errorMsg}`,
            code: "WORKER_CONNECTION_ERROR"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "update_state") {
      const updates: Record<string, unknown> = {};

      if (payload.ult_nsu !== undefined) updates.ult_nsu = payload.ult_nsu;
      if (payload.max_nsu !== undefined) updates.max_nsu = payload.max_nsu;
      if (payload.documents_fetched !== undefined) updates.documents_fetched = payload.documents_fetched;
      if (payload.credits_created !== undefined) updates.credits_created = payload.credits_created;

      await updateState(supabaseAdmin, payload.empresa_id, updates);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "complete") {
      await updateState(supabaseAdmin, payload.empresa_id, {
        status: "idle",
        last_sync_at: new Date().toISOString(),
        last_error: null,
      });

      await logSync(supabaseAdmin, payload.empresa_id, "info", "Sincronizacao concluida com sucesso");

      return new Response(
        JSON.stringify({ success: true, status: "idle" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "error") {
      await updateState(supabaseAdmin, payload.empresa_id, {
        status: "error",
        last_error: payload.error_message || "Erro desconhecido",
      });

      await logSync(supabaseAdmin, payload.empresa_id, "error", payload.error_message || "Erro durante sincronizacao");

      return new Response(
        JSON.stringify({ success: true, status: "error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Acao invalida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro no sync request:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
