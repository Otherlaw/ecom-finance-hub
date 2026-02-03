/**
 * NFe Worker Proxy - Edge Function
 * 
 * Proxy seguro para operações do worker externo no Render.
 * Autenticado via WORKER_INGEST_TOKEN para evitar necessidade de SERVICE_ROLE_KEY no worker.
 * 
 * Ações suportadas:
 * - get-active-companies: Lista empresas com certificado ativo
 * - get-certificate: Busca certificado A1 de uma empresa
 * - get-sync-state: Retorna estado de sincronização
 * - update-sync-state: Atualiza estado de sincronização
 * - log: Registra log em nfe_sync_logs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validar token do worker
    const workerToken = req.headers.get('x-worker-token');
    const expectedToken = Deno.env.get('WORKER_INGEST_TOKEN');

    if (!expectedToken) {
      console.error('WORKER_INGEST_TOKEN não configurado');
      return new Response(
        JSON.stringify({ error: 'Configuração inválida do servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (workerToken !== expectedToken) {
      console.warn('Token inválido recebido');
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair action da URL
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const empresaId = url.searchParams.get('empresa_id');

    console.log(`[nfe-worker-proxy] Action: ${action}, Empresa: ${empresaId}`);

    switch (action) {
      case 'get-active-companies': {
        const { data, error } = await supabase
          .from('nfe_certificates')
          .select('empresa_id, cnpj, uf, ambiente')
          .eq('is_active', true);

        if (error) {
          console.error('Erro ao buscar empresas:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ companies: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-certificate': {
        if (!empresaId) {
          return new Response(
            JSON.stringify({ error: 'empresa_id obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('nfe_certificates')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('is_active', true)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return new Response(
              JSON.stringify({ certificate: null }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.error('Erro ao buscar certificado:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ certificate: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-sync-state': {
        if (!empresaId) {
          return new Response(
            JSON.stringify({ error: 'empresa_id obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from('nfe_sync_state')
          .select('*')
          .eq('empresa_id', empresaId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return new Response(
              JSON.stringify({ sync_state: null }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.error('Erro ao buscar sync state:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ sync_state: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-sync-state': {
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Método deve ser POST' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { empresa_id, updates } = body;

        if (!empresa_id || !updates) {
          return new Response(
            JSON.stringify({ error: 'empresa_id e updates obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('nfe_sync_state')
          .upsert({
            empresa_id,
            ...updates,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'empresa_id' });

        if (error) {
          console.error('Erro ao atualizar sync state:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'log': {
        if (req.method !== 'POST') {
          return new Response(
            JSON.stringify({ error: 'Método deve ser POST' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { empresa_id, level, message, meta } = body;

        if (!empresa_id || !level || !message) {
          return new Response(
            JSON.stringify({ error: 'empresa_id, level e message obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('nfe_sync_logs')
          .insert({
            empresa_id,
            level,
            message,
            meta,
          });

        if (error) {
          console.error('Erro ao registrar log:', error);
          // Não retornamos erro para não interromper o fluxo
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('[nfe-worker-proxy] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
