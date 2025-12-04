-- Adiciona campo status na tabela manual_transactions para controle de aprovação
ALTER TABLE public.manual_transactions
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

-- Adiciona constraint para valores válidos
ALTER TABLE public.manual_transactions
ADD CONSTRAINT manual_transactions_status_check 
CHECK (status IN ('pendente', 'aprovado', 'rejeitado'));

-- Cria índice para consultas por status
CREATE INDEX IF NOT EXISTS idx_manual_transactions_status ON public.manual_transactions(status);

-- Comentário para documentação
COMMENT ON COLUMN public.manual_transactions.status IS 'Status do lançamento manual: pendente, aprovado ou rejeitado';