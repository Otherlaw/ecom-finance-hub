-- Deletar eventos de frete_comprador existentes (poluem margem/fechamento)
DELETE FROM public.marketplace_financial_events 
WHERE tipo_evento = 'frete_comprador' 
  AND canal = 'Mercado Livre';

-- Log de quantos foram removidos
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deletados % eventos de frete_comprador', deleted_count;
END $$;