-- =============================================================================
-- SISTEMA DE DEDUPLICAÇÃO E RASTREABILIDADE DE IMPORTAÇÕES
-- =============================================================================

-- 1. TABELA: import_batches - Rastreia cada importação/sincronização
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  canal TEXT NOT NULL,
  tipo_importacao TEXT NOT NULL, -- 'sync_api', 'upload_csv', 'upload_ofx', etc.
  periodo_inicio DATE,
  periodo_fim DATE,
  file_hash TEXT, -- Hash do arquivo para detectar reimportações
  file_name TEXT,
  total_registros INT NOT NULL DEFAULT 0,
  registros_criados INT NOT NULL DEFAULT 0,
  registros_atualizados INT NOT NULL DEFAULT 0,
  registros_ignorados INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro', 'parcial')),
  mensagem_erro TEXT,
  metadados JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em TIMESTAMPTZ
);

-- Índices para import_batches
CREATE INDEX idx_import_batches_empresa ON public.import_batches(empresa_id, criado_em DESC);
CREATE INDEX idx_import_batches_hash ON public.import_batches(empresa_id, canal, file_hash) WHERE file_hash IS NOT NULL;

-- RLS para import_batches
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own import_batches"
ON public.import_batches FOR SELECT
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own import_batches"
ON public.import_batches FOR INSERT
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own import_batches"
ON public.import_batches FOR UPDATE
USING (public.user_has_empresa_access(empresa_id));

-- =============================================================================
-- 2. ADICIONAR batch_id às tabelas de transação
-- =============================================================================
ALTER TABLE public.marketplace_transactions 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id);

ALTER TABLE public.marketplace_transaction_items 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id);

ALTER TABLE public.marketplace_financial_events 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id);

ALTER TABLE public.bank_transactions 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.import_batches(id);

-- Índices para batch_id
CREATE INDEX IF NOT EXISTS idx_mkt_tx_batch ON public.marketplace_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_mkt_items_batch ON public.marketplace_transaction_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_mkt_events_batch ON public.marketplace_financial_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_batch ON public.bank_transactions(batch_id);

-- =============================================================================
-- 3. ÍNDICES ÚNICOS PARA DEDUPLICAÇÃO
-- =============================================================================

-- 3.1 marketplace_transactions: já tem uq_mkt_tx_key, mas vamos garantir
-- Nota: A constraint atual é (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento)
-- Isso permite múltiplas linhas por pedido (venda, repasse, estorno), que é correto

-- 3.2 marketplace_transaction_items: (transaction_id, sku_marketplace)
-- Primeiro limpar duplicatas se existirem
DELETE FROM public.marketplace_transaction_items a
USING public.marketplace_transaction_items b
WHERE a.id > b.id
  AND a.transaction_id = b.transaction_id
  AND a.sku_marketplace = b.sku_marketplace
  AND a.sku_marketplace IS NOT NULL;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_item_tx_sku 
ON public.marketplace_transaction_items(transaction_id, sku_marketplace)
WHERE sku_marketplace IS NOT NULL;

-- 3.3 marketplace_financial_events: já tem uq_mkt_fin_event (empresa_id, canal, event_id) ✓

-- 3.4 bank_transactions: (empresa_id, origem_extrato, referencia_externa)
-- Primeiro limpar duplicatas se existirem
DELETE FROM public.bank_transactions a
USING public.bank_transactions b
WHERE a.id > b.id
  AND a.empresa_id = b.empresa_id
  AND a.origem_extrato = b.origem_extrato
  AND a.referencia_externa = b.referencia_externa
  AND a.referencia_externa IS NOT NULL;

-- Criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_tx_ref 
ON public.bank_transactions(empresa_id, origem_extrato, referencia_externa)
WHERE referencia_externa IS NOT NULL;

-- =============================================================================
-- 4. COMENTÁRIOS EXPLICATIVOS
-- =============================================================================
COMMENT ON TABLE public.import_batches IS 
'Rastreia cada importação/sincronização para auditoria e deduplicação. 
Cada batch agrupa registros importados juntos.';

COMMENT ON COLUMN public.import_batches.file_hash IS 
'Hash SHA256 do arquivo para detectar reimportação do mesmo arquivo.';

COMMENT ON COLUMN public.marketplace_transactions.batch_id IS 
'Referência ao batch de importação que criou/atualizou este registro.';

COMMENT ON INDEX uq_mkt_item_tx_sku IS 
'Previne duplicação de itens com mesmo SKU na mesma transação.';

COMMENT ON INDEX uq_bank_tx_ref IS 
'Previne duplicação de transações bancárias com mesma referência externa.';