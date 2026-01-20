-- Atualizar função para suportar tanto updated_at quanto atualizado_em
-- Usa to_jsonb para verificar dinamicamente quais colunas existem no registro

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verifica se o registro tem a coluna "updated_at"
  IF to_jsonb(NEW) ? 'updated_at' THEN
    NEW.updated_at = now();
  -- Senão, verifica se tem "atualizado_em"
  ELSIF to_jsonb(NEW) ? 'atualizado_em' THEN
    NEW.atualizado_em = now();
  END IF;
  
  RETURN NEW;
END;
$function$;