
-- Adicionar FK entre user_empresas.user_id e profiles.id
-- Isso permite fazer join para buscar dados do colaborador

-- Primeiro verificar se já existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_empresas_user_id_fkey'
    AND table_name = 'user_empresas'
  ) THEN
    ALTER TABLE public.user_empresas
    ADD CONSTRAINT user_empresas_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Garantir que profiles tenha email indexado
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
