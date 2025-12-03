-- Adicionar colunas para hierarquia nos centros de custo
ALTER TABLE public.centros_de_custo 
ADD COLUMN IF NOT EXISTS codigo text,
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.centros_de_custo(id) ON DELETE CASCADE;

-- Criar índice para busca hierárquica
CREATE INDEX IF NOT EXISTS idx_centros_de_custo_parent_id ON public.centros_de_custo(parent_id);
CREATE INDEX IF NOT EXISTS idx_centros_de_custo_codigo ON public.centros_de_custo(codigo);

-- Inserir Centros de Custo principais
INSERT INTO public.centros_de_custo (id, nome, codigo, descricao, ativo, parent_id)
VALUES 
  ('a1000000-0000-0000-0000-000000000001', 'Operação', 'CC-OP', 'Centro de custo para operações administrativas e de gestão', true, NULL),
  ('a2000000-0000-0000-0000-000000000002', 'E-commerce', 'CC-ECOM', 'Centro de custo para operações de e-commerce e marketplace', true, NULL),
  ('a3000000-0000-0000-0000-000000000003', 'Distribuição', 'CC-DIST', 'Centro de custo para operações de distribuição', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Inserir Subcentros de Operação (CC-OP)
INSERT INTO public.centros_de_custo (nome, codigo, descricao, ativo, parent_id)
VALUES 
  ('Administrativo', 'CC-OP-ADM', 'Despesas administrativas gerais', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Financeiro', 'CC-OP-FIN', 'Despesas do setor financeiro', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Contabilidade / Fiscal', 'CC-OP-CONT', 'Despesas contábeis e fiscais', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Diretoria / Gestão', 'CC-OP-DIR', 'Despesas da diretoria e gestão', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Infraestrutura e Escritório', 'CC-OP-INFRA', 'Despesas de infraestrutura e escritório', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Pessoas / RH', 'CC-OP-RH', 'Despesas de recursos humanos', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Tecnologia e Sistemas', 'CC-OP-TI', 'Despesas de tecnologia e sistemas', true, 'a1000000-0000-0000-0000-000000000001'),
  ('Jurídico', 'CC-OP-JUR', 'Despesas jurídicas', true, 'a1000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Inserir Subcentros de E-commerce (CC-ECOM)
INSERT INTO public.centros_de_custo (nome, codigo, descricao, ativo, parent_id)
VALUES 
  ('Operação Marketplace', 'CC-ECOM-MKP', 'Operações de marketplace', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Logística / Expedição', 'CC-ECOM-LOG', 'Logística e expedição', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Fretes Enviados', 'CC-ECOM-FRT', 'Custos de fretes enviados', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Embalagens / Insumos', 'CC-ECOM-EMB', 'Embalagens e insumos', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Marketing / Ads', 'CC-ECOM-MKT', 'Marketing e publicidade', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Ferramentas e Softwares', 'CC-ECOM-SOFT', 'Ferramentas e softwares', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Atendimento ao Cliente', 'CC-ECOM-SAC', 'Atendimento ao cliente', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Estoque / Armazenagem', 'CC-ECOM-EST', 'Estoque e armazenagem', true, 'a2000000-0000-0000-0000-000000000002'),
  ('Conteúdo e Mídia', 'CC-ECOM-CONT', 'Conteúdo e mídia', true, 'a2000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Inserir Subcentros de Distribuição (CC-DIST)
INSERT INTO public.centros_de_custo (nome, codigo, descricao, ativo, parent_id)
VALUES 
  ('Compras / Suprimentos', 'CC-DIST-CPR', 'Compras e suprimentos', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Logística de Distribuição', 'CC-DIST-LOG', 'Logística de distribuição', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Operacional da Distribuição', 'CC-DIST-OPE', 'Operacional da distribuição', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Marketing da Distribuição', 'CC-DIST-MKT', 'Marketing da distribuição', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Atendimento', 'CC-DIST-ATD', 'Atendimento distribuição', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Estoque Distribuição', 'CC-DIST-EST', 'Estoque de distribuição', true, 'a3000000-0000-0000-0000-000000000003'),
  ('Veículos / Coleta / Entregas', 'CC-DIST-VEI', 'Veículos, coleta e entregas', true, 'a3000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;