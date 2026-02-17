/**
 * NFe Status Edge Function V2
 * Retorna estado da sincronização incluindo first_success_at, manifest_queue stats
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token invalido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const empresaId = url.searchParams.get("empresa_id");

    if (!empresaId) {
      return new Response(JSON.stringify({ error: "empresa_id obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: userEmpresa } = await supabase
      .from("user_empresas")
      .select("id")
      .eq("user_id", claims.claims.sub)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!userEmpresa) {
      return new Response(JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar estado
    const { data: syncState } = await supabase
      .from("nfe_sync_state")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // Logs
    const { data: logs } = await supabase
      .from("nfe_sync_logs")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Certificado
    const { data: certificate } = await supabase
      .from("nfe_certificates")
      .select("id, cnpj, is_active, ambiente, uf, created_at, updated_at")
      .eq("empresa_id", empresaId)
      .eq("is_active", true)
      .maybeSingle();

    // Stats
    const { count: documentsCount } = await supabase
      .from("nfe_documents")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    const { count: creditsCount } = await supabase
      .from("creditos_icms")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("origin", "nfe_sync");

    // Manifest queue stats
    const { count: manifestPending } = await supabase
      .from("nfe_manifest_queue")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .in("status", ["pending", "error"]);

    const { count: manifestSuccess } = await supabase
      .from("nfe_manifest_queue")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("status", "success");

    // Recent documents
    const { data: recentDocuments } = await supabase
      .from("nfe_documents")
      .select("access_key, nsu, schema_type, issue_date, total_value, processed, direction, xml_status, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Determine sync mode (V2: based on first_success_at)
    const syncMode = syncState?.first_success_at ? "continuous" : "awaiting_first_sync";

    const response = {
      has_certificate: !!certificate,
      certificate: certificate ? {
        cnpj: certificate.cnpj,
        ambiente: certificate.ambiente,
        uf: certificate.uf,
        updated_at: certificate.updated_at,
      } : null,
      sync_state: syncState || {
        status: "idle",
        ult_nsu: 0,
        max_nsu: 0,
        last_sync_at: null,
        documents_fetched: 0,
        credits_created: 0,
        first_success_at: null,
        last_success_at: null,
        sync_enabled: false,
        bootstrap_completed_at: null,
        sync_mode: "bootstrap",
      },
      sync_mode: syncMode,
      stats: {
        total_documents: documentsCount || 0,
        total_credits_from_sync: creditsCount || 0,
        manifest_pending: manifestPending || 0,
        manifest_success: manifestSuccess || 0,
      },
      recent_documents: recentDocuments || [],
      logs: logs || [],
    };

    return new Response(JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Erro:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
