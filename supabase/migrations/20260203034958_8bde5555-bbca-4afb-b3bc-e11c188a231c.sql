-- ============================================
-- NF-e Automatic Sync Infrastructure Tables
-- ============================================

-- 1. Tabela para armazenar certificados A1 (PFX) criptografados
CREATE TABLE IF NOT EXISTS public.nfe_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cnpj TEXT NOT NULL,
    cert_pfx_encrypted TEXT NOT NULL, -- base64 do PFX criptografado (iv:ciphertext:tag)
    cert_password_encrypted TEXT NOT NULL, -- senha criptografada (iv:ciphertext:tag)
    is_active BOOLEAN NOT NULL DEFAULT true,
    ambiente TEXT NOT NULL DEFAULT 'producao', -- 'producao' ou 'homologacao'
    uf TEXT NOT NULL DEFAULT 'SP', -- UF para consulta na SEFAZ
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice para busca por empresa
CREATE INDEX IF NOT EXISTS idx_nfe_certificates_empresa ON public.nfe_certificates(empresa_id);

-- 2. Tabela para estado de sincronizacao por empresa
CREATE TABLE IF NOT EXISTS public.nfe_sync_state (
    empresa_id UUID PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
    ult_nsu BIGINT NOT NULL DEFAULT 0,
    max_nsu BIGINT NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'running', 'error', 'completed'
    last_error TEXT,
    documents_fetched INTEGER NOT NULL DEFAULT 0,
    credits_created INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela para armazenar documentos NF-e baixados
CREATE TABLE IF NOT EXISTS public.nfe_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    access_key TEXT NOT NULL, -- Chave de acesso de 44 digitos
    nsu BIGINT,
    schema_type TEXT, -- 'procNFe', 'resNFe', 'resEvento', etc.
    xml_content TEXT, -- XML completo quando disponivel
    issuer_cnpj TEXT,
    dest_cnpj TEXT,
    issue_date DATE,
    total_value NUMERIC(15,2),
    processed BOOLEAN NOT NULL DEFAULT false,
    credits_generated INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_nfe_documents_access_key UNIQUE (empresa_id, access_key)
);

-- Indices para busca de documentos
CREATE INDEX IF NOT EXISTS idx_nfe_documents_empresa ON public.nfe_documents(empresa_id);
CREATE INDEX IF NOT EXISTS idx_nfe_documents_access_key ON public.nfe_documents(access_key);
CREATE INDEX IF NOT EXISTS idx_nfe_documents_processed ON public.nfe_documents(empresa_id, processed);

-- 4. Tabela para logs de sincronizacao
CREATE TABLE IF NOT EXISTS public.nfe_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error', 'debug'
    message TEXT NOT NULL,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice para busca de logs
CREATE INDEX IF NOT EXISTS idx_nfe_sync_logs_empresa ON public.nfe_sync_logs(empresa_id, created_at DESC);

-- 5. Adicionar coluna 'origin' na tabela creditos_icms para rastrear origem do credito
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'creditos_icms' 
          AND column_name = 'origin'
    ) THEN
        ALTER TABLE public.creditos_icms ADD COLUMN origin TEXT DEFAULT 'manual';
    END IF;
END $$;

-- 6. Adicionar coluna 'nfe_document_id' para vincular credito ao documento original
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'creditos_icms' 
          AND column_name = 'nfe_document_id'
    ) THEN
        ALTER TABLE public.creditos_icms ADD COLUMN nfe_document_id UUID REFERENCES public.nfe_documents(id);
    END IF;
END $$;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.nfe_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_sync_logs ENABLE ROW LEVEL SECURITY;

-- Funcao auxiliar para verificar acesso a empresa (evita recursao)
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_empresas
        WHERE user_id = auth.uid()
          AND empresa_id = p_empresa_id
    )
$$;

-- Policies para nfe_certificates (apenas admin/owner pode ver/editar)
CREATE POLICY "Users can view certificates of their empresas"
    ON public.nfe_certificates FOR SELECT
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert certificates for their empresas"
    ON public.nfe_certificates FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update certificates of their empresas"
    ON public.nfe_certificates FOR UPDATE
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete certificates of their empresas"
    ON public.nfe_certificates FOR DELETE
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

-- Policies para nfe_sync_state
CREATE POLICY "Users can view sync state of their empresas"
    ON public.nfe_sync_state FOR SELECT
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can manage sync state of their empresas"
    ON public.nfe_sync_state FOR ALL
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

-- Policies para nfe_documents
CREATE POLICY "Users can view documents of their empresas"
    ON public.nfe_documents FOR SELECT
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can manage documents of their empresas"
    ON public.nfe_documents FOR ALL
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

-- Policies para nfe_sync_logs
CREATE POLICY "Users can view logs of their empresas"
    ON public.nfe_sync_logs FOR SELECT
    TO authenticated
    USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert logs for their empresas"
    ON public.nfe_sync_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_empresa_access(empresa_id));

-- ============================================
-- Trigger para atualizar updated_at
-- ============================================

-- Trigger para nfe_certificates
CREATE TRIGGER update_nfe_certificates_updated_at
    BEFORE UPDATE ON public.nfe_certificates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para nfe_sync_state
CREATE TRIGGER update_nfe_sync_state_updated_at
    BEFORE UPDATE ON public.nfe_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();