-- Adicionar campo para tipo de movimento nas transações de cartão
ALTER TABLE public.credit_card_transactions
ADD COLUMN IF NOT EXISTS tipo_movimento TEXT CHECK (tipo_movimento IN ('debito', 'credito'));

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.credit_card_transactions.tipo_movimento IS 'Tipo de movimento: débito (saída) ou crédito (entrada/estorno)';

-- Criar índice para facilitar queries por tipo de movimento
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_tipo_movimento 
ON public.credit_card_transactions(tipo_movimento) 
WHERE tipo_movimento IS NOT NULL;