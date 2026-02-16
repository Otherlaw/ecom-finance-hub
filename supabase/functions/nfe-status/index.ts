/**
 * NFe Status Edge Function
 * Retorna estado da sincronizacao e ultimos logs para uma empresa
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Parse query params
    const url = new URL(req.url);
    const empresaId = url.searchParams.get("empresa_id");

    if (!empresaId) {
      return new Response(
        JSON.stringify({ error: "empresa_id obrigatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se usuario tem acesso a empresa (RLS cuida disso, mas verificamos explicitamente)
    const { data: userEmpresa } = await supabase
      .from("user_empresas")
      .select("id")
      .eq("user_id", claims.claims.sub)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!userEmpresa) {
      return new Response(
        JSON.stringify({ error: "Acesso negado a esta empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar estado de sincronizacao
    const { data: syncState } = await supabase
      .from("nfe_sync_state")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    // Buscar ultimos logs (20)
    const { data: logs } = await supabase
      .from("nfe_sync_logs")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Buscar certificado (sem dados sensiveis)
    const { data: certificate } = await supabase
      .from("nfe_certificates")
      .select("id, cnpj, is_active, ambiente, uf, created_at, updated_at")
      .eq("empresa_id", empresaId)
      .eq("is_active", true)
      .maybeSingle();

    // Contar documentos e creditos
    const { count: documentsCount } = await supabase
      .from("nfe_documents")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    const { count: creditsCount } = await supabase
      .from("creditos_icms")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("origin", "nfe_sync");

    // Ultimas chaves importadas
    const { data: recentDocuments } = await supabase
      .from("nfe_documents")
      .select("access_key, nsu, schema_type, issue_date, total_value, processed, direction, xml_status, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Determine sync mode
    const syncMode = syncState?.bootstrap_completed_at ? "daily" : "bootstrap";

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
        bootstrap_completed_at: null,
        sync_mode: "bootstrap",
      },
      sync_mode: syncMode,
      stats: {
        total_documents: documentsCount || 0,
        total_credits_from_sync: creditsCount || 0,
      },
      recent_documents: recentDocuments || [],
      logs: logs || [],
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro ao buscar status:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
