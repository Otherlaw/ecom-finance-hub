-- Adicionar constraint UNIQUE em empresa_id na tabela nfe_certificates
-- Isso permite apenas 1 certificado ativo por empresa (regra de negocio)
-- O upsert usa onConflict: 'empresa_id'

-- Primeiro, verificar se existem duplicatas e remover (manter apenas o mais recente)
WITH duplicates AS (
  SELECT id, empresa_id,
    ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY updated_at DESC, created_at DESC) as rn
  FROM public.nfe_certificates
)
DELETE FROM public.nfe_certificates
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Agora adicionar a constraint UNIQUE
ALTER TABLE public.nfe_certificates
ADD CONSTRAINT nfe_certificates_empresa_id_key UNIQUE (empresa_id);