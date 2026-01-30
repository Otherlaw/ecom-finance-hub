CREATE OR REPLACE FUNCTION public.delete_empresa_cascade(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário é dono/admin da empresa
  IF NOT EXISTS (
    SELECT 1 FROM user_empresas 
    WHERE empresa_id = p_empresa_id 
      AND user_id = auth.uid()
      AND role_na_empresa IN ('dono', 'admin')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta empresa';
  END IF;

  -- 1. Limpar empresa_padrao_id nos profiles
  UPDATE profiles 
  SET empresa_padrao_id = NULL 
  WHERE empresa_padrao_id = p_empresa_id;

  -- 2. Limpar empresa_id no onboarding_status
  UPDATE onboarding_status 
  SET empresa_id = NULL, empresa_criada = false 
  WHERE empresa_id = p_empresa_id;

  -- 3. Remover vínculos user_empresas
  DELETE FROM user_empresas WHERE empresa_id = p_empresa_id;

  -- 4. Finalmente, excluir a empresa
  DELETE FROM empresas WHERE id = p_empresa_id;
END;
$$;