import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mercado Livre OAuth URLs
const ML_AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { empresa_id } = await req.json();

    if (!empresa_id) {
      return new Response(
        JSON.stringify({ error: "empresa_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do ambiente
    const ML_APP_ID = Deno.env.get("ML_APP_ID");
    const ML_REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI");

    if (!ML_APP_ID || !ML_REDIRECT_URI) {
      console.error("Credenciais ML não configuradas");
      return new Response(
        JSON.stringify({ error: "Credenciais do Mercado Livre não configuradas. Configure ML_APP_ID e ML_REDIRECT_URI nos secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar state para segurança (contém empresa_id para callback)
    const state = btoa(JSON.stringify({ 
      empresa_id, 
      timestamp: Date.now() 
    }));

    // Montar URL de autorização
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: ML_APP_ID,
      redirect_uri: ML_REDIRECT_URI,
      state: state,
    });

    const authUrl = `${ML_AUTH_URL}?${authParams.toString()}`;

    console.log(`[ML OAuth Start] Gerando URL para empresa ${empresa_id}`);

    return new Response(
      JSON.stringify({ 
        auth_url: authUrl,
        message: "Redirecione o usuário para esta URL" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ML OAuth Start] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
