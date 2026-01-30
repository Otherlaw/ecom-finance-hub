-- =========================================
-- Corrigir Isolamento Multi-Tenant Completo
-- (Sem Admin Global, Sem Mock)
-- =========================================

-- 1. Remover políticas admin-only de integracao_config
DROP POLICY IF EXISTS "Only admins can read integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can insert integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can update integracao_config" ON integracao_config;
DROP POLICY IF EXISTS "Only admins can delete integracao_config" ON integracao_config;

-- Criar políticas baseadas em empresa para integracao_config
CREATE POLICY "Users can read own integracao_config"
ON integracao_config FOR SELECT
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_config"
ON integracao_config FOR INSERT
TO authenticated
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_config"
ON integracao_config FOR UPDATE
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_config"
ON integracao_config FOR DELETE
TO authenticated
USING (user_has_empresa_access(empresa_id));

-- 2. Remover políticas admin-only de integracao_tokens
DROP POLICY IF EXISTS "Only admins can read integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can insert integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can update integracao_tokens" ON integracao_tokens;
DROP POLICY IF EXISTS "Only admins can delete integracao_tokens" ON integracao_tokens;

-- Criar políticas baseadas em empresa para integracao_tokens
CREATE POLICY "Users can read own integracao_tokens"
ON integracao_tokens FOR SELECT
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_tokens"
ON integracao_tokens FOR INSERT
TO authenticated
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_tokens"
ON integracao_tokens FOR UPDATE
TO authenticated
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_tokens"
ON integracao_tokens FOR DELETE
TO authenticated
USING (user_has_empresa_access(empresa_id));

-- 3. Garantir política de INSERT em empresas para usuários autenticados
-- (necessário para criar novas empresas)
DROP POLICY IF EXISTS "empresas_insert" ON empresas;
DROP POLICY IF EXISTS "empresas_insert_authenticated" ON empresas;

CREATE POLICY "empresas_insert_authenticated"
ON empresas FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);