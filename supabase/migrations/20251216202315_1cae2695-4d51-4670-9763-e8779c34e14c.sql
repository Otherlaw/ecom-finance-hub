-- 1. Criar função para atualizar atualizado_em
CREATE OR REPLACE FUNCTION public.update_atualizado_em_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$;

-- 2. Remover o trigger antigo que usa a função errada
DROP TRIGGER IF EXISTS update_bank_transactions_updated_at ON public.bank_transactions;

-- 3. Criar o novo trigger com a função correta
CREATE TRIGGER update_bank_transactions_atualizado_em
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_atualizado_em_column();