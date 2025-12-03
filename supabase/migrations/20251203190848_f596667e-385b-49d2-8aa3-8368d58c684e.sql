-- Tabela para armazenar regras de categorização automática baseadas em estabelecimentos
CREATE TABLE public.regras_categorizacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estabelecimento_pattern TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_de_custo(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  uso_count INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por padrão de estabelecimento
CREATE INDEX idx_regras_categorizacao_pattern ON public.regras_categorizacao(estabelecimento_pattern);

-- Habilitar RLS
ALTER TABLE public.regras_categorizacao ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Allow all users to read regras" ON public.regras_categorizacao
  FOR SELECT USING (true);

CREATE POLICY "Allow all users to insert regras" ON public.regras_categorizacao
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all users to update regras" ON public.regras_categorizacao
  FOR UPDATE USING (true);

CREATE POLICY "Allow all users to delete regras" ON public.regras_categorizacao
  FOR DELETE USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_regras_categorizacao_updated_at
  BEFORE UPDATE ON public.regras_categorizacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();