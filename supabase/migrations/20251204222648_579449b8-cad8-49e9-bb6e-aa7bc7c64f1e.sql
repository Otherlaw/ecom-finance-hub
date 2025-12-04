-- Tabela de mapeamento SKU Marketplace → SKU/Produto interno
CREATE TABLE marketplace_sku_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  canal text NOT NULL,
  sku_marketplace text NOT NULL,
  sku_id uuid REFERENCES produto_skus(id),
  produto_id uuid REFERENCES produtos(id),
  nome_produto_marketplace text,
  mapeado_automaticamente boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_sku_mapping UNIQUE (empresa_id, canal, sku_marketplace),
  CONSTRAINT check_has_product CHECK (sku_id IS NOT NULL OR produto_id IS NOT NULL OR (sku_id IS NULL AND produto_id IS NULL))
);

-- Index para busca rápida
CREATE INDEX idx_sku_mappings_lookup ON marketplace_sku_mappings(empresa_id, canal, sku_marketplace);
CREATE INDEX idx_sku_mappings_produto ON marketplace_sku_mappings(produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX idx_sku_mappings_sku ON marketplace_sku_mappings(sku_id) WHERE sku_id IS NOT NULL;

-- Trigger para updated_at
CREATE TRIGGER update_marketplace_sku_mappings_updated_at
  BEFORE UPDATE ON marketplace_sku_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE marketplace_sku_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read marketplace_sku_mappings" 
  ON marketplace_sku_mappings FOR SELECT USING (true);

CREATE POLICY "Allow public insert marketplace_sku_mappings" 
  ON marketplace_sku_mappings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update marketplace_sku_mappings" 
  ON marketplace_sku_mappings FOR UPDATE USING (true);

CREATE POLICY "Allow public delete marketplace_sku_mappings" 
  ON marketplace_sku_mappings FOR DELETE USING (true);