
-- ================================================================
-- FIX: Permitir múltiplos orders por pack no marketplace_transactions
-- 
-- PROBLEMA: uq_mkt_venda_pedido impede múltiplos orders no mesmo pack
-- porque pedido_id era definido como pack_id quando existia.
-- 
-- SOLUÇÃO:
-- 1. Remover uq_mkt_venda_pedido
-- 2. Backfill: pedido_id deve ser order.id (referencia_externa), pack_id separado
-- 3. Atualizar RPCs para agrupar por COALESCE(pack_id, pedido_id)
-- ================================================================

-- 1) Remover o índice único problemático
DROP INDEX IF EXISTS uq_mkt_venda_pedido;

-- 2) Backfill: corrigir registros onde pedido_id foi definido como pack_id
-- Para registros ML onde pedido_id != referencia_externa e pack_id IS NOT NULL,
-- isso significa que pedido_id foi incorretamente setado como pack_id
UPDATE marketplace_transactions
SET pedido_id = referencia_externa
WHERE canal = 'Mercado Livre'
  AND pack_id IS NOT NULL
  AND pedido_id = pack_id
  AND pedido_id != referencia_externa
  AND tipo_transacao = 'venda';

-- 3) Backfill: preencher pack_id a partir de raw_order para quem não tem
UPDATE marketplace_transactions
SET pack_id = raw_order->>'pack_id'
WHERE pack_id IS NULL
  AND raw_order IS NOT NULL
  AND raw_order->>'pack_id' IS NOT NULL
  AND (raw_order->>'pack_id') != '';

-- 4) Criar índice para buscas por pack_id (não único!)
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pack_id 
  ON marketplace_transactions(pack_id) 
  WHERE pack_id IS NOT NULL;

-- 5) Criar índice composto para agrupamento por pack na UI
CREATE INDEX IF NOT EXISTS idx_mkt_tx_group_key 
  ON marketplace_transactions(empresa_id, canal, tipo_transacao, tipo_lancamento, pack_id, pedido_id);

-- ================================================================
-- 6) Atualizar RPC get_vendas_por_pedido para agrupar por pack
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  empresa_nome_fantasia text,
  canal text,
  conta_nome text,
  data_pedido timestamptz,
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
  primeiro_anuncio_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
BEGIN
  -- Converter strings para timestamps em UTC (período BR = UTC-3)
  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  RETURN QUERY
  WITH vendas AS (
    SELECT
      -- group_key: pack_id quando existir, senão pedido_id
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
  -- Agregar itens por transação
  itens_por_tx AS (
    SELECT
      mti.transaction_id,
      SUM(mti.quantidade) AS qtd,
      MIN(mti.anuncio_id) AS primeiro_anuncio,
      SUM(CASE WHEN p.custo_medio > 0 THEN mti.quantidade * p.custo_medio ELSE 0 END) AS cmv,
      BOOL_OR(p.custo_medio IS NOT NULL AND p.custo_medio > 0) AS has_cmv
    FROM marketplace_transaction_items mti
    LEFT JOIN produtos p ON p.id = mti.produto_id
    WHERE mti.transaction_id IN (SELECT tx_id FROM vendas)
    GROUP BY mti.transaction_id
  ),
  -- Agregar por group_key (pack)
  agregado AS (
    SELECT
      v.group_key,
      v.empresa_id,
      v.empresa_nome_fantasia,
      v.canal,
      MAX(v.conta_nome) AS conta_nome,
      MIN(v.data_transacao) AS data_pedido,
      MAX(v.data_repasse) AS data_repasse,
      -- Status: priorizar importado > pendente_sync > pendente
      MAX(v.status) AS status,
      MAX(v.tipo_envio) AS tipo_envio,
      SUM(COALESCE(v.valor_bruto, 0)) AS valor_produto,
      -- Comissão: NULL se TODOS forem null, senão soma
      CASE WHEN BOOL_AND(v.taxas IS NULL) THEN NULL ELSE SUM(COALESCE(v.taxas, 0)) END AS comissao_total,
      CASE WHEN BOOL_AND(v.tarifas IS NULL) THEN NULL ELSE SUM(COALESCE(v.tarifas, 0)) END AS tarifa_fixa_total,
      CASE WHEN BOOL_AND(v.frete_vendedor IS NULL) THEN NULL ELSE SUM(COALESCE(v.frete_vendedor, 0)) END AS frete_vendedor_total,
      SUM(COALESCE(v.custo_ads, 0)) AS ads_total,
      SUM(COALESCE(v.outros_descontos, 0)) AS outros_descontos_total,
      SUM(COALESCE(v.valor_liquido, 0)) AS valor_liquido_calc,
      -- Itens: somar de todas as transactions do pack
      COALESCE(SUM(ipt.qtd), 0) AS qtd_itens_total,
      -- CMV: somar de todas as transactions
      SUM(COALESCE(ipt.cmv, 0)) AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv_any,
      -- Primeiro anuncio_id para thumbnail
      MIN(ipt.primeiro_anuncio) AS first_anuncio
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    GROUP BY v.group_key, v.empresa_id, v.empresa_nome_fantasia, v.canal
  ),
  -- Filtros pós-agregação
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
    -- Impostos: calcular com base na config fiscal da empresa
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
    f.first_anuncio AS primeiro_anuncio_id
  FROM filtrado f
  LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = f.empresa_id
  ORDER BY f.data_pedido DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ================================================================
-- 7) Atualizar RPC get_vendas_por_pedido_count
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_tipo_envio text DEFAULT NULL,
  p_tem_custo text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_count bigint;
BEGIN
  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  SELECT COUNT(DISTINCT COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa))
  INTO v_count
  FROM marketplace_transactions mt
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
         mt.descricao ILIKE '%' || p_busca || '%');

  -- Apply tem_custo filter if needed (requires join, separate query)
  IF p_tem_custo IS NOT NULL THEN
    WITH groups AS (
      SELECT
        COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa) AS gk,
        BOOL_OR(p.custo_medio IS NOT NULL AND p.custo_medio > 0) AS has_cmv
      FROM marketplace_transactions mt
      LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
      LEFT JOIN produtos p ON p.id = mti.produto_id
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
             mt.referencia_externa ILIKE '%' || p_busca || '%')
      GROUP BY gk
    )
    SELECT COUNT(*)
    INTO v_count
    FROM groups
    WHERE (p_tem_custo = 'com_custo' AND has_cmv = true)
       OR (p_tem_custo = 'sem_custo' AND has_cmv = false);
  END IF;

  RETURN v_count;
END;
$$;

-- ================================================================
-- 8) Atualizar RPC get_vendas_por_pedido_resumo
-- ================================================================
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio text DEFAULT NULL,
  p_data_fim text DEFAULT NULL
)
RETURNS TABLE(
  total_pedidos bigint,
  total_itens numeric,
  valor_produto_total numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  valor_liquido_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv bigint,
  pedidos_sem_cmv bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.custo_ads,
      mt.outros_descontos,
      mt.valor_liquido,
      mt.id AS tx_id
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (p_empresa_id IS NULL OR mt.empresa_id = p_empresa_id)
  ),
  itens_por_tx AS (
    SELECT
      mti.transaction_id,
      SUM(mti.quantidade) AS qtd,
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
      SUM(COALESCE(v.valor_bruto, 0)) AS val_bruto,
      SUM(COALESCE(v.taxas, 0)) AS taxas_sum,
      SUM(COALESCE(v.tarifas, 0)) AS tarifas_sum,
      SUM(COALESCE(v.frete_vendedor, 0)) AS frete_v_sum,
      SUM(COALESCE(v.custo_ads, 0)) AS ads_sum,
      SUM(COALESCE(v.outros_descontos, 0)) AS desc_sum,
      SUM(COALESCE(v.valor_liquido, 0)) AS liq_sum,
      COALESCE(SUM(ipt.qtd), 0) AS qtd_sum,
      SUM(COALESCE(ipt.cmv, 0)) AS cmv_sum,
      BOOL_OR(COALESCE(ipt.has_cmv, false)) AS has_cmv
    FROM vendas v
    LEFT JOIN itens_por_tx ipt ON ipt.transaction_id = v.tx_id
    GROUP BY v.group_key, v.empresa_id
  )
  SELECT
    COUNT(*)::bigint AS total_pedidos,
    SUM(a.qtd_sum) AS total_itens,
    SUM(a.val_bruto) AS valor_produto_total,
    SUM(a.taxas_sum) AS comissao_total,
    SUM(a.tarifas_sum) AS tarifa_fixa_total,
    SUM(a.frete_v_sum) AS frete_vendedor_total,
    SUM(a.ads_sum) AS ads_total,
    SUM(a.val_bruto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100) AS impostos_total,
    SUM(a.liq_sum) AS valor_liquido_total,
    SUM(a.cmv_sum) AS cmv_total,
    SUM(CASE WHEN a.has_cmv THEN a.liq_sum - a.cmv_sum - (a.val_bruto * COALESCE(ecf.aliquota_imposto_vendas, 6) / 100) ELSE 0 END) AS margem_contribuicao_total,
    COUNT(*) FILTER (WHERE a.has_cmv)::bigint AS pedidos_com_cmv,
    COUNT(*) FILTER (WHERE NOT a.has_cmv)::bigint AS pedidos_sem_cmv
  FROM agregado a
  LEFT JOIN empresas_config_fiscal ecf ON ecf.empresa_id = a.empresa_id;
END;
$$;
