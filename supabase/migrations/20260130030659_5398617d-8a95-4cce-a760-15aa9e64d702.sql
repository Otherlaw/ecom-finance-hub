-- ================================================================
-- CORREÇÃO DE SEGURANÇA: ISOLAMENTO MULTI-TENANT
-- ================================================================

-- PARTE 1: Remover Policies RLS Duplicadas
-- ================================================================

-- Empresas - remover duplicatas
DROP POLICY IF EXISTS "empresas_delete_owner" ON empresas;
DROP POLICY IF EXISTS "empresas_select_own" ON empresas;
DROP POLICY IF EXISTS "empresas_update_owner" ON empresas;
DROP POLICY IF EXISTS "empresas_insert_authenticated" ON empresas;
DROP POLICY IF EXISTS "empresas_insert" ON empresas;

-- Profiles - remover duplicatas
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- User_empresas - remover duplicatas
DROP POLICY IF EXISTS "user_empresas_select_own" ON user_empresas;
DROP POLICY IF EXISTS "user_empresas_delete_owner" ON user_empresas;
DROP POLICY IF EXISTS "user_empresas_insert_via_trigger" ON user_empresas;

-- ================================================================
-- PARTE 2: Criar função get_user_empresa_ids()
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_user_empresa_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    ARRAY_AGG(ue.empresa_id),
    ARRAY[]::uuid[]
  )
  FROM user_empresas ue
  WHERE ue.user_id = auth.uid();
$$;

-- ================================================================
-- PARTE 3: Corrigir RPC get_dashboard_kpis_period
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis_period(
  p_empresa_id uuid, 
  p_data_inicio date, 
  p_data_fim date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim_exclusivo TIMESTAMPTZ;
  v_result JSONB;
  v_user_empresa_ids uuid[];
  v_is_admin boolean;
BEGIN
  -- Obter empresas do usuário e verificar se é admin
  v_user_empresa_ids := public.get_user_empresa_ids();
  v_is_admin := public.has_role(auth.uid(), 'admin');
  
  -- Validar acesso: se empresa específica, verificar se usuário tem acesso
  IF p_empresa_id IS NOT NULL AND NOT v_is_admin THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN '{}'::jsonb; -- Sem acesso
    END IF;
  END IF;

  v_inicio := CASE WHEN p_data_inicio IS NOT NULL THEN public.date_to_br_timestamptz(p_data_inicio) ELSE NULL END;
  v_fim_exclusivo := CASE WHEN p_data_fim IS NOT NULL THEN public.date_to_br_timestamptz(p_data_fim + 1) ELSE NULL END;

  WITH 
  vendas_transacoes AS (
    SELECT
      mt.canal,
      mt.pedido_id,
      mt.tipo_lancamento,
      mt.valor_bruto,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor,
      mt.frete_comprador,
      mt.custo_ads
    FROM marketplace_transactions mt
    WHERE 
      (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  
  eventos_financeiros AS (
    SELECT
      fe.pedido_id,
      fe.tipo_evento,
      fe.valor,
      fe.origem,
      ROW_NUMBER() OVER (
        PARTITION BY fe.pedido_id, fe.tipo_evento 
        ORDER BY CASE WHEN fe.origem = 'report' THEN 1 ELSE 2 END
      ) AS rn
    FROM marketplace_financial_events fe
    WHERE 
      (v_inicio IS NULL OR fe.data_evento >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR fe.data_evento < v_fim_exclusivo)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN fe.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE fe.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  eventos_priorizados AS (
    SELECT pedido_id, tipo_evento, valor, origem
    FROM eventos_financeiros
    WHERE rn = 1
  ),
  
  cmv_periodo AS (
    SELECT
      COALESCE(SUM(
        mti.quantidade * COALESCE(
          NULLIF(p_by_id.custo_medio, 0),
          NULLIF(p_by_sku.custo_medio, 0),
          NULLIF(sc.custo_unitario, 0),
          0
        )
      ), 0) AS cmv_total,
      COUNT(DISTINCT CASE 
        WHEN COALESCE(NULLIF(p_by_id.custo_medio, 0), NULLIF(p_by_sku.custo_medio, 0), NULLIF(sc.custo_unitario, 0)) > 0 
        THEN mti.id 
      END) AS itens_com_custo,
      COUNT(DISTINCT mti.id) AS total_itens
    FROM marketplace_transactions mt
    INNER JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
    LEFT JOIN sku_costs sc ON 
      sc.sku = mti.sku_marketplace 
      AND sc.empresa_id = mt.empresa_id
      AND (mti.produto_id IS NULL OR COALESCE(p_by_id.custo_medio, 0) = 0)
      AND COALESCE(p_by_sku.custo_medio, 0) = 0
    WHERE 
      mt.tipo_lancamento = 'credito'
      AND (v_inicio IS NULL OR mt.data_transacao >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data_transacao < v_fim_exclusivo)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  
  despesas_banco AS (
    SELECT
      COALESCE(SUM(ABS(bt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM bank_transactions bt
    WHERE 
      bt.tipo_lancamento IN ('saida', 'debito')
      AND bt.status != 'cancelado'
      AND (v_inicio IS NULL OR bt.data_transacao::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR bt.data_transacao::TIMESTAMPTZ < v_fim_exclusivo)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN bt.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE bt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  
  despesas_manuais AS (
    SELECT
      COALESCE(SUM(ABS(mt.valor)), 0) AS total_despesas,
      COUNT(*) AS qtd_despesas
    FROM manual_transactions mt
    WHERE 
      mt.tipo IN ('saida', 'despesa')
      AND mt.status = 'aprovado'
      AND (v_inicio IS NULL OR mt.data::TIMESTAMPTZ >= v_inicio)
      AND (v_fim_exclusivo IS NULL OR mt.data::TIMESTAMPTZ < v_fim_exclusivo)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
  ),
  
  metricas_vendas AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS faturamento_bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS receita_liquida,
      COALESCE(SUM(COALESCE(taxas, 0)), 0) AS comissao_total_legado,
      COALESCE(SUM(COALESCE(tarifas, 0)), 0) AS tarifa_fixa_total_legado,
      COALESCE(SUM(COALESCE(frete_vendedor, 0)), 0) AS frete_vendedor_total,
      COALESCE(SUM(COALESCE(frete_comprador, 0)), 0) AS frete_comprador_total,
      COALESCE(SUM(COALESCE(custo_ads, 0)), 0) AS ads_total,
      COUNT(DISTINCT pedido_id) AS pedidos_unicos,
      COUNT(*) AS total_transacoes
    FROM vendas_transacoes
  ),
  
  metricas_eventos AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo_evento = 'comissao' THEN ABS(valor) ELSE 0 END), 0) AS comissao_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento IN ('tarifa_fixa', 'tarifa_financeira') THEN ABS(valor) ELSE 0 END), 0) AS tarifa_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'frete_vendedor' THEN ABS(valor) ELSE 0 END), 0) AS frete_vendedor_eventos,
      COALESCE(SUM(CASE WHEN tipo_evento = 'ads' THEN ABS(valor) ELSE 0 END), 0) AS ads_eventos,
      COUNT(*) AS total_eventos,
      COUNT(*) FILTER (WHERE origem = 'report') AS eventos_report
    FROM eventos_priorizados
  ),
  
  por_canal AS (
    SELECT
      canal,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN valor_bruto ELSE 0 END), 0) AS bruto,
      COALESCE(SUM(CASE WHEN tipo_lancamento = 'credito' THEN 
        valor_bruto - COALESCE(taxas, 0) - COALESCE(tarifas, 0) - COALESCE(frete_vendedor, 0) - COALESCE(custo_ads, 0)
      ELSE 0 END), 0) AS liquido,
      COUNT(DISTINCT pedido_id) AS pedidos
    FROM vendas_transacoes
    GROUP BY canal
  )
  
  SELECT jsonb_build_object(
    'faturamento_bruto', mv.faturamento_bruto,
    'receita_liquida', mv.receita_liquida,
    'pedidos_unicos', mv.pedidos_unicos,
    'total_transacoes', mv.total_transacoes,
    'comissao_total', CASE WHEN me.total_eventos > 0 THEN me.comissao_eventos ELSE mv.comissao_total_legado END,
    'tarifa_fixa_total', CASE WHEN me.total_eventos > 0 THEN me.tarifa_eventos ELSE mv.tarifa_fixa_total_legado END,
    'frete_vendedor_total', CASE WHEN me.total_eventos > 0 THEN me.frete_vendedor_eventos ELSE mv.frete_vendedor_total END,
    'ads_total', CASE WHEN me.total_eventos > 0 THEN me.ads_eventos ELSE mv.ads_total END,
    'impostos_total', ROUND(mv.faturamento_bruto * 0.06, 2),
    'impostos_estimado', TRUE,
    'cmv_total', cmv.cmv_total,
    'cmv_itens_com_custo', cmv.itens_com_custo,
    'cmv_total_itens', cmv.total_itens,
    'cmv_completo', cmv.itens_com_custo = cmv.total_itens AND cmv.total_itens > 0,
    'despesas_operacionais_total', db.total_despesas + dm.total_despesas,
    'despesas_banco', db.total_despesas,
    'despesas_manuais', dm.total_despesas,
    'qtd_despesas', db.qtd_despesas + dm.qtd_despesas,
    'lucro_bruto', mv.receita_liquida - cmv.cmv_total,
    'lucro_liquido', mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas),
    'margem_bruta_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'margem_liquida_pct', CASE WHEN mv.faturamento_bruto > 0 
      THEN ROUND(((mv.receita_liquida - cmv.cmv_total - (db.total_despesas + dm.total_despesas)) / mv.faturamento_bruto * 100), 2) 
      ELSE 0 END,
    'ticket_medio', CASE WHEN mv.pedidos_unicos > 0 
      THEN ROUND(mv.faturamento_bruto / mv.pedidos_unicos, 2) 
      ELSE 0 END,
    'por_canal', COALESCE((
      SELECT jsonb_object_agg(canal, jsonb_build_object('bruto', bruto, 'liquido', liquido, 'pedidos', pedidos))
      FROM por_canal
    ), '{}'::jsonb),
    'tem_eventos_financeiros', me.total_eventos > 0,
    'eventos_de_relatorio', me.eventos_report
  ) INTO v_result
  FROM metricas_vendas mv
  CROSS JOIN metricas_eventos me
  CROSS JOIN cmv_periodo cmv
  CROSS JOIN despesas_banco db
  CROSS JOIN despesas_manuais dm;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;

-- ================================================================
-- PARTE 4: Corrigir RPC get_top_produtos_vendidos
-- ================================================================

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
  v_is_admin boolean;
BEGIN
  -- Obter empresas do usuário e verificar se é admin
  v_user_empresa_ids := public.get_user_empresa_ids();
  v_is_admin := public.has_role(auth.uid(), 'admin');
  
  -- Validar acesso
  IF p_empresa_id IS NOT NULL AND NOT v_is_admin THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN; -- Sem acesso, retorna vazio
    END IF;
  END IF;

  v_inicio := date_to_br_timestamptz(p_data_inicio);
  v_fim := date_to_br_timestamptz(p_data_fim + 1);
  
  RETURN QUERY
  WITH vendas_items AS (
    SELECT
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      COALESCE(
        NULLIF(p_by_id.custo_medio, 0), 
        NULLIF(p_by_sku.custo_medio, 0), 
        NULLIF(sc.custo_unitario, 0),
        0
      ) as custo,
      COALESCE(mti.quantidade, 0) as quantidade,
      COALESCE(mti.preco_total, 0) as preco_total,
      mt.canal,
      mt.id as transaction_id,
      COALESCE(mt.custo_ads, 0) as custo_ads
    FROM marketplace_transaction_items mti
    INNER JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
    LEFT JOIN produtos p_by_id ON p_by_id.id = mti.produto_id
    LEFT JOIN produtos p_by_sku ON 
      p_by_sku.sku = mti.sku_marketplace 
      AND p_by_sku.empresa_id = mt.empresa_id
      AND p_by_sku.id IS DISTINCT FROM mti.produto_id
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
          WHEN v_is_admin THEN true
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
      MAX(vi.custo) as custo_unitario,
      SUM(vi.quantidade) as qtd_total,
      SUM(vi.preco_total) as total_faturado,
      SUM(vi.custo_ads) as total_ads,
      jsonb_object_agg(
        vi.canal, 
        vi.quantidade
      ) FILTER (WHERE vi.canal IS NOT NULL) as por_canal_raw
    FROM vendas_items vi
    GROUP BY vi.prod_key, vi.nome, vi.sku, vi.imagem_url
  )
  SELECT
    a.prod_key as produto_id,
    a.nome as produto_nome,
    a.sku as produto_sku,
    a.imagem_url as produto_imagem_url,
    a.custo_unitario,
    a.qtd_total,
    a.total_faturado,
    a.total_ads,
    COALESCE(a.por_canal_raw, '{}'::jsonb) as por_canal
  FROM agregado a
  ORDER BY a.total_faturado DESC
  LIMIT p_limite;
END;
$function$;

-- ================================================================
-- PARTE 5: Corrigir RPC get_vendas_por_pedido
-- ================================================================

DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id text,
  empresa_id uuid,
  canal text,
  conta_nome text,
  status text,
  data_pedido timestamptz,
  data_repasse date,
  valor_produto numeric,
  valor_liquido_calculado numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  outros_descontos_total numeric,
  qtd_itens numeric,
  cmv_total numeric,
  tem_cmv boolean,
  margem_contribuicao numeric,
  tipo_envio text,
  status_enriquecimento text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
  v_is_admin boolean;
BEGIN
  -- Obter empresas do usuário e verificar se é admin
  v_user_empresa_ids := public.get_user_empresa_ids();
  v_is_admin := public.has_role(auth.uid(), 'admin');
  
  -- Validar acesso
  IF p_empresa_id IS NOT NULL AND NOT v_is_admin THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      RETURN; -- Sem acesso
    END IF;
  END IF;

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_agregados AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      mt.canal,
      mt.conta_nome,
      mt.status,
      mt.data_transacao,
      mt.data_repasse,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
      mt.frete_vendedor as frete_vend,
      mt.custo_ads as ads,
      mt.outros_descontos,
      mt.tipo_envio,
      mt.status_enriquecimento
    FROM marketplace_transactions mt
    WHERE mt.pedido_id IS NOT NULL
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_start_ts
      AND mt.data_transacao < v_end_ts
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
      AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  pedidos_com_calculo AS (
    SELECT 
      pa.*,
      COALESCE((
        SELECT SUM(COALESCE(mti.quantidade, 1))
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), 1) as qtd_itens_calc,
      COALESCE((
        SELECT SUM(
          COALESCE(mti.quantidade, 1) * COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pa.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pa.empresa_id LIMIT 1), 0),
            0
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), 0) as cmv_calculado,
      COALESCE((
        SELECT bool_and(
          COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pa.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pa.empresa_id LIMIT 1), 0)
          ) IS NOT NULL
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pa.transaction_id
      ), false) as tem_cmv_calc
    FROM pedidos_agregados pa
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) as comissao_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira', 'tarifa_frete_gratis') THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) as frete_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) as ads_evt
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IN (SELECT pcc.pedido_id FROM pedidos_com_calculo pcc)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN fe.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE fe.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    GROUP BY fe.pedido_id
  )
  SELECT
    pcc.pedido_id::text,
    pcc.empresa_id,
    pcc.canal::text,
    pcc.conta_nome::text,
    pcc.status::text,
    pcc.data_transacao as data_pedido,
    pcc.data_repasse::date,
    pcc.valor_bruto::numeric as valor_produto,
    pcc.valor_liquido::numeric as valor_liquido_calculado,
    COALESCE(NULLIF(ep.comissao_evt, 0), pcc.taxas)::numeric as comissao_total,
    COALESCE(NULLIF(ep.tarifa_evt, 0), pcc.tarifas)::numeric as tarifa_fixa_total,
    COALESCE(NULLIF(ep.frete_evt, 0), pcc.frete_vend)::numeric as frete_vendedor_total,
    COALESCE(NULLIF(ep.ads_evt, 0), pcc.ads)::numeric as ads_total,
    ROUND(pcc.valor_bruto * 0.06, 2)::numeric as impostos_total,
    COALESCE(pcc.outros_descontos, 0)::numeric as outros_descontos_total,
    pcc.qtd_itens_calc::numeric as qtd_itens,
    pcc.cmv_calculado::numeric as cmv_total,
    pcc.tem_cmv_calc as tem_cmv,
    CASE 
      WHEN pcc.tem_cmv_calc THEN
        (pcc.valor_bruto 
         - COALESCE(NULLIF(ep.comissao_evt, 0), pcc.taxas)
         - COALESCE(NULLIF(ep.tarifa_evt, 0), pcc.tarifas)
         - COALESCE(NULLIF(ep.frete_evt, 0), pcc.frete_vend)
         - COALESCE(NULLIF(ep.ads_evt, 0), pcc.ads)
         - ROUND(pcc.valor_bruto * 0.06, 2)
         - pcc.cmv_calculado
        )::numeric
      ELSE NULL
    END as margem_contribuicao,
    pcc.tipo_envio::text,
    pcc.status_enriquecimento::text
  FROM pedidos_com_calculo pcc
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pcc.pedido_id
  ORDER BY pcc.data_transacao DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ================================================================
-- PARTE 6: Corrigir RPC get_vendas_por_pedido_resumo
-- ================================================================

DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date, text, text, text);

CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_resumo(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_data_fim date DEFAULT CURRENT_DATE,
  p_canal text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  total_pedidos bigint,
  total_itens numeric,
  valor_produto_total numeric,
  valor_liquido_total numeric,
  comissao_total numeric,
  tarifa_fixa_total numeric,
  frete_vendedor_total numeric,
  ads_total numeric,
  impostos_total numeric,
  cmv_total numeric,
  margem_contribuicao_total numeric,
  pedidos_com_cmv bigint,
  pedidos_sem_cmv bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_user_empresa_ids uuid[];
  v_is_admin boolean;
BEGIN
  -- Obter empresas do usuário e verificar se é admin
  v_user_empresa_ids := public.get_user_empresa_ids();
  v_is_admin := public.has_role(auth.uid(), 'admin');
  
  -- Validar acesso
  IF p_empresa_id IS NOT NULL AND NOT v_is_admin THEN
    IF NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
      -- Retorna zeros se não tem acesso
      RETURN QUERY SELECT 0::bigint, 0::numeric, 0::numeric, 0::numeric, 
                          0::numeric, 0::numeric, 0::numeric, 0::numeric,
                          0::numeric, 0::numeric, 0::numeric, 0::bigint, 0::bigint;
      RETURN;
    END IF;
  END IF;

  v_start_ts := (p_data_inicio::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_end_ts := ((p_data_fim + INTERVAL '1 day')::date::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY
  WITH pedidos_base AS (
    SELECT DISTINCT ON (mt.pedido_id)
      mt.pedido_id,
      mt.id as transaction_id,
      mt.empresa_id,
      mt.valor_bruto,
      mt.valor_liquido,
      mt.taxas,
      mt.tarifas,
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
          WHEN v_is_admin THEN true
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
      AND (p_canal IS NULL OR mt.canal ILIKE '%' || p_canal || '%')
      AND (p_conta IS NULL OR mt.conta_nome ILIKE '%' || p_conta || '%')
      AND (p_status IS NULL OR mt.status ILIKE '%' || p_status || '%')
    ORDER BY mt.pedido_id, mt.data_transacao DESC
  ),
  pedidos_com_itens AS (
    SELECT 
      pb.*,
      COALESCE((
        SELECT SUM(COALESCE(mti.quantidade, 1))
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pb.transaction_id
      ), 1) as qtd_itens,
      COALESCE((
        SELECT SUM(
          COALESCE(mti.quantidade, 1) * COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pb.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pb.empresa_id LIMIT 1), 0),
            0
          )
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pb.transaction_id
      ), 0) as cmv_calculado,
      COALESCE((
        SELECT bool_and(
          COALESCE(
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.id = mti.produto_id), 0),
            NULLIF((SELECT p.custo_medio FROM produtos p WHERE p.sku = mti.sku_marketplace AND p.empresa_id = pb.empresa_id LIMIT 1), 0),
            NULLIF((SELECT sc.custo_unitario FROM sku_costs sc WHERE sc.sku = mti.sku_marketplace AND sc.empresa_id = pb.empresa_id LIMIT 1), 0)
          ) IS NOT NULL
        )
        FROM marketplace_transaction_items mti
        WHERE mti.transaction_id = pb.transaction_id
      ), false) as tem_cmv_flag
    FROM pedidos_base pb
  ),
  eventos_por_pedido AS (
    SELECT
      fe.pedido_id,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'comissao' THEN ABS(fe.valor) ELSE 0 END), 0) as comissao_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento IN ('tarifa_fixa', 'tarifa_financeira', 'tarifa_frete_gratis') THEN ABS(fe.valor) ELSE 0 END), 0) as tarifa_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'frete_vendedor' THEN ABS(fe.valor) ELSE 0 END), 0) as frete_evt,
      COALESCE(SUM(CASE WHEN fe.tipo_evento = 'ads' THEN ABS(fe.valor) ELSE 0 END), 0) as ads_evt
    FROM marketplace_financial_events fe
    WHERE fe.pedido_id IN (SELECT pedido_id FROM pedidos_base)
      AND (
        CASE 
          WHEN p_empresa_id IS NOT NULL THEN fe.empresa_id = p_empresa_id
          WHEN v_is_admin THEN true
          ELSE fe.empresa_id = ANY(v_user_empresa_ids)
        END
      )
    GROUP BY fe.pedido_id
  )
  SELECT
    COUNT(*)::bigint as total_pedidos,
    COALESCE(SUM(pci.qtd_itens), 0)::numeric as total_itens,
    COALESCE(SUM(pci.valor_bruto), 0)::numeric as valor_produto_total,
    COALESCE(SUM(pci.valor_liquido), 0)::numeric as valor_liquido_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.comissao_evt, 0), pci.taxas)), 0)::numeric as comissao_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.tarifa_evt, 0), pci.tarifas)), 0)::numeric as tarifa_fixa_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.frete_evt, 0), pci.frete_vendedor)), 0)::numeric as frete_vendedor_total,
    COALESCE(SUM(COALESCE(NULLIF(ep.ads_evt, 0), pci.custo_ads)), 0)::numeric as ads_total,
    ROUND(COALESCE(SUM(pci.valor_bruto), 0) * 0.06, 2)::numeric as impostos_total,
    COALESCE(SUM(pci.cmv_calculado), 0)::numeric as cmv_total,
    (COALESCE(SUM(pci.valor_bruto), 0) 
     - COALESCE(SUM(COALESCE(NULLIF(ep.comissao_evt, 0), pci.taxas)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.tarifa_evt, 0), pci.tarifas)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.frete_evt, 0), pci.frete_vendedor)), 0)
     - COALESCE(SUM(COALESCE(NULLIF(ep.ads_evt, 0), pci.custo_ads)), 0)
     - ROUND(COALESCE(SUM(pci.valor_bruto), 0) * 0.06, 2)
     - COALESCE(SUM(pci.cmv_calculado), 0)
    )::numeric as margem_contribuicao_total,
    COUNT(*) FILTER (WHERE pci.tem_cmv_flag = true)::bigint as pedidos_com_cmv,
    COUNT(*) FILTER (WHERE pci.tem_cmv_flag = false)::bigint as pedidos_sem_cmv
  FROM pedidos_com_itens pci
  LEFT JOIN eventos_por_pedido ep ON ep.pedido_id = pci.pedido_id;
END;
$$;