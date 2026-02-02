
-- Atualizar a função handle_new_user para usar CNPJ único por usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_nome_empresa text;
  v_cnpj_placeholder text;
BEGIN
  -- Criar profile
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Todos os novos usuários recebem role padrão 'operador'
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador')
  ON CONFLICT DO NOTHING;
  
  -- Verificar se o usuário está enviando dados de empresa no signup
  -- Se tiver cnpj no metadata, usamos os dados do formulário
  IF NEW.raw_user_meta_data->>'empresa_cnpj' IS NOT NULL THEN
    -- Usar dados do formulário de cadastro
    INSERT INTO public.empresas (razao_social, nome_fantasia, cnpj, regime_tributario, created_by)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'empresa_razao_social', 'Minha Empresa'),
      NEW.raw_user_meta_data->>'empresa_nome_fantasia',
      NEW.raw_user_meta_data->>'empresa_cnpj',
      COALESCE(NEW.raw_user_meta_data->>'empresa_regime', 'simples_nacional'),
      NEW.id
    )
    RETURNING id INTO v_empresa_id;
  ELSE
    -- Gerar CNPJ placeholder único baseado no UUID do usuário
    v_cnpj_placeholder := 'TEMP-' || LEFT(REPLACE(NEW.id::text, '-', ''), 14);
    
    v_nome_empresa := COALESCE(
      NEW.raw_user_meta_data->>'empresa_nome',
      'Empresa de ' || COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
    );
    
    INSERT INTO public.empresas (razao_social, cnpj, regime_tributario, created_by)
    VALUES (
      v_nome_empresa,
      v_cnpj_placeholder,
      'simples_nacional',
      NEW.id
    )
    RETURNING id INTO v_empresa_id;
  END IF;
  
  -- Vincular como dono da empresa
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
$function$;

-- Corrigir empresa existente com CNPJ duplicado placeholder
UPDATE public.empresas 
SET cnpj = 'TEMP-' || LEFT(REPLACE(id::text, '-', ''), 14)
WHERE cnpj = '00.000.000/0000-00';
