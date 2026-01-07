-- Vincular usuário às empresas que possuem dados de marketplace
INSERT INTO public.user_empresas (user_id, empresa_id, role_na_empresa)
VALUES 
  ('4d05d28c-2b19-4279-8d7b-8e741c665711', 'd0b0c897-d560-4dc5-aa07-df99d3019bf5', 'dono'),
  ('4d05d28c-2b19-4279-8d7b-8e741c665711', 'd2e99a0f-47ae-4490-ac98-0b2cce7047ac', 'dono')
ON CONFLICT (user_id, empresa_id) DO NOTHING;