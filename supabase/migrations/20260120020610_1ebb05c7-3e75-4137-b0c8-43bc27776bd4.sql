
-- =============================================================================
-- Tabela: marketplace_financial_events
-- Armazena eventos financeiros granulares de marketplace (comissão, tarifa, frete, ads, etc.)
-- Cada evento tem um event_id único por empresa+canal para idempotência
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.marketplace_financial_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  canal TEXT NOT NULL DEFAULT 'Mercado Livre',
  conta_nome TEXT,
  -- Identificador único do evento (da API ou gerado)
  event_id TEXT NOT NULL,
  -- Referência ao pedido (pode ser null para eventos gerais como anúncios)
  pedido_id TEXT,
  -- Tipo de evento financeiro
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN (
    'comissao',           -- CV - Comissão de venda do marketplace
    'tarifa_fixa',        -- Taxa fixa por venda
    'tarifa_financeira',  -- Tarifa de parcelamento/financiamento
    'frete_vendedor',     -- CXE - Custo de envio pago pelo vendedor
    'frete_comprador',    -- Frete pago pelo comprador (receita)
    'ads',                -- Custo de anúncios/publicidade
    'estorno',            -- Estornos e devoluções
    'cancelamento',       -- Taxas de cancelamento
    'ajuste',             -- Ajustes manuais
    'outros'              -- Outros tipos não categorizados
  )),
  -- Data do evento
  data_evento TIMESTAMPTZ NOT NULL,
  -- Valor (positivo = receita, negativo = custo)
  valor NUMERIC NOT NULL DEFAULT 0,
  -- Descrição adicional
  descricao TEXT,
  -- Origem do dado
  origem TEXT NOT NULL DEFAULT 'api',
  -- Metadados extras (JSON)
  metadados JSONB,
  -- Timestamps
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint de unicidade para UPSERT idempotente
  CONSTRAINT uq_mkt_fin_event UNIQUE (empresa_id, canal, event_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_empresa_pedido 
  ON public.marketplace_financial_events(empresa_id, pedido_id);

CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_data 
  ON public.marketplace_financial_events(empresa_id, data_evento);

CREATE INDEX IF NOT EXISTS idx_mkt_fin_events_tipo 
  ON public.marketplace_financial_events(empresa_id, tipo_evento);

-- Trigger para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_mkt_fin_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_fin_events_updated_at ON public.marketplace_financial_events;
CREATE TRIGGER trg_mkt_fin_events_updated_at
  BEFORE UPDATE ON public.marketplace_financial_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mkt_fin_events_updated_at();

-- RLS
ALTER TABLE public.marketplace_financial_events ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ver eventos das empresas que têm acesso
CREATE POLICY "Eventos visíveis por empresa"
  ON public.marketplace_financial_events
  FOR SELECT
  USING (
    empresa_id IN (
      SELECT ue.empresa_id 
      FROM public.user_empresas ue 
      WHERE ue.user_id = auth.uid()
    )
  );

-- Policy: usuários podem inserir/atualizar eventos das empresas que têm acesso
CREATE POLICY "Eventos editáveis por empresa"
  ON public.marketplace_financial_events
  FOR ALL
  USING (
    empresa_id IN (
      SELECT ue.empresa_id 
      FROM public.user_empresas ue 
      WHERE ue.user_id = auth.uid()
    )
  );
