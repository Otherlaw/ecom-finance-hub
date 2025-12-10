-- Tabela para cadastro de bens patrimoniais (investimentos, imobilizado, intangível)
CREATE TABLE public.patrimonio_bens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('investimento', 'imobilizado', 'intangivel')),
  grupo_balanco TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_aquisicao DATE NOT NULL,
  valor_aquisicao NUMERIC(14,2) NOT NULL,
  vida_util_meses INTEGER,
  valor_residual NUMERIC(14,2),
  depreciacao_acumulada NUMERIC(14,2) DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patrimonio_bens_empresa ON public.patrimonio_bens(empresa_id);
CREATE INDEX idx_patrimonio_bens_tipo ON public.patrimonio_bens(tipo);

ALTER TABLE public.patrimonio_bens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own patrimonio_bens"
ON public.patrimonio_bens FOR SELECT
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own patrimonio_bens"
ON public.patrimonio_bens FOR INSERT
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own patrimonio_bens"
ON public.patrimonio_bens FOR UPDATE
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own patrimonio_bens"
ON public.patrimonio_bens FOR DELETE
USING (user_has_empresa_access(empresa_id));

-- Trigger para atualizar timestamp
CREATE TRIGGER update_patrimonio_bens_updated_at
BEFORE UPDATE ON public.patrimonio_bens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para movimentos de Patrimônio Líquido (capital social, reservas, lucros acumulados)
CREATE TABLE public.patrimonio_pl_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'saldo_inicial',
    'aporte_socio',
    'retirada_socio',
    'ajuste_pl',
    'reserva_lucros',
    'distribuicao_lucros',
    'lucro_prejuizo_periodo'
  )),
  grupo_pl TEXT NOT NULL CHECK (grupo_pl IN (
    'capital_social',
    'reservas',
    'lucros_acumulados'
  )),
  descricao TEXT,
  valor NUMERIC(14,2) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patrimonio_pl_empresa_data ON public.patrimonio_pl_movimentos(empresa_id, data_referencia);
CREATE INDEX idx_patrimonio_pl_grupo ON public.patrimonio_pl_movimentos(grupo_pl);

ALTER TABLE public.patrimonio_pl_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own patrimonio_pl_movimentos"
ON public.patrimonio_pl_movimentos FOR SELECT
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own patrimonio_pl_movimentos"
ON public.patrimonio_pl_movimentos FOR INSERT
WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own patrimonio_pl_movimentos"
ON public.patrimonio_pl_movimentos FOR UPDATE
USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own patrimonio_pl_movimentos"
ON public.patrimonio_pl_movimentos FOR DELETE
USING (user_has_empresa_access(empresa_id));

-- Trigger para atualizar timestamp
CREATE TRIGGER update_patrimonio_pl_updated_at
BEFORE UPDATE ON public.patrimonio_pl_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();