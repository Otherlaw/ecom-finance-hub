
-- Corrigir bonus_envio errado para pedidos Full e Coleta
-- Para essas modalidades o ML não paga bônus ao vendedor
-- O valor estava sendo capturado erroneamente da API

UPDATE marketplace_transactions
SET 
  bonus_envio = 0,
  valor_liquido = GREATEST(0, valor_bruto 
    - COALESCE(taxas, 0) 
    - COALESCE(tarifas, 0) 
    - COALESCE(frete_vendedor, 0)
  )
WHERE tipo_envio IN ('full', 'coleta')
  AND bonus_envio > 0;

-- Para Flex: o bonus_envio está correto E já está embutido no valor_liquido.
-- O problema é que a RPC soma bonus_envio DE NOVO sobre o valor_bruto,
-- resultando em dupla contagem. Devemos zerar o bonus_envio nas transações Flex
-- e deixar o valor_liquido refletir o real (que já inclui o bônus).
-- Assim a RPC calcula corretamente: valor_bruto - tarifas - frete + bonus (= 0) = valor_liquido correto

-- Para Flex: verificar se valor_liquido já está correto e apenas zerar bonus_envio
-- para evitar dupla contagem na RPC (que soma +bonus_envio sobre valor_bruto)
UPDATE marketplace_transactions
SET bonus_envio = 0
WHERE tipo_envio IN ('flex', 'flex_turbo')
  AND bonus_envio > 0
  AND bonus_envio = COALESCE(frete_vendedor, 0);
-- Só zera quando bonus == frete (caso típico onde o bônus já está no valor_liquido)
