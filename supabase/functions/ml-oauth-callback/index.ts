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

    // Decodificar state para obter empresa_id e code_verifier (PKCE)
    let empresa_id: string;
    let code_verifier: string;
    try {
      const stateData = JSON.parse(atob(state));
      empresa_id = stateData.empresa_id;
      code_verifier = stateData.code_verifier;
      
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

    // Para GET (redirect do ML), retornar HTML que fecha a janela
    if (req.method === "GET") {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conexão Estabelecida</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 16px;
              backdrop-filter: blur(10px);
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { margin: 0 0 10px; font-size: 24px; }
            p { margin: 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Conexão Estabelecida!</h1>
            <p>Você pode fechar esta janela.</p>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage({ type: 'ML_OAUTH_SUCCESS' }, '*');
                window.close();
              }
            }, 2000);
          </script>
        </body>
        </html>
      `;
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Conexão estabelecida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML OAuth Callback] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
