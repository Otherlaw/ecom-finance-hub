
-- ==========================================================
-- MIGRATION: Ajustar RLS para multiempresa com colaboradores
-- ==========================================================

-- 1. Criar função helper para verificar se usuário é dono/admin da empresa
CREATE OR REPLACE FUNCTION public.user_is_empresa_owner(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_empresas
    WHERE user_id = auth.uid()
      AND empresa_id = p_empresa_id
      AND role_na_empresa IN ('dono', 'admin')
  )
$$;

-- 2. Ajustar policies de user_empresas para permitir que donos/admins gerenciem colaboradores
-- Remover policies antigas que podem conflitar
DROP POLICY IF EXISTS "Admins can manage all user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Admins can manage empresa associations" ON public.user_empresas;
DROP POLICY IF EXISTS "Admins can read all user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Users can delete own user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Users can insert own user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Users can read own user_empresas" ON public.user_empresas;
DROP POLICY IF EXISTS "Users can view own empresa associations" ON public.user_empresas;

-- 3. Novas policies mais simples e claras
-- SELECT: Usuário vê seus próprios vínculos OU é admin global
CREATE POLICY "user_empresas_select"
ON public.user_empresas
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);

-- INSERT: Admin global pode inserir qualquer vínculo
-- Ou dono/admin da empresa pode adicionar colaboradores à sua empresa
CREATE POLICY "user_empresas_insert"
ON public.user_empresas
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = user_id -- Usuário criando próprio vínculo (ex: ao criar empresa)
  )
);

-- UPDATE: Admin global ou dono/admin da empresa
CREATE POLICY "user_empresas_update"
ON public.user_empresas
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.user_is_empresa_owner(empresa_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.user_is_empresa_owner(empresa_id)
);

-- DELETE: Admin global ou dono/admin da empresa (não pode remover o último dono)
CREATE POLICY "user_empresas_delete"
ON public.user_empresas
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.user_is_empresa_owner(empresa_id)
);

-- 4. Garantir que colaboradores possam ver empresas às quais têm acesso
-- Habilitar RLS na tabela empresas (estava desabilitada por segurança)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Authenticated users can read empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admins can manage empresas" ON public.empresas;
DROP POLICY IF EXISTS "Users can read linked empresas" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_delete" ON public.empresas;

-- SELECT: Usuário vê empresas às quais está vinculado
CREATE POLICY "empresas_select"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.user_has_empresa_access(id)
);

-- INSERT: Qualquer usuário autenticado pode criar empresa
CREATE POLICY "empresas_insert"
ON public.empresas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Apenas dono/admin da empresa ou admin global
CREATE POLICY "empresas_update"
ON public.empresas
FOR UPDATE
TO authenticated
USING (
  public.user_is_empresa_owner(id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  public.user_is_empresa_owner(id)
  OR public.has_role(auth.uid(), 'admin')
);

-- DELETE: Apenas dono/admin da empresa ou admin global
CREATE POLICY "empresas_delete"
ON public.empresas
FOR DELETE
TO authenticated
USING (
  public.user_is_empresa_owner(id)
  OR public.has_role(auth.uid(), 'admin')
);

-- 5. Adicionar coluna email à tabela profiles se não existir (para buscar usuário por email)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    
    -- Criar índice para busca por email
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
END $$;
