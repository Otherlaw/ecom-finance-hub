-- Adicionar coluna capital_inicial na tabela empresas
-- Representa o K Inicial (capital social inicial investido pelos sócios)
ALTER TABLE public.empresas 
ADD COLUMN capital_inicial numeric DEFAULT 0;