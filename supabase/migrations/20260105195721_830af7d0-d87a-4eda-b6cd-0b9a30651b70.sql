-- Adicionar coluna role_na_empresa à tabela user_empresas
ALTER TABLE public.user_empresas 
ADD COLUMN IF NOT EXISTS role_na_empresa TEXT NOT NULL DEFAULT 'operador';

-- Adicionar constraint para validar valores permitidos
ALTER TABLE public.user_empresas 
ADD CONSTRAINT role_na_empresa_check 
CHECK (role_na_empresa IN ('dono', 'admin', 'financeiro', 'operador'));

-- Comentário para documentação
COMMENT ON COLUMN public.user_empresas.role_na_empresa IS 'Papel do usuário na empresa: dono, admin, financeiro ou operador';