-- Política para admins lerem todos os profiles (gerenciamento de usuários)
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins lerem todos os vínculos user_empresas
CREATE POLICY "Admins can read all user_empresas"
ON public.user_empresas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política para admins gerenciarem vínculos user_empresas
CREATE POLICY "Admins can manage all user_empresas"
ON public.user_empresas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));