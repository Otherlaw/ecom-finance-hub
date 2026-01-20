-- Remover versões TEXT das RPCs que causam conflito PGRST203
-- PostgREST pode converter automaticamente strings 'YYYY-MM-DD' para DATE

-- Remover overloads com TEXT para get_vendas_por_pedido
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido(uuid, text, text, text, text, text, integer, integer);

-- Remover overloads com TEXT para get_vendas_por_pedido_resumo  
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_resumo(uuid, text, text);

-- Remover overloads com TEXT para get_vendas_por_pedido_count
DROP FUNCTION IF EXISTS public.get_vendas_por_pedido_count(uuid, text, text, text, text, text);