-- Função para mapear SKU de marketplace para produto interno
-- Atualiza itens históricos de forma eficiente usando JOIN ao invés de IN()

CREATE OR REPLACE FUNCTION public.mapear_sku_para_produto(
  p_empresa_id UUID,
  p_produto_id UUID,
  p_canal TEXT,
  p_sku_marketplace TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atualizados INTEGER;
BEGIN
  -- Atualizar itens que:
  -- 1. Pertencem a transações da empresa/canal
  -- 2. Têm o SKU especificado
  -- 3. Ainda não têm produto vinculado
  UPDATE marketplace_transaction_items mti
  SET produto_id = p_produto_id
  FROM marketplace_transactions mt
  WHERE mti.transaction_id = mt.id
    AND mt.empresa_id = p_empresa_id
    AND mt.canal = p_canal
    AND mti.sku_marketplace = p_sku_marketplace
    AND mti.produto_id IS NULL;
  
  GET DIAGNOSTICS v_atualizados = ROW_COUNT;
  
  RETURN v_atualizados;
END;
$$;

-- Garantir permissão para authenticated users
GRANT EXECUTE ON FUNCTION public.mapear_sku_para_produto TO authenticated;