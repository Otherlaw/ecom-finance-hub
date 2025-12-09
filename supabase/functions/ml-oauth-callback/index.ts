import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mercado Livre Token URL
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Pode receber via query params (redirect) ou body (manual)
    let code: string | null = null;
    let state: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
    } else {
      const body = await req.json();
      code = body.code;
      state = body.state;
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Código de autorização não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decodificar state para obter empresa_id
    let empresa_id: string | null = null;
    if (state) {
      try {
        const decoded = JSON.parse(atob(state));
        empresa_id = decoded.empresa_id;
      } catch {
        console.warn("Não foi possível decodificar state");
      }
    }

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id não encontrado no state" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais
    const ML_APP_ID = Deno.env.get("ML_APP_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    const ML_REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI");

    if (!ML_APP_ID || !ML_CLIENT_SECRET || !ML_REDIRECT_URI) {
      return new Response(
        JSON.stringify({ error: "Credenciais do Mercado Livre não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ML OAuth Callback] Trocando code por tokens para empresa ${empresa_id}`);

    // Trocar code por tokens
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
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[ML OAuth Callback] Erro ao obter token:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao obter token do Mercado Livre", details: errorText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("[ML OAuth Callback] Token obtido com sucesso");

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Salvar tokens no banco
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert token
    const { error: tokenError } = await supabase
      .from("integracao_tokens")
      .upsert({
        empresa_id,
        provider: "mercado_livre",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || "Bearer",
        expires_at: expiresAt,
        scope: tokenData.scope,
        user_id_provider: String(tokenData.user_id),
        metadata: {
          token_type: tokenData.token_type,
          scope: tokenData.scope,
        },
      }, { onConflict: "empresa_id,provider" });

    if (tokenError) {
      console.error("[ML OAuth Callback] Erro ao salvar token:", tokenError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar token", details: tokenError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar configuração padrão
    const { error: configError } = await supabase
      .from("integracao_config")
      .upsert({
        empresa_id,
        provider: "mercado_livre",
        ativo: true,
        sync_frequency_minutes: 30,
        auto_categorize: true,
        auto_reconcile: false,
        webhook_enabled: true,
      }, { onConflict: "empresa_id,provider" });

    if (configError) {
      console.warn("[ML OAuth Callback] Erro ao criar config:", configError);
    }

    // Registrar log de sucesso
    await supabase.from("integracao_logs").insert({
      empresa_id,
      provider: "mercado_livre",
      tipo: "oauth",
      status: "success",
      mensagem: "Conexão OAuth realizada com sucesso",
      detalhes: { user_id: tokenData.user_id },
    });

    console.log(`[ML OAuth Callback] Integração configurada para empresa ${empresa_id}`);

    // Se for GET (redirect do ML), retornar HTML para fechar popup
    if (req.method === "GET") {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Conexão realizada!</title>
          <style>
            body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #22c55e; margin-bottom: 1rem; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Conexão realizada!</h1>
            <p>Você pode fechar esta janela.</p>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.location.reload();
                }
                window.close();
              }, 2000);
            </script>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "text/html" } 
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Integração configurada com sucesso" }),
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
