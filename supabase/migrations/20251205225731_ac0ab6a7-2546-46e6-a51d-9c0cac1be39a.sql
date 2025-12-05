-- =============================================
-- TABELA: produto_sku_map (Mapeamentos Upseller)
-- =============================================
-- Mapeia SKU interno → Anúncios/Variações de Marketplace
-- Suporta múltiplos anúncios por SKU e múltiplas variações

CREATE TABLE IF NOT EXISTS public.produto_sku_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  sku_interno TEXT NOT NULL,
  canal TEXT NOT NULL, -- mercado_livre, shopee, etc
  loja TEXT, -- nome da loja extraído do arquivo
  anuncio_id TEXT, -- MLBxxxxxxxx ou ID numérico Shopee
  variante_id TEXT, -- ID da variação (opcional)
  variante_nome TEXT, -- Nome da variação (ex: "Dourado,Floco")
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  sku_id UUID REFERENCES public.produto_skus(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_produto_sku_map_unique 
ON public.produto_sku_map(empresa_id, canal, anuncio_id, variante_id)
WHERE anuncio_id IS NOT NULL;

-- Índice para buscas por anúncio
CREATE INDEX IF NOT EXISTS idx_produto_sku_map_anuncio 
ON public.produto_sku_map(empresa_id, canal, anuncio_id);

-- Índice para buscas por SKU interno
CREATE INDEX IF NOT EXISTS idx_produto_sku_map_sku_interno 
ON public.produto_sku_map(empresa_id, sku_interno);

-- Habilitar RLS
ALTER TABLE public.produto_sku_map ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acesso público para dev)
CREATE POLICY "Allow public read produto_sku_map" 
ON public.produto_sku_map FOR SELECT USING (true);

CREATE POLICY "Allow public insert produto_sku_map" 
ON public.produto_sku_map FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update produto_sku_map" 
ON public.produto_sku_map FOR UPDATE USING (true);

CREATE POLICY "Allow public delete produto_sku_map" 
ON public.produto_sku_map FOR DELETE USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_produto_sku_map_updated_at
BEFORE UPDATE ON public.produto_sku_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();