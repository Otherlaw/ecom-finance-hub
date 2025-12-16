-- Adicionar coluna origem_descricao para descrições personalizadas quando origem_credito = 'outro'
ALTER TABLE creditos_icms ADD COLUMN IF NOT EXISTS origem_descricao TEXT;
COMMENT ON COLUMN creditos_icms.origem_descricao IS 'Descrição customizada quando origem_credito é "outro"';