-- Parte 1: Corrigir delete_empresa_cascade para respeitar admin global
CREATE OR REPLACE FUNCTION public.delete_empresa_cascade(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verificar se usuário é dono/admin da empresa OU admin global
  IF NOT EXISTS (
    SELECT 1 FROM user_empresas 
    WHERE empresa_id = p_empresa_id 
      AND user_id = auth.uid()
      AND role_na_empresa IN ('dono', 'admin')
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
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

-- Parte 2: Criar delete_user_cascade para exclusão de usuário + empresas órfãs
CREATE OR REPLACE FUNCTION public.delete_user_cascade(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresas_deletadas uuid[];
BEGIN
  -- Apenas admins globais podem excluir usuários
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir usuários';
  END IF;

  -- Impedir auto-exclusão
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir a si mesmo';
  END IF;

  -- 1. Buscar empresas onde este usuário é o ÚNICO membro
  SELECT ARRAY_AGG(empresa_id) INTO v_empresas_deletadas
  FROM (
    SELECT ue.empresa_id
    FROM user_empresas ue
    WHERE ue.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM user_empresas ue2 
        WHERE ue2.empresa_id = ue.empresa_id 
          AND ue2.user_id != p_user_id
      )
  ) sub;

  -- 2. Limpar vínculos do usuário
  DELETE FROM user_empresas WHERE user_id = p_user_id;
  DELETE FROM user_roles WHERE user_id = p_user_id;
  DELETE FROM onboarding_status WHERE user_id = p_user_id;

  -- 3. Limpar profiles que referenciam empresas a serem deletadas e deletar empresas órfãs
  IF v_empresas_deletadas IS NOT NULL AND array_length(v_empresas_deletadas, 1) > 0 THEN
    UPDATE profiles 
    SET empresa_padrao_id = NULL 
    WHERE empresa_padrao_id = ANY(v_empresas_deletadas);
    
    UPDATE onboarding_status 
    SET empresa_id = NULL, empresa_criada = false 
    WHERE empresa_id = ANY(v_empresas_deletadas);
    
    -- Deletar empresas órfãs
    DELETE FROM empresas WHERE id = ANY(v_empresas_deletadas);
  END IF;

  -- 4. Deletar profile do usuário
  DELETE FROM profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'empresas_deletadas', COALESCE(v_empresas_deletadas, ARRAY[]::uuid[])
  );
END;
$$;