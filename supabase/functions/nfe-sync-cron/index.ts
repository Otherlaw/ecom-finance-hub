/**
 * NFe Sync Cron Edge Function
 * Executado automaticamente via pg_cron 1x por dia às 00:00 BRT (03:00 UTC).
 * 
 * MODO AUTOMÁTICO: Sem interação do usuário, roda em background.
 * 
 * Regras:
 * - 1 sync por empresa por execução (máx 1x/dia)
 * - Sem retry no mesmo dia — se der erro, próximo ciclo é amanhã 00:00
 * - Respeita cooldown (next_retry_at) e lock de concorrência
 * - Bootstrap (30d) para empresas novas, daily (24h) para recorrentes
 * 
 * SEGURANÇA: Chama worker com x-worker-sync-token
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sync diário: mínimo 24h entre execuções
const MIN_HOURS_SINCE_LAST_SYNC = 24;
const RUNNING_TIMEOUT_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[nfe-sync-cron] ========================================");
  console.log("[nfe-sync-cron] Execução diária de sync NF-e (00:00 BRT)");
  console.log("[nfe-sync-cron] ========================================");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const workerBaseUrl = Deno.env.get("NFE_WORKER_BASE_URL") || Deno.env.get("NFE_WORKER_URL");
    const workerToken = Deno.env.get("WORKER_INGEST_TOKEN");
    
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!workerBaseUrl) {
      console.log("[nfe-sync-cron] NFE_WORKER_BASE_URL não configurado");
      return new Response(
        JSON.stringify({ success: false, error: "NFE_WORKER_BASE_URL não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workerToken) {
      console.log("[nfe-sync-cron] WORKER_INGEST_TOKEN não configurado");
      return new Response(
        JSON.stringify({ success: false, error: "WORKER_INGEST_TOKEN não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workerEndpoint = new URL("/sync", workerBaseUrl).toString();

    // Buscar empresas com certificado ativo
    const { data: certificates, error: certError } = await supabase
      .from("nfe_certificates")
      .select(`empresa_id, ambiente, empresas:empresa_id (razao_social)`)
      .eq("is_active", true);

    if (certError) {
      console.error("[nfe-sync-cron] Erro ao buscar certificados:", certError);
      throw certError;
    }

    if (!certificates || certificates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma empresa", empresas_processadas: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nfe-sync-cron] ${certificates.length} empresas com certificado ativo`);

    const results: { empresa_id: string; status: string; mode?: string; reason?: string; message?: string }[] = [];

    for (const cert of certificates) {
      const empresaId = cert.empresa_id;
      const empresaNome = (cert.empresas as unknown as { razao_social?: string })?.razao_social || empresaId.substring(0, 8);

      console.log(`[nfe-sync-cron] Avaliando: ${empresaNome}`);

      try {
        const { data: syncState } = await supabase
          .from("nfe_sync_state")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        const now = new Date();

        // CONDIÇÃO 1: Não running/queued (ou expirado > timeout)
        if (syncState?.status === "running" || syncState?.status === "queued") {
          const lastUpdate = new Date(syncState.updated_at);
          const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;
          
          if (diffMinutes < RUNNING_TIMEOUT_MINUTES) {
            results.push({ empresa_id: empresaId, status: "skipped", reason: "sync_running", message: `Em andamento há ${Math.round(diffMinutes)} min` });
            continue;
          }
          console.log(`[nfe-sync-cron] ${empresaNome}: Travada há ${Math.round(diffMinutes)} min, resetando`);
          await supabase.from("nfe_sync_state").update({
            status: "idle",
            last_error: `Timeout: sync travada por ${Math.round(diffMinutes)} min`,
            updated_at: now.toISOString(),
          }).eq("empresa_id", empresaId);
        }

        // CONDIÇÃO 2: Cooldown expirado (next_retry_at)
        if (syncState?.next_retry_at) {
          const nextRetry = new Date(syncState.next_retry_at);
          if (now < nextRetry) {
            const minutesLeft = Math.round((nextRetry.getTime() - now.getTime()) / 60000);
            results.push({ empresa_id: empresaId, status: "skipped", reason: "cooldown", message: `Cooldown: ${minutesLeft} min restantes` });
            continue;
          }
        }

        // CONDIÇÃO 3: Determinar modo e verificar intervalo
        const syncMode = syncState?.bootstrap_completed_at ? "daily" : "bootstrap";
        let needsSync = false;
        let syncReason = "";

        if (syncMode === "bootstrap") {
          // Bootstrap: sempre executar se não está running
          needsSync = true;
          syncReason = "bootstrap";
        } else if (syncState?.last_sync_at) {
          const lastSync = new Date(syncState.last_sync_at);
          const hoursSince = (now.getTime() - lastSync.getTime()) / 3600000;
          
          if (hoursSince >= MIN_HOURS_SINCE_LAST_SYNC) {
            needsSync = true;
            syncReason = `daily_${Math.round(hoursSince)}h`;
          } else {
            results.push({ empresa_id: empresaId, status: "skipped", mode: syncMode, reason: "recent_sync", message: `Última sync há ${hoursSince.toFixed(1)}h` });
            continue;
          }
        } else {
          needsSync = true;
          syncReason = "first_sync";
        }

        if (!needsSync) {
          results.push({ empresa_id: empresaId, status: "skipped", mode: syncMode, reason: "no_need" });
          continue;
        }

        // DISPARAR SYNC via Worker
        console.log(`[nfe-sync-cron] ${empresaNome}: Iniciando sync (${syncReason}, modo: ${syncMode})`);

        await supabase.from("nfe_sync_state").upsert({
          empresa_id: empresaId,
          status: "queued",
          last_error: null,
          updated_at: now.toISOString(),
        }, { onConflict: "empresa_id" });

        await supabase.from("nfe_sync_logs").insert({
          empresa_id: empresaId,
          level: "info",
          message: `Auto-sync diário iniciado (${syncReason}, modo: ${syncMode})`,
          meta: { trigger: "cron", reason: syncReason, mode: syncMode },
        });

        try {
          const workerResponse = await fetch(workerEndpoint, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-worker-sync-token": workerToken,
            },
            body: JSON.stringify({ 
              empresa_id: empresaId, 
              sync_id: crypto.randomUUID(), 
              trigger: "cron" 
            }),
          });

          if (workerResponse.ok) {
            results.push({ empresa_id: empresaId, status: "started", mode: syncMode, reason: syncReason });
          } else {
            const errorBody = await workerResponse.text().catch(() => "");
            console.error(`[nfe-sync-cron] Worker error ${workerResponse.status}: ${errorBody.slice(0, 200)}`);
            
            await supabase.from("nfe_sync_state").update({
              status: "error",
              last_error: `Cron: Worker ${workerResponse.status}`,
              updated_at: now.toISOString(),
            }).eq("empresa_id", empresaId);
            
            results.push({ empresa_id: empresaId, status: "error", message: `Worker ${workerResponse.status}` });
          }
        } catch (fetchError) {
          const errorMsg = fetchError instanceof Error ? fetchError.message : "Erro conexão";
          await supabase.from("nfe_sync_state").update({
            status: "error",
            last_error: `Cron: ${errorMsg}`,
            updated_at: now.toISOString(),
          }).eq("empresa_id", empresaId);
          
          results.push({ empresa_id: empresaId, status: "error", message: errorMsg });
        }

        // Delay entre empresas
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (empresaError) {
        const message = empresaError instanceof Error ? empresaError.message : "Erro";
        results.push({ empresa_id: empresaId, status: "error", message });
      }
    }

    const duration = Date.now() - startTime;
    const started = results.filter(r => r.status === "started").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    console.log(`[nfe-sync-cron] Concluído em ${duration}ms | Iniciadas: ${started}, Puladas: ${skipped}, Erros: ${errors}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        duration_ms: duration, 
        empresas_processadas: certificates.length, 
        iniciadas: started, puladas: skipped, erros: errors, 
        detalhes: results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: message, duration_ms: duration }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
