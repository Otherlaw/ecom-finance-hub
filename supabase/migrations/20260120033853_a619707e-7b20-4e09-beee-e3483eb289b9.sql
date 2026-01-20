-- 1) Adicionar coluna created_by em empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

-- 2) Criar trigger AFTER INSERT em empresas para auto-insert em user_empresas
CREATE OR REPLACE FUNCTION public.auto_add_owner_to_user_empresas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Inserir o criador como 'dono' na tabela user_empresas
  INSERT INTO public.user_empresas (user_id, empresa_id, role_na_empresa)
  VALUES (
    COALESCE(NEW.created_by, auth.uid()),
    NEW.id,
    'dono'
  )
  ON CONFLICT (user_id, empresa_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Drop trigger se existir e recriar
DROP TRIGGER IF EXISTS trg_auto_add_owner ON public.empresas;
CREATE TRIGGER trg_auto_add_owner
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_owner_to_user_empresas();

-- 3) Criar constraint única em user_empresas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_empresas_user_empresa_unique'
  ) THEN
    ALTER TABLE public.user_empresas 
    ADD CONSTRAINT user_empresas_user_empresa_unique 
    UNIQUE (user_id, empresa_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 4) Habilitar RLS em empresas (estava desabilitado)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas de empresas
DROP POLICY IF EXISTS "Usuarios podem ver suas empresas" ON public.empresas;
DROP POLICY IF EXISTS "Usuarios podem criar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Donos podem atualizar empresas" ON public.empresas;
DROP POLICY IF EXISTS "Donos podem deletar empresas" ON public.empresas;
DROP POLICY IF EXISTS "empresas_select_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_insert_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_update_policy" ON public.empresas;
DROP POLICY IF EXISTS "empresas_delete_policy" ON public.empresas;

-- 5) Criar policies para empresas
CREATE POLICY "empresas_select_own"
ON public.empresas FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT empresa_id FROM public.user_empresas 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "empresas_insert_authenticated"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() OR created_by IS NULL
);

CREATE POLICY "empresas_update_owner"
ON public.empresas FOR UPDATE
TO authenticated
USING (
  public.user_is_empresa_owner(id)
);

CREATE POLICY "empresas_delete_owner"
ON public.empresas FOR DELETE
TO authenticated
USING (
  public.user_is_empresa_owner(id)
);

-- 6) Habilitar RLS em user_empresas
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas
DROP POLICY IF EXISTS "Usuarios podem ver suas associacoes" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_select_policy" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_insert_policy" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_delete_policy" ON public.user_empresas;

-- 7) Criar policies para user_empresas
CREATE POLICY "user_empresas_select_own"
ON public.user_empresas FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT apenas via trigger ou RPC (não permitir INSERT direto do cliente)
-- Mas precisamos permitir para o trigger funcionar (trigger usa SECURITY DEFINER)
CREATE POLICY "user_empresas_insert_via_trigger"
ON public.user_empresas FOR INSERT
TO authenticated
WITH CHECK (false); -- Bloqueia INSERT direto, trigger bypassa via SECURITY DEFINER

-- DELETE apenas owner
CREATE POLICY "user_empresas_delete_owner"
ON public.user_empresas FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_empresas ue
    WHERE ue.empresa_id = user_empresas.empresa_id
    AND ue.user_id = auth.uid()
    AND ue.role_na_empresa = 'dono'
  )
);

-- 8) Criar RPC para adicionar membro por email
CREATE OR REPLACE FUNCTION public.add_user_to_empresa_by_email(
  p_empresa_id uuid,
  p_email text,
  p_role text DEFAULT 'operador'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_user_id uuid;
  v_caller_role text;
BEGIN
  -- Verificar se o chamador é dono da empresa
  SELECT role_na_empresa INTO v_caller_role
  FROM public.user_empresas
  WHERE user_id = auth.uid()
    AND empresa_id = p_empresa_id;
  
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('dono', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você não tem permissão para adicionar membros a esta empresa'
    );
  END IF;
  
  -- Buscar user_id pelo email
  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE email = lower(trim(p_email));
  
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usuário não encontrado. O usuário precisa ter uma conta no sistema.'
    );
  END IF;
  
  -- Verificar se já existe associação
  IF EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = v_target_user_id AND empresa_id = p_empresa_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este usuário já faz parte da empresa'
    );
  END IF;
  
  -- Inserir associação
  INSERT INTO public.user_empresas (user_id, empresa_id, role_na_empresa)
  VALUES (v_target_user_id, p_empresa_id, p_role);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro adicionado com sucesso',
    'user_id', v_target_user_id
  );
END;
$function$;

-- 9) Criar RPC para listar membros da empresa
CREATE OR REPLACE FUNCTION public.get_empresa_members(p_empresa_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  nome text,
  role_na_empresa text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se o chamador tem acesso à empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
  ) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    ue.user_id,
    u.email,
    p.nome,
    ue.role_na_empresa,
    ue.created_at
  FROM public.user_empresas ue
  JOIN auth.users u ON u.id = ue.user_id
  LEFT JOIN public.profiles p ON p.id = ue.user_id
  WHERE ue.empresa_id = p_empresa_id
  ORDER BY ue.created_at;
END;
$function$;

-- 10) Criar RPC para remover membro
CREATE OR REPLACE FUNCTION public.remove_user_from_empresa(
  p_empresa_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
  v_target_role text;
BEGIN
  -- Verificar se o chamador é dono/admin
  SELECT role_na_empresa INTO v_caller_role
  FROM public.user_empresas
  WHERE user_id = auth.uid() AND empresa_id = p_empresa_id;
  
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('dono', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você não tem permissão para remover membros desta empresa'
    );
  END IF;
  
  -- Não permitir remover a si mesmo se for dono
  IF p_user_id = auth.uid() AND v_caller_role = 'dono' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você não pode remover a si mesmo como dono'
    );
  END IF;
  
  -- Verificar role do alvo
  SELECT role_na_empresa INTO v_target_role
  FROM public.user_empresas
  WHERE user_id = p_user_id AND empresa_id = p_empresa_id;
  
  -- Apenas dono pode remover admin
  IF v_target_role = 'admin' AND v_caller_role != 'dono' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Apenas o dono pode remover administradores'
    );
  END IF;
  
  -- Não permitir remover dono
  IF v_target_role = 'dono' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Não é possível remover o dono da empresa'
    );
  END IF;
  
  -- Remover
  DELETE FROM public.user_empresas
  WHERE user_id = p_user_id AND empresa_id = p_empresa_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Membro removido com sucesso'
  );
END;
$function$;