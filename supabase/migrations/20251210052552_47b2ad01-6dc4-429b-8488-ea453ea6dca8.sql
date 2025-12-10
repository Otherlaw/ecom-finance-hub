-- View agregada para vendas detalhadas
-- Junta marketplace_transactions + items + produtos + cmv para visão completa de vendas

CREATE OR REPLACE VIEW public.vw_vendas_detalhadas AS
SELECT
  mt.id as transacao_id,
  mti.id as item_id,
  mt.empresa_id,
  mt.canal,
  mt.canal_venda,
  mt.conta_nome,
  mt.pedido_id,
  mt.data_transacao as data_venda,
  mt.data_repasse,
  mt.tipo_transacao,
  mt.descricao,
  mt.status,
  mt.referencia_externa,
  
  -- Valores da transação
  COALESCE(mt.valor_bruto, 0) as valor_bruto,
  COALESCE(mt.valor_liquido, 0) as valor_liquido,
  COALESCE(mt.tarifas, 0) as tarifas,
  COALESCE(mt.taxas, 0) as taxas,
  COALESCE(mt.outros_descontos, 0) as outros_descontos,
  mt.tipo_lancamento,
  
  -- Dados do item (se existir)
  mti.sku_marketplace,
  mti.anuncio_id,
  mti.descricao_item,
  COALESCE(mti.quantidade, 1) as quantidade,
  COALESCE(mti.preco_unitario, mt.valor_bruto) as preco_unitario,
  COALESCE(mti.preco_total, mt.valor_bruto) as preco_total,
  
  -- Produto vinculado
  mti.produto_id,
  p.sku as sku_interno,
  p.nome as produto_nome,
  COALESCE(p.custo_medio, 0) as custo_medio,
  
  -- CMV calculado (se existir)
  cmv.custo_total as cmv_total,
  cmv.margem_bruta as cmv_margem_bruta,
  cmv.margem_percentual as cmv_margem_percentual,
  
  -- Cálculos derivados
  (COALESCE(mti.quantidade, 1) * COALESCE(p.custo_medio, 0)) as custo_calculado,
  
  -- Flags de consistência
  CASE WHEN mti.produto_id IS NULL THEN true ELSE false END as sem_produto_vinculado,
  CASE WHEN p.custo_medio IS NULL OR p.custo_medio = 0 THEN true ELSE false END as sem_custo,
  CASE WHEN mt.categoria_id IS NULL THEN true ELSE false END as sem_categoria,
  CASE WHEN mt.status != 'conciliado' THEN true ELSE false END as nao_conciliado,
  mt.categoria_id,
  mt.centro_custo_id

FROM marketplace_transactions mt
LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
LEFT JOIN produtos p ON p.id = mti.produto_id
LEFT JOIN cmv_registros cmv ON cmv.referencia_id = mt.id AND cmv.produto_id = mti.produto_id
WHERE mt.tipo_lancamento = 'credito';

-- Comentário explicativo
COMMENT ON VIEW public.vw_vendas_detalhadas IS 'View agregada para análise de vendas. Combina transações de marketplace, itens, produtos e CMV para visão operacional completa.';