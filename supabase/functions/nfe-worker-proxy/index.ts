/**
 * NFe Worker Proxy - Edge Function
 * V2: Inclui manifest_queue operations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const workerToken = req.headers.get('x-worker-token');
    const expectedToken = Deno.env.get('WORKER_INGEST_TOKEN');

    if (!expectedToken) {
      return new Response(JSON.stringify({ error: 'WORKER_INGEST_TOKEN não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (workerToken !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        if (error) throw error;
        return new Response(JSON.stringify({ companies: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get-certificate': {
        if (!empresaId) {
          return new Response(JSON.stringify({ error: 'empresa_id obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data, error } = await supabase
          .from('nfe_certificates')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('is_active', true)
          .single();

        if (error && error.code === 'PGRST116') {
          return new Response(JSON.stringify({ certificate: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (error) throw error;
        return new Response(JSON.stringify({ certificate: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get-sync-state': {
        if (!empresaId) {
          return new Response(JSON.stringify({ error: 'empresa_id obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { data, error } = await supabase
          .from('nfe_sync_state')
          .select('*')
          .eq('empresa_id', empresaId)
          .single();

        if (error && error.code === 'PGRST116') {
          return new Response(JSON.stringify({ sync_state: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (error) throw error;
        return new Response(JSON.stringify({ sync_state: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'update-sync-state': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST obrigatório' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json();
        const { empresa_id, updates } = body;

        if (!empresa_id || !updates) {
          return new Response(JSON.stringify({ error: 'empresa_id e updates obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { error } = await supabase
          .from('nfe_sync_state')
          .upsert({ empresa_id, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id' });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'log': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST obrigatório' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json();
        const { empresa_id: logEmpresaId, level, message, meta } = body;

        if (!logEmpresaId || !level || !message) {
          return new Response(JSON.stringify({ error: 'campos obrigatórios faltando' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        await supabase.from('nfe_sync_logs').insert({ empresa_id: logEmpresaId, level, message, meta });

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ★ MANIFEST QUEUE OPERATIONS

      case 'enqueue-manifest': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST obrigatório' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json();
        const { empresa_id: mqEmpresaId, ch_nfe } = body;

        if (!mqEmpresaId || !ch_nfe) {
          return new Response(JSON.stringify({ error: 'empresa_id e ch_nfe obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Upsert (idempotente)
        const { error } = await supabase
          .from('nfe_manifest_queue')
          .upsert(
            { empresa_id: mqEmpresaId, ch_nfe, status: 'pending', attempts: 0 },
            { onConflict: 'empresa_id,ch_nfe', ignoreDuplicates: true }
          );

        if (error) {
          console.error('Erro ao enfileirar manifest:', error);
          return new Response(JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get-pending-manifests': {
        if (!empresaId) {
          return new Response(JSON.stringify({ error: 'empresa_id obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const limit = parseInt(url.searchParams.get('limit') || '5');
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from('nfe_manifest_queue')
          .select('*')
          .eq('empresa_id', empresaId)
          .in('status', ['pending', 'error'])
          .lte('next_try_at', now)
          .order('created_at', { ascending: true })
          .limit(limit);

        if (error) {
          console.error('Erro ao buscar manifests:', error);
          return new Response(JSON.stringify({ manifests: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ manifests: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'update-manifest': {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'POST obrigatório' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json();
        const { id, status: mStatus, last_error, attempts, next_try_at } = body;

        if (!id || !mStatus) {
          return new Response(JSON.stringify({ error: 'id e status obrigatórios' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const updates: Record<string, unknown> = {
          status: mStatus,
          updated_at: new Date().toISOString(),
        };
        if (last_error !== undefined) updates.last_error = last_error;
        if (attempts !== undefined) updates.attempts = attempts;
        if (next_try_at !== undefined) updates.next_try_at = next_try_at;

        const { error } = await supabase
          .from('nfe_manifest_queue')
          .update(updates)
          .eq('id', id);

        if (error) {
          console.error('Erro ao atualizar manifest:', error);
        }

        return new Response(JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('[nfe-worker-proxy] Erro:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
