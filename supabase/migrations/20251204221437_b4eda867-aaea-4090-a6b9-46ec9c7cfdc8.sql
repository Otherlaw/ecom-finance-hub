-- Criar tabela de itens de transações de marketplace
-- Vincula vendas de marketplace a produtos/SKUs para controle de estoque e CMV

CREATE TABLE public.marketplace_transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES marketplace_transactions(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  sku_id UUID REFERENCES produto_skus(id) ON DELETE SET NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC,
  preco_total NUMERIC,
  sku_marketplace VARCHAR(100),
  descricao_item TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para garantir pelo menos produto ou SKU vinculado quando há
  CONSTRAINT chk_produto_ou_sku CHECK (produto_id IS NOT NULL OR sku_id IS NOT NULL OR sku_marketplace IS NOT NULL)
);

-- Índices para performance
CREATE INDEX idx_mkt_items_transaction ON marketplace_transaction_items(transaction_id);
CREATE INDEX idx_mkt_items_produto ON marketplace_transaction_items(produto_id);
CREATE INDEX idx_mkt_items_sku ON marketplace_transaction_items(sku_id);

-- Enable RLS
ALTER TABLE marketplace_transaction_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (ambiente de desenvolvimento)
CREATE POLICY "Allow public read marketplace_transaction_items" 
ON marketplace_transaction_items FOR SELECT USING (true);

CREATE POLICY "Allow public insert marketplace_transaction_items" 
ON marketplace_transaction_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update marketplace_transaction_items" 
ON marketplace_transaction_items FOR UPDATE USING (true);

CREATE POLICY "Allow public delete marketplace_transaction_items" 
ON marketplace_transaction_items FOR DELETE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_mkt_items_updated_at
  BEFORE UPDATE ON marketplace_transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE marketplace_transaction_items IS 'Itens/produtos vendidos em transações de marketplace para controle de estoque e CMV';
COMMENT ON COLUMN marketplace_transaction_items.sku_marketplace IS 'SKU original do marketplace (para matching posterior)';