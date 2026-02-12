import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache: item_id -> { url, ts }
const memCache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
    });

  try {
    const url = new URL(req.url);
    const itemId = url.searchParams.get("item_id")?.trim();
    const empresaId = url.searchParams.get("empresa_id")?.trim();

    if (!itemId) {
      return json({ imageUrl: null, error: "item_id obrigatório" });
    }

    // 1) Check in-memory cache
    const cached = memCache.get(itemId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return json({ imageUrl: cached.url }, 200, { "Cache-Control": "public, max-age=86400" });
    }

    // 2) Build headers — try authenticated if empresa_id provided
    const headers: Record<string, string> = {};

    if (empresaId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: tokenRow } = await supabase
          .from("integracao_tokens")
          .select("access_token, expires_at")
          .eq("empresa_id", empresaId)
          .eq("provider", "mercado_livre")
          .maybeSingle();

        if (tokenRow?.access_token) {
          const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : Infinity;
          if (expiresAt > Date.now()) {
            headers["Authorization"] = `Bearer ${tokenRow.access_token}`;
          }
        }
      } catch (e) {
        console.warn("[ml-item-thumb] Erro ao buscar token:", e);
      }
    }

    // 3) Fetch from ML API
    const mlRes = await fetch(
      `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`,
      { headers }
    );

    let imageUrl: string | null = null;

    if (mlRes.ok) {
      const data = await mlRes.json();
      imageUrl =
        data?.secure_thumbnail ||
        data?.thumbnail ||
        data?.pictures?.[0]?.secure_url ||
        data?.pictures?.[0]?.url ||
        null;
    } else {
      await mlRes.text();
      console.warn(`[ml-item-thumb] ML API ${mlRes.status} para ${itemId}`);
    }

    // 4) Cache
    memCache.set(itemId, { url: imageUrl, ts: Date.now() });
    if (memCache.size > 5000) {
      const now = Date.now();
      for (const [key, val] of memCache) {
        if (now - val.ts > CACHE_TTL) memCache.delete(key);
      }
    }

    return json({ imageUrl }, 200, { "Cache-Control": "public, max-age=86400" });
  } catch (err) {
    console.error("[ml-item-thumb] Erro:", err);
    return json({ imageUrl: null, error: "Erro interno" });
  }
});
