-- Adicionar campos na marketplace_transactions
ALTER TABLE public.marketplace_transactions 
ADD COLUMN IF NOT EXISTS tipo_envio TEXT,
ADD COLUMN IF NOT EXISTS frete_comprador NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS frete_vendedor NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_ads NUMERIC DEFAULT 0;

-- Criar tabela de configuração fiscal por empresa
CREATE TABLE IF NOT EXISTS public.empresas_config_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  aliquota_imposto_vendas NUMERIC(5,2) NOT NULL DEFAULT 6.00,
  aliquota_icms NUMERIC(5,2) DEFAULT 0,
  aliquota_pis_cofins NUMERIC(5,2) DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id)
);

-- Enable RLS
ALTER TABLE public.empresas_config_fiscal ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own empresas_config_fiscal" 
ON public.empresas_config_fiscal 
FOR SELECT 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own empresas_config_fiscal" 
ON public.empresas_config_fiscal 
FOR INSERT 
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own empresas_config_fiscal" 
ON public.empresas_config_fiscal 
FOR UPDATE 
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own empresas_config_fiscal" 
ON public.empresas_config_fiscal 
FOR DELETE 
USING (user_has_empresa_access(empresa_id));

-- Atualizar a view vw_vendas_detalhadas para incluir os novos campos
DROP VIEW IF EXISTS public.vw_vendas_detalhadas;

CREATE VIEW public.vw_vendas_detalhadas AS
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
  
  -- Valores da transação
  mt.valor_bruto,
  mt.valor_liquido,
  mt.tarifas,
  mt.taxas,
  mt.outros_descontos,
  mt.tipo_lancamento,
  
  -- Novos campos de frete e ads
  mt.tipo_envio,
  COALESCE(mt.frete_comprador, 0) as frete_comprador,
  COALESCE(mt.frete_vendedor, 0) as frete_vendedor,
  COALESCE(mt.custo_ads, 0) as custo_ads,
  
  -- Dados do item
  mti.sku_marketplace,
  mti.anuncio_id,
  mti.descricao_item,
  mti.quantidade,
  mti.preco_unitario,
  mti.preco_total,
  
  -- Produto vinculado
  mti.produto_id,
  p.sku as sku_interno,
  p.nome as produto_nome,
  p.custo_medio,
  
  -- CMV calculado (se existir)
  cmv.custo_total as cmv_total,
  cmv.margem_bruta,
  cmv.margem_percentual,
  
  -- Flags de consistência
  CASE WHEN mti.produto_id IS NULL THEN true ELSE false END as sem_produto_vinculado,
  CASE WHEN p.custo_medio IS NULL OR p.custo_medio = 0 THEN true ELSE false END as sem_custo,
  CASE WHEN mt.categoria_id IS NULL THEN true ELSE false END as sem_categoria,
  mt.status != 'conciliado' as nao_conciliado,
  COALESCE(mt.custo_ads, 0) > 0 as teve_ads

FROM marketplace_transactions mt
LEFT JOIN marketplace_transaction_items mti ON mti.transaction_id = mt.id
LEFT JOIN produtos p ON p.id = mti.produto_id
LEFT JOIN cmv_registros cmv ON cmv.referencia_id = mt.id AND cmv.produto_id = mti.produto_id
WHERE mt.tipo_lancamento = 'credito' 
  AND mt.tipo_transacao IN ('venda', 'repasse', 'liberacao')
ORDER BY mt.data_transacao DESC;