
-- Drop the OLD overloaded version of get_vendas_por_pedido that has p_limit/p_offset BEFORE p_tipo_envio/p_tem_custo
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, text, integer, integer, text, text);
