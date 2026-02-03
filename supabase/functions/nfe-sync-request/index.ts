/**
 * NFe Sync Request Edge Function
 * Endpoint para disparar sincronizacao manual ou atualizar estado
 * Pode ser chamado pela UI ou pelo cron
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
    const { data: certificate } = await supabase
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

    // Usar service role para operacoes de escrita no sync_state
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    if (action === "start") {
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
      }

      // Criar ou atualizar estado para running
      const newState = {
        empresa_id: payload.empresa_id,
        status: "running",
        last_error: null,
        updated_at: new Date().toISOString(),
      };

      const { error: stateError } = await supabaseAdmin
        .from("nfe_sync_state")
        .upsert(newState, { onConflict: "empresa_id" });

      if (stateError) {
        console.error("Erro ao atualizar estado:", stateError);
        throw stateError;
      }

      // Registrar log
      await supabaseAdmin.from("nfe_sync_logs").insert({
        empresa_id: payload.empresa_id,
        level: "info",
        message: "Sincronizacao iniciada pelo usuario",
        meta: { user_id: userId },
      });

      // NOTA: O worker externo sera chamado via webhook ou polling
      // Aqui apenas marcamos como 'running' e retornamos
      // Em producao, voce chamaria o worker via HTTP

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Sincronizacao iniciada",
          status: "running"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_state") {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (payload.ult_nsu !== undefined) updates.ult_nsu = payload.ult_nsu;
      if (payload.max_nsu !== undefined) updates.max_nsu = payload.max_nsu;
      if (payload.documents_fetched !== undefined) updates.documents_fetched = payload.documents_fetched;
      if (payload.credits_created !== undefined) updates.credits_created = payload.credits_created;

      const { error } = await supabaseAdmin
        .from("nfe_sync_state")
        .update(updates)
        .eq("empresa_id", payload.empresa_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "complete") {
      await supabaseAdmin
        .from("nfe_sync_state")
        .update({
          status: "idle",
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", payload.empresa_id);

      await supabaseAdmin.from("nfe_sync_logs").insert({
        empresa_id: payload.empresa_id,
        level: "info",
        message: "Sincronizacao concluida com sucesso",
      });

      return new Response(
        JSON.stringify({ success: true, status: "idle" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "error") {
      await supabaseAdmin
        .from("nfe_sync_state")
        .update({
          status: "error",
          last_error: payload.error_message || "Erro desconhecido",
          updated_at: new Date().toISOString(),
        })
        .eq("empresa_id", payload.empresa_id);

      await supabaseAdmin.from("nfe_sync_logs").insert({
        empresa_id: payload.empresa_id,
        level: "error",
        message: payload.error_message || "Erro durante sincronizacao",
      });

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
