import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mercado Livre OAuth URLs
const ML_AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { empresa_id, frontend_url } = await req.json();

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

    // Gerar PKCE code_verifier e code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Gerar state para segurança (contém empresa_id, code_verifier e frontend_url para callback)
    const state = btoa(JSON.stringify({ 
      empresa_id, 
      code_verifier: codeVerifier,
      frontend_url: frontend_url || "https://ecom-finance.lovable.app",
      timestamp: Date.now() 
    }));

    // Montar URL de autorização com PKCE
    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: ML_APP_ID,
      redirect_uri: ML_REDIRECT_URI,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authUrl = `${ML_AUTH_URL}?${authParams.toString()}`;

    console.log(`[ML OAuth Start] Gerando URL PKCE para empresa ${empresa_id}`);

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
