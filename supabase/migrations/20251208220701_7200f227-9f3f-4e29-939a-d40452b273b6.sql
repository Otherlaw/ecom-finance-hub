-- Adicionar coluna imagem_url na tabela produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;