-- Fix 1: Set search_path on function to prevent search path mutation attacks
CREATE OR REPLACE FUNCTION public.update_marketplace_import_jobs_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$;

-- Fix 2: Set empresa_id as NOT NULL in responsaveis table to prevent RLS bypass
-- First check if there are any NULL values and update them if needed
UPDATE responsaveis 
SET empresa_id = (SELECT id FROM empresas LIMIT 1)
WHERE empresa_id IS NULL;

-- Now set the column as NOT NULL
ALTER TABLE responsaveis ALTER COLUMN empresa_id SET NOT NULL;