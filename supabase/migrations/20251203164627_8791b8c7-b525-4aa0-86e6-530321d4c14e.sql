-- Remover políticas restritivas existentes e criar políticas permissivas para acesso público
-- Tabela: empresas
DROP POLICY IF EXISTS "Allow authenticated users to insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow authenticated users to read empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow authenticated users to update empresas" ON public.empresas;

CREATE POLICY "Allow public read empresas" 
ON public.empresas 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert empresas" 
ON public.empresas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update empresas" 
ON public.empresas 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete empresas" 
ON public.empresas 
FOR DELETE 
USING (true);

-- Tabela: responsaveis
DROP POLICY IF EXISTS "Allow authenticated users to insert responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Allow authenticated users to read responsaveis" ON public.responsaveis;
DROP POLICY IF EXISTS "Allow authenticated users to update responsaveis" ON public.responsaveis;

CREATE POLICY "Allow public read responsaveis" 
ON public.responsaveis 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert responsaveis" 
ON public.responsaveis 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update responsaveis" 
ON public.responsaveis 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete responsaveis" 
ON public.responsaveis 
FOR DELETE 
USING (true);

-- Inserir dados iniciais se tabela estiver vazia
INSERT INTO public.empresas (razao_social, nome_fantasia, cnpj, regime_tributario, ativo)
SELECT 'Exchange Comercial Ltda.', 'Exchange Comercial', '12.345.678/0001-90', 'lucro_presumido', true
WHERE NOT EXISTS (SELECT 1 FROM public.empresas WHERE cnpj = '12.345.678/0001-90');

INSERT INTO public.empresas (razao_social, nome_fantasia, cnpj, regime_tributario, ativo)
SELECT 'Inpari Distribuição Ltda.', 'Inpari Distribuição', '98.765.432/0001-10', 'simples_nacional', true
WHERE NOT EXISTS (SELECT 1 FROM public.empresas WHERE cnpj = '98.765.432/0001-10');

INSERT INTO public.responsaveis (nome, email, funcao, ativo)
SELECT 'João Silva', 'joao@exchange.com', 'Financeiro', true
WHERE NOT EXISTS (SELECT 1 FROM public.responsaveis WHERE email = 'joao@exchange.com');

INSERT INTO public.responsaveis (nome, email, funcao, ativo)
SELECT 'Maria Santos', 'maria@exchange.com', 'Administrativo', true
WHERE NOT EXISTS (SELECT 1 FROM public.responsaveis WHERE email = 'maria@exchange.com');