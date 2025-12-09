-- Remover constraint antiga e adicionar nova com 'emitido' no lugar de 'pago'
ALTER TABLE compras DROP CONSTRAINT compras_status_check;
ALTER TABLE compras ADD CONSTRAINT compras_status_check 
  CHECK (status = ANY (ARRAY['rascunho', 'emitido', 'em_transito', 'parcial', 'concluido', 'cancelado']));

-- Atualizar registros existentes de 'pago' para 'emitido'
UPDATE compras SET status = 'emitido' WHERE status = 'pago';