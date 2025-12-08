-- Fase 1: Atualizar CHECK constraint de status em compras
ALTER TABLE public.compras DROP CONSTRAINT IF EXISTS compras_status_check;

ALTER TABLE public.compras 
ADD CONSTRAINT compras_status_check 
CHECK (status = ANY (ARRAY[
  'rascunho'::text, 
  'pago'::text, 
  'em_transito'::text, 
  'parcial'::text, 
  'concluido'::text, 
  'cancelado'::text
]));

-- Fase 2: Criar armazéns padrão para cada empresa ativa
-- Armazém Operacional (Administrativo)
INSERT INTO public.armazens (empresa_id, codigo, nome, tipo, ativo)
SELECT 
  id as empresa_id,
  'ARM-OP' as codigo,
  'Operacional (Administrativo)' as nome,
  'proprio' as tipo,
  true as ativo
FROM public.empresas 
WHERE ativo = true
ON CONFLICT DO NOTHING;

-- Armazém E-commerce
INSERT INTO public.armazens (empresa_id, codigo, nome, tipo, ativo)
SELECT 
  id as empresa_id,
  'ARM-ECOM' as codigo,
  'E-commerce (Marketplace)' as nome,
  'proprio' as tipo,
  true as ativo
FROM public.empresas 
WHERE ativo = true
ON CONFLICT DO NOTHING;

-- Armazém Distribuição
INSERT INTO public.armazens (empresa_id, codigo, nome, tipo, ativo)
SELECT 
  id as empresa_id,
  'ARM-DIST' as codigo,
  'Distribuição (Logística)' as nome,
  'proprio' as tipo,
  true as ativo
FROM public.empresas 
WHERE ativo = true
ON CONFLICT DO NOTHING;