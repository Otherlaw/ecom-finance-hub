-- ETAPA 1: Deduplicação + UNIQUE Constraint Robusta em marketplace_transactions
-- Esta migration:
-- 1. Identifica duplicatas por chave composta
-- 2. Rewire itens órfãos para apontar para o registro mantido
-- 3. Remove duplicatas mantendo o mais recente
-- 4. Cria UNIQUE INDEX para prevenir futuras duplicatas

DO $$
DECLARE
  v_duplicatas_encontradas INTEGER;
  v_itens_rewired INTEGER;
  v_duplicatas_removidas INTEGER;
BEGIN
  -- Contar duplicatas antes
  SELECT COUNT(*) INTO v_duplicatas_encontradas
  FROM (
    SELECT empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento, COUNT(*) as cnt
    FROM marketplace_transactions
    WHERE referencia_externa IS NOT NULL
    GROUP BY empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento
    HAVING COUNT(*) > 1
  ) dups;
  
  RAISE NOTICE 'Duplicatas encontradas: %', v_duplicatas_encontradas;
  
  -- Se não há duplicatas, pular para criação do índice
  IF v_duplicatas_encontradas > 0 THEN
    -- 1. Rewire itens: atualizar transaction_id dos itens para apontar para o registro que será mantido
    -- Mantemos o registro com maior atualizado_em (mais recente)
    WITH duplicatas AS (
      SELECT 
        empresa_id, 
        canal, 
        referencia_externa, 
        tipo_transacao, 
        tipo_lancamento,
        (SELECT id FROM marketplace_transactions t2 
         WHERE t2.empresa_id = t1.empresa_id 
           AND t2.canal = t1.canal 
           AND t2.referencia_externa = t1.referencia_externa
           AND t2.tipo_transacao = t1.tipo_transacao
           AND t2.tipo_lancamento = t1.tipo_lancamento
         ORDER BY t2.atualizado_em DESC NULLS LAST, t2.criado_em DESC NULLS LAST
         LIMIT 1) as id_mantido
      FROM marketplace_transactions t1
      WHERE referencia_externa IS NOT NULL
      GROUP BY empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento
      HAVING COUNT(*) > 1
    ),
    itens_para_rewire AS (
      SELECT 
        mti.id as item_id,
        mti.transaction_id as old_transaction_id,
        d.id_mantido as new_transaction_id
      FROM marketplace_transaction_items mti
      JOIN marketplace_transactions mt ON mt.id = mti.transaction_id
      JOIN duplicatas d ON d.empresa_id = mt.empresa_id 
                       AND d.canal = mt.canal 
                       AND d.referencia_externa = mt.referencia_externa
                       AND d.tipo_transacao = mt.tipo_transacao
                       AND d.tipo_lancamento = mt.tipo_lancamento
      WHERE mti.transaction_id != d.id_mantido
    )
    UPDATE marketplace_transaction_items mti
    SET transaction_id = ipr.new_transaction_id
    FROM itens_para_rewire ipr
    WHERE mti.id = ipr.item_id;
    
    GET DIAGNOSTICS v_itens_rewired = ROW_COUNT;
    RAISE NOTICE 'Itens rewired: %', v_itens_rewired;
    
    -- 2. Deletar registros duplicados (mantendo o mais recente)
    WITH duplicatas_para_deletar AS (
      SELECT mt.id
      FROM marketplace_transactions mt
      WHERE mt.referencia_externa IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM marketplace_transactions mt2
          WHERE mt2.empresa_id = mt.empresa_id
            AND mt2.canal = mt.canal
            AND mt2.referencia_externa = mt.referencia_externa
            AND mt2.tipo_transacao = mt.tipo_transacao
            AND mt2.tipo_lancamento = mt.tipo_lancamento
            AND (
              mt2.atualizado_em > mt.atualizado_em 
              OR (mt2.atualizado_em = mt.atualizado_em AND mt2.criado_em > mt.criado_em)
              OR (mt2.atualizado_em = mt.atualizado_em AND mt2.criado_em = mt.criado_em AND mt2.id > mt.id)
            )
        )
    )
    DELETE FROM marketplace_transactions
    WHERE id IN (SELECT id FROM duplicatas_para_deletar);
    
    GET DIAGNOSTICS v_duplicatas_removidas = ROW_COUNT;
    RAISE NOTICE 'Duplicatas removidas: %', v_duplicatas_removidas;
  END IF;
END $$;

-- 3. Criar UNIQUE INDEX na chave composta
-- Usamos UNIQUE INDEX em vez de CONSTRAINT para melhor performance e flexibilidade
DROP INDEX IF EXISTS idx_mkt_tx_unique_key;

CREATE UNIQUE INDEX idx_mkt_tx_unique_key 
ON marketplace_transactions (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento)
WHERE referencia_externa IS NOT NULL;

-- 4. Criar índice para performance de queries por data
DROP INDEX IF EXISTS idx_mkt_tx_empresa_data;

CREATE INDEX idx_mkt_tx_empresa_data 
ON marketplace_transactions (empresa_id, data_transacao DESC, id DESC);

-- 5. Criar índice para busca por canal + referência
DROP INDEX IF EXISTS idx_mkt_tx_canal_ref;

CREATE INDEX idx_mkt_tx_canal_ref 
ON marketplace_transactions (empresa_id, canal, referencia_externa);

-- 6. Criar índice para itens por transaction_id (FK lookup)
DROP INDEX IF EXISTS idx_mkt_tx_items_transaction;

CREATE INDEX IF NOT EXISTS idx_mkt_tx_items_transaction 
ON marketplace_transaction_items (transaction_id);