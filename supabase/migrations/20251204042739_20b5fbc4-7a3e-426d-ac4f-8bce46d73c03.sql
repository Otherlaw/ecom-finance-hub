-- Adicionar novas colunas para detalhamento de transações marketplace
ALTER TABLE marketplace_transactions 
ADD COLUMN canal_venda TEXT,
ADD COLUMN tarifas NUMERIC DEFAULT 0,
ADD COLUMN taxas NUMERIC DEFAULT 0,
ADD COLUMN outros_descontos NUMERIC DEFAULT 0;

-- Renomear coluna para consistência com outros módulos
ALTER TABLE marketplace_transactions 
RENAME COLUMN origem_arquivo TO origem_extrato;