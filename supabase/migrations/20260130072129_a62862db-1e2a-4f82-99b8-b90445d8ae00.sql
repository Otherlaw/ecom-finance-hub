-- ============================================================
-- MIGRAÇÃO: Integração CMV com produto_marketplace_map
-- ============================================================

-- 1. Função auxiliar para resolver produto_id via mapeamento
CREATE OR REPLACE FUNCTION public.get_produto_id_from_mapping(
  p_sku_marketplace TEXT,
  p_empresa_id UUID
)
RETURNS UUID
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT produto_id 
  FROM produto_marketplace_map 
  WHERE sku_marketplace = p_sku_marketplace 
    AND empresa_id = p_empresa_id 
    AND ativo = true
  LIMIT 1;
$$;

-- 2. Atualizar itens existentes que têm mapeamento em produto_marketplace_map
-- mas ainda não têm produto_id preenchido (13.272 itens estimados)
-- Usando subquery para evitar erro de referência
UPDATE marketplace_transaction_items mti
SET produto_id = sub.mapped_produto_id,
    updated_at = NOW()
FROM (
  SELECT 
    mti_inner.id AS item_id,
    pmm.produto_id AS mapped_produto_id
  FROM marketplace_transaction_items mti_inner
  JOIN marketplace_transactions mt ON mt.id = mti_inner.transaction_id
  JOIN produto_marketplace_map pmm 
    ON pmm.sku_marketplace = mti_inner.sku_marketplace 
    AND pmm.empresa_id = mt.empresa_id 
    AND pmm.ativo = true
  WHERE mti_inner.produto_id IS NULL
) sub
WHERE mti.id = sub.item_id;

-- 3. Trigger para sincronizar automaticamente quando um mapeamento é criado/atualizado
CREATE OR REPLACE FUNCTION public.sync_mapping_to_transaction_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando um mapeamento é criado ou atualizado e está ativo
  IF NEW.ativo = true THEN
    -- Atualiza todos os itens históricos com o mesmo SKU da empresa
    UPDATE marketplace_transaction_items mti
    SET produto_id = NEW.produto_id,
        updated_at = NOW()
    FROM marketplace_transactions mt
    WHERE mt.id = mti.transaction_id
      AND mt.empresa_id = NEW.empresa_id
      AND mti.sku_marketplace = NEW.sku_marketplace
      AND (mti.produto_id IS NULL OR mti.produto_id != NEW.produto_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar trigger na tabela produto_marketplace_map
DROP TRIGGER IF EXISTS trigger_sync_mapping_to_items ON produto_marketplace_map;
CREATE TRIGGER trigger_sync_mapping_to_items
AFTER INSERT OR UPDATE ON produto_marketplace_map
FOR EACH ROW
EXECUTE FUNCTION public.sync_mapping_to_transaction_items();