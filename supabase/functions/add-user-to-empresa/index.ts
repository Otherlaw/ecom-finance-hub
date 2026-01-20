import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AddUserRequest {
  email: string;
  empresa_id: string;
  role_na_empresa: "dono" | "admin" | "financeiro" | "operador";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com service_role para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com token do usuário para verificar permissões
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AddUserRequest = await req.json();
    const { email, empresa_id, role_na_empresa } = body;

    if (!email || !empresa_id || !role_na_empresa) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios: email, empresa_id, role_na_empresa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o usuário atual é dono/admin da empresa
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_empresas")
      .select("role_na_empresa")
      .eq("user_id", user.id)
      .eq("empresa_id", empresa_id)
      .single();

    if (roleError || !callerRole) {
      return new Response(
        JSON.stringify({ error: "Você não tem acesso a esta empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["dono", "admin"].includes(callerRole.role_na_empresa)) {
      return new Response(
        JSON.stringify({ error: "Apenas donos e admins podem adicionar colaboradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar usuário pelo email na tabela profiles
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, nome")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao buscar profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ 
          error: "Usuário não encontrado. O colaborador precisa criar uma conta primeiro." 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se já existe vínculo
    const { data: existingLink, error: linkError } = await supabaseAdmin
      .from("user_empresas")
      .select("id, role_na_empresa")
      .eq("user_id", targetProfile.id)
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    if (linkError) {
      console.error("Erro ao verificar vínculo:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar vínculo existente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingLink) {
      // Atualizar role existente
      const { error: updateError } = await supabaseAdmin
        .from("user_empresas")
        .update({ role_na_empresa })
        .eq("id", existingLink.id);

      if (updateError) {
        console.error("Erro ao atualizar vínculo:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar role do colaborador" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Role de ${targetProfile.nome || email} atualizado para ${role_na_empresa}`,
          action: "updated"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar novo vínculo
    const { error: insertError } = await supabaseAdmin
      .from("user_empresas")
      .insert({
        user_id: targetProfile.id,
        empresa_id,
        role_na_empresa,
      });

    if (insertError) {
      console.error("Erro ao criar vínculo:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao adicionar colaborador" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${targetProfile.nome || email} adicionado como ${role_na_empresa}`,
        action: "created"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na edge function:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
