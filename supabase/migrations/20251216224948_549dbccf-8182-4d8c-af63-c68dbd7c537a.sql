-- 1. Dropar a view que depende da coluna
DROP VIEW IF EXISTS vw_vendas_detalhadas;

-- 2. Alterar o tipo da coluna para timestamp
ALTER TABLE marketplace_transactions 
ALTER COLUMN data_transacao TYPE timestamp with time zone 
USING data_transacao::timestamp with time zone;

-- 3. Recriar a view com a coluna timestamp
CREATE OR REPLACE VIEW vw_vendas_detalhadas AS
SELECT 
    mt.id AS transacao_id,
    mti.id AS item_id,
    mt.empresa_id,
    mt.canal,
    mt.canal_venda,
    mt.conta_nome,
    mt.pedido_id,
    mt.data_transacao AS data_venda,
    mt.data_repasse,
    mt.tipo_transacao,
    mt.descricao,
    mt.status,
    mt.valor_bruto,
    mt.valor_liquido,
    mt.tarifas,
    mt.taxas,
    mt.outros_descontos,
    mt.tipo_lancamento,
    mt.tipo_envio,
    COALESCE(mt.frete_comprador, 0::numeric) AS frete_comprador,
    COALESCE(mt.frete_vendedor, 0::numeric) AS frete_vendedor,
    COALESCE(mt.custo_ads, 0::numeric) AS custo_ads,
    mti.sku_marketplace,
    mti.anuncio_id,
    mti.descricao_item,
    mti.quantidade,
    mti.preco_unitario,
    mti.preco_total,
    mti.produto_id,
    p.sku AS sku_interno,
    p.nome AS produto_nome,
    p.custo_medio,
    cmv.custo_total AS cmv_total,
    cmv.margem_bruta,
    cmv.margem_percentual,
    CASE WHEN mti.produto_id IS NULL THEN true ELSE false END AS sem_produto_vinculado,
    CASE WHEN p.custo_medio IS NULL OR p.custo_medio = 0::numeric THEN true ELSE false END AS sem_custo,
    CASE WHEN mt.categoria_id IS NULL THEN true ELSE false END AS sem_categoria,
    mt.status <> 'conciliado'::text AS nao_conciliado,
    COALESCE(mt.custo_ads, 0::numeric) > 0::numeric AS teve_ads
FROM marketplace_transactions mt
LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
LEFT JOIN produtos p ON p.id = mti.produto_id
LEFT JOIN cmv_registros cmv ON cmv.referencia_id = mt.id AND cmv.produto_id = mti.produto_id
WHERE mt.tipo_lancamento = 'credito'::text 
  AND (mt.tipo_transacao = ANY (ARRAY['venda'::text, 'repasse'::text, 'liberacao'::text]))
ORDER BY mt.data_transacao DESC;