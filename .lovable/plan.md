

# Plano: Criar RPC get_top_produtos_vendidos

## Problema Identificado

O Top 10 Produtos ainda está usando uma query direta:

```typescript
// Dashboard.tsx linha 182-209
const { data, error } = await supabase
  .from("marketplace_transaction_items")
  .select(`quantidade, preco_total, ... transaction:marketplace_transactions!inner(...)`)
```

Esta query busca **todos os itens** (30.000+) e processa no frontend, causando **timeout** (erro 57014).

## Solução em 2 Etapas

### Etapa 1: Criar RPC no Banco de Dados

**Arquivo:** `supabase/migrations/[nova]_create_rpc_top_produtos_vendidos.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_limite integer DEFAULT 10
)
RETURNS TABLE(
  produto_id text,
  produto_nome text,
  produto_sku text,
  produto_imagem_url text,
  custo_unitario numeric,
  qtd_total numeric,
  total_faturado numeric,
  total_ads numeric,
  por_canal jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
BEGIN
  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas AS (
    SELECT
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-id') as prod_key,
      COALESCE(p.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p.sku, mti.sku_marketplace, '-') as sku,
      p.imagem_url,
      COALESCE(p.custo_medio, 0) as custo,
      mti.quantidade,
      mti.preco_total,
      mt.canal,
      mt.id as transaction_id,
      mt.custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mt.empresa_id = p_empresa_id
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
  ),
  agregado AS (
    SELECT
      prod_key,
      MAX(nome) as nome,
      MAX(sku) as sku,
      MAX(imagem_url) as imagem_url,
      MAX(custo) as custo,
      SUM(quantidade) as qtd,
      SUM(preco_total) as faturado,
      jsonb_object_agg(COALESCE(canal, 'Outros'), 
        (SELECT SUM(v2.quantidade) FROM vendas v2 
         WHERE v2.prod_key = vendas.prod_key AND v2.canal = vendas.canal)
      ) as por_canal,
      -- Ads por transação única
      (SELECT COALESCE(SUM(DISTINCT custo_ads), 0) 
       FROM vendas v3 WHERE v3.prod_key = vendas.prod_key) as ads
    FROM vendas
    GROUP BY prod_key
  )
  SELECT
    prod_key::text as produto_id,
    nome::text as produto_nome,
    sku::text as produto_sku,
    imagem_url::text as produto_imagem_url,
    custo::numeric as custo_unitario,
    qtd::numeric as qtd_total,
    faturado::numeric as total_faturado,
    ads::numeric as total_ads,
    COALESCE(por_canal, '{}'::jsonb) as por_canal
  FROM agregado
  ORDER BY qtd DESC
  LIMIT p_limite;
END;
$$;
```

### Etapa 2: Atualizar Dashboard.tsx

**Arquivo:** `src/pages/Dashboard.tsx`

Substituir a query direta (linhas 166-219) pela chamada da RPC:

```typescript
// Query para Top 10 produtos mais vendidos - usa RPC otimizada
const {
  data: topProdutosRaw = [],
  isLoading: isTopProdutosLoading
} = useQuery({
  queryKey: ["top-produtos-vendidos", empresaIdFiltro, periodoInicio, periodoFim],
  queryFn: async () => {
    if (!empresaIdFiltro) return [];
    
    const { data, error } = await supabase.rpc("get_top_produtos_vendidos", {
      p_empresa_id: empresaIdFiltro,
      p_data_inicio: periodoInicio,
      p_data_fim: periodoFim,
      p_limite: 10
    });
    
    if (error) {
      console.error("Erro ao buscar top produtos:", error);
      return [];
    }
    return data || [];
  },
  enabled: !!periodoInicio && !!periodoFim && !!empresaIdFiltro
});

// Simplificar processamento - dados já vêm agregados da RPC
const topProdutosProcessados = useMemo(() => {
  const faturamentoTotal = topProdutosRaw.reduce(
    (sum: number, p: any) => sum + Number(p.total_faturado), 0
  );
  
  return topProdutosRaw.map((p: any) => {
    const cmv = Number(p.custo_unitario) * Number(p.qtd_total);
    const lucro = Number(p.total_faturado) - cmv - Number(p.total_ads);
    const margem = Number(p.total_faturado) > 0 
      ? (lucro / Number(p.total_faturado)) * 100 
      : 0;
    
    return {
      id: p.produto_id,
      nome: p.produto_nome,
      sku: p.produto_sku,
      imagemUrl: p.produto_imagem_url,
      custoUnitario: Number(p.custo_unitario),
      qtdTotal: Number(p.qtd_total),
      precoMedio: Number(p.qtd_total) > 0 
        ? Number(p.total_faturado) / Number(p.qtd_total) 
        : 0,
      totalFaturado: Number(p.total_faturado),
      totalAds: Number(p.total_ads),
      lucro,
      margem,
      representatividade: faturamentoTotal > 0 
        ? (Number(p.total_faturado) / faturamentoTotal) * 100 
        : 0,
      porCanal: p.por_canal || {}
    };
  }).slice(0, 10);
}, [topProdutosRaw]);
```

## Arquivos Modificados

1. `supabase/migrations/[nova].sql` - Criar RPC `get_top_produtos_vendidos`
2. `src/pages/Dashboard.tsx` - Substituir query direta por chamada RPC

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Registros transferidos | 30.000+ itens | 10 produtos |
| Tempo de execução | Timeout (>8s) | ~200ms |
| Processamento frontend | Pesado | Mínimo |

