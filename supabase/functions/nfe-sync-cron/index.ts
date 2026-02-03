/**
 * NFe Sync Cron Edge Function
 * Executado automaticamente via pg_cron para sincronizar NF-e
 * de todas as empresas com certificado ativo.
 * 
 * Frequência padrão: a cada 6 horas
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmpresaWithCert {
  empresa_id: string;
  empresa_nome: string;
  ambiente: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[nfe-sync-cron] Iniciando sincronização automática...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar todas as empresas com certificado ativo
    const { data: certificates, error: certError } = await supabase
      .from("nfe_certificates")
      .select(`
        empresa_id,
        ambiente,
        empresas:empresa_id (
          razao_social
        )
      `)
      .eq("is_active", true);

    if (certError) {
      console.error("[nfe-sync-cron] Erro ao buscar certificados:", certError);
      throw certError;
    }

    if (!certificates || certificates.length === 0) {
      console.log("[nfe-sync-cron] Nenhuma empresa com certificado ativo encontrada");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma empresa para sincronizar",
          empresas_processadas: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[nfe-sync-cron] Encontradas ${certificates.length} empresas com certificado ativo`);

    const results: { empresa_id: string; status: string; message?: string }[] = [];

    for (const cert of certificates) {
      const empresaId = cert.empresa_id;
      const empresaNome = (cert.empresas as any)?.razao_social || empresaId;

      console.log(`[nfe-sync-cron] Processando empresa: ${empresaNome}`);

      try {
        // Verificar se já existe sync em andamento
        const { data: currentState } = await supabase
          .from("nfe_sync_state")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle();

        if (currentState?.status === "running") {
          // Verificar timeout (30 min)
          const lastUpdate = new Date(currentState.updated_at);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 60000;

          if (diffMinutes < 30) {
            console.log(`[nfe-sync-cron] ${empresaNome}: Sync já em andamento, pulando`);
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              message: "Sincronização já em andamento" 
            });
            continue;
          } else {
            // Timeout - resetar estado
            console.log(`[nfe-sync-cron] ${empresaNome}: Sync travado, resetando estado`);
            await supabase
              .from("nfe_sync_state")
              .update({
                status: "error",
                last_error: "Timeout detectado pelo cron - sincronização reiniciada",
                updated_at: new Date().toISOString(),
              })
              .eq("empresa_id", empresaId);
          }
        }

        // Verificar última sincronização (evitar sync muito frequente)
        if (currentState?.last_sync_at) {
          const lastSync = new Date(currentState.last_sync_at);
          const now = new Date();
          const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / 3600000;

          // Sincronizar somente se passou mais de 4 horas desde última sync
          if (hoursSinceLastSync < 4) {
            console.log(`[nfe-sync-cron] ${empresaNome}: Sincronizado há menos de 4h, pulando`);
            results.push({ 
              empresa_id: empresaId, 
              status: "skipped", 
              message: `Última sync há ${hoursSinceLastSync.toFixed(1)}h` 
            });
            continue;
          }
        }

        // Iniciar sincronização - marcar como running
        const newState = {
          empresa_id: empresaId,
          status: "running",
          last_error: null,
          updated_at: new Date().toISOString(),
        };

        const { error: stateError } = await supabase
          .from("nfe_sync_state")
          .upsert(newState, { onConflict: "empresa_id" });

        if (stateError) {
          console.error(`[nfe-sync-cron] ${empresaNome}: Erro ao atualizar estado:`, stateError);
          results.push({ 
            empresa_id: empresaId, 
            status: "error", 
            message: stateError.message 
          });
          continue;
        }

        // Registrar log de início
        await supabase.from("nfe_sync_logs").insert({
          empresa_id: empresaId,
          level: "info",
          message: "Sincronização automática iniciada (cron)",
          meta: { trigger: "cron", ambiente: cert.ambiente },
        });

        results.push({ 
          empresa_id: empresaId, 
          status: "started", 
          message: "Sincronização iniciada" 
        });

        console.log(`[nfe-sync-cron] ${empresaNome}: Sync iniciada com sucesso`);

        // NOTA: O worker externo detectará o estado "running" via polling
        // e processará a sincronização real com SEFAZ

      } catch (empresaError) {
        const message = empresaError instanceof Error ? empresaError.message : "Erro desconhecido";
        console.error(`[nfe-sync-cron] ${empresaNome}: Erro:`, message);
        results.push({ 
          empresa_id: empresaId, 
          status: "error", 
          message 
        });
      }
    }

    const duration = Date.now() - startTime;
    const started = results.filter(r => r.status === "started").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    console.log(`[nfe-sync-cron] Concluído em ${duration}ms - Iniciadas: ${started}, Puladas: ${skipped}, Erros: ${errors}`);

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
      JSON.stringify({ 
        success: false, 
        error: message,
        duration_ms: duration
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
