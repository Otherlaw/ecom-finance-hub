-- =====================================================
-- FIX: Tabelas de Configuração Compartilhadas Expostas
-- =====================================================

-- 1. CENTROS_DE_CUSTO: Tornar somente-leitura para não-admins
DROP POLICY IF EXISTS "Allow public insert centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Allow public read centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Allow public update centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Authenticated users can read centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Only admins can insert centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Only admins can update centros" ON centros_de_custo;
DROP POLICY IF EXISTS "Only admins can delete centros" ON centros_de_custo;

CREATE POLICY "Authenticated users can read centros" ON centros_de_custo
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert centros" ON centros_de_custo
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update centros" ON centros_de_custo
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete centros" ON centros_de_custo
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 2. CATEGORIAS_FINANCEIRAS: Tornar somente-leitura para não-admins
DROP POLICY IF EXISTS "Allow public insert categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Allow public read categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Allow public update categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Authenticated users can read categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Only admins can insert categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Only admins can update categorias" ON categorias_financeiras;
DROP POLICY IF EXISTS "Only admins can delete categorias" ON categorias_financeiras;

CREATE POLICY "Authenticated users can read categorias" ON categorias_financeiras
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can insert categorias" ON categorias_financeiras
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update categorias" ON categorias_financeiras
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete categorias" ON categorias_financeiras
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- 3. RESPONSAVEIS: RLS já corrigido, apenas garantir policies corretas
DROP POLICY IF EXISTS "Users can read own responsaveis" ON responsaveis;
DROP POLICY IF EXISTS "Users can insert own responsaveis" ON responsaveis;
DROP POLICY IF EXISTS "Users can update own responsaveis" ON responsaveis;
DROP POLICY IF EXISTS "Users can delete own responsaveis" ON responsaveis;

CREATE POLICY "Users can read own responsaveis" ON responsaveis
FOR SELECT USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own responsaveis" ON responsaveis
FOR INSERT WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own responsaveis" ON responsaveis
FOR UPDATE USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own responsaveis" ON responsaveis
FOR DELETE USING (user_has_empresa_access(empresa_id));

-- 4. RECEBIMENTOS_ITENS: Implementar RLS via tabela pai (recebimentos -> compras)
DROP POLICY IF EXISTS "Allow public all recebimentos_itens" ON recebimentos_itens;

CREATE POLICY "Users can select own recebimentos_itens" ON recebimentos_itens
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM recebimentos r
    JOIN compras c ON c.id = r.compra_id
    WHERE r.id = recebimentos_itens.recebimento_id
    AND user_has_empresa_access(c.empresa_id)
  )
);

CREATE POLICY "Users can insert own recebimentos_itens" ON recebimentos_itens
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM recebimentos r
    JOIN compras c ON c.id = r.compra_id
    WHERE r.id = recebimentos_itens.recebimento_id
    AND user_has_empresa_access(c.empresa_id)
  )
);

CREATE POLICY "Users can update own recebimentos_itens" ON recebimentos_itens
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM recebimentos r
    JOIN compras c ON c.id = r.compra_id
    WHERE r.id = recebimentos_itens.recebimento_id
    AND user_has_empresa_access(c.empresa_id)
  )
);

CREATE POLICY "Users can delete own recebimentos_itens" ON recebimentos_itens
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM recebimentos r
    JOIN compras c ON c.id = r.compra_id
    WHERE r.id = recebimentos_itens.recebimento_id
    AND user_has_empresa_access(c.empresa_id)
  )
);

-- 5. REGRAS_CATEGORIZACAO: Adicionar empresa_id e implementar RLS
ALTER TABLE regras_categorizacao ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

-- Atualizar registros existentes com empresa padrão
UPDATE regras_categorizacao SET empresa_id = 'd0b0c897-d560-4dc5-aa07-df99d3019bf5' WHERE empresa_id IS NULL;

-- Tornar NOT NULL após popular os dados
ALTER TABLE regras_categorizacao ALTER COLUMN empresa_id SET NOT NULL;

DROP POLICY IF EXISTS "Allow public read regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow public insert regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow public update regras" ON regras_categorizacao;
DROP POLICY IF EXISTS "Allow public delete regras" ON regras_categorizacao;

CREATE POLICY "Users can read own regras" ON regras_categorizacao
FOR SELECT USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own regras" ON regras_categorizacao
FOR INSERT WITH CHECK (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own regras" ON regras_categorizacao
FOR UPDATE USING (user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own regras" ON regras_categorizacao
FOR DELETE USING (user_has_empresa_access(empresa_id));

-- 6. CHECKLIST_LOGS: Restringir acesso baseado na etapa vinculada
DROP POLICY IF EXISTS "Allow public read checklist_logs" ON checklist_logs;
DROP POLICY IF EXISTS "Allow public insert checklist_logs" ON checklist_logs;
DROP POLICY IF EXISTS "Users can read related checklist_logs" ON checklist_logs;
DROP POLICY IF EXISTS "Users can insert checklist_logs" ON checklist_logs;

CREATE POLICY "Users can read related checklist_logs" ON checklist_logs
FOR SELECT USING (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM checklist_etapas ce
    WHERE ce.id = checklist_logs.etapa_id
    AND user_has_empresa_access(ce.empresa_id)
  )
);

CREATE POLICY "Users can insert checklist_logs" ON checklist_logs
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM checklist_etapas ce
    WHERE ce.id = checklist_logs.etapa_id
    AND user_has_empresa_access(ce.empresa_id)
  )
);