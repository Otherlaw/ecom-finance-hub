
CREATE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio text DEFAULT NULL::text,
  p_data_fim text DEFAULT NULL::text,
  p_canal text DEFAULT NULL::text,
  p_conta text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text,
  p_tipo_envio text DEFAULT NULL::text,
  p_tem_custo text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamp with time zone,
  data_repasse date,
  status text,
  tipo_envio text,
  valor_produto numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  outros_descontos_total numeric,
  valor_liquido_calculado numeric,
  qtd_itens bigint,
  cmv_total numeric,
  margem_contribuicao numeric,
  tem_cmv boolean,
  primeiro_anuncio_id text,
  anuncio_ids text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
BEGIN
  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  RETURN QUERY
  WITH vendas AS (
    SELECT
      COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS group_key,
      mt.empresa_id,
      e.nome_fantasia AS empresa_nome_fantasia,
      mt.canal,
      mt.conta_nome,
      mt.data_transacao,
      mt.data_repasse,
      mt.status,
      mt.tipo_envio,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads,
      mt.outros_descontos,
      mt.valor_liquido,
      mt.id AS tx_id
    FROM marketplace_transactions mt
    LEFT JOIN empresas e ON e.id = mt.empresa_id
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio = p_tipo_envio)
      AND (p_busca IS NULL OR 
           mt.pedido_id ILIKE '%' || p_busca || '%' OR
           mt.pack_id ILIKE '%' || p_busca || '%' OR
           mt.referencia_externa ILIKE '%' || p_busca || '%' OR
           mt.descricao ILIKE '%' || p_busca || '%')
  ),
  itens_por_tx AS (
    SELECT
      mti.transaction_id,
      SUM(mti.quantidade) AS qtd,
      MIN(mti.anuncio_id) AS primeiro_anuncio,
      array_remove(array_agg(DISTINCT mti.anuncio_id ORDER BY mti.anuncio_id), NULL) AS anuncio_id_arr,
      SUM(CASE WHEN p.custo_medio > 0 THEN mti.quantidade * p.custo_medio ELSE 0 END) AS cmv,
      BOOL_OR(p.custo_medio IS NOT NULL AND p.custo_medio > 0) AS has_cmv
    FROM marketplace_transaction_items mti
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mti.transaction_id IN (SELECT tx_id FROM vendas)
    GROUP BY mti.transaction_id
  ),
  agregado AS (
    SELECT
      v.group_key,
      v.empresa_id,
      v.empresa_nome_fantasia,
      v.canal,
      MAX(v.conta_nome) AS conta_nome,
      MIN(v.data_transacao) AS data_pedido,
      MAX(v.data_repasse) AS data_repasse,
      MAX(v.status) AS status,
      MAX(v.tipo_envio) AS tipo_envio,
      SUM(COALESCE(v.valor_bruto, 0)) AS valor_produto,
      CASE WHEN BOOL_AND(v.taxas IS NULL) THEN NULL ELSE SUM(COALESCE(v.taxas, 0)) END AS comissao_total,
      CASE WHEN BOOL_AND(v.tarifas IS NULL) THEN NULL ELSE SUM(COALESCE(v.tarifas, 0)) END AS tarifa_fixa_total,
      CASE WHEN BOOL_AND(v.frete_vendedor IS NULL) THEN NULL ELSE SUM(COALESCE(v.frete_vendedor, 0)) END AS frete_vendedor_total,
      SUM(COALESCE(v.custo_ads, 0)) AS ads_total,
      SUM(COALESCE(v.outros_descontos, 0)) AS outros_descontos_total,
      SUM(COALESCE(v.valor_liquido, 0)) AS valor_liquido_calc,
      COALESCE(SUM(ipt.qtd), 0)::bigint AS qtd_itens_total,
      SUM(COALESCE(ipt.cmv, 0)) AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv_any,
      MIN(ipt.primeiro_anuncio) AS first_anuncio,
      array_remove(
        array_agg(DISTINCT unnested_id ORDER BY unnested_id),
        NULL
      ) AS merged_anuncio_ids
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    LEFT JOIN LATERAL unnest(COALESCE(ipt.anuncio_id_arr, ARRAY[]::text[])) AS unnested_id ON true
    GROUP BY v.group_key, v.empresa_id, v.empresa_nome_fantasia, v.canal
  ),
  filtrado AS (
    SELECT *
    FROM agregado a
    WHERE (p_tem_custo IS NULL 
           OR (p_tem_custo = 'com_custo' AND a.has_cmv_any = true)
           OR (p_tem_custo = 'sem_custo' AND a.has_cmv_any = false))
  )
  SELECT
    f.group_key AS pedido_id,
    f.empresa_id,
    f.empresa_nome_fantasia,
    f.canal,
    f.conta_nome,
    f.data_pedido,
    f.data_repasse,
    f.status,
    f.tipo_envio,
    f.valor_produto,
    f.comissao_total,
    f.tarifa_fixa_total,
    f.frete_vendedor_total,
    f.ads_total,
    COALESCE(
      f.valor_produto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100,
      0
    ) AS impostos_total,
    f.outros_descontos_total,
    f.valor_liquido_calc AS valor_liquido_calculado,
    f.qtd_itens_total AS qtd_itens,
    CASE WHEN f.has_cmv_any THEN f.cmv_sum ELSE NULL END AS cmv_total,
    CASE WHEN f.has_cmv_any THEN
      f.valor_liquido_calc 
      - f.cmv_sum 
      - COALESCE(f.valor_produto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100, 0)
    ELSE NULL END AS margem_contribuicao,
    f.has_cmv_any AS tem_cmv,
    f.first_anuncio AS primeiro_anuncio_id,
    COALESCE(f.merged_anuncio_ids, ARRAY[]::text[]) AS anuncio_ids
  FROM filtrado f
  LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = f.empresa_id
  ORDER BY f.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
