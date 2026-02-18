
-- Remove TODAS as versões existentes de get_vendas_por_pedido para eliminar qualquer conflito de overload
-- A função correta (com parâmetros TEXT) será recriada logo abaixo

DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(date, date, uuid, text, text, text, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, date, date, text, text, text, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text, text, text, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(p_empresa_id uuid, p_data_inicio text, p_data_fim text, p_canal text, p_conta text, p_status text, p_busca text, p_tipo_envio text, p_tem_custo text, p_page integer, p_page_size integer);
