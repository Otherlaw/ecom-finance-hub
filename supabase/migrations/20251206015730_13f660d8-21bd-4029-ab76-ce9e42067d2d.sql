-- ===========================================================
-- MÓDULO COMPLETO DE PRODUTOS: ÚNICO, VARIAÇÕES E KITS
-- ===========================================================

-- 1. DROP DAS TABELAS ANTIGAS (cascata)
DROP TABLE IF EXISTS public.cmv_registros CASCADE;
DROP TABLE IF EXISTS public.movimentacoes_estoque CASCADE;
DROP TABLE IF EXISTS public.recebimentos_itens CASCADE;
DROP TABLE IF EXISTS public.recebimentos_compra CASCADE;
DROP TABLE IF EXISTS public.compras_itens CASCADE;
DROP TABLE IF EXISTS public.compras CASCADE;
DROP TABLE IF EXISTS public.marketplace_transaction_items CASCADE;
DROP TABLE IF EXISTS public.marketplace_sku_mappings CASCADE;
DROP TABLE IF EXISTS public.produto_sku_map CASCADE;
DROP TABLE IF EXISTS public.produto_skus CASCADE;
DROP TABLE IF EXISTS public.produtos CASCADE;

-- 2. TABELA DE ARMAZÉNS
CREATE TABLE public.armazens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  tipo TEXT NOT NULL DEFAULT 'proprio' CHECK (tipo IN ('proprio', 'terceiro', 'fulfillment', 'dropship')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, codigo)
);

-- 3. NOVA TABELA DE PRODUTOS (suporta único, variation_parent e kit)
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  
  -- Identificação
  sku TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  
  -- Tipo do produto: 'unico', 'variation_parent', 'variation_child', 'kit'
  tipo TEXT NOT NULL DEFAULT 'unico' CHECK (tipo IN ('unico', 'variation_parent', 'variation_child', 'kit')),
  
  -- Para variation_child: referência ao pai
  parent_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  
  -- Atributos de variação (JSON: {"cor": "Azul", "tamanho": "M"})
  atributos_variacao JSONB DEFAULT '{}',
  
  -- Para kits: componentes (JSON array: [{"sku": "SKU-001", "quantidade": 2}, ...])
  kit_componentes JSONB DEFAULT '[]',
  
  -- Dados fiscais
  ncm TEXT,
  cfop_venda TEXT,
  cfop_compra TEXT,
  situacao_tributaria TEXT,
  
  -- Valores
  custo_medio NUMERIC NOT NULL DEFAULT 0,
  preco_venda NUMERIC NOT NULL DEFAULT 0,
  
  -- Físico
  peso_kg NUMERIC DEFAULT 0,
  altura_cm NUMERIC DEFAULT 0,
  largura_cm NUMERIC DEFAULT 0,
  profundidade_cm NUMERIC DEFAULT 0,
  
  -- Categorização
  categoria TEXT,
  subcategoria TEXT,
  marca TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  
  -- Fornecedor padrão
  fornecedor_id UUID,
  fornecedor_nome TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'rascunho')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(empresa_id, sku)
);

-- 4. TABELA DE ESTOQUE (por produto + armazém)
CREATE TABLE public.estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  armazem_id UUID NOT NULL REFERENCES public.armazens(id) ON DELETE CASCADE,
  
  quantidade NUMERIC NOT NULL DEFAULT 0,
  quantidade_reservada NUMERIC NOT NULL DEFAULT 0,
  quantidade_disponivel NUMERIC GENERATED ALWAYS AS (quantidade - quantidade_reservada) STORED,
  
  custo_medio NUMERIC NOT NULL DEFAULT 0,
  
  estoque_minimo NUMERIC DEFAULT 0,
  estoque_maximo NUMERIC DEFAULT 0,
  ponto_reposicao NUMERIC DEFAULT 0,
  
  localizacao TEXT,
  lote TEXT,
  validade DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(produto_id, armazem_id)
);

-- 5. MOVIMENTAÇÕES DE ESTOQUE
CREATE TABLE public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  armazem_id UUID NOT NULL REFERENCES public.armazens(id) ON DELETE CASCADE,
  
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia', 'ajuste')),
  motivo TEXT NOT NULL,
  origem TEXT NOT NULL,
  
  quantidade NUMERIC NOT NULL,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC NOT NULL DEFAULT 0,
  
  estoque_anterior NUMERIC NOT NULL DEFAULT 0,
  estoque_posterior NUMERIC NOT NULL DEFAULT 0,
  custo_medio_anterior NUMERIC NOT NULL DEFAULT 0,
  custo_medio_posterior NUMERIC NOT NULL DEFAULT 0,
  
  -- Para transferências
  armazem_destino_id UUID REFERENCES public.armazens(id),
  
  documento TEXT,
  referencia_id UUID,
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. MAPEAMENTOS SKU MARKETPLACE
CREATE TABLE public.produto_marketplace_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  
  canal TEXT NOT NULL,
  sku_marketplace TEXT NOT NULL,
  anuncio_id TEXT,
  variante_id TEXT,
  nome_loja TEXT,
  nome_anuncio TEXT,
  
  ativo BOOLEAN NOT NULL DEFAULT true,
  mapeado_automaticamente BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(empresa_id, canal, sku_marketplace)
);

-- 7. COMPRAS (pedidos de compra)
CREATE TABLE public.compras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  
  numero TEXT,
  fornecedor_nome TEXT NOT NULL,
  fornecedor_cnpj TEXT,
  
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao DATE,
  
  valor_produtos NUMERIC NOT NULL DEFAULT 0,
  valor_frete NUMERIC NOT NULL DEFAULT 0,
  valor_desconto NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- NF-e
  numero_nf TEXT,
  chave_acesso TEXT,
  data_nf DATE,
  
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'confirmado', 'parcial', 'concluido', 'cancelado')),
  
  armazem_destino_id UUID REFERENCES public.armazens(id),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ITENS DA COMPRA
CREATE TABLE public.compras_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  
  -- Dados da NF (podem não estar mapeados)
  codigo_nf TEXT,
  descricao_nf TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  
  quantidade NUMERIC NOT NULL DEFAULT 0,
  quantidade_recebida NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- ICMS
  aliquota_icms NUMERIC,
  valor_icms NUMERIC,
  
  -- IPI
  aliquota_ipi NUMERIC,
  valor_ipi NUMERIC,
  
  mapeado BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. RECEBIMENTOS
CREATE TABLE public.recebimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compra_id UUID NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  armazem_id UUID NOT NULL REFERENCES public.armazens(id),
  
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ITENS DO RECEBIMENTO
CREATE TABLE public.recebimentos_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id UUID NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  compra_item_id UUID NOT NULL REFERENCES public.compras_itens(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  
  quantidade_recebida NUMERIC NOT NULL DEFAULT 0,
  quantidade_devolvida NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  
  lote TEXT,
  validade DATE,
  localizacao TEXT,
  observacao TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. CMV (Custo da Mercadoria Vendida)
CREATE TABLE public.cmv_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  armazem_id UUID REFERENCES public.armazens(id),
  
  data DATE NOT NULL,
  origem TEXT NOT NULL,
  canal TEXT,
  
  quantidade NUMERIC NOT NULL,
  custo_unitario NUMERIC NOT NULL,
  custo_total NUMERIC NOT NULL,
  
  preco_venda_unitario NUMERIC,
  receita_total NUMERIC,
  margem_bruta NUMERIC,
  margem_percentual NUMERIC,
  
  referencia_id UUID,
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. ITENS DE TRANSAÇÃO MARKETPLACE (recriar)
CREATE TABLE public.marketplace_transaction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.marketplace_transactions(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  
  sku_marketplace TEXT,
  anuncio_id TEXT,
  variante_id TEXT,
  descricao_item TEXT,
  
  quantidade NUMERIC NOT NULL DEFAULT 1,
  preco_unitario NUMERIC,
  preco_total NUMERIC,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ÍNDICES
CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX idx_produtos_tipo ON public.produtos(tipo);
CREATE INDEX idx_produtos_parent ON public.produtos(parent_id);
CREATE INDEX idx_produtos_status ON public.produtos(status);
CREATE INDEX idx_produtos_sku ON public.produtos(sku);

CREATE INDEX idx_estoque_empresa ON public.estoque(empresa_id);
CREATE INDEX idx_estoque_produto ON public.estoque(produto_id);
CREATE INDEX idx_estoque_armazem ON public.estoque(armazem_id);

CREATE INDEX idx_mov_estoque_empresa ON public.movimentacoes_estoque(empresa_id);
CREATE INDEX idx_mov_estoque_produto ON public.movimentacoes_estoque(produto_id);
CREATE INDEX idx_mov_estoque_data ON public.movimentacoes_estoque(created_at DESC);

CREATE INDEX idx_mkt_map_empresa ON public.produto_marketplace_map(empresa_id);
CREATE INDEX idx_mkt_map_produto ON public.produto_marketplace_map(produto_id);
CREATE INDEX idx_mkt_map_sku ON public.produto_marketplace_map(sku_marketplace);

CREATE INDEX idx_compras_empresa ON public.compras(empresa_id);
CREATE INDEX idx_compras_status ON public.compras(status);

-- TRIGGERS PARA updated_at
CREATE TRIGGER update_armazens_updated_at BEFORE UPDATE ON public.armazens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estoque_updated_at BEFORE UPDATE ON public.estoque FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mkt_map_updated_at BEFORE UPDATE ON public.produto_marketplace_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compras_updated_at BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compras_itens_updated_at BEFORE UPDATE ON public.compras_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_mkt_items_updated_at BEFORE UPDATE ON public.marketplace_transaction_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS POLICIES (acesso público para desenvolvimento)
ALTER TABLE public.armazens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_marketplace_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmv_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all armazens" ON public.armazens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all estoque" ON public.estoque FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all mov_estoque" ON public.movimentacoes_estoque FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all mkt_map" ON public.produto_marketplace_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all compras" ON public.compras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all compras_itens" ON public.compras_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all recebimentos" ON public.recebimentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all recebimentos_itens" ON public.recebimentos_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all cmv" ON public.cmv_registros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all mkt_items" ON public.marketplace_transaction_items FOR ALL USING (true) WITH CHECK (true);