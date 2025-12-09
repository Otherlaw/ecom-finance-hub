-- Remove as políticas RLS inseguras que estão anulando a segurança por empresa
-- As políticas "Allow all users to..." com USING=true permitem acesso irrestrito

DROP POLICY IF EXISTS "Allow all users to delete regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow all users to insert regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow all users to read regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow all users to update regras" ON regras_categorizacao;

-- Verificar que as políticas seguras ainda existem (não criar se já existirem)
DO $$ 
BEGIN
  -- Políticas seguras baseadas em empresa_id via user_has_empresa_access()
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own regras' AND tablename = 'regras_categorizacao') THEN
    CREATE POLICY "Users can read own regras" ON regras_categorizacao FOR SELECT USING (user_has_empresa_access(empresa_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own regras' AND tablename = 'regras_categorizacao') THEN
    CREATE POLICY "Users can insert own regras" ON regras_categorizacao FOR INSERT WITH CHECK (user_has_empresa_access(empresa_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own regras' AND tablename = 'regras_categorizacao') THEN
    CREATE POLICY "Users can update own regras" ON regras_categorizacao FOR UPDATE USING (user_has_empresa_access(empresa_id));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own regras' AND tablename = 'regras_categorizacao') THEN
    CREATE POLICY "Users can delete own regras" ON regras_categorizacao FOR DELETE USING (user_has_empresa_access(empresa_id));
  END IF;
END $$;