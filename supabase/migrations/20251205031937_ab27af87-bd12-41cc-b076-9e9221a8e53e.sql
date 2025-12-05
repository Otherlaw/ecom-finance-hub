-- Adicionar campo de hash para detecção de duplicidades
ALTER TABLE public.marketplace_transactions 
ADD COLUMN IF NOT EXISTS hash_duplicidade text;

-- Criar índice único para prevenir duplicidades
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_transactions_hash_duplicidade 
ON public.marketplace_transactions(hash_duplicidade) 
WHERE hash_duplicidade IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.marketplace_transactions.hash_duplicidade IS 'Hash MD5 baseado em empresa_id + canal + data_transacao + descricao + valor_liquido + pedido_id para detecção de duplicidades';