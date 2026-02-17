
CREATE OR REPLACE FUNCTION public.get_vendas_por_pedido_count(
  p_empresa_id uuid DEFAULT NULL::uuid,
  p_data_inicio text DEFAULT NULL::text,
  p_data_fim text DEFAULT NULL::text,
  p_canal text DEFAULT NULL::text,
  p_conta text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text,
  p_tipo_envio text DEFAULT NULL::text,
  p_tem_custo text DEFAULT NULL::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_inicio timestamptz;
  v_data_fim timestamptz;
  v_count bigint;
  v_user_empresa_ids uuid[];
BEGIN
  -- Security: get user's allowed empresas
  v_user_empresa_ids := public.get_user_empresa_ids();

  IF array_length(v_user_empresa_ids, 1) IS NULL OR array_length(v_user_empresa_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  IF p_empresa_id IS NOT NULL AND NOT (p_empresa_id = ANY(v_user_empresa_ids)) THEN
    RETURN 0;
  END IF;

  v_data_inicio := (p_data_inicio || ' 00:00:00-03')::timestamptz;
  v_data_fim := (p_data_fim || ' 23:59:59.999-03')::timestamptz;

  -- Base count (without tem_custo filter)
  IF p_tem_custo IS NULL THEN
    SELECT COUNT(DISTINCT COALESCE(mt.pack_id, mt.pedido_id, mt.referencia_externa))
    INTO v_count
    FROM marketplace_transactions mt
    WHERE mt.tipo_transacao = 'venda'
      AND mt.tipo_lancamento = 'credito'
      AND mt.data_transacao >= v_data_inicio
      AND mt.data_transacao <= v_data_fim
      AND (
        CASE
          WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
          ELSE mt.empresa_id = ANY(v_user_empresa_ids)
        END
      )
      AND (p_canal IS NULL OR mt.canal = p_canal)
      AND (p_conta IS NULL OR mt.conta_nome = p_conta)
      AND (p_status IS NULL OR mt.status = p_status)
      AND (p_tipo_envio IS NULL OR mt.tipo_envio = p_tipo_envio)
      AND (p_busca IS NULL OR 
           mt.pedido_id ILIKE '%' || p_busca || '%' OR
           mt.pack_id ILIKE '%' || p_busca || '%' OR
           mt.referencia_externa ILIKE '%' || p_busca || '%' OR
           mt.descricao ILIKE '%' || p_busca || '%');
  ELSE
    -- With tem_custo filter (requires join)
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
        AND (
          CASE
            WHEN p_empresa_id IS NOT NULL THEN mt.empresa_id = p_empresa_id
            ELSE mt.empresa_id = ANY(v_user_empresa_ids)
          END
        )
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
$function$;
