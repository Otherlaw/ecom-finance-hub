-- Criar bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Permitir leitura pública de imagens de produtos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Permitir upload de imagens de produtos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Permitir atualização de imagens de produtos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

CREATE POLICY "Permitir exclusão de imagens de produtos"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');