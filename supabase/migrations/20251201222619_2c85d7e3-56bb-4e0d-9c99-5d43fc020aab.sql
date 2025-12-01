-- Add missing foreign key relationship between credit_cards and empresas
ALTER TABLE credit_cards
ADD CONSTRAINT credit_cards_empresa_id_fkey
FOREIGN KEY (empresa_id)
REFERENCES empresas(id)
ON DELETE RESTRICT;