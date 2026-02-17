
-- =============================================
-- 1) Adicionar campos first_success_at, last_success_at, sync_enabled à nfe_sync_state
-- =============================================
ALTER TABLE public.nfe_sync_state
  ADD COLUMN IF NOT EXISTS first_success_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT false;

-- =============================================
-- 2) Criar tabela manifest_queue para Ciência da Operação
-- =============================================
CREATE TABLE IF NOT EXISTS public.nfe_manifest_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ch_nfe text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, success, error
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_try_at timestamptz DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, ch_nfe)
);

-- RLS
ALTER TABLE public.nfe_manifest_queue ENABLE ROW LEVEL SECURITY;

-- Service role (worker) pode fazer tudo via proxy, mas para segurança:
CREATE POLICY "Users can read own manifest_queue"
  ON public.nfe_manifest_queue FOR SELECT
  USING (user_has_empresa_access(empresa_id));

-- Index para busca eficiente de itens pendentes
CREATE INDEX IF NOT EXISTS idx_manifest_queue_pending 
  ON public.nfe_manifest_queue (empresa_id, status, next_try_at)
  WHERE status IN ('pending', 'error');

-- =============================================
-- 3) Atualizar empresas existentes: sync_enabled = true se já tem certificado ativo
-- =============================================
UPDATE public.nfe_sync_state ss
SET sync_enabled = true
WHERE EXISTS (
  SELECT 1 FROM public.nfe_certificates nc
  WHERE nc.empresa_id = ss.empresa_id AND nc.is_active = true
);
