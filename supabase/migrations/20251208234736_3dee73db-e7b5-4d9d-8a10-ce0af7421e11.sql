-- Adicionar campos de forma de pagamento e integração com contas a pagar na tabela compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS condicao_pagamento text DEFAULT 'a_vista';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS prazo_dias integer;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS data_vencimento date;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS gerar_conta_pagar boolean DEFAULT false;

-- Comentários explicativos
COMMENT ON COLUMN compras.forma_pagamento IS 'Forma de pagamento: pix, boleto, transferencia, cartao, dinheiro';
COMMENT ON COLUMN compras.condicao_pagamento IS 'Condição: a_vista ou a_prazo';
COMMENT ON COLUMN compras.prazo_dias IS 'Prazo em dias se for a prazo';
COMMENT ON COLUMN compras.data_vencimento IS 'Data de vencimento calculada ou manual';
COMMENT ON COLUMN compras.gerar_conta_pagar IS 'Se true, gera automaticamente título em contas_a_pagar';