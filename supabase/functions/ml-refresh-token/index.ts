import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ML_APP_ID = Deno.env.get("ML_APP_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");

    if (!ML_APP_ID || !ML_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Credenciais do ML não configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar tokens que expiram nas próximas 24h
    const expirationThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: tokens, error } = await supabase
      .from("integracao_tokens")
      .select("*")
      .eq("provider", "mercado_livre")
      .lt("expires_at", expirationThreshold);

    if (error) {
      throw error;
    }

    console.log(`[ML Refresh] Encontrados ${tokens?.length || 0} tokens para renovar`);

    let renovados = 0;
    let erros = 0;

    for (const token of tokens || []) {
      try {
        console.log(`[ML Refresh] Renovando token para empresa ${token.empresa_id}`);

        const response = await fetch(ML_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: ML_APP_ID,
            client_secret: ML_CLIENT_SECRET,
            refresh_token: token.refresh_token,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[ML Refresh] Erro ao renovar token: ${errorText}`);
          
          // Registrar erro
          await supabase.from("integracao_logs").insert({
            empresa_id: token.empresa_id,
            provider: "mercado_livre",
            tipo: "oauth",
            status: "error",
            mensagem: "Erro ao renovar token",
            detalhes: { error: errorText },
          });
          
          erros++;
          continue;
        }

        const data = await response.json();
        const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();

        // Atualizar token no banco
        await supabase
          .from("integracao_tokens")
          .update({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", token.id);

        // Registrar sucesso
        await supabase.from("integracao_logs").insert({
          empresa_id: token.empresa_id,
          provider: "mercado_livre",
          tipo: "oauth",
          status: "success",
          mensagem: "Token renovado com sucesso",
        });

        renovados++;
        console.log(`[ML Refresh] Token renovado para empresa ${token.empresa_id}`);

      } catch (err) {
        console.error(`[ML Refresh] Erro ao processar token ${token.id}:`, err);
        erros++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokens_verificados: tokens?.length || 0,
        renovados,
        erros,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML Refresh] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
