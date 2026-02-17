import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestItem {
  sku?: string;
  anuncio_id?: string;
  preco_final: number;
  quantidade?: number;
}

interface MarginResult {
  sku: string | null;
  anuncio_id: string | null;
  preco_final: number;
  custo_unitario: number;
  comissao: number;
  tarifa_fixa: number;
  frete_vendedor: number;
  imposto: number;
  margem: number;
  margem_pct: number;
  fonte_custo: "produto" | "sku_costs" | "nao_encontrado";
}

// Tarifa fixa do ML baseada no preço (valores aproximados 2024/2025)
function estimarTarifaFixaML(preco: number): number {
  if (preco <= 29) return 6.0;
  if (preco <= 50) return 6.5;
  if (preco <= 79) return 7.0;
  return 0; // Acima de R$79 geralmente sem tarifa fixa
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação necessário" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { empresa_id, items } = await req.json() as {
      empresa_id: string;
      items: RequestItem[];
    };

    if (!empresa_id || !items?.length) {
      return new Response(
        JSON.stringify({ error: "empresa_id e items são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso à empresa
    const { data: userEmpresas } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id)
      .eq("empresa_id", empresa_id);

    if (!userEmpresas?.length) {
      return new Response(
        JSON.stringify({ error: "Sem acesso a esta empresa" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar config fiscal da empresa
    const { data: configFiscal } = await supabase
      .from("empresas_config_fiscal")
      .select("aliquota_imposto_vendas")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    const aliquotaImposto = configFiscal?.aliquota_imposto_vendas ?? 6.0;

    // Coletar SKUs e anuncio_ids para busca em batch
    const skus = items.map((i) => i.sku).filter(Boolean) as string[];
    const anuncioIds = items.map((i) => i.anuncio_id).filter(Boolean) as string[];

    // Buscar mapeamentos produto-marketplace (por anuncio_id ou sku)
    let mappings: Record<string, { produto_id: string; sku_marketplace: string }> = {};
    if (anuncioIds.length > 0 || skus.length > 0) {
      let query = supabase
        .from("produto_marketplace_map")
        .select("produto_id, sku_marketplace, anuncio_id")
        .eq("empresa_id", empresa_id)
        .eq("ativo", true);

      // Buscar por anuncio_id ou sku
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
          if (m.anuncio_id) mappings[`anuncio:${m.anuncio_id}`] = m;
          if (m.sku_marketplace) mappings[`sku:${m.sku_marketplace}`] = m;
        }
      }
    }

    // Buscar custos dos produtos mapeados
    const produtoIds = [...new Set(Object.values(mappings).map((m) => m.produto_id))];
    let produtoCustos: Record<string, number> = {};
    if (produtoIds.length > 0) {
      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, custo_medio")
        .in("id", produtoIds);

      if (produtos) {
        for (const p of produtos) {
          if (p.custo_medio && p.custo_medio > 0) {
            produtoCustos[p.id] = Number(p.custo_medio);
          }
        }
      }
    }

    // Buscar fallback sku_costs
    let skuCosts: Record<string, number> = {};
    if (skus.length > 0) {
      const { data: costs } = await supabase
        .from("sku_costs")
        .select("sku, custo_unitario")
        .eq("empresa_id", empresa_id)
        .in("sku", skus);

      if (costs) {
        for (const c of costs) {
          skuCosts[c.sku] = Number(c.custo_unitario);
        }
      }
    }

    // Calcular margem para cada item
    const results: MarginResult[] = items.map((item) => {
      const preco = item.preco_final;
      const qty = item.quantidade || 1;

      // Resolver custo
      let custoUnitario = 0;
      let fonteCusto: MarginResult["fonte_custo"] = "nao_encontrado";

      // 1) Buscar por anuncio_id -> produto
      const mapByAnuncio = item.anuncio_id ? mappings[`anuncio:${item.anuncio_id}`] : null;
      if (mapByAnuncio && produtoCustos[mapByAnuncio.produto_id]) {
        custoUnitario = produtoCustos[mapByAnuncio.produto_id];
        fonteCusto = "produto";
      }

      // 2) Buscar por SKU -> produto
      if (fonteCusto === "nao_encontrado" && item.sku) {
        const mapBySku = mappings[`sku:${item.sku}`];
        if (mapBySku && produtoCustos[mapBySku.produto_id]) {
          custoUnitario = produtoCustos[mapBySku.produto_id];
          fonteCusto = "produto";
        }
      }

      // 3) Fallback: sku_costs
      if (fonteCusto === "nao_encontrado" && item.sku && skuCosts[item.sku]) {
        custoUnitario = skuCosts[item.sku];
        fonteCusto = "sku_costs";
      }

      // Estimar comissão e tarifa
      const comissao = preco * 0.12; // 12% padrão ML
      const tarifaFixa = estimarTarifaFixaML(preco);
      const freteVendedor = 0; // Sem dados no contexto da extensão
      const imposto = preco * (aliquotaImposto / 100);

      const margem = preco - (custoUnitario * qty) - comissao - tarifaFixa - freteVendedor - imposto;
      const margemPct = preco > 0 ? (margem / preco) * 100 : 0;

      return {
        sku: item.sku || null,
        anuncio_id: item.anuncio_id || null,
        preco_final: preco,
        custo_unitario: custoUnitario,
        comissao: Math.round(comissao * 100) / 100,
        tarifa_fixa: tarifaFixa,
        frete_vendedor: freteVendedor,
        imposto: Math.round(imposto * 100) / 100,
        margem: Math.round(margem * 100) / 100,
        margem_pct: Math.round(margemPct * 100) / 100,
        fonte_custo: fonteCusto,
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no ml-margin-lookup:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
