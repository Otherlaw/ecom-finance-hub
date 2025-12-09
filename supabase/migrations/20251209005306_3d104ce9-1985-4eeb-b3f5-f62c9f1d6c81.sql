-- Adicionar campos faltantes em compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_icms_st numeric DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS outras_despesas numeric DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS uf_emitente text;

-- Adicionar valor_icms_st em compras_itens
ALTER TABLE compras_itens ADD COLUMN IF NOT EXISTS valor_icms_st numeric DEFAULT 0;