-- Drop any existing triggers on marketplace_import_jobs that might use wrong function
DROP TRIGGER IF EXISTS update_marketplace_import_jobs_updated_at ON marketplace_import_jobs;
DROP TRIGGER IF EXISTS set_updated_at ON marketplace_import_jobs;

-- Create function specifically for marketplace_import_jobs using correct field name
CREATE OR REPLACE FUNCTION set_marketplace_import_jobs_atualizado_em()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

-- Create trigger using the correct function
CREATE TRIGGER set_marketplace_import_jobs_atualizado_em_trigger
  BEFORE UPDATE ON marketplace_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_marketplace_import_jobs_atualizado_em();