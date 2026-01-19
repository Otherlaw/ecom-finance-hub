-- CORREÇÃO 1: Remover trigger incorreto que referencia coluna inexistente (updated_at)
DROP TRIGGER IF EXISTS update_movimentos_updated_at ON public.movimentos_financeiros;

-- CORREÇÃO 2: Criar função de trigger correta para a coluna atualizado_em
CREATE OR REPLACE FUNCTION public.update_movimentos_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- CORREÇÃO 3: Aplicar o trigger correto
CREATE TRIGGER update_movimentos_atualizado_em
BEFORE UPDATE ON public.movimentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.update_movimentos_atualizado_em();

-- CORREÇÃO 4: Remover versão antiga da RPC get_dashboard_metrics (que usa DATE)
-- Isso garante que apenas a versão correta (TIMESTAMPTZ) seja usada
DROP FUNCTION IF EXISTS public.get_dashboard_metrics(uuid, date, date);