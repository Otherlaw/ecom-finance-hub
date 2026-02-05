 /**
  * NFe Sync Cron Edge Function
  * Executado automaticamente via pg_cron para auto-resume de sincronização NF-e.
  * 
  * CORRIGIDO: Não marca mais "running" diretamente.
  * Agora chama o worker diretamente após validar condições.
  * 
  * Frequência recomendada: a cada 30-60 minutos
  * 
  * Condições para auto-resume:
  * - Status não é running/queued
  * - next_retry_at é null ou já passou (cooldown expirado)
  * - last_sync_at > 4h OU (ult_nsu < max_nsu) indicando backlog pendente
  * - last_sefaz_request_at não é muito recente (< 3 min)
  */
 
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 const MIN_HOURS_SINCE_LAST_SYNC = 4;
 const MIN_MINUTES_SINCE_LAST_SEFAZ_REQUEST = 3;
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   const startTime = Date.now();
   console.log("[nfe-sync-cron] Iniciando verificação de auto-resume...");
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const workerUrl = Deno.env.get("NFE_WORKER_URL");
     
     const supabase = createClient(supabaseUrl, serviceKey);
 
     if (!workerUrl) {
       console.log("[nfe-sync-cron] NFE_WORKER_URL não configurado");
       return new Response(
         JSON.stringify({ success: false, error: "NFE_WORKER_URL não configurado" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
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
       const empresaNome = (cert.empresas as unknown as { razao_social?: string })?.razao_social || empresaId;
 
       console.log(`[nfe-sync-cron] Avaliando: ${empresaNome}`);
 
       try {
         const { data: syncState } = await supabase
           .from("nfe_sync_state")
           .select("*")
           .eq("empresa_id", empresaId)
           .maybeSingle();
 
         const now = new Date();
 
         // COND 1: Não running/queued (ou expirado > 30min)
         if (syncState?.status === "running" || syncState?.status === "queued") {
           const lastUpdate = new Date(syncState.updated_at);
           const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;
           
           if (diffMinutes < 30) {
             results.push({ empresa_id: empresaId, status: "skipped", reason: "sync_running", message: `Em andamento há ${Math.round(diffMinutes)} min` });
             continue;
           }
           console.log(`[nfe-sync-cron] ${empresaNome}: Travada há ${Math.round(diffMinutes)} min, tentando reiniciar`);
         }
 
         // COND 2: Cooldown expirado
         if (syncState?.next_retry_at) {
           const nextRetry = new Date(syncState.next_retry_at);
           if (now < nextRetry) {
             const minutesLeft = Math.round((nextRetry.getTime() - now.getTime()) / 60000);
             results.push({ empresa_id: empresaId, status: "skipped", reason: "cooldown", message: `${minutesLeft} min restantes` });
             continue;
           }
         }
 
         // COND 3: Último request SEFAZ não muito recente
         if (syncState?.last_sefaz_request_at) {
           const lastRequest = new Date(syncState.last_sefaz_request_at);
           const minutesSince = (now.getTime() - lastRequest.getTime()) / 60000;
           
           if (minutesSince < MIN_MINUTES_SINCE_LAST_SEFAZ_REQUEST) {
             results.push({ empresa_id: empresaId, status: "skipped", reason: "recent_request", message: `Último request há ${Math.round(minutesSince)} min` });
             continue;
           }
         }
 
         // COND 4: Precisa de sync (backlog ou tempo)
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
             results.push({ empresa_id: empresaId, status: "skipped", reason: "recent_sync", message: `Sync há ${hoursSince.toFixed(1)}h` });
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
 
         // DISPARAR SYNC
         console.log(`[nfe-sync-cron] ${empresaNome}: Iniciando (${syncReason})`);
 
         await supabase.from("nfe_sync_state").upsert({
           empresa_id: empresaId,
           status: "queued",
           last_error: null,
           updated_at: now.toISOString(),
         }, { onConflict: "empresa_id" });
 
         await supabase.from("nfe_sync_logs").insert({
           empresa_id: empresaId,
           level: "info",
           message: `Auto-resume iniciado (${syncReason})`,
           meta: { trigger: "cron", reason: syncReason, backlog: hasBacklog },
         });
 
         try {
           const workerResponse = await fetch(workerUrl, {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ empresa_id: empresaId, sync_id: crypto.randomUUID(), trigger: "cron" }),
           });
 
           if (workerResponse.ok) {
             results.push({ empresa_id: empresaId, status: "started", reason: syncReason });
           } else {
             const errorBody = await workerResponse.text().catch(() => "");
             await supabase.from("nfe_sync_state").update({
               status: "error",
               last_error: `Cron: Worker ${workerResponse.status}`,
               updated_at: now.toISOString(),
             }).eq("empresa_id", empresaId);
             results.push({ empresa_id: empresaId, status: "error", message: `Worker ${workerResponse.status}: ${errorBody.slice(0, 100)}` });
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
 
     console.log(`[nfe-sync-cron] ${duration}ms - Iniciadas: ${started}, Puladas: ${skipped}, Erros: ${errors}`);
 
     return new Response(
       JSON.stringify({ success: true, duration_ms: duration, empresas_processadas: certificates.length, iniciadas: started, puladas: skipped, erros: errors, detalhes: results }),
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
