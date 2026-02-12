-- Drop the duplicate DATE versions that conflict with the TEXT versions
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, date, date, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, date, date);