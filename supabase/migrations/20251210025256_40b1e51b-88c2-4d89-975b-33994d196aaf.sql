-- Tabela principal de checklists por canal
CREATE TABLE public.checklists_canal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  canal_id TEXT NOT NULL,
  canal_nome TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020 AND ano <= 2100),
  status TEXT NOT NULL DEFAULT 'pendente',
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, canal_id, mes, ano)
);

-- Tabela de itens/etapas do checklist
CREATE TABLE public.checklist_canal_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists_canal(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo_etapa TEXT NOT NULL DEFAULT 'outro',
  ordem INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente',
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  exige_upload BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  data_hora_conclusao TIMESTAMPTZ,
  responsavel TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de arquivos enviados para itens do checklist
CREATE TABLE public.checklist_canal_arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id UUID NOT NULL REFERENCES checklist_canal_itens(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tamanho_bytes BIGINT,
  tipo_mime TEXT,
  processado BOOLEAN NOT NULL DEFAULT false,
  resultado_processamento JSONB,
  transacoes_importadas INTEGER DEFAULT 0,
  data_upload TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes para performance
CREATE INDEX idx_checklists_canal_empresa ON checklists_canal(empresa_id);
CREATE INDEX idx_checklists_canal_periodo ON checklists_canal(ano, mes);
CREATE INDEX idx_checklists_canal_status ON checklists_canal(status);
CREATE INDEX idx_checklist_canal_itens_checklist ON checklist_canal_itens(checklist_id);
CREATE INDEX idx_checklist_canal_itens_ordem ON checklist_canal_itens(checklist_id, ordem);
CREATE INDEX idx_checklist_canal_arquivos_item ON checklist_canal_arquivos(checklist_item_id);

-- Enable RLS
ALTER TABLE checklists_canal ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_canal_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_canal_arquivos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checklists_canal
CREATE POLICY "Users can read own checklists_canal"
  ON checklists_canal FOR SELECT
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own checklists_canal"
  ON checklists_canal FOR INSERT
  WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own checklists_canal"
  ON checklists_canal FOR UPDATE
  USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own checklists_canal"
  ON checklists_canal FOR DELETE
  USING (user_has_empresa_access(empresa_id));

-- RLS Policies for checklist_canal_itens
CREATE POLICY "Users can read own checklist_canal_itens"
  ON checklist_canal_itens FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM checklists_canal c
    WHERE c.id = checklist_canal_itens.checklist_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can insert own checklist_canal_itens"
  ON checklist_canal_itens FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM checklists_canal c
    WHERE c.id = checklist_canal_itens.checklist_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can update own checklist_canal_itens"
  ON checklist_canal_itens FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM checklists_canal c
    WHERE c.id = checklist_canal_itens.checklist_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can delete own checklist_canal_itens"
  ON checklist_canal_itens FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM checklists_canal c
    WHERE c.id = checklist_canal_itens.checklist_id
    AND user_has_empresa_access(c.empresa_id)
  ));

-- RLS Policies for checklist_canal_arquivos
CREATE POLICY "Users can read own checklist_canal_arquivos"
  ON checklist_canal_arquivos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM checklist_canal_itens i
    JOIN checklists_canal c ON c.id = i.checklist_id
    WHERE i.id = checklist_canal_arquivos.checklist_item_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can insert own checklist_canal_arquivos"
  ON checklist_canal_arquivos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM checklist_canal_itens i
    JOIN checklists_canal c ON c.id = i.checklist_id
    WHERE i.id = checklist_canal_arquivos.checklist_item_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can update own checklist_canal_arquivos"
  ON checklist_canal_arquivos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM checklist_canal_itens i
    JOIN checklists_canal c ON c.id = i.checklist_id
    WHERE i.id = checklist_canal_arquivos.checklist_item_id
    AND user_has_empresa_access(c.empresa_id)
  ));

CREATE POLICY "Users can delete own checklist_canal_arquivos"
  ON checklist_canal_arquivos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM checklist_canal_itens i
    JOIN checklists_canal c ON c.id = i.checklist_id
    WHERE i.id = checklist_canal_arquivos.checklist_item_id
    AND user_has_empresa_access(c.empresa_id)
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_checklists_canal_updated_at
  BEFORE UPDATE ON checklists_canal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_canal_itens_updated_at
  BEFORE UPDATE ON checklist_canal_itens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();