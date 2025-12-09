import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mercado Livre OAuth Token URL
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let code: string | null = null;
    let state: string | null = null;

    // Suportar tanto GET (redirect do ML) quanto POST
    if (req.method === "GET") {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
    } else {
      const body = await req.json();
      code = body.code;
      state = body.state;
    }

    if (!code || !state) {
      console.error("[ML OAuth Callback] Code ou state ausente");
      return new Response(
        JSON.stringify({ error: "Parâmetros code e state são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decodificar state para obter empresa_id, code_verifier (PKCE) e frontend_url
    let empresa_id: string;
    let code_verifier: string;
    let frontend_url: string;
    try {
      const stateData = JSON.parse(atob(state));
      empresa_id = stateData.empresa_id;
      code_verifier = stateData.code_verifier;
      frontend_url = stateData.frontend_url || "https://ecom-finance.lovable.app";
      
      if (!empresa_id || !code_verifier) {
        throw new Error("empresa_id ou code_verifier ausente no state");
      }
    } catch (e) {
      console.error("[ML OAuth Callback] Erro ao decodificar state:", e);
      return new Response(
        JSON.stringify({ error: "State inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do ambiente
    const ML_APP_ID = Deno.env.get("ML_APP_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    const ML_REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ML_APP_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
      console.error("[ML OAuth Callback] Credenciais ML não configuradas");
      return new Response(
        JSON.stringify({ error: "Credenciais do Mercado Livre não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[ML OAuth Callback] Credenciais Supabase não configuradas");
      return new Response(
        JSON.stringify({ error: "Credenciais Supabase não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ML OAuth Callback] Trocando code por tokens para empresa ${empresa_id} (PKCE)`);

    // Trocar code por tokens (com PKCE code_verifier)
    const tokenResponse = await fetch(ML_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ML_APP_ID,
        client_secret: ML_CLIENT_SECRET,
        code: code,
        redirect_uri: ML_REDIRECT_URI,
        code_verifier: code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[ML OAuth Callback] Erro ao obter tokens:", errorText);
      return new Response(
        JSON.stringify({ error: "Falha ao obter tokens do Mercado Livre", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("[ML OAuth Callback] Tokens obtidos com sucesso");

    // Salvar tokens no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Upsert token (inserir ou atualizar se já existir)
    const { error: tokenError } = await supabase
      .from("integracao_tokens")
      .upsert({
        empresa_id,
        provider: "mercado_livre",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        user_id_provider: tokenData.user_id?.toString(),
        metadata: {
          obtained_at: new Date().toISOString(),
          auth_method: "pkce",
        },
      }, {
        onConflict: "empresa_id,provider",
      });

    if (tokenError) {
      console.error("[ML OAuth Callback] Erro ao salvar token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Falha ao salvar tokens", details: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar ou atualizar configuração padrão
    await supabase
      .from("integracao_config")
      .upsert({
        empresa_id,
        provider: "mercado_livre",
        ativo: true,
        sync_frequency_minutes: 60,
        auto_categorize: true,
        auto_reconcile: false,
      }, {
        onConflict: "empresa_id,provider",
      });

    // Registrar log de sucesso
    await supabase
      .from("integracao_logs")
      .insert({
        empresa_id,
        provider: "mercado_livre",
        tipo: "oauth",
        status: "success",
        mensagem: "Conexão OAuth estabelecida com sucesso (PKCE)",
        detalhes: {
          user_id: tokenData.user_id,
          scope: tokenData.scope,
        },
      });

    console.log(`[ML OAuth Callback] Conexão estabelecida para empresa ${empresa_id}`);

    // Para GET (redirect do ML), fazer redirect 302 para o frontend
    if (req.method === "GET") {
      // Usar a URL do frontend que veio no state (dinâmica)
      const redirectUrl = `${frontend_url}/integracoes?ml_status=success&provider=mercado_livre`;
      
      console.log(`[ML OAuth Callback] Redirecionando para: ${redirectUrl}`);
      
      return new Response(null, {
        status: 302,
        headers: { 
          "Location": redirectUrl,
          ...corsHeaders
        },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Conexão estabelecida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML OAuth Callback] Erro:", error);
    
    // Tentar redirecionar com erro se for GET
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const fallbackUrl = "https://ecom-finance.lovable.app";
    
    return new Response(null, {
      status: 302,
      headers: { 
        "Location": `${fallbackUrl}/integracoes?ml_status=error&error=${encodeURIComponent(errorMessage)}`,
        ...corsHeaders
      },
    });
  }
});