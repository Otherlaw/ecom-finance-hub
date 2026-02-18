-- Garante unique constraint para upsert por (empresa_id, canal, tipo_envio)
ALTER TABLE public.logistica_plataforma_config
  DROP CONSTRAINT IF EXISTS logistica_plataforma_config_empresa_canal_tipo_key;

ALTER TABLE public.logistica_plataforma_config
  ADD CONSTRAINT logistica_plataforma_config_empresa_canal_tipo_key
  UNIQUE (empresa_id, canal, tipo_envio);
