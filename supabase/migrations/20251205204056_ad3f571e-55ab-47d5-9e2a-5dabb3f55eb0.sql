-- Remove the incorrect trigger that references updated_at
DROP TRIGGER IF EXISTS set_updated_at_marketplace_import_jobs ON marketplace_import_jobs;
DROP FUNCTION IF EXISTS update_marketplace_import_jobs_updated_at();

-- Create a correct function for atualizado_em
CREATE OR REPLACE FUNCTION update_marketplace_import_jobs_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger with correct field name
CREATE TRIGGER set_atualizado_em_marketplace_import_jobs
  BEFORE UPDATE ON marketplace_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_import_jobs_atualizado_em();