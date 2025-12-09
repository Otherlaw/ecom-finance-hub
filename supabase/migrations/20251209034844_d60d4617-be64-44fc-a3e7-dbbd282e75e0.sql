-- Add empresa_id to responsaveis table for proper data isolation
ALTER TABLE public.responsaveis ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Drop existing public policies on responsaveis
DROP POLICY IF EXISTS "Allow public read responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Allow public insert responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Allow public update responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Allow public delete responsaveis" ON public.responsaveis;

-- Create secure RLS policies for responsaveis
CREATE POLICY "Users can read own responsaveis"
ON public.responsaveis FOR SELECT
USING (
  empresa_id IS NULL OR user_has_empresa_access(empresa_id)
);

CREATE POLICY "Users can insert own responsaveis"
ON public.responsaveis FOR INSERT
WITH CHECK (
  empresa_id IS NULL OR user_has_empresa_access(empresa_id)
);

CREATE POLICY "Users can update own responsaveis"
ON public.responsaveis FOR UPDATE
USING (
  empresa_id IS NULL OR user_has_empresa_access(empresa_id)
);

CREATE POLICY "Users can delete own responsaveis"
ON public.responsaveis FOR DELETE
USING (
  empresa_id IS NULL OR user_has_empresa_access(empresa_id)
);