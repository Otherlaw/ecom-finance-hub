
-- =====================================================================
-- Migração: Auto-provisioning de empresa para novos usuários
-- =====================================================================

-- 1) Atualizar trigger handle_new_user para criar empresa automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_nome_empresa text;
BEGIN
  -- Criar profile
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Primeiro usuário do sistema vira admin global
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador')
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Criar empresa automaticamente para o novo usuário
  v_nome_empresa := COALESCE(
    NEW.raw_user_meta_data->>'empresa_nome',
    'Empresa de ' || COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  );
  
  INSERT INTO public.empresas (razao_social, cnpj, regime_tributario, created_by)
  VALUES (
    v_nome_empresa,
    '00.000.000/0000-00', -- CNPJ placeholder, usuário preenche depois
    'simples_nacional',
    NEW.id
  )
  RETURNING id INTO v_empresa_id;
  
  -- O trigger auto_add_owner_to_user_empresas já cria o vínculo dono→empresa
  -- Mas vamos garantir que existe
  INSERT INTO public.user_empresas (user_id, empresa_id, role_na_empresa)
  VALUES (NEW.id, v_empresa_id, 'dono')
  ON CONFLICT (user_id, empresa_id) DO NOTHING;
  
  -- Atualizar onboarding_status com empresa criada
  INSERT INTO public.onboarding_status (user_id, empresa_criada, empresa_id)
  VALUES (NEW.id, true, v_empresa_id)
  ON CONFLICT (user_id) DO UPDATE SET
    empresa_criada = true,
    empresa_id = v_empresa_id,
    updated_at = now();
  
  -- Definir empresa padrão no profile
  UPDATE public.profiles
  SET empresa_padrao_id = v_empresa_id
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Comentário para rastreabilidade
COMMENT ON FUNCTION public.handle_new_user IS 'Auto-provisioning: cria profile + empresa + vínculo dono para cada novo usuário';
