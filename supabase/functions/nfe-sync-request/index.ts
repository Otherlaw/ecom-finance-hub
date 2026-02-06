/**
 * NFe Sync Request Edge Function
 * Endpoint para disparar sincronizacao manual ou atualizar estado
 * Agora chama o worker externo via HTTP
 * 
 * Actions disponiveis:
 * - start: inicia sincronizacao (chama worker)
 * - reset: forca status=idle (destravar sync travada)
 * - get_status: retorna estado + ultimos logs
 * - update_state: atualiza campos de progresso
 * - complete: finaliza sync com sucesso
 * - error: registra erro
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequestPayload {
  empresa_id: string;
  action?: "start" | "reset" | "get_status" | "update_state" | "complete" | "error";
  // Campos para update_state
  ult_nsu?: number;
  max_nsu?: number;
  documents_fetched?: number;
  credits_created?: number;
  error_message?: string;
  next_retry_at?: string;
}

type SyncStatus = "idle" | "queued" | "running" | "error" | "completed" | "rate_limited";

/**
 * Regra de concorrência do START.
 * - Bloqueia se status estiver running/queued e updated_at for recente.
 * - Usa janela de 30 minutos (compatível com lock do worker).
 */
export function shouldBlockConcurrentStart(currentState: { status?: string | null; updated_at?: string } | null): {
  blocked: boolean;
  diffMinutes?: number;
  reason?: "SYNC_RUNNING";
} {
  if (!currentState?.status || !currentState.updated_at) return { blocked: false };

  const status = currentState.status as string;
  if (status !== "running" && status !== "queued") return { blocked: false };

  const lastUpdate = new Date(currentState.updated_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;

  if (diffMinutes < 30) {
    return { blocked: true, diffMinutes, reason: "SYNC_RUNNING" };
  }

  return { blocked: false, diffMinutes };
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
  const { error, data } = await supabase
    .from("nfe_sync_state")
    .upsert(
      {
        empresa_id: empresaId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "empresa_id" }
    )
    .select()
    .single();
  if (error) console.error("Erro ao atualizar estado:", error);
  return data;
}

// Helper para buscar estado atual com logs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFullStatus(supabase: any, empresaId: string, logsLimit = 30) {
  // Buscar estado
  const { data: syncState } = await supabase
    .from("nfe_sync_state")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  // Buscar ultimos logs
  const { data: logs } = await supabase
    .from("nfe_sync_logs")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(logsLimit);

  // Buscar certificado
  const { data: certificate } = await supabase
    .from("nfe_certificates")
    .select("cnpj, ambiente, uf, updated_at")
    .eq("empresa_id", empresaId)
    .eq("is_active", true)
    .maybeSingle();

  // Stats
  const { count: totalDocuments } = await supabase
    .from("nfe_documents")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { count: totalCredits } = await supabase
    .from("creditos_icms")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    // origem correta do ingest
    .eq("origin", "nfe_sync");

  return {
    sync_state: syncState || {
      status: "idle",
      ult_nsu: 0,
      max_nsu: 0,
      last_sync_at: null,
      last_error: null,
      documents_fetched: 0,
      credits_created: 0,
      next_retry_at: null,
    },
    logs: logs || [],
    has_certificate: !!certificate,
    certificate,
    stats: {
      total_documents: totalDocuments || 0,
      total_credits_from_sync: totalCredits || 0,
    },
  };
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

    // ========================================
    // ACTION: GET_STATUS - Retorna estado completo
    // ========================================
    if (action === "get_status") {
      const fullStatus = await getFullStatus(supabaseAdmin, payload.empresa_id);
      
      return new Response(
        JSON.stringify(fullStatus),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: RESET - Forca status=idle para destravar
    // ========================================
    if (action === "reset") {
     // Buscar estado atual para preservar next_retry_at
     const { data: currentState } = await supabaseAdmin
       .from("nfe_sync_state")
       .select("next_retry_at, rate_limit_count, last_rate_limit_at, last_sefaz_request_at")
       .eq("empresa_id", payload.empresa_id)
       .maybeSingle();
 
     // Reset NÃO limpa campos de rate limit - apenas destrava execução
      const updatedState = await updateState(supabaseAdmin, payload.empresa_id, {
        status: "idle",
       last_error: null
       // NÃO mexer em: next_retry_at, last_rate_limit_at, rate_limit_count, last_sefaz_request_at
      });

     const hasActiveCooldown = currentState?.next_retry_at && new Date(currentState.next_retry_at) > new Date();
 
     await logSync(supabaseAdmin, payload.empresa_id, "warn", 
       hasActiveCooldown 
         ? "Sincronizacao resetada (cooldown de rate limit preservado)"
         : "Sincronizacao resetada manualmente pelo usuario", 
       {
        user_id: userId,
       next_retry_at_preserved: currentState?.next_retry_at || null,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
         message: hasActiveCooldown 
           ? "Sincronizacao resetada, mas cooldown de rate limit continua ativo" 
           : "Sincronizacao resetada",
          status: "idle",
          state: updatedState,
         next_retry_at: currentState?.next_retry_at || null,
         cooldown_active: hasActiveCooldown,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se empresa tem certificado cadastrado (para actions que precisam)
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

    // ========================================
    // ACTION: START - Iniciar sincronizacao
    // ========================================
    if (action === "start") {
      // PADRONIZADO: usar BASE_URL sem path, construir endpoint com new URL()
      const workerBaseUrl = Deno.env.get("NFE_WORKER_BASE_URL") || Deno.env.get("NFE_WORKER_URL");
      if (!workerBaseUrl) {
        const errorMsg = "Worker nao configurado. Configure a variavel NFE_WORKER_BASE_URL.";
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

      // Construir endpoint de forma segura (nunca duplica /sync/sync)
      const workerEndpoint = new URL("/sync", workerBaseUrl).toString();
      console.log(`[nfe-sync-request] Worker endpoint construído: ${workerEndpoint}`);

      // Verificar estado atual para bloqueio de concorrencia
      const { data: currentState } = await supabaseAdmin
        .from("nfe_sync_state")
        .select("*")
        .eq("empresa_id", payload.empresa_id)
        .maybeSingle();

      // ========================================
      // BLOQUEIO FORTE: Verificar next_retry_at (cooldown) ANTES de qualquer mudança de status
      // ========================================
      if (currentState?.next_retry_at) {
        const nextRetry = new Date(currentState.next_retry_at);
        const now = new Date();

        if (now < nextRetry) {
          await logSync(
            supabaseAdmin,
            payload.empresa_id,
            "warn",
            `Start bloqueado por cooldown até ${currentState.next_retry_at}`,
            {
              next_retry_at: currentState.next_retry_at,
              status: currentState.status,
            }
          );

          return new Response(
            JSON.stringify({
              success: false,
              code: "RATE_LIMITED",
              next_retry_at: currentState.next_retry_at,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // BLOQUEIO: Verificar se ja existe sync em andamento
      const concurrency = shouldBlockConcurrentStart(currentState);
      if (concurrency.blocked) {
        const diff = Math.round(concurrency.diffMinutes || 0);
        await logSync(
          supabaseAdmin,
          payload.empresa_id,
          "warn",
          `Sincronizacao ja em andamento (status=${currentState?.status}, iniciada ha ${diff} minutos)`
        );

        return new Response(
          JSON.stringify({
            error: `Sincronizacao ja em andamento (status=${currentState?.status}, iniciada ha ${diff} minutos)`,
            code: "SYNC_RUNNING",
            state: currentState,
            started_at: currentState?.updated_at,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se estava running/queued mas expirou (>=30min), liberamos para reiniciar
      if (currentState?.status === "running" || currentState?.status === "queued") {
        const diff = Math.round(concurrency.diffMinutes || 0);
        if (diff >= 30) {
          await logSync(
            supabaseAdmin,
            payload.empresa_id,
            "warn",
            `Sync anterior expirou (status=${currentState.status}, sem updates por ${diff} min), reiniciando`
          );
        }
      }

      // Gerar sync_id para rastreabilidade
      const syncId = crypto.randomUUID();
      const startedAt = new Date().toISOString();

      // Atualizar estado para queued.
      // IMPORTANTE: NÃO limpar next_retry_at aqui. Cooldown é controlado exclusivamente pelo worker.
      // O worker é quem transiciona queued -> running após passar no lock real.
      const updatedState = await updateState(supabaseAdmin, payload.empresa_id, {
        status: "queued" as SyncStatus,
        last_error: null,
      });

      await logSync(supabaseAdmin, payload.empresa_id, "info", "Sincronizacao iniciada pelo usuario", { 
        user_id: userId,
        sync_id: syncId,
        started_at: startedAt,
      });

      // Chamar o worker externo
      await logSync(supabaseAdmin, payload.empresa_id, "info", `Chamando worker externo: ${workerEndpoint}`, {
        sync_id: syncId,
        base_url: workerBaseUrl,
      });

       // Obter token de autenticação do worker
       const workerToken = Deno.env.get("WORKER_INGEST_TOKEN");
       if (!workerToken) {
         const errorMsg = "WORKER_INGEST_TOKEN não configurado";
         await updateState(supabaseAdmin, payload.empresa_id, {
           status: "error",
           last_error: errorMsg,
         });
         await logSync(supabaseAdmin, payload.empresa_id, "error", errorMsg);
         
         return new Response(
           JSON.stringify({ error: errorMsg, code: "TOKEN_NOT_CONFIGURED" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
      try {
         const workerResponse = await fetch(workerEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
             "x-worker-sync-token": workerToken,
          },
          body: JSON.stringify({
            empresa_id: payload.empresa_id,
            sync_id: syncId,
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
            response: workerData,
            sync_id: syncId,
          });

          return new Response(
            JSON.stringify({ 
              error: errorMsg,
              code: "WORKER_ERROR"
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logSync(supabaseAdmin, payload.empresa_id, "info", "Worker respondeu com sucesso (sync em background)", { 
          response: workerData,
          sync_id: syncId,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Sincronizacao iniciada em background",
            status: "queued",
            sync_id: syncId,
            started_at: startedAt,
            state: updatedState,
            worker_response: workerData,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchError: unknown) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : "Erro ao conectar ao worker";
        await updateState(supabaseAdmin, payload.empresa_id, {
          status: "error",
          last_error: `Falha ao conectar ao worker: ${errorMsg}`,
        });
        await logSync(supabaseAdmin, payload.empresa_id, "error", `Falha ao conectar ao worker: ${errorMsg}`, {
          sync_id: syncId,
        });

        return new Response(
          JSON.stringify({ 
            error: `Falha ao conectar ao worker: ${errorMsg}`,
            code: "WORKER_CONNECTION_ERROR"
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========================================
    // ACTION: UPDATE_STATE - Atualiza progresso
    // ========================================
    if (action === "update_state") {
      const updates: Record<string, unknown> = {};

      if (payload.ult_nsu !== undefined) updates.ult_nsu = payload.ult_nsu;
      if (payload.max_nsu !== undefined) updates.max_nsu = payload.max_nsu;
      if (payload.documents_fetched !== undefined) updates.documents_fetched = payload.documents_fetched;
      if (payload.credits_created !== undefined) updates.credits_created = payload.credits_created;
      if (payload.next_retry_at !== undefined) updates.next_retry_at = payload.next_retry_at;

      const updatedState = await updateState(supabaseAdmin, payload.empresa_id, updates);

      return new Response(
        JSON.stringify({ success: true, state: updatedState }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: COMPLETE - Finaliza com sucesso
    // ========================================
    if (action === "complete") {
      const updatedState = await updateState(supabaseAdmin, payload.empresa_id, {
        status: "idle",
        last_sync_at: new Date().toISOString(),
        last_error: null,
        next_retry_at: null,
      });

      await logSync(supabaseAdmin, payload.empresa_id, "info", "Sincronizacao concluida com sucesso");

      return new Response(
        JSON.stringify({ success: true, status: "idle", state: updatedState }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // ACTION: ERROR - Registra erro
    // ========================================
    if (action === "error") {
      const updates: Record<string, unknown> = {
        status: "error",
        last_error: payload.error_message || "Erro desconhecido",
      };
      
      // Se tiver next_retry_at (rate limit), adicionar
      if (payload.next_retry_at) {
        updates.next_retry_at = payload.next_retry_at;
      }

      const updatedState = await updateState(supabaseAdmin, payload.empresa_id, updates);

      await logSync(supabaseAdmin, payload.empresa_id, "error", payload.error_message || "Erro durante sincronizacao", {
        next_retry_at: payload.next_retry_at,
      });

      return new Response(
        JSON.stringify({ success: true, status: "error", state: updatedState }),
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
