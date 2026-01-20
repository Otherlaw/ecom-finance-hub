-- =============================================================================
-- SEPARAÇÃO: Adicionar coluna 'regime' para distinguir caixa de competência
-- regime = 'caixa'       → movimentos de banco, repasses (aparecem no Fluxo de Caixa)
-- regime = 'competencia' → vendas, eventos financeiros (aparecem em Vendas/DRE)
-- =============================================================================

-- 1. Adicionar coluna regime
ALTER TABLE public.movimentos_financeiros 
ADD COLUMN IF NOT EXISTS regime TEXT NOT NULL DEFAULT 'caixa' 
CHECK (regime IN ('caixa', 'competencia'));

-- 2. Criar índice para filtros por regime
CREATE INDEX IF NOT EXISTS idx_movimentos_regime 
ON public.movimentos_financeiros(regime, data);

-- 3. Atualizar registros existentes:
-- - Marketplace individual = competencia (são vendas, não entradas de caixa)
-- - Banco, manual, contas_pagar, contas_receber = caixa (são movimentos reais de caixa)
UPDATE public.movimentos_financeiros
SET regime = 'competencia'
WHERE origem = 'marketplace';

-- Garantir que os demais são caixa (já é o default, mas para clareza)
UPDATE public.movimentos_financeiros
SET regime = 'caixa'
WHERE origem IN ('banco', 'manual', 'contas_pagar', 'contas_receber', 'cartao');

-- 4. Adicionar comentário explicativo
COMMENT ON COLUMN public.movimentos_financeiros.regime IS 
'Regime contábil do movimento:
- caixa: movimentos reais de banco/caixa (aparecem no Fluxo de Caixa)
- competencia: vendas e eventos (aparecem em Vendas/DRE, não no caixa)';