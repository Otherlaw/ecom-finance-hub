-- Desabilitar RLS na tabela empresas para permitir cadastro
-- ATENÇÃO: Isso remove a proteção de acesso por linha temporariamente
-- Podemos reabilitar com policies simplificadas depois

-- 1. Remover TODAS as policies existentes da tabela empresas
DROP POLICY IF EXISTS "Users can read own empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users can update own empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins can delete empresas" ON public.empresas;
DROP POLICY IF EXISTS "Usuarios autenticados podem criar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Usuarios podem criar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Authenticated users can insert empresas" ON public.empresas;

-- 2. Desabilitar RLS completamente na tabela
ALTER TABLE public.empresas DISABLE ROW LEVEL SECURITY;