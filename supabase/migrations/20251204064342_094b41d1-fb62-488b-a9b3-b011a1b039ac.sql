-- ===========================================
-- MOTOR DE CUSTOS V1 - TABELA DE PRODUTOS
-- ===========================================

-- Criar tabela de produtos com campos para custo médio contínuo
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  
  -- Identificação
  codigo_interno TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  subcategoria TEXT,
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  ncm TEXT,
  
  -- Fiscal
  cfop_venda TEXT,
  cfop_compra TEXT,
  situacao_tributaria TEXT,
  
  -- Fornecedor
  fornecedor_principal_id UUID,
  fornecedor_principal_nome TEXT,
  
  -- Preços
  preco_venda_sugerido NUMERIC DEFAULT 0,
  
  -- ========================================
  -- MOTOR DE CUSTOS V1 - Campos de custo médio
  -- ========================================
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  custo_medio_atual NUMERIC NOT NULL DEFAULT 0,
  ultima_atualizacao_custo TIMESTAMPTZ,
  
  -- Mapeamentos de canais (JSON array)
  canais JSONB DEFAULT '[]'::jsonb,
  
  -- Status e controle
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT produtos_codigo_unico UNIQUE (empresa_id, codigo_interno)
);

-- Índices para performance
CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX idx_produtos_codigo ON public.produtos(codigo_interno);
CREATE INDEX idx_produtos_status ON public.produtos(status);
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria);
CREATE INDEX idx_produtos_ncm ON public.produtos(ncm);

-- Enable RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Allow public insert produtos" ON public.produtos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update produtos" ON public.produtos FOR UPDATE USING (true);
CREATE POLICY "Allow public delete produtos" ON public.produtos FOR DELETE USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- MOTOR DE CUSTOS V1 - REGISTROS DE CMV
-- ===========================================

-- Tabela para registrar cada baixa de estoque/CMV por venda
CREATE TABLE public.cmv_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  
  -- Referência à transação de origem
  origem TEXT NOT NULL CHECK (origem IN ('marketplace', 'manual', 'ajuste', 'devolucao')),
  referencia_id UUID, -- ID da transação de marketplace, ajuste manual, etc.
  
  -- Data da operação
  data DATE NOT NULL,
  
  -- Dados da operação
  quantidade NUMERIC NOT NULL,
  custo_unitario_momento NUMERIC NOT NULL, -- Custo médio no momento da venda
  custo_total NUMERIC NOT NULL, -- quantidade * custo_unitario_momento
  
  -- Preço de venda (para cálculo de margem)
  preco_venda_unitario NUMERIC,
  receita_total NUMERIC,
  margem_bruta NUMERIC, -- receita_total - custo_total
  margem_percentual NUMERIC, -- (margem_bruta / receita_total) * 100
  
  -- Canal de venda
  canal TEXT,
  
  -- Observações
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_cmv_empresa ON public.cmv_registros(empresa_id);
CREATE INDEX idx_cmv_produto ON public.cmv_registros(produto_id);
CREATE INDEX idx_cmv_data ON public.cmv_registros(data);
CREATE INDEX idx_cmv_origem ON public.cmv_registros(origem);
CREATE INDEX idx_cmv_canal ON public.cmv_registros(canal);
CREATE INDEX idx_cmv_referencia ON public.cmv_registros(referencia_id);

-- Enable RLS
ALTER TABLE public.cmv_registros ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read cmv" ON public.cmv_registros FOR SELECT USING (true);
CREATE POLICY "Allow public insert cmv" ON public.cmv_registros FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update cmv" ON public.cmv_registros FOR UPDATE USING (true);
CREATE POLICY "Allow public delete cmv" ON public.cmv_registros FOR DELETE USING (true);

-- ===========================================
-- MOTOR DE CUSTOS V1 - MOVIMENTAÇÕES DE ESTOQUE
-- ===========================================

-- Tabela para registrar todas as movimentações de estoque (entradas e saídas)
CREATE TABLE public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  
  -- Tipo de movimentação
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  motivo TEXT NOT NULL CHECK (motivo IN ('compra', 'venda', 'ajuste_positivo', 'ajuste_negativo', 'devolucao_compra', 'devolucao_venda', 'transferencia')),
  
  -- Referência à origem
  origem TEXT NOT NULL, -- 'compra', 'marketplace', 'manual', etc.
  referencia_id UUID, -- ID do documento de origem
  documento TEXT, -- Número NF, pedido, etc.
  
  -- Data da operação
  data DATE NOT NULL,
  
  -- Dados da movimentação
  quantidade NUMERIC NOT NULL,
  custo_unitario NUMERIC NOT NULL,
  custo_total NUMERIC NOT NULL,
  
  -- Snapshot do estoque após a operação
  estoque_anterior NUMERIC NOT NULL,
  estoque_posterior NUMERIC NOT NULL,
  custo_medio_anterior NUMERIC NOT NULL,
  custo_medio_posterior NUMERIC NOT NULL,
  
  -- Observações
  observacoes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_mov_estoque_empresa ON public.movimentacoes_estoque(empresa_id);
CREATE INDEX idx_mov_estoque_produto ON public.movimentacoes_estoque(produto_id);
CREATE INDEX idx_mov_estoque_data ON public.movimentacoes_estoque(data);
CREATE INDEX idx_mov_estoque_tipo ON public.movimentacoes_estoque(tipo);
CREATE INDEX idx_mov_estoque_motivo ON public.movimentacoes_estoque(motivo);
CREATE INDEX idx_mov_estoque_referencia ON public.movimentacoes_estoque(referencia_id);

-- Enable RLS
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read mov_estoque" ON public.movimentacoes_estoque FOR SELECT USING (true);
CREATE POLICY "Allow public insert mov_estoque" ON public.movimentacoes_estoque FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update mov_estoque" ON public.movimentacoes_estoque FOR UPDATE USING (true);
CREATE POLICY "Allow public delete mov_estoque" ON public.movimentacoes_estoque FOR DELETE USING (true);