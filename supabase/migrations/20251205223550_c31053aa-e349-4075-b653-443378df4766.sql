-- ============================================================
-- MIGRAÇÃO: Módulo de Compras - Status e Recebimentos
-- ============================================================

-- Alterar tabela compras para usar novos status
-- Status: em_compra, em_transito, parcial, concluido, cancelado
ALTER TABLE public.compras
DROP CONSTRAINT IF EXISTS compras_status_check;

ALTER TABLE public.compras
ADD CONSTRAINT compras_status_check 
CHECK (status IN ('em_compra', 'em_transito', 'parcial', 'concluido', 'cancelado'));

-- Atualizar valores antigos para novos (se existirem)
UPDATE public.compras 
SET status = CASE 
  WHEN status = 'em_aberto' THEN 'em_compra'
  WHEN status = 'confirmada' THEN 'concluido'
  WHEN status = 'cancelada' THEN 'cancelado'
  ELSE status
END
WHERE status IN ('em_aberto', 'confirmada', 'cancelada');

-- ============================================================
-- Tabela: recebimentos_compra (já existe, verificar estrutura)
-- ============================================================
-- A tabela recebimentos_compra já existe, vamos verificar e adicionar campos se necessário

-- Adicionar campo usuario_id se não existir (nullable para compatibilidade)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'recebimentos_compra' AND column_name = 'usuario_id') THEN
    ALTER TABLE public.recebimentos_compra ADD COLUMN usuario_id uuid;
  END IF;
END $$;

-- ============================================================
-- Tabela: recebimentos_itens (já existe, verificar/adicionar campos)
-- ============================================================
-- Adicionar campos faltantes à tabela existente

-- Verificar e adicionar quantidade_pedida
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'recebimentos_itens' AND column_name = 'quantidade_pedida') THEN
    ALTER TABLE public.recebimentos_itens ADD COLUMN quantidade_pedida numeric DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- Trigger para atualizar status da compra após recebimento
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_status_compra_apos_recebimento()
RETURNS TRIGGER AS $$
DECLARE
  v_compra_id uuid;
  v_total_pedido numeric;
  v_total_recebido numeric;
BEGIN
  -- Buscar compra_id a partir do recebimento
  SELECT compra_id INTO v_compra_id 
  FROM public.recebimentos_compra 
  WHERE id = NEW.recebimento_id;
  
  IF v_compra_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calcular totais
  SELECT 
    COALESCE(SUM(ci.quantidade), 0),
    COALESCE(SUM(ri.quantidade_recebida), 0)
  INTO v_total_pedido, v_total_recebido
  FROM public.compras_itens ci
  LEFT JOIN public.recebimentos_itens ri ON ri.compra_item_id = ci.id
  WHERE ci.compra_id = v_compra_id;
  
  -- Atualizar status baseado nos totais
  IF v_total_recebido >= v_total_pedido THEN
    UPDATE public.compras SET status = 'concluido', updated_at = now() WHERE id = v_compra_id;
  ELSIF v_total_recebido > 0 THEN
    UPDATE public.compras SET status = 'parcial', updated_at = now() WHERE id = v_compra_id;
  END IF;
  
  -- Atualizar quantidade_recebida no item da compra
  UPDATE public.compras_itens 
  SET quantidade_recebida = (
    SELECT COALESCE(SUM(quantidade_recebida), 0) 
    FROM public.recebimentos_itens 
    WHERE compra_item_id = NEW.compra_item_id
  ),
  updated_at = now()
  WHERE id = NEW.compra_item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_atualizar_status_compra ON public.recebimentos_itens;
CREATE TRIGGER trigger_atualizar_status_compra
AFTER INSERT OR UPDATE ON public.recebimentos_itens
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_status_compra_apos_recebimento();