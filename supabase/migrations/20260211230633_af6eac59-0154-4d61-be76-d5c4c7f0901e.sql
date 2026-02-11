
-- Adicionar coluna thumbnail_url em marketplace_transaction_items
ALTER TABLE public.marketplace_transaction_items
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.marketplace_transaction_items.thumbnail_url IS 'URL da imagem do anúncio no marketplace (ex: thumbnail do Mercado Livre)';
