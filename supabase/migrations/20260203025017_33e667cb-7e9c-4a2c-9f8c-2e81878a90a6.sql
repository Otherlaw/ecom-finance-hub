-- Tabela para armazenar códigos de verificação de e-mail
CREATE TABLE public.email_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índice para busca rápida por email e código
CREATE INDEX idx_email_verification_codes_email ON public.email_verification_codes(email);
CREATE INDEX idx_email_verification_codes_code ON public.email_verification_codes(code);

-- Habilitar RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Política pública para inserção (edge function usa service role)
-- Não precisa de políticas pois será acessado apenas via edge functions com service role

-- Limpar códigos expirados automaticamente (função para ser chamada manualmente ou via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < now();
END;
$$;