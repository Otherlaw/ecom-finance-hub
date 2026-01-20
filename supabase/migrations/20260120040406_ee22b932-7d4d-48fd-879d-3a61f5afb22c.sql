-- Índices otimizados para performance de Vendas e Dashboard
-- Remove duplicatas e adiciona índices compostos estratégicos

-- 1. Remover índices duplicados para marketplace_transaction_items
DROP INDEX IF EXISTS idx_mkt_items_transaction;
DROP INDEX IF EXISTS idx_mkt_trans_items_transaction_id;
-- Manter apenas idx_mkt_items_transaction_id e idx_mkt_tx_items_transaction

-- 2. Índice para filtro principal de vendas por pedido (get_vendas_por_pedido)
-- Otimiza: WHERE pedido_id IS NOT NULL AND empresa_id = X AND data_transacao >= Y
CREATE INDEX IF NOT EXISTS idx_mkt_tx_pedido_empresa_data
ON public.marketplace_transactions (empresa_id, data_transacao DESC)
WHERE pedido_id IS NOT NULL;

-- 3. Índice covering para queries de resumo (evita lookup na heap)
CREATE INDEX IF NOT EXISTS idx_mkt_tx_resumo_covering
ON public.marketplace_transactions (empresa_id, data_transacao, tipo_lancamento)
INCLUDE (pedido_id, valor_bruto, taxas, tarifas, frete_vendedor, custo_ads, status, tipo_envio);

-- 4. Índice para eventos financeiros (get_vendas_por_pedido usa JOIN com essa tabela)
CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_pedido_empresa_data
ON public.marketplace_financial_events (empresa_id, pedido_id, data_evento DESC)
WHERE pedido_id IS NOT NULL;

-- 5. Índice para CMV lookup (join produtos.custo_medio)
CREATE INDEX IF NOT EXISTS idx_produtos_custo_lookup
ON public.produtos (id)
INCLUDE (custo_medio)
WHERE custo_medio IS NOT NULL AND custo_medio > 0;

-- 6. Atualizar estatísticas das tabelas principais para otimizador
ANALYZE public.marketplace_transactions;
ANALYZE public.marketplace_transaction_items;
ANALYZE public.marketplace_financial_events;
ANALYZE public.produtos;