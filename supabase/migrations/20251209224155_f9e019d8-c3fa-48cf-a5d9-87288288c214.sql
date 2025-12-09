-- Corrigir policy de INSERT na tabela empresas
-- Problema: a policy atual está atribuída ao role 'public' ao invés de 'authenticated'
-- Solução: remover a policy incorreta e criar uma nova correta

-- 1. Remover a policy incorreta
DROP POLICY IF EXISTS "Authenticated users can insert empresas" ON public.empresas;

-- 2. Criar nova policy permitindo INSERT para usuários autenticados
CREATE POLICY "Usuarios autenticados podem criar empresas"
ON public.empresas
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);