-- Índices para otimização de performance da página de Vendas

-- Índice na FK transaction_id (CRÍTICO - maior ganho de performance)
CREATE INDEX IF NOT EXISTS idx_mkt_items_transaction 
ON public.marketplace_transaction_items (transaction_id);

-- Índice na FK produto_id para JOINs com produtos
CREATE INDEX IF NOT EXISTS idx_mkt_items_produto 
ON public.marketplace_transaction_items (produto_id);

-- Índice composto para filtro empresa + tipo + data (otimiza a query principal)
CREATE INDEX IF NOT EXISTS idx_mkt_transactions_empresa_tipo_data 
ON public.marketplace_transactions (empresa_id, tipo_lancamento, data_transacao DESC);