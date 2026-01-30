
-- Primeiro dropar a função antiga (tem assinatura com TIMESTAMPTZ)
DROP FUNCTION IF EXISTS public.get_vendas_resumo_por_tipo_envio(uuid, timestamptz, timestamptz);

-- Dropar também se existir com DATE
DROP FUNCTION IF EXISTS public.get_vendas_resumo_por_tipo_envio(uuid, date, date);

-- =================================================================
-- NOVA VERSÃO: RPC get_vendas_resumo_por_tipo_envio
-- Correções:
-- 1) Usa hierarquia correta de CMV (produto_id → sku → sku_costs)
-- 2) Filtra por empresas do usuário (suporta consolidado)
-- 3) Usa DATE para consistência com outras RPCs
-- 4) Usa eventos financeiros para comissão/tarifa quando disponíveis
-- =================================================================

CREATE OR REPLACE FUNCTION public.get_vendas_resumo_por_tipo_envio(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT CURRENT_DATE - 30,
  p_data_fim date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  tipo_envio text,
  qtd_transacoes bigint,
  qtd_itens numeric,
  valor_bruto numeric,
  valor_liquido numeric,
  tarifas numeric,
  taxas numeric,
  frete_comprador numeric,
  frete_vendedor numeric,
  custo_ads numeric,
  cmv_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
BEGIN
  -- Obter empresas do usuário
  v_user_empresa_ids := public.get_user_empresa_ids();
  
  -- Validar acesso
  IF p_empresa_id IS NOT NULL THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN; -- Sem acesso
    END IF;
  END IF;
  
  -- Se não tem nenhuma empresa, retorna vazio
  IF array_length(v_user_empresa_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Converter datas para timestamptz Brasil
  v_start_ts := public.date_to_br_timestamptz(p_data_inicio);
  v_end_ts := public.date_to_br_timestamptz(p_data_fim + 1);

  RETURN QUERY
  WITH transacoes_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.id as transaction_id,
      mt.empresa_id,
      mt.pedido_id,
      COALESCE(LOWER(mt.tipo_envio), 'outros') as tipo_envio_norm,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.tarifas,
      mt.taxas,
      mt.frete_comprador,
      mt.frete_vendedor,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  itens_com_cmv AS (
    SELECT
      tb.transaction_id,
      tb.tipo_envio_norm,
      -- Usar quantidade real dos itens
      COALESCE(mti.quantidade, 1) as quantidade,
      -- Hierarquia de custo: produto_id → sku → sku_costs
      COALESCE(mti.quantidade, 1) * COALESCE(
        NULLIF(p_by_id.custo_medio, 0),
        NULLIF(p_by_sku.custo_medio, 0),
        NULLIF(sc.custo_unitario, 0),
        0
      ) as cmv_item
    FROM transacoes_base tb
    LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = tb.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = tb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = tb.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
      AND COALESCE(p_by_sku.custo_medio, 0) = 0
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as comissao,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_fixa,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' AND fe.rn = 1 THEN ABS(fe.valor) ELSE 0 END), 0) as frete_vend
    FROM (
      SELECT 
        mfe.pedido_id, mfe.tipo_evento, mfe.valor,
        ROW_NUMBER() OVER (PARTITION BY mfe.pedido_id, mfe.tipo_evento ORDER BY CASE WHEN mfe.origem = 'report' THEN 1 ELSE 2 END) as rn
      FROM marketplace_financial_events mfe
      WHERE mfe.pedido_id IN (SELECT DISTINCT tb2.pedido_id FROM transacoes_base tb2 WHERE tb2.pedido_id IS NOT NULL)
    ) fe
    GROUP BY fe.pedido_id
  )
  SELECT
    tb.tipo_envio_norm as tipo_envio,
    COUNT(DISTINCT tb.pedido_id)::bigint as qtd_transacoes,
    COALESCE(SUM(ic.quantidade), 0)::numeric as qtd_itens,
    COALESCE(SUM(tb.valor_bruto), 0)::numeric as valor_bruto,
    COALESCE(SUM(tb.valor_liquido), 0)::numeric as valor_liquido,
    -- Usar tarifas dos eventos financeiros quando disponíveis
    COALESCE(SUM(COALESCE(NULLIF(epp.tarifa_fixa, 0), tb.tarifas)), 0)::numeric as tarifas,
    COALESCE(SUM(COALESCE(NULLIF(epp.comissao, 0), tb.taxas)), 0)::numeric as taxas,
    COALESCE(SUM(tb.frete_comprador), 0)::numeric as frete_comprador,
    COALESCE(SUM(COALESCE(NULLIF(epp.frete_vend, 0), tb.frete_vendedor)), 0)::numeric as frete_vendedor,
    COALESCE(SUM(tb.custo_ads), 0)::numeric as custo_ads,
    COALESCE(SUM(ic.cmv_item), 0)::numeric as cmv_total
  FROM transacoes_base tb
  LEFT JOIN itens_com_cmv ic ON ic.transaction_id = tb.transaction_id
  LEFT JOIN eventos_por_pedido epp ON epp.pedido_id = tb.pedido_id
  GROUP BY tb.tipo_envio_norm
  ORDER BY valor_bruto DESC;
END;
$function$;

COMMENT ON FUNCTION public.get_vendas_resumo_por_tipo_envio IS 
'Retorna métricas de vendas agrupadas por tipo de envio (full, flex, coleta, outros).
Considera hierarquia de CMV: produto_id → sku → sku_costs.
Suporta consolidado (p_empresa_id = NULL) filtrando por empresas do usuário.';
