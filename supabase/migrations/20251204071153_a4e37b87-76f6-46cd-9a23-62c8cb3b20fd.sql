-- ============= MOTOR DE ESTOQUE V1 - CONTROLE POR SKU =============

-- 1. Criar tabela de SKUs do produto
CREATE TABLE IF NOT EXISTS produto_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_sku text NOT NULL,
  variacao jsonb DEFAULT '{}', -- exemplo: {"cor": "Preto", "voltagem": "110V"}
  estoque_atual numeric NOT NULL DEFAULT 0,
  custo_medio_atual numeric NOT NULL DEFAULT 0,
  ultima_atualizacao_custo timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único para garantir SKU único por produto
CREATE UNIQUE INDEX IF NOT EXISTS produto_skus_produto_codigo_idx
  ON produto_skus (produto_id, codigo_sku);

-- Índice para busca por empresa
CREATE INDEX IF NOT EXISTS produto_skus_empresa_idx ON produto_skus (empresa_id);

-- Índice para busca por código SKU
CREATE INDEX IF NOT EXISTS produto_skus_codigo_idx ON produto_skus (codigo_sku);

-- 2. Adicionar coluna sku_id nas tabelas de movimentação (nullable para retrocompatibilidade)
ALTER TABLE movimentacoes_estoque 
ADD COLUMN IF NOT EXISTS sku_id uuid REFERENCES produto_skus(id) ON DELETE SET NULL;

ALTER TABLE cmv_registros 
ADD COLUMN IF NOT EXISTS sku_id uuid REFERENCES produto_skus(id) ON DELETE SET NULL;

-- Índices para as novas colunas
CREATE INDEX IF NOT EXISTS movimentacoes_estoque_sku_idx ON movimentacoes_estoque (sku_id);
CREATE INDEX IF NOT EXISTS cmv_registros_sku_idx ON cmv_registros (sku_id);

-- 3. Enable RLS
ALTER TABLE produto_skus ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies para produto_skus
CREATE POLICY "Allow public read produto_skus" 
ON produto_skus FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert produto_skus" 
ON produto_skus FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update produto_skus" 
ON produto_skus FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete produto_skus" 
ON produto_skus FOR DELETE 
USING (true);

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_produto_skus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_produto_skus_updated_at
  BEFORE UPDATE ON produto_skus
  FOR EACH ROW
  EXECUTE FUNCTION update_produto_skus_updated_at();