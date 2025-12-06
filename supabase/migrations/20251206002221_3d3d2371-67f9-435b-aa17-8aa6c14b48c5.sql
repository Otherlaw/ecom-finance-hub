-- Adicionar colunas de anúncio/variante na tabela de itens de marketplace
-- para possibilitar mapeamento automático com Upseller

ALTER TABLE public.marketplace_transaction_items 
  ADD COLUMN IF NOT EXISTS anuncio_id TEXT,
  ADD COLUMN IF NOT EXISTS variante_id TEXT;

-- Índices para performance nas buscas de mapeamento
CREATE INDEX IF NOT EXISTS idx_mkt_items_anuncio_id ON public.marketplace_transaction_items(anuncio_id) WHERE anuncio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_items_variante_id ON public.marketplace_transaction_items(variante_id) WHERE variante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_items_sku_marketplace ON public.marketplace_transaction_items(sku_marketplace) WHERE sku_marketplace IS NOT NULL;

-- Índice composto para buscas de mapeamento em produto_sku_map
CREATE INDEX IF NOT EXISTS idx_sku_map_anuncio_lookup 
  ON public.produto_sku_map(empresa_id, canal, anuncio_id) 
  WHERE anuncio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sku_map_anuncio_variante_lookup 
  ON public.produto_sku_map(empresa_id, canal, anuncio_id, variante_id) 
  WHERE anuncio_id IS NOT NULL;