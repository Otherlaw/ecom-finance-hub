
-- =====================================================
-- FASE 1: INFRAESTRUTURA BASE PARA INTEGRAÇÕES
-- =====================================================

-- Tabela de tokens OAuth para cada integração
CREATE TABLE public.integracao_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'mercado_livre', 'shopee', 'pluggy', etc.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  user_id_provider TEXT, -- ID do usuário no provider (ex: ML user_id)
  metadata JSONB DEFAULT '{}', -- dados extras do provider
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, provider)
);

-- Tabela de configurações por integração
CREATE TABLE public.integracao_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 30,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  auto_categorize BOOLEAN DEFAULT true,
  auto_reconcile BOOLEAN DEFAULT false,
  webhook_enabled BOOLEAN DEFAULT true,
  webhook_secret TEXT,
  settings JSONB DEFAULT '{}', -- configurações específicas do provider
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, provider)
);

-- Tabela de logs de sincronização
CREATE TABLE public.integracao_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'sync', 'webhook', 'oauth', 'error'
  status TEXT NOT NULL, -- 'success', 'error', 'partial', 'pending'
  mensagem TEXT,
  registros_processados INTEGER DEFAULT 0,
  registros_criados INTEGER DEFAULT 0,
  registros_atualizados INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  detalhes JSONB DEFAULT '{}',
  duracao_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_integracao_tokens_empresa_provider ON public.integracao_tokens(empresa_id, provider);
CREATE INDEX idx_integracao_config_empresa_provider ON public.integracao_config(empresa_id, provider);
CREATE INDEX idx_integracao_logs_empresa_provider ON public.integracao_logs(empresa_id, provider);
CREATE INDEX idx_integracao_logs_created_at ON public.integracao_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.integracao_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integracao_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para integracao_tokens
CREATE POLICY "Users can read own integracao_tokens" 
ON public.integracao_tokens FOR SELECT 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_tokens" 
ON public.integracao_tokens FOR INSERT 
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_tokens" 
ON public.integracao_tokens FOR UPDATE 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_tokens" 
ON public.integracao_tokens FOR DELETE 
USING (user_has_empresa_access(empresa_id));

-- Políticas RLS para integracao_config
CREATE POLICY "Users can read own integracao_config" 
ON public.integracao_config FOR SELECT 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_config" 
ON public.integracao_config FOR INSERT 
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own integracao_config" 
ON public.integracao_config FOR UPDATE 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own integracao_config" 
ON public.integracao_config FOR DELETE 
USING (user_has_empresa_access(empresa_id));

-- Políticas RLS para integracao_logs
CREATE POLICY "Users can read own integracao_logs" 
ON public.integracao_logs FOR SELECT 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own integracao_logs" 
ON public.integracao_logs FOR INSERT 
WITH CHECK (user_has_empresa_access(empresa_id));

-- Trigger para updated_at
CREATE TRIGGER update_integracao_tokens_updated_at
BEFORE UPDATE ON public.integracao_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integracao_config_updated_at
BEFORE UPDATE ON public.integracao_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
