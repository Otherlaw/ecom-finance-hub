-- Tabela principal de etapas do checklist
CREATE TABLE public.checklist_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) NOT NULL,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  secao TEXT NOT NULL,
  codigo_etapa TEXT NOT NULL,
  nome_etapa TEXT NOT NULL,
  descricao TEXT,
  importancia TEXT,
  link_acao TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'nao_aplicavel')),
  pendencias INTEGER DEFAULT 0,
  concluidas INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, ano, mes, codigo_etapa)
);

-- Tabela de logs de auditoria
CREATE TABLE public.checklist_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id UUID REFERENCES checklist_etapas(id) ON DELETE CASCADE,
  usuario_id UUID,
  acao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklist_etapas
CREATE POLICY "Allow public read checklist_etapas" ON public.checklist_etapas
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert checklist_etapas" ON public.checklist_etapas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update checklist_etapas" ON public.checklist_etapas
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete checklist_etapas" ON public.checklist_etapas
  FOR DELETE USING (true);

-- RLS Policies for checklist_logs
CREATE POLICY "Allow public read checklist_logs" ON public.checklist_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert checklist_logs" ON public.checklist_logs
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_checklist_etapas_empresa_periodo ON public.checklist_etapas(empresa_id, ano, mes);
CREATE INDEX idx_checklist_logs_etapa ON public.checklist_logs(etapa_id);