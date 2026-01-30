import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-auth-user] Iniciando exclusão do usuário: ${user_id}`);

    // Client com token do usuário logado (para RPC)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Chamar RPC para limpar dados no banco (usa permissões do usuário logado)
    const { data: cascadeResult, error: cascadeError } = await supabaseClient.rpc(
      "delete_user_cascade",
      { p_user_id: user_id }
    );

    if (cascadeError) {
      console.error(`[delete-auth-user] Erro na RPC delete_user_cascade:`, cascadeError);
      return new Response(
        JSON.stringify({ error: cascadeError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-auth-user] RPC executada com sucesso:`, cascadeResult);

    // 2. Usar service_role para deletar do Auth
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (authDeleteError) {
      console.error(`[delete-auth-user] Erro ao deletar do Auth:`, authDeleteError);
      // Dados já foram limpos do banco, mas avisa sobre o erro no Auth
      return new Response(
        JSON.stringify({
          warning: "Dados removidos do banco, mas erro ao remover do Auth",
          error: authDeleteError.message,
          cascade_result: cascadeResult,
        }),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-auth-user] Usuário ${user_id} excluído completamente`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Usuário excluído com sucesso",
        ...cascadeResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[delete-auth-user] Erro inesperado:`, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
