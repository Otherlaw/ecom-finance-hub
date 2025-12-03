-- Drop existing restrictive policies and create permissive ones for categorias_financeiras
DROP POLICY IF EXISTS "Allow authenticated users to read categorias" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Allow authenticated users to insert categorias" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Allow authenticated users to update categorias" ON public.categorias_financeiras;

CREATE POLICY "Allow public read categorias" 
ON public.categorias_financeiras 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert categorias" 
ON public.categorias_financeiras 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update categorias" 
ON public.categorias_financeiras 
FOR UPDATE 
USING (true);

-- Drop existing restrictive policies and create permissive ones for centros_de_custo
DROP POLICY IF EXISTS "Allow authenticated users to read centros" ON public.centros_de_custo;
DROP POLICY IF EXISTS "Allow authenticated users to insert centros" ON public.centros_de_custo;
DROP POLICY IF EXISTS "Allow authenticated users to update centros" ON public.centros_de_custo;

CREATE POLICY "Allow public read centros" 
ON public.centros_de_custo 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert centros" 
ON public.centros_de_custo 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update centros" 
ON public.centros_de_custo 
FOR UPDATE 
USING (true);