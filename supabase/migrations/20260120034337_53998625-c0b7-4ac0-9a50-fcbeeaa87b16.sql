-- Adicionar colunas de auditoria e metadados em marketplace_transactions
-- seller_id: ID do vendedor no ML
-- shipment_id: ID do envio no ML  
-- raw_order: Payload do pedido para auditoria
-- raw_fees: Dados brutos das taxas (conciliação)
-- raw_shipping_costs: Dados brutos dos custos de envio

ALTER TABLE public.marketplace_transactions 
ADD COLUMN IF NOT EXISTS seller_id text,
ADD COLUMN IF NOT EXISTS shipment_id text,
ADD COLUMN IF NOT EXISTS raw_order jsonb,
ADD COLUMN IF NOT EXISTS raw_fees jsonb,
ADD COLUMN IF NOT EXISTS raw_shipping_costs jsonb;

-- Índice para busca por seller_id (útil para filtros por conta)
CREATE INDEX IF NOT EXISTS idx_mkt_tx_seller_id 
ON public.marketplace_transactions(seller_id) 
WHERE seller_id IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.marketplace_transactions.seller_id IS 'ID do vendedor no marketplace (user_id_provider)';
COMMENT ON COLUMN public.marketplace_transactions.shipment_id IS 'ID do envio no marketplace';
COMMENT ON COLUMN public.marketplace_transactions.raw_order IS 'Payload bruto do pedido para auditoria';
COMMENT ON COLUMN public.marketplace_transactions.raw_fees IS 'Dados brutos das taxas extraídas da API de conciliação';
COMMENT ON COLUMN public.marketplace_transactions.raw_shipping_costs IS 'Dados brutos dos custos de envio da API /shipments/costs';