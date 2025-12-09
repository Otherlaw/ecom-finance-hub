-- =====================================================
-- FASE 1: Criar tabela de vínculo usuário-empresa
-- =====================================================

-- Tabela que vincula usuários às empresas (substitui a lógica quebrada)
CREATE TABLE IF NOT EXISTS public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role_na_empresa TEXT NOT NULL DEFAULT 'operador' CHECK (role_na_empresa IN ('dono', 'admin', 'financeiro', 'operador')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

-- Habilitar RLS
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Políticas para user_empresas
CREATE POLICY "Users can read own user_empresas"
ON public.user_empresas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_empresas"
ON public.user_empresas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_empresas"
ON public.user_empresas FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- FASE 2: Atualizar função de acesso à empresa
-- =====================================================

-- Recriar função user_has_empresa_access para usar a nova tabela
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
  ) OR public.has_role(auth.uid(), 'admin')
$$;

-- =====================================================
-- FASE 3: Corrigir políticas RLS de empresas
-- =====================================================

-- Remover política antiga de INSERT (que exigia admin)
DROP POLICY IF EXISTS "Admins can insert empresas" ON public.empresas;

-- Nova política: usuários autenticados podem criar empresas
CREATE POLICY "Authenticated users can insert empresas"
ON public.empresas FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- FASE 4: Criar tabela de status de onboarding
-- =====================================================

CREATE TABLE IF NOT EXISTS public.onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  empresa_criada BOOLEAN NOT NULL DEFAULT false,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  dados_empresa_completos BOOLEAN NOT NULL DEFAULT false,
  plano_contas_revisado BOOLEAN NOT NULL DEFAULT false,
  centros_custo_revisados BOOLEAN NOT NULL DEFAULT false,
  primeira_importacao BOOLEAN NOT NULL DEFAULT false,
  onboarding_completo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;

-- Políticas para onboarding_status
CREATE POLICY "Users can read own onboarding_status"
ON public.onboarding_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding_status"
ON public.onboarding_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding_status"
ON public.onboarding_status FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_onboarding_status_updated_at
BEFORE UPDATE ON public.onboarding_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FASE 5: Atualizar função handle_new_user
-- =====================================================

-- Atualizar trigger para criar onboarding_status automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar profile
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  
  -- Primeiro usuário vira admin automaticamente
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador');
  END IF;
  
  -- Criar registro de onboarding
  INSERT INTO public.onboarding_status (user_id, empresa_criada)
  VALUES (NEW.id, false);
  
  RETURN NEW;
END;
$$;