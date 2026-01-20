-- Adicionar coluna de status de enriquecimento para rastrear dados pendentes
ALTER TABLE public.marketplace_transactions
ADD COLUMN IF NOT EXISTS status_enriquecimento text DEFAULT 'completo';

-- Comentário explicativo
COMMENT ON COLUMN public.marketplace_transactions.status_enriquecimento IS 
'Status do enriquecimento de dados: completo, pendente_taxas, pendente_frete, pendente_custos';

-- Criar índice para facilitar queries de pendências
CREATE INDEX IF NOT EXISTS idx_mkt_tx_status_enriquecimento
ON public.marketplace_transactions(status_enriquecimento)
WHERE status_enriquecimento != 'completo';