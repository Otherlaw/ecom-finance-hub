
-- Add direction and xml_status columns to nfe_documents
ALTER TABLE public.nfe_documents 
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'recebida',
  ADD COLUMN IF NOT EXISTS xml_status text DEFAULT 'resumo';

-- Add comment for documentation
COMMENT ON COLUMN public.nfe_documents.direction IS 'RECEBIDA (compra) ou EMITIDA (venda), baseado no CNPJ do emitente vs empresa';
COMMENT ON COLUMN public.nfe_documents.xml_status IS 'RESUMO (só metadados), XML_OK (XML completo), XML_ERROR (erro ao parsear XML)';

-- Update existing records: set xml_status based on xml_content presence
UPDATE public.nfe_documents 
SET xml_status = CASE 
  WHEN xml_content IS NOT NULL AND xml_content != '' THEN 'xml_ok'
  ELSE 'resumo'
END
WHERE xml_status = 'resumo';

-- Update existing records: set direction based on issuer_cnpj vs empresa CNPJ
-- If issuer_cnpj matches empresa CNPJ -> emitida, otherwise -> recebida
UPDATE public.nfe_documents nd
SET direction = CASE 
  WHEN nd.issuer_cnpj IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.empresas e 
    WHERE e.id = nd.empresa_id 
    AND REPLACE(REPLACE(e.cnpj, '.', ''), '/', '') = REPLACE(REPLACE(nd.issuer_cnpj, '.', ''), '/', '')
  ) THEN 'emitida'
  WHEN nd.issuer_cnpj IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.nfe_certificates nc 
    WHERE nc.empresa_id = nd.empresa_id 
    AND REPLACE(REPLACE(nc.cnpj, '.', ''), '/', '') = REPLACE(REPLACE(nd.issuer_cnpj, '.', ''), '/', '')
  ) THEN 'emitida'
  ELSE 'recebida'
END;

-- Create index for direction queries
CREATE INDEX IF NOT EXISTS idx_nfe_documents_direction ON public.nfe_documents (empresa_id, direction);
