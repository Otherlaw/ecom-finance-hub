-- Remover a trigger duplicada que causa conflito durante signup
-- A trigger handle_new_user já faz a inserção em user_empresas corretamente
DROP TRIGGER IF EXISTS trg_auto_add_owner ON public.empresas;

-- Manter a função para uso futuro em criação de empresas adicionais pelo usuário logado
-- mas precisamos garantir que ela só rode quando created_by é diferente de NULL
-- e não rode durante o signup (quando handle_new_user já cuida disso)
CREATE OR REPLACE FUNCTION public.auto_add_owner_to_user_empresas()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se created_by foi definido E é diferente de NULL
  -- Durante o signup, handle_new_user já faz a inserção
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.user_empresas (user_id, empresa_id, role_na_empresa)
    VALUES (NEW.created_by, NEW.id, 'dono')
    ON CONFLICT (user_id, empresa_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar a trigger, mas ela só vai adicionar owner se created_by não for null
-- Isso evita duplicidade com handle_new_user que já faz a inserção
CREATE TRIGGER trg_auto_add_owner
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION auto_add_owner_to_user_empresas();