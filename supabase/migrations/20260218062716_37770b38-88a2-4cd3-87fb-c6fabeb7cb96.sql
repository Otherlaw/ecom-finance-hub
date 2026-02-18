
-- Corrigir tipo_envio para pedidos "Coleta Flex" já importados
-- Critério: self_service + sender_cost > 0 (vendedor paga o frete, caracteriza Coleta Flex)
-- A coluna raw_shipping_costs já guarda logistic_type e sender_cost

UPDATE marketplace_transactions
SET
  tipo_envio = 'flex',
  atualizado_em = now()
WHERE
  tipo_envio = 'coleta'
  AND tipo_transacao = 'venda'
  AND (raw_shipping_costs->>'logistic_type') = 'self_service'
  AND (raw_shipping_costs->>'sender_cost')::numeric > 0;
