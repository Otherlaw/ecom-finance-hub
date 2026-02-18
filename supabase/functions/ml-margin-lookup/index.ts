import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = new Set([
  "https://www.mercadolivre.com.br",
  "https://mercadolivre.com.br",
  "https://ecomfinance.lovable.app",
  "https://www.ecomfinance.lovable.app",
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isChromeExt = origin.startsWith("chrome-extension://");
  const allowOrigin =
    origin === ""
      ? "*"
      : ALLOWED_ORIGINS.has(origin) || isChromeExt
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

function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestItem {
  sku?: string | null;
  anuncio_id?: string | null;
  preco_final: number;
  quantidade?: number | null;
  comissao?: number | null;
  tarifa_fixa?: number | null;
  tarifa_total?: number | null;
  imposto?: number | null;
  shipping_mode?: string | null;
  rebate?: number | null;
  ads?: number | null;
  outros_descontos?: number | null;
  impostos?: number | null;
  frete_vendedor?: number | null;
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
  rebate: number;
  margem: number | null;
  margem_pct: number | null;
  fonte_custo: "produto" | "sku_costs" | "nao_encontrado";
  shipping_mode: string | null;
  usando_tarifas_reais: boolean;
  usando_imposto_real: boolean;
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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Token de autenticacao necessario" }, 401, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Usuario nao autenticado" }, 401, cors);
    }

    const body = await req.json();
    const empresa_id: string = body.empresa_id;
    const items: RequestItem[] = body.items;

    if (!empresa_id || !Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: "empresa_id e items sao obrigatorios" }, 400, cors);
    }

    // Verificar acesso a empresa
    const { data: acesso } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresa_id);

    if (!acesso || acesso.length === 0) {
      return jsonResponse({ error: "Sem acesso a esta empresa" }, 403, cors);
    }

    // Buscar configurações em paralelo: aliquota fiscal + config logística
    const [configFiscalRes, logisticaRes] = await Promise.all([
      supabase
        .from("empresas_config_fiscal")
        .select("aliquota_imposto_vendas")
        .eq("empresa_id", empresa_id)
        .maybeSingle(),
      supabase
        .from("empresa_logistica_config")
        .select("flex_custo, flex_turbo_custo")
        .eq("empresa_id", empresa_id)
        .maybeSingle(),
    ]);

    const aliquota = configFiscalRes.data?.aliquota_imposto_vendas ?? 6.0;
    const flexCusto = Number(logisticaRes.data?.flex_custo ?? 0);
    const flexTurboCusto = Number(logisticaRes.data?.flex_turbo_custo ?? 0);

    // Coletar SKUs e anuncio_ids unicos
    const skus: string[] = [];
    const anuncioIds: string[] = [];
    for (const item of items) {
      if (item.sku) skus.push(item.sku);
      if (item.anuncio_id) anuncioIds.push(item.anuncio_id);
    }

    // Buscar mapeamentos produto_marketplace_map
    const mappings: Record<string, { produto_id: string; sku_marketplace: string | null }> = {};

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

      if (item.anuncio_id) {
        const map = mappings[`anuncio:${item.anuncio_id}`];
        if (map && produtoCustos[map.produto_id]) {
          custoUnitario = produtoCustos[map.produto_id];
          fonteCusto = "produto";
        }
      }

      if (fonteCusto === "nao_encontrado" && item.sku) {
        const map = mappings[`sku:${item.sku}`];
        if (map && produtoCustos[map.produto_id]) {
          custoUnitario = produtoCustos[map.produto_id];
          fonteCusto = "produto";
        }
      }

      if (fonteCusto === "nao_encontrado" && item.sku && skuCosts[item.sku]) {
        custoUnitario = skuCosts[item.sku];
        fonteCusto = "sku_costs";
      }

      // === 2) Comissão / tarifa ===
      let comissao: number;
      let tarifaFixa: number;
      let usandoTarifasReais = false;

      if (item.comissao != null && item.comissao > 0) {
        comissao = item.comissao;
        tarifaFixa = item.tarifa_fixa != null ? item.tarifa_fixa : 0;
        usandoTarifasReais = true;
      } else if (item.tarifa_total != null && item.tarifa_total > 0) {
        tarifaFixa = item.tarifa_fixa != null ? item.tarifa_fixa : 0;
        comissao = round2(Math.max(0, item.tarifa_total - tarifaFixa));
        if (item.tarifa_fixa == null) {
          comissao = item.tarifa_total;
          tarifaFixa = 0;
        }
        usandoTarifasReais = true;
      } else {
        comissao = round2(preco * 0.12);
        tarifaFixa = item.tarifa_fixa != null ? item.tarifa_fixa : estimarTarifaFixaML(preco);
        usandoTarifasReais = false;
      }

      // === 3) Frete vendedor: custo de FLEX/FLEX TURBO da config da empresa ===
      let freteVendedor = item.frete_vendedor ?? 0;
      const shippingMode = item.shipping_mode ?? null;
      if (shippingMode === "flex_turbo" && flexTurboCusto > 0) {
        freteVendedor = flexTurboCusto;
      } else if (shippingMode === "flex" && flexCusto > 0) {
        freteVendedor = flexCusto;
      }

      // === 4) Ads ===
      const ads = item.ads ?? 0;
      const outrosDescontos = item.outros_descontos ?? 0;

      // === 5) Impostos: real > legado > estimado ===
      let imposto: number;
      let usandoImpostoReal = false;
      const impostoReal = item.imposto ?? item.impostos ?? null;
      if (impostoReal != null) {
        imposto = impostoReal;
        usandoImpostoReal = true;
      } else {
        imposto = round2(preco * (aliquota / 100));
      }

      // === 6) Rebate ===
      const rebate = item.rebate ?? 0;

      // === 7) Margem final ===
      let margem: number | null = null;
      let margemPct: number | null = null;

      if (custoUnitario !== null) {
        margem = round2(
          preco
          - custoUnitario * qty
          - comissao
          - tarifaFixa
          - freteVendedor
          - ads
          - outrosDescontos
          - imposto
          + rebate
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
        rebate: round2(rebate),
        margem,
        margem_pct: margemPct,
        fonte_custo: fonteCusto,
        shipping_mode: shippingMode,
        usando_tarifas_reais: usandoTarifasReais,
        usando_imposto_real: usandoImpostoReal,
      };
    });

    return jsonResponse({ results }, 200, cors);
  } catch (error) {
    console.error("Erro no ml-margin-lookup:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500, cors);
  }
});
