-- 1. Fix compras_status_check constraint to include all valid statuses
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_status_check;
ALTER TABLE public.compras ADD CONSTRAINT compras_status_check 
  CHECK (status IN ('rascunho', 'emitido', 'em_transito', 'parcial', 'concluido', 'cancelado'));

-- 2. Add compra_id column to contas_a_pagar for purchase linking
ALTER TABLE public.contas_a_pagar 
  ADD COLUMN IF NOT EXISTS compra_id uuid REFERENCES public.compras(id) ON DELETE SET NULL;

-- 3. Add numero_parcela and total_parcelas columns to contas_a_pagar
ALTER TABLE public.contas_a_pagar 
  ADD COLUMN IF NOT EXISTS numero_parcela integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer;

-- 4. Update status constraint to include 'em_analise'
-- First, update any existing 'pago' status to valid status
UPDATE public.contas_a_pagar SET status = 'em_aberto' WHERE status = 'pago';

-- Drop old constraint if exists and create new one
DO $$
BEGIN
  -- Try to drop any existing status constraint
  ALTER TABLE public.contas_a_pagar DROP CONSTRAINT IF EXISTS contas_a_pagar_status_check;
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.contas_a_pagar ADD CONSTRAINT contas_a_pagar_status_check 
  CHECK (status IN ('em_analise', 'em_aberto', 'parcialmente_pago', 'pago', 'vencido', 'cancelado'));

-- 5. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_compra_id ON public.contas_a_pagar(compra_id);
CREATE INDEX IF NOT EXISTS idx_contas_a_pagar_status ON public.contas_a_pagar(status);