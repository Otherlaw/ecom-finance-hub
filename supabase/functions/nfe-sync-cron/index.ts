/**
 * NFe Sync Cron Edge Function
 * Executado automaticamente via pg_cron para auto-sync de NF-e estilo Arquivei/Qive.
 * 
 * MODO AUTOMÁTICO: Sem interação do usuário, roda em background.
 * 
 * Frequência recomendada: a cada 30-60 minutos
 * 
 * Condições para disparar sync:
 * - Status não é running/queued (ou expirado > 30min)
 * - next_retry_at é null ou já passou (cooldown expirado)
 * - last_sync_at > 1h OU (ult_nsu < max_nsu) indicando backlog pendente OU primeiro sync
 * - last_sefaz_request_at não é muito recente (< 5 min)
 * 
 * SEGURANÇA: Chama worker com x-worker-sync-token
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Intervalos de verificação
const MIN_HOURS_SINCE_LAST_SYNC = 1; // 1 hora (mais agressivo para modo automático)
const MIN_MINUTES_SINCE_LAST_SEFAZ_REQUEST = 5; // 5 minutos entre requests
const RUNNING_TIMEOUT_MINUTES = 30; // Timeout para considerar sync travada

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[nfe-sync-cron] ========================================");
  console.log("[nfe-sync-cron] Iniciando auto-sync NF-e (modo Arquivei)");
  console.log("[nfe-sync-cron] ========================================");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // PADRONIZADO: usar BASE_URL sem path, construir endpoint com new URL()
    const workerBaseUrl = Deno.env.get("NFE_WORKER_BASE_URL") || Deno.env.get("NFE_WORKER_URL");
    const workerToken = Deno.env.get("WORKER_INGEST_TOKEN");
    
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validar configurações
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

    // Construir endpoint de forma segura (nunca duplica /sync/sync)
    const workerEndpoint = new URL("/sync", workerBaseUrl).toString();
    console.log(`[nfe-sync-cron] Worker endpoint construído: ${workerEndpoint}`);

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
      console.log("[nfe-sync-cron] Nenhuma empresa com certificado ativo");
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma empresa", empresas_processadas: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nfe-sync-cron] ${certificates.length} empresas com certificado ativo`);

    const results: { empresa_id: string; status: string; reason?: string; message?: string }[] = [];

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

        // ========================================
        // CONDIÇÃO 1: Não running/queued (ou expirado > 30min timeout)
        // ========================================
        if (syncState?.status === "running" || syncState?.status === "queued") {
          const lastUpdate = new Date(syncState.updated_at);
          const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;
          
          if (diffMinutes < RUNNING_TIMEOUT_MINUTES) {
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              reason: "sync_running", 
              message: `Em andamento há ${Math.round(diffMinutes)} min` 
            });
            continue;
          }
          // Se passou do timeout, consideramos travada e tentamos reiniciar
          console.log(`[nfe-sync-cron] ${empresaNome}: Travada há ${Math.round(diffMinutes)} min, tentando reiniciar`);
          
          // Resetar status para permitir reinício
          await supabase.from("nfe_sync_state").update({
            status: "idle",
            last_error: `Timeout: sync travada por ${Math.round(diffMinutes)} min`,
            updated_at: now.toISOString(),
          }).eq("empresa_id", empresaId);
        }

        // ========================================
        // CONDIÇÃO 2: Cooldown expirado (next_retry_at)
        // ========================================
        if (syncState?.next_retry_at) {
          const nextRetry = new Date(syncState.next_retry_at);
          if (now < nextRetry) {
            const minutesLeft = Math.round((nextRetry.getTime() - now.getTime()) / 60000);
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              reason: "cooldown", 
              message: `Cooldown: ${minutesLeft} min restantes` 
            });
            continue;
          }
        }

        // ========================================
        // CONDIÇÃO 3: Último request SEFAZ não muito recente
        // ========================================
        if (syncState?.last_sefaz_request_at) {
          const lastRequest = new Date(syncState.last_sefaz_request_at);
          const minutesSince = (now.getTime() - lastRequest.getTime()) / 60000;
          
          if (minutesSince < MIN_MINUTES_SINCE_LAST_SEFAZ_REQUEST) {
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              reason: "recent_request", 
              message: `Último request há ${Math.round(minutesSince)} min` 
            });
            continue;
          }
        }

        // ========================================
        // CONDIÇÃO 4: Precisa de sync?
        // ========================================
        const hasBacklog = syncState && syncState.max_nsu > 0 && syncState.ult_nsu < syncState.max_nsu;
        let needsSync = hasBacklog;
        let syncReason = hasBacklog ? "backlog" : "";

        if (!needsSync && syncState?.last_sync_at) {
          const lastSync = new Date(syncState.last_sync_at);
          const hoursSince = (now.getTime() - lastSync.getTime()) / 3600000;
          
          if (hoursSince >= MIN_HOURS_SINCE_LAST_SYNC) {
            needsSync = true;
            syncReason = `scheduled_${Math.round(hoursSince)}h`;
          } else {
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              reason: "recent_sync", 
              message: `Última sync há ${hoursSince.toFixed(1)}h` 
            });
            continue;
          }
        } else if (!needsSync && !syncState?.last_sync_at) {
          needsSync = true;
          syncReason = "first_sync";
        }

        if (!needsSync) {
          results.push({ empresa_id: empresaId, status: "skipped", reason: "no_need" });
          continue;
        }

        // ========================================
        // DISPARAR SYNC via Worker (com autenticação)
        // ========================================
        console.log(`[nfe-sync-cron] ${empresaNome}: Iniciando sync (${syncReason})`);

        // Marcar como queued ANTES de chamar worker
        await supabase.from("nfe_sync_state").upsert({
          empresa_id: empresaId,
          status: "queued",
          last_error: null,
          updated_at: now.toISOString(),
        }, { onConflict: "empresa_id" });

        await supabase.from("nfe_sync_logs").insert({
          empresa_id: empresaId,
          level: "info",
          message: `Auto-sync iniciado (${syncReason})`,
          meta: { trigger: "cron", reason: syncReason, backlog: hasBacklog },
        });

        try {
          // Chamar worker com token de autenticação (usando endpoint construído)
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
            results.push({ empresa_id: empresaId, status: "started", reason: syncReason });
          } else {
            const errorBody = await workerResponse.text().catch(() => "");
            console.error(`[nfe-sync-cron] Worker error ${workerResponse.status}: ${errorBody.slice(0, 200)}`);
            
            await supabase.from("nfe_sync_state").update({
              status: "error",
              last_error: `Cron: Worker ${workerResponse.status}`,
              updated_at: now.toISOString(),
            }).eq("empresa_id", empresaId);
            
            results.push({ 
              empresa_id: empresaId, 
              status: "error", 
              message: `Worker ${workerResponse.status}: ${errorBody.slice(0, 100)}` 
            });
          }
        } catch (fetchError) {
          const errorMsg = fetchError instanceof Error ? fetchError.message : "Erro conexão";
          console.error(`[nfe-sync-cron] Fetch error: ${errorMsg}`);
          
          await supabase.from("nfe_sync_state").update({
            status: "error",
            last_error: `Cron: ${errorMsg}`,
            updated_at: now.toISOString(),
          }).eq("empresa_id", empresaId);
          
          results.push({ empresa_id: empresaId, status: "error", message: errorMsg });
        }

        // Delay entre empresas para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (empresaError) {
        const message = empresaError instanceof Error ? empresaError.message : "Erro";
        console.error(`[nfe-sync-cron] Erro empresa ${empresaId}: ${message}`);
        results.push({ empresa_id: empresaId, status: "error", message });
      }
    }

    const duration = Date.now() - startTime;
    const started = results.filter(r => r.status === "started").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    console.log("[nfe-sync-cron] ========================================");
    console.log(`[nfe-sync-cron] Concluído em ${duration}ms`);
    console.log(`[nfe-sync-cron] Iniciadas: ${started}, Puladas: ${skipped}, Erros: ${errors}`);
    console.log("[nfe-sync-cron] ========================================");

    return new Response(
      JSON.stringify({ 
        success: true, 
        duration_ms: duration, 
        empresas_processadas: certificates.length, 
        iniciadas: started, 
        puladas: skipped, 
        erros: errors, 
        detalhes: results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error("[nfe-sync-cron] Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    
    return new Response(
      JSON.stringify({ success: false, error: message, duration_ms: duration }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
