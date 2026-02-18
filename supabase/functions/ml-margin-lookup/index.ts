import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedExact = new Set([
    "https://www.mercadolivre.com.br",
    "https://mercadolivre.com.br",
    "https://ecomfinance.lovable.app",
    "https://www.ecomfinance.lovable.app",
  ]);
  const isChromeExt = origin.startsWith("chrome-extension://");
  const allowOrigin =
    allowedExact.has(origin) || isChromeExt
      ? origin
      : "https://www.mercadolivre.com.br";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

interface RequestItem {
  sku?: string | null;
  anuncio_id?: string | null;
  preco_final: number;
  quantidade?: number | null;
  comissao?: number | null;
  tarifa_fixa?: number | null;
  frete_vendedor?: number | null;
  ads?: number | null;
  outros_descontos?: number | null;
  impostos?: number | null;
}

interface MarginResult {
  sku: string | null;
  anuncio_id: string | null;
  preco_final: number;
  quantidade: number;
  custo_unitario: number | null;
  comissao: number;
  tarifa_fixa: number;
  frete_vendedor: number;
  ads: number;
  outros_descontos: number;
  imposto: number;
  margem: number | null;
  margem_pct: number | null;
  fonte_custo: "produto" | "sku_costs" | "nao_encontrado";
}

function estimarTarifaFixaML(preco: number): number {
  if (preco <= 29) return 6.0;
  if (preco <= 50) return 6.5;
  if (preco <= 79) return 7.0;
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticacao necessario" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuario
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuario nao autenticado" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const body = await req.json();
    const empresa_id: string = body.empresa_id;
    const items: RequestItem[] = body.items;

    if (!empresa_id || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "empresa_id e items sao obrigatorios" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Verificar acesso a empresa
    const { data: acesso } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresa_id);

    if (!acesso || acesso.length === 0) {
      return new Response(
        JSON.stringify({ error: "Sem acesso a esta empresa" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // Buscar aliquota de imposto
    const { data: configFiscal } = await supabase
      .from("empresas_config_fiscal")
      .select("aliquota_imposto_vendas")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    const aliquota = configFiscal?.aliquota_imposto_vendas ?? 6.0;

    // Coletar SKUs e anuncio_ids unicos
    const skus: string[] = [];
    const anuncioIds: string[] = [];
    for (const item of items) {
      if (item.sku) skus.push(item.sku);
      if (item.anuncio_id) anuncioIds.push(item.anuncio_id);
    }

    // Buscar mapeamentos produto_marketplace_map
    const mappings: Record<
      string,
      { produto_id: string; sku_marketplace: string | null }
    > = {};

    if (anuncioIds.length > 0 || skus.length > 0) {
      let query = supabase
        .from("produto_marketplace_map")
        .select("produto_id, sku_marketplace, anuncio_id")
        .eq("empresa_id", empresa_id)
        .eq("ativo", true);

      if (anuncioIds.length > 0 && skus.length > 0) {
        query = query.or(
          `anuncio_id.in.(${anuncioIds.join(",")}),sku_marketplace.in.(${skus.join(",")})`
        );
      } else if (anuncioIds.length > 0) {
        query = query.in("anuncio_id", anuncioIds);
      } else {
        query = query.in("sku_marketplace", skus);
      }

      const { data: maps } = await query;
      if (maps) {
        for (const m of maps) {
          if (m.anuncio_id)
            mappings[`anuncio:${m.anuncio_id}`] = {
              produto_id: m.produto_id,
              sku_marketplace: m.sku_marketplace,
            };
          if (m.sku_marketplace)
            mappings[`sku:${m.sku_marketplace}`] = {
              produto_id: m.produto_id,
              sku_marketplace: m.sku_marketplace,
            };
        }
      }
    }

    // Buscar custo_medio dos produtos mapeados
    const produtoIds = [
      ...new Set(Object.values(mappings).map((m) => m.produto_id)),
    ];
    const produtoCustos: Record<string, number> = {};

    if (produtoIds.length > 0) {
      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, custo_medio")
        .in("id", produtoIds);

      if (produtos) {
        for (const p of produtos) {
          const custo = Number(p.custo_medio);
          if (custo > 0) {
            produtoCustos[p.id] = custo;
          }
        }
      }
    }

    // Buscar fallback sku_costs
    const skuCosts: Record<string, number> = {};
    if (skus.length > 0) {
      const { data: costs } = await supabase
        .from("sku_costs")
        .select("sku, custo_unitario")
        .eq("empresa_id", empresa_id)
        .in("sku", skus);

      if (costs) {
        for (const c of costs) {
          const custo = Number(c.custo_unitario);
          if (custo > 0) skuCosts[c.sku] = custo;
        }
      }
    }

    // Calcular margem para cada item
    const results: MarginResult[] = items.map((item) => {
      const preco = item.preco_final;
      const qty = item.quantidade ?? 1;

      // === 1) Resolver custo ===
      let custoUnitario: number | null = null;
      let fonteCusto: MarginResult["fonte_custo"] = "nao_encontrado";

      // a) por anuncio_id
      if (item.anuncio_id) {
        const map = mappings[`anuncio:${item.anuncio_id}`];
        if (map && produtoCustos[map.produto_id]) {
          custoUnitario = produtoCustos[map.produto_id];
          fonteCusto = "produto";
        }
      }

      // b) por sku_marketplace
      if (fonteCusto === "nao_encontrado" && item.sku) {
        const map = mappings[`sku:${item.sku}`];
        if (map && produtoCustos[map.produto_id]) {
          custoUnitario = produtoCustos[map.produto_id];
          fonteCusto = "produto";
        }
      }

      // c) fallback sku_costs
      if (fonteCusto === "nao_encontrado" && item.sku && skuCosts[item.sku]) {
        custoUnitario = skuCosts[item.sku];
        fonteCusto = "sku_costs";
      }

      // === 2) Comissao/tarifa: usar valores enviados ou estimar ===
      const comissao =
        item.comissao != null ? item.comissao : round2(preco * 0.12);
      const tarifaFixa =
        item.tarifa_fixa != null
          ? item.tarifa_fixa
          : estimarTarifaFixaML(preco);
      const freteVendedor = item.frete_vendedor ?? 0;
      const ads = item.ads ?? 0;
      const outrosDescontos = item.outros_descontos ?? 0;

      // === 3) Impostos: usar enviado ou calcular ===
      const imposto =
        item.impostos != null ? item.impostos : round2(preco * (aliquota / 100));

      // === 4) Margem ===
      let margem: number | null = null;
      let margemPct: number | null = null;

      if (custoUnitario !== null) {
        margem = round2(
          preco -
            custoUnitario * qty -
            comissao -
            tarifaFixa -
            freteVendedor -
            ads -
            outrosDescontos -
            imposto
        );
        margemPct = preco > 0 ? round2((margem / preco) * 100) : 0;
      }

      return {
        sku: item.sku || null,
        anuncio_id: item.anuncio_id || null,
        preco_final: preco,
        quantidade: qty,
        custo_unitario: custoUnitario,
        comissao: round2(comissao),
        tarifa_fixa: round2(tarifaFixa),
        frete_vendedor: round2(freteVendedor),
        ads: round2(ads),
        outros_descontos: round2(outrosDescontos),
        imposto: round2(imposto),
        margem,
        margem_pct: margemPct,
        fonte_custo: fonteCusto,
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Erro no ml-margin-lookup:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
