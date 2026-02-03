
-- Reconstruir a RPC com ordenação explícita por valor numérico
-- e deduplica itens de pedido para evitar contagem duplicada

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
  v_user_empresa_ids uuid[];
BEGIN
  -- Obter empresas do usuário
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  -- Validar acesso
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN; -- Sem acesso, retorna vazio
    END IF;
  END IF;
  
  -- Se não tem nenhuma empresa, retorna vazio
  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Converter datas para timestamptz (fuso BR)
  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas_items_unique AS (
    -- Seleciona itens únicos por (transaction_id, item_id ou sku) para evitar duplicatas
    SELECT DISTINCT ON (mti.id)
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      COALESCE(
        NULLIF(p_by_id.custo_medio, 0), 
        NULLIF(p_by_sku.custo_medio, 0), 
        NULLIF(sc.custo_unitario, 0),
        0
      )::numeric as custo,
      COALESCE(mti.quantidade, 0)::numeric as quantidade,
      COALESCE(mti.preco_total, 0)::numeric as preco_total,
      mt.canal,
      mt.id as transaction_id,
      COALESCE(mt.custo_ads, 0)::numeric as custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND mti.produto_id IS NULL  -- Só usa SKU se não tem produto_id
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = mt.empresa_id
    WHERE 
      mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_inicio
      AND mt.data_transacao < v_fim
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  agregado AS (
    SELECT
      vi.prod_key,
      vi.nome,
      vi.sku,
      vi.imagem_url,
      MAX(vi.custo)::numeric as custo_max,
      SUM(vi.quantidade)::numeric as qtd_sum,
      SUM(vi.preco_total)::numeric as faturado_sum,
      SUM(vi.custo_ads)::numeric as ads_sum,
      jsonb_object_agg(
        vi.canal, 
        vi.quantidade
      ) FILTER (WHERE vi.canal IS NOT NULL) as por_canal_raw
    FROM vendas_items_unique vi
    GROUP BY vi.prod_key, vi.nome, vi.sku, vi.imagem_url
  )
  SELECT
    a.prod_key as produto_id,
    a.nome as produto_nome,
    a.sku as produto_sku,
    a.imagem_url as produto_imagem_url,
    a.custo_max as custo_unitario,
    a.qtd_sum as qtd_total,
    a.faturado_sum as total_faturado,
    a.ads_sum as total_ads,
    COALESCE(a.por_canal_raw, '{}'::jsonb) as por_canal
  FROM agregado a
  ORDER BY a.faturado_sum DESC NULLS LAST  -- Ordenação explícita por valor numérico
  LIMIT p_limite;
END;
$function$;
