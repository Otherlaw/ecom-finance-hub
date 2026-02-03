
-- Corrigir a RPC get_top_produtos_vendidos para agregar corretamente por SKU
-- Problema: jsonb_object_agg não soma as quantidades por canal, apenas pega uma

DROP FUNCTION IF EXISTS public.get_top_produtos_vendidos(uuid, date, date, integer);

CREATE OR REPLACE FUNCTION public.get_top_produtos_vendidos(
  p_empresa_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
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
SET search_path = public
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
  WITH 
  -- Primeiro: extrair todos os itens únicos de vendas no período
  itens_base AS (
    SELECT
      mti.id as item_id,
      -- Chave do produto: prioriza produto_id mapeado, depois SKU, depois fallback
      COALESCE(mti.produto_id::text, mti.sku_marketplace, 'sem-mapeamento') as prod_key,
      -- Dados do produto: busca por ID primeiro, depois por SKU
      COALESCE(p_by_id.nome, p_by_sku.nome, mti.descricao_item, mti.sku_marketplace, 'Produto não mapeado') as nome,
      COALESCE(p_by_id.sku, p_by_sku.sku, mti.sku_marketplace, '-') as sku,
      COALESCE(p_by_id.imagem_url, p_by_sku.imagem_url) as imagem_url,
      -- Custo: fallback hierárquico
      COALESCE(
        NULLIF(p_by_id.custo_medio, 0), 
        NULLIF(p_by_sku.custo_medio, 0), 
        NULLIF(sc.custo_unitario, 0),
        0
      )::numeric as custo,
      -- Valores do item
      COALESCE(mti.quantidade, 1)::numeric as quantidade,
      COALESCE(mti.preco_total, 0)::numeric as preco_total,
      -- Canal e ads (ads vem da transação, dividir proporcionalmente seria complexo, usar 0 aqui)
      mt.canal
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
  -- Segundo: agregar por produto (SUM de quantidade e faturamento)
  agregado_produto AS (
    SELECT
      ib.prod_key,
      -- Pegar nome/sku/imagem do primeiro registro (MODE ou MAX)
      MAX(ib.nome) as nome,
      MAX(ib.sku) as sku,
      MAX(ib.imagem_url) as imagem_url,
      -- Custo: usar o MAX (mais conservador)
      MAX(ib.custo)::numeric as custo_max,
      -- SOMA de todas as quantidades desse produto
      SUM(ib.quantidade)::numeric as qtd_sum,
      -- SOMA de todo o faturamento desse produto (CRÍTICO: é isso que rankeia)
      SUM(ib.preco_total)::numeric as faturado_sum
    FROM itens_base ib
    GROUP BY ib.prod_key
  ),
  -- Terceiro: agregar quantidades por canal (separado para evitar problemas)
  agregado_canal AS (
    SELECT
      ib.prod_key,
      jsonb_object_agg(
        ib.canal, 
        canal_qtd.total_qtd
      ) as por_canal_agg
    FROM (SELECT DISTINCT prod_key, canal FROM itens_base) ib
    INNER JOIN LATERAL (
      SELECT SUM(ib2.quantidade) as total_qtd
      FROM itens_base ib2
      WHERE ib2.prod_key = ib.prod_key AND ib2.canal = ib.canal
    ) canal_qtd ON true
    GROUP BY ib.prod_key
  )
  -- Query final: juntar agregações e ordenar por faturamento DESC
  SELECT
    ap.prod_key as produto_id,
    ap.nome as produto_nome,
    ap.sku as produto_sku,
    ap.imagem_url as produto_imagem_url,
    ap.custo_max as custo_unitario,
    ap.qtd_sum as qtd_total,
    ap.faturado_sum as total_faturado,
    0::numeric as total_ads,  -- Simplificado: ads por produto é complexo de calcular
    COALESCE(ac.por_canal_agg, '{}'::jsonb) as por_canal
  FROM agregado_produto ap
  LEFT JOIN agregado_canal ac ON ac.prod_key = ap.prod_key
  -- ORDENAÇÃO CRÍTICA: por faturamento total DESC (numérico, não texto)
  ORDER BY ap.faturado_sum DESC NULLS LAST
  LIMIT p_limite;
END;
$function$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.get_top_produtos_vendidos IS 
'Retorna os top N produtos mais vendidos por FATURAMENTO TOTAL no período.
Agrega todas as vendas/itens de cada SKU e ordena pelo faturamento acumulado (DESC).
Suporta filtro por empresa ou visão consolidada (p_empresa_id = NULL).';
