-- 1) Garantir que eusaviosantoss@gmail.com tenha role admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'eusaviosantoss@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Criar policy para usuários lerem suas próprias roles (se não existir)
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) Admins podem ler todas as roles (para tela de usuários)
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));