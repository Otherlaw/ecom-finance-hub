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

    // Para GET (redirect do ML), retornar HTML com animações
    if (req.method === "GET") {
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conexão Estabelecida</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      overflow: hidden;
    }
    
    .container {
      text-align: center;
      padding: 48px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      max-width: 400px;
      width: 90%;
    }
    
    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    
    .spinner {
      width: 56px;
      height: 56px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top-color: #ffe600;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading-text {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.8);
    }
    
    /* Success State */
    .success-state {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    
    .success-icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 40px rgba(16, 185, 129, 0.4);
      animation: popIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }
    
    .success-icon svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    
    .checkmark {
      stroke-dasharray: 50;
      stroke-dashoffset: 50;
      animation: drawCheck 0.6s ease-out 0.3s forwards;
    }
    
    @keyframes popIn {
      0% { transform: scale(0); opacity: 0; }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    @keyframes drawCheck {
      to { stroke-dashoffset: 0; }
    }
    
    .success-title {
      font-size: 24px;
      font-weight: 600;
      color: white;
      animation: fadeInUp 0.5s ease-out 0.4s backwards;
    }
    
    .success-subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      animation: fadeInUp 0.5s ease-out 0.5s backwards;
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Countdown */
    .countdown-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      animation: fadeInUp 0.5s ease-out 0.6s backwards;
    }
    
    .countdown-ring {
      position: relative;
      width: 48px;
      height: 48px;
    }
    
    .countdown-ring svg {
      transform: rotate(-90deg);
    }
    
    .countdown-ring circle {
      fill: none;
      stroke-width: 4;
    }
    
    .countdown-bg {
      stroke: rgba(255, 255, 255, 0.1);
    }
    
    .countdown-progress {
      stroke: #ffe600;
      stroke-dasharray: 126;
      stroke-dashoffset: 0;
      transition: stroke-dashoffset 1s linear;
    }
    
    .countdown-number {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      font-weight: 600;
      color: white;
    }
    
    .countdown-text {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
    }
    
    /* Manual Close Button */
    .manual-close {
      display: none;
      margin-top: 16px;
      padding: 12px 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .manual-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    /* ML Logo */
    .ml-logo {
      position: absolute;
      bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }
    
    .ml-logo-icon {
      width: 20px;
      height: 20px;
      background: #ffe600;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #333;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Loading State -->
    <div class="loading-state" id="loadingState">
      <div class="spinner"></div>
      <div class="loading-text">Processando conexão...</div>
    </div>
    
    <!-- Success State -->
    <div class="success-state" id="successState">
      <div class="success-icon">
        <svg viewBox="0 0 24 24">
          <path class="checkmark" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="success-title">Conexão Estabelecida!</div>
      <div class="success-subtitle">Sua conta do Mercado Livre foi conectada</div>
      
      <div class="countdown-container">
        <div class="countdown-ring">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle class="countdown-bg" cx="24" cy="24" r="20"/>
            <circle class="countdown-progress" id="countdownProgress" cx="24" cy="24" r="20"/>
          </svg>
          <span class="countdown-number" id="countdownNumber">3</span>
        </div>
        <span class="countdown-text">Fechando automaticamente...</span>
      </div>
      
      <button class="manual-close" id="manualClose" onclick="closeWindow()">
        Fechar manualmente
      </button>
    </div>
  </div>
  
  <div class="ml-logo">
    <div class="ml-logo-icon">ML</div>
    <span>Mercado Livre</span>
  </div>
  
  <script>
    const loadingState = document.getElementById('loadingState');
    const successState = document.getElementById('successState');
    const countdownProgress = document.getElementById('countdownProgress');
    const countdownNumber = document.getElementById('countdownNumber');
    const manualClose = document.getElementById('manualClose');
    
    let countdown = 3;
    const circumference = 2 * Math.PI * 20; // r=20
    
    // Notificar janela pai
    function notifyParent() {
      if (window.opener) {
        window.opener.postMessage({ type: 'ML_OAUTH_SUCCESS' }, '*');
      }
    }
    
    // Fechar janela
    function closeWindow() {
      notifyParent();
      window.close();
      
      // Se não conseguiu fechar, mostra botão manual
      setTimeout(() => {
        manualClose.style.display = 'block';
      }, 500);
    }
    
    // Mostrar estado de sucesso após delay
    setTimeout(() => {
      loadingState.style.display = 'none';
      successState.style.display = 'flex';
      
      // Iniciar countdown
      const interval = setInterval(() => {
        countdown--;
        countdownNumber.textContent = countdown;
        
        // Atualizar progresso do anel
        const offset = circumference * (1 - countdown / 3);
        countdownProgress.style.strokeDashoffset = offset;
        
        if (countdown <= 0) {
          clearInterval(interval);
          closeWindow();
        }
      }, 1000);
      
    }, 800);
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