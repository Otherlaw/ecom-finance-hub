-- ================================================
-- MIGRAÇÃO: Identificar e prevenir duplicatas entre empresas
-- ================================================

-- 1. Criar tabela para rastrear pedidos duplicados entre empresas
CREATE TABLE IF NOT EXISTS public.pedidos_duplicados_entre_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id TEXT NOT NULL,
  canal TEXT NOT NULL,
  empresas_afetadas TEXT[] NOT NULL,
  total_duplicatas INT NOT NULL,
  valor_duplicado NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, resolvido, ignorado
  resolucao TEXT, -- empresa_correta, deletado, etc
  empresa_correta_id UUID,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT uq_pedido_duplicado UNIQUE (pedido_id, canal)
);

-- 2. Criar índice para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_pedidos_dup_status ON public.pedidos_duplicados_entre_empresas(status);

-- 3. Identificar e registrar todos os pedidos duplicados atuais
INSERT INTO public.pedidos_duplicados_entre_empresas (pedido_id, canal, empresas_afetadas, total_duplicatas, valor_duplicado)
SELECT 
  pedido_id,
  canal,
  array_agg(DISTINCT empresa_id::TEXT) as empresas_afetadas,
  COUNT(DISTINCT empresa_id) as total_duplicatas,
  SUM(valor_bruto) as valor_duplicado
FROM marketplace_transactions
WHERE pedido_id IS NOT NULL
  AND tipo_transacao = 'venda'
GROUP BY pedido_id, canal
HAVING COUNT(DISTINCT empresa_id) > 1
ON CONFLICT (pedido_id, canal) DO UPDATE SET
  empresas_afetadas = EXCLUDED.empresas_afetadas,
  total_duplicatas = EXCLUDED.total_duplicatas,
  valor_duplicado = EXCLUDED.valor_duplicado,
  atualizado_em = now();

-- 4. Criar constraint única para prevenir novos pedidos duplicados
-- Primeiro, identificar se já existe algum pedido duplicado para evitar erro
-- A constraint só pode ser criada se não houver duplicatas OU se escolhermos resolver
-- Por enquanto, criar um índice parcial que alerta mas não bloqueia

-- NOTA: Não podemos criar constraint única direta porque já existem duplicatas
-- Ao invés, vamos criar uma função de trigger para PREVENIR novas duplicatas

CREATE OR REPLACE FUNCTION public.check_pedido_duplicado_entre_empresas()
RETURNS TRIGGER AS $$
DECLARE
  existing_empresa_id UUID;
BEGIN
  -- Apenas verificar se é uma venda com pedido_id
  IF NEW.tipo_transacao = 'venda' AND NEW.pedido_id IS NOT NULL THEN
    -- Verificar se já existe este pedido_id em OUTRA empresa
    SELECT empresa_id INTO existing_empresa_id
    FROM marketplace_transactions
    WHERE pedido_id = NEW.pedido_id
      AND canal = NEW.canal
      AND empresa_id != NEW.empresa_id
      AND tipo_transacao = 'venda'
    LIMIT 1;
    
    IF existing_empresa_id IS NOT NULL THEN
      -- Logar o conflito mas NÃO bloquear (para não quebrar sync existente)
      -- Apenas inserir na tabela de duplicados para análise posterior
      INSERT INTO public.pedidos_duplicados_entre_empresas 
        (pedido_id, canal, empresas_afetadas, total_duplicatas, valor_duplicado)
      VALUES 
        (NEW.pedido_id, NEW.canal, ARRAY[existing_empresa_id::TEXT, NEW.empresa_id::TEXT], 2, NEW.valor_bruto)
      ON CONFLICT (pedido_id, canal) DO UPDATE SET
        empresas_afetadas = array_cat(
          pedidos_duplicados_entre_empresas.empresas_afetadas,
          ARRAY[NEW.empresa_id::TEXT]
        ),
        total_duplicatas = pedidos_duplicados_entre_empresas.total_duplicatas + 1,
        valor_duplicado = pedidos_duplicados_entre_empresas.valor_duplicado + NEW.valor_bruto,
        atualizado_em = now();
      
      RAISE WARNING '[ECOM Finance] Pedido % do canal % já existe na empresa %. Registrado como duplicata.', 
        NEW.pedido_id, NEW.canal, existing_empresa_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Criar trigger para monitorar novas inserções
DROP TRIGGER IF EXISTS trg_check_pedido_duplicado ON marketplace_transactions;
CREATE TRIGGER trg_check_pedido_duplicado
  BEFORE INSERT ON marketplace_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_pedido_duplicado_entre_empresas();

-- 6. Habilitar RLS na nova tabela
ALTER TABLE public.pedidos_duplicados_entre_empresas ENABLE ROW LEVEL SECURITY;

-- 7. Política para permitir leitura apenas para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver duplicatas"
  ON public.pedidos_duplicados_entre_empresas
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. Comentário explicativo
COMMENT ON TABLE public.pedidos_duplicados_entre_empresas IS 
'Tabela para rastrear pedidos que aparecem em múltiplas empresas (problema de sincronização ML com múltiplas contas)';

COMMENT ON FUNCTION public.check_pedido_duplicado_entre_empresas() IS 
'Trigger function que detecta e registra pedidos duplicados entre empresas, sem bloquear a inserção';