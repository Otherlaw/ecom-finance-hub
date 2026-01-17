-- Limpar itens órfãos (transaction_id que não existe mais)
DELETE FROM marketplace_transaction_items
WHERE transaction_id NOT IN (SELECT id FROM marketplace_transactions);

-- Índices de performance para consultas paginadas
CREATE INDEX IF NOT EXISTS idx_mkt_empresa_data_tipo
ON marketplace_transactions (empresa_id, data_transacao DESC, tipo_lancamento);

CREATE INDEX IF NOT EXISTS idx_mkt_items_transaction_id
ON marketplace_transaction_items (transaction_id);

-- Extensão e índice para ILIKE performático (busca por conta_nome)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_mkt_conta_nome_trgm
ON marketplace_transactions USING gin (conta_nome gin_trgm_ops);

-- Índices adicionais para filtros comuns
CREATE INDEX IF NOT EXISTS idx_mkt_empresa_canal_data
ON marketplace_transactions (empresa_id, canal, data_transacao DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_empresa_status_data
ON marketplace_transactions (empresa_id, status, data_transacao DESC);