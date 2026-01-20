
-- ==========================================================
-- MIGRATION: Garantir idempotência em marketplace_transactions
-- ==========================================================

-- 1. Primeiro, remover duplicatas residuais (manter a mais recente por chave)
-- Critério: (empresa_id, canal, pedido_id, tipo_transacao, tipo_lancamento)
-- Isso cobre vendas e outros tipos de transação

WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY empresa_id, canal, pedido_id, tipo_transacao, tipo_lancamento
           ORDER BY atualizado_em DESC, criado_em DESC, id DESC
         ) as rn
  FROM marketplace_transactions
  WHERE pedido_id IS NOT NULL
)
DELETE FROM marketplace_transactions
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Criar constraint único para vendas por pedido
-- Isso garante que não pode haver mais de 1 venda para o mesmo pedido
DROP INDEX IF EXISTS uq_mkt_venda_pedido;

CREATE UNIQUE INDEX uq_mkt_venda_pedido 
ON marketplace_transactions (empresa_id, canal, pedido_id)
WHERE pedido_id IS NOT NULL 
  AND tipo_transacao = 'venda' 
  AND tipo_lancamento = 'credito';

-- 3. Garantir que a constraint uq_mkt_tx_key existe e está correta
-- (já existe, mas vamos verificar/recriar se necessário)
DO $$
BEGIN
  -- Verificar se existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'uq_mkt_tx_key' 
    AND schemaname = 'public'
  ) THEN
    CREATE UNIQUE INDEX uq_mkt_tx_key 
    ON public.marketplace_transactions 
    (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento);
  END IF;
END $$;

-- 4. Adicionar comentário para documentar a estratégia de idempotência
COMMENT ON INDEX uq_mkt_venda_pedido IS 
'Garante máximo 1 transação de venda (tipo_transacao=venda, tipo_lancamento=credito) por pedido_id/empresa/canal';

COMMENT ON INDEX uq_mkt_tx_key IS 
'Constraint principal de idempotência: impede duplicatas por referencia_externa+tipo para todos os tipos de transação';
