-- 1. Remover o índice parcial que não funciona com onConflict
DROP INDEX IF EXISTS idx_mkt_tx_unique_key;

-- 2. Garantir que referencia_externa não tenha valores nulos
UPDATE marketplace_transactions 
SET referencia_externa = COALESCE(referencia_externa, pedido_id, id::text)
WHERE referencia_externa IS NULL;

-- 3. Adicionar NOT NULL constraint para referencia_externa
ALTER TABLE marketplace_transactions 
ALTER COLUMN referencia_externa SET NOT NULL;

-- 4. Criar uma CONSTRAINT real (não índice) para funcionar com onConflict
ALTER TABLE marketplace_transactions 
ADD CONSTRAINT uq_mkt_tx_key 
UNIQUE (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento);