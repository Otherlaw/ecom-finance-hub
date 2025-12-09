-- 1. Criar tabela de associação usuário-empresa
CREATE TABLE IF NOT EXISTS public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);

-- Habilitar RLS na nova tabela
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem suas próprias associações
CREATE POLICY "Users can view own empresa associations"
ON public.user_empresas FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Apenas admins podem gerenciar associações
CREATE POLICY "Admins can manage empresa associations"
ON public.user_empresas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Criar função segura para verificar acesso à empresa
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa_id
  ) OR public.has_role(auth.uid(), 'admin')
$$;

-- 3. Atualizar políticas RLS em todas as tabelas afetadas

-- EMPRESAS
DROP POLICY IF EXISTS "Allow public delete empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow public insert empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow public read empresas" ON public.empresas;
DROP POLICY IF EXISTS "Allow public update empresas" ON public.empresas;

CREATE POLICY "Users can read own empresas"
ON public.empresas FOR SELECT TO authenticated
USING (public.user_has_empresa_access(id));

CREATE POLICY "Users can update own empresas"
ON public.empresas FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(id));

CREATE POLICY "Admins can insert empresas"
ON public.empresas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete empresas"
ON public.empresas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- BANK_TRANSACTIONS
DROP POLICY IF EXISTS "Allow public delete bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Allow public insert bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Allow public read bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Allow public update bank_transactions" ON public.bank_transactions;

CREATE POLICY "Users can read own bank_transactions"
ON public.bank_transactions FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own bank_transactions"
ON public.bank_transactions FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own bank_transactions"
ON public.bank_transactions FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own bank_transactions"
ON public.bank_transactions FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CREDIT_CARDS
DROP POLICY IF EXISTS "Allow public delete credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow public insert credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow public read credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Allow public update credit_cards" ON public.credit_cards;

CREATE POLICY "Users can read own credit_cards"
ON public.credit_cards FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own credit_cards"
ON public.credit_cards FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own credit_cards"
ON public.credit_cards FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own credit_cards"
ON public.credit_cards FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CREDIT_CARD_INVOICES
DROP POLICY IF EXISTS "Allow all users to delete invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow all users to insert invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow all users to read invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Allow all users to update invoices" ON public.credit_card_invoices;

CREATE POLICY "Users can read own invoices"
ON public.credit_card_invoices FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_cards cc 
  WHERE cc.id = credit_card_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can insert own invoices"
ON public.credit_card_invoices FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.credit_cards cc 
  WHERE cc.id = credit_card_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can update own invoices"
ON public.credit_card_invoices FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_cards cc 
  WHERE cc.id = credit_card_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can delete own invoices"
ON public.credit_card_invoices FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_cards cc 
  WHERE cc.id = credit_card_id AND public.user_has_empresa_access(cc.empresa_id)
));

-- CREDIT_CARD_TRANSACTIONS
DROP POLICY IF EXISTS "Allow all users to delete transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow all users to insert transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow all users to read transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Allow all users to update transactions" ON public.credit_card_transactions;

CREATE POLICY "Users can read own cc_transactions"
ON public.credit_card_transactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_card_invoices i
  JOIN public.credit_cards cc ON cc.id = i.credit_card_id
  WHERE i.id = invoice_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can insert own cc_transactions"
ON public.credit_card_transactions FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.credit_card_invoices i
  JOIN public.credit_cards cc ON cc.id = i.credit_card_id
  WHERE i.id = invoice_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can update own cc_transactions"
ON public.credit_card_transactions FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_card_invoices i
  JOIN public.credit_cards cc ON cc.id = i.credit_card_id
  WHERE i.id = invoice_id AND public.user_has_empresa_access(cc.empresa_id)
));

CREATE POLICY "Users can delete own cc_transactions"
ON public.credit_card_transactions FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.credit_card_invoices i
  JOIN public.credit_cards cc ON cc.id = i.credit_card_id
  WHERE i.id = invoice_id AND public.user_has_empresa_access(cc.empresa_id)
));

-- CONTAS_A_PAGAR
DROP POLICY IF EXISTS "Allow public delete contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Allow public insert contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Allow public read contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Allow public update contas_a_pagar" ON public.contas_a_pagar;

CREATE POLICY "Users can read own contas_a_pagar"
ON public.contas_a_pagar FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own contas_a_pagar"
ON public.contas_a_pagar FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own contas_a_pagar"
ON public.contas_a_pagar FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own contas_a_pagar"
ON public.contas_a_pagar FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CONTAS_A_RECEBER
DROP POLICY IF EXISTS "Allow public delete contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Allow public insert contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Allow public read contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Allow public update contas_a_receber" ON public.contas_a_receber;

CREATE POLICY "Users can read own contas_a_receber"
ON public.contas_a_receber FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own contas_a_receber"
ON public.contas_a_receber FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own contas_a_receber"
ON public.contas_a_receber FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own contas_a_receber"
ON public.contas_a_receber FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MOVIMENTOS_FINANCEIROS
DROP POLICY IF EXISTS "Allow public delete movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Allow public insert movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Allow public read movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Allow public update movimentos" ON public.movimentos_financeiros;

CREATE POLICY "Users can read own movimentos"
ON public.movimentos_financeiros FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own movimentos"
ON public.movimentos_financeiros FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own movimentos"
ON public.movimentos_financeiros FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own movimentos"
ON public.movimentos_financeiros FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- FORNECEDORES
DROP POLICY IF EXISTS "Allow public delete fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow public insert fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow public read fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow public update fornecedores" ON public.fornecedores;

CREATE POLICY "Users can read own fornecedores"
ON public.fornecedores FOR SELECT TO authenticated
USING (empresa_id IS NULL OR public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own fornecedores"
ON public.fornecedores FOR INSERT TO authenticated
WITH CHECK (empresa_id IS NULL OR public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own fornecedores"
ON public.fornecedores FOR UPDATE TO authenticated
USING (empresa_id IS NULL OR public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own fornecedores"
ON public.fornecedores FOR DELETE TO authenticated
USING (empresa_id IS NULL OR public.user_has_empresa_access(empresa_id));

-- COMPRAS
DROP POLICY IF EXISTS "Allow public all compras" ON public.compras;

CREATE POLICY "Users can read own compras"
ON public.compras FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own compras"
ON public.compras FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own compras"
ON public.compras FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own compras"
ON public.compras FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- COMPRAS_ITENS
DROP POLICY IF EXISTS "Allow public all compras_itens" ON public.compras_itens;

CREATE POLICY "Users can read own compras_itens"
ON public.compras_itens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

CREATE POLICY "Users can insert own compras_itens"
ON public.compras_itens FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

CREATE POLICY "Users can update own compras_itens"
ON public.compras_itens FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

CREATE POLICY "Users can delete own compras_itens"
ON public.compras_itens FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

-- ESTOQUE
DROP POLICY IF EXISTS "Allow public all estoque" ON public.estoque;

CREATE POLICY "Users can read own estoque"
ON public.estoque FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own estoque"
ON public.estoque FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own estoque"
ON public.estoque FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own estoque"
ON public.estoque FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MOVIMENTACOES_ESTOQUE
DROP POLICY IF EXISTS "Allow public all mov_estoque" ON public.movimentacoes_estoque;

CREATE POLICY "Users can read own mov_estoque"
ON public.movimentacoes_estoque FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own mov_estoque"
ON public.movimentacoes_estoque FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own mov_estoque"
ON public.movimentacoes_estoque FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own mov_estoque"
ON public.movimentacoes_estoque FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- PRODUTOS
DROP POLICY IF EXISTS "Allow public all produtos" ON public.produtos;

CREATE POLICY "Users can read own produtos"
ON public.produtos FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own produtos"
ON public.produtos FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own produtos"
ON public.produtos FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own produtos"
ON public.produtos FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MARKETPLACE_TRANSACTIONS
DROP POLICY IF EXISTS "Allow public delete marketplace_transactions" ON public.marketplace_transactions;
DROP POLICY IF EXISTS "Allow public insert marketplace_transactions" ON public.marketplace_transactions;
DROP POLICY IF EXISTS "Allow public read marketplace_transactions" ON public.marketplace_transactions;
DROP POLICY IF EXISTS "Allow public update marketplace_transactions" ON public.marketplace_transactions;

CREATE POLICY "Users can read own mkt_transactions"
ON public.marketplace_transactions FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own mkt_transactions"
ON public.marketplace_transactions FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own mkt_transactions"
ON public.marketplace_transactions FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own mkt_transactions"
ON public.marketplace_transactions FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CREDITOS_ICMS
DROP POLICY IF EXISTS "Allow public delete creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Allow public insert creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Allow public read creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Allow public update creditos_icms" ON public.creditos_icms;

CREATE POLICY "Users can read own creditos_icms"
ON public.creditos_icms FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own creditos_icms"
ON public.creditos_icms FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own creditos_icms"
ON public.creditos_icms FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own creditos_icms"
ON public.creditos_icms FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- ARMAZENS
DROP POLICY IF EXISTS "Allow public all armazens" ON public.armazens;

CREATE POLICY "Users can read own armazens"
ON public.armazens FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own armazens"
ON public.armazens FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own armazens"
ON public.armazens FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own armazens"
ON public.armazens FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CMV_REGISTROS
DROP POLICY IF EXISTS "Allow public all cmv" ON public.cmv_registros;

CREATE POLICY "Users can read own cmv"
ON public.cmv_registros FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own cmv"
ON public.cmv_registros FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own cmv"
ON public.cmv_registros FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own cmv"
ON public.cmv_registros FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- CHECKLIST_ETAPAS
DROP POLICY IF EXISTS "Allow public delete checklist_etapas" ON public.checklist_etapas;
DROP POLICY IF EXISTS "Allow public insert checklist_etapas" ON public.checklist_etapas;
DROP POLICY IF EXISTS "Allow public read checklist_etapas" ON public.checklist_etapas;
DROP POLICY IF EXISTS "Allow public update checklist_etapas" ON public.checklist_etapas;

CREATE POLICY "Users can read own checklist_etapas"
ON public.checklist_etapas FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own checklist_etapas"
ON public.checklist_etapas FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own checklist_etapas"
ON public.checklist_etapas FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own checklist_etapas"
ON public.checklist_etapas FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MANUAL_TRANSACTIONS
DROP POLICY IF EXISTS "Allow public delete manual_transactions" ON public.manual_transactions;
DROP POLICY IF EXISTS "Allow public insert manual_transactions" ON public.manual_transactions;
DROP POLICY IF EXISTS "Allow public read manual_transactions" ON public.manual_transactions;
DROP POLICY IF EXISTS "Allow public update manual_transactions" ON public.manual_transactions;

CREATE POLICY "Users can read own manual_transactions"
ON public.manual_transactions FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own manual_transactions"
ON public.manual_transactions FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own manual_transactions"
ON public.manual_transactions FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own manual_transactions"
ON public.manual_transactions FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MARKETPLACE_IMPORT_JOBS
DROP POLICY IF EXISTS "Allow public delete marketplace_import_jobs" ON public.marketplace_import_jobs;
DROP POLICY IF EXISTS "Allow public insert marketplace_import_jobs" ON public.marketplace_import_jobs;
DROP POLICY IF EXISTS "Allow public read marketplace_import_jobs" ON public.marketplace_import_jobs;
DROP POLICY IF EXISTS "Allow public update marketplace_import_jobs" ON public.marketplace_import_jobs;

CREATE POLICY "Users can read own mkt_import_jobs"
ON public.marketplace_import_jobs FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own mkt_import_jobs"
ON public.marketplace_import_jobs FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own mkt_import_jobs"
ON public.marketplace_import_jobs FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own mkt_import_jobs"
ON public.marketplace_import_jobs FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MARKETPLACE_RULES
DROP POLICY IF EXISTS "Allow public delete marketplace_rules" ON public.marketplace_rules;
DROP POLICY IF EXISTS "Allow public insert marketplace_rules" ON public.marketplace_rules;
DROP POLICY IF EXISTS "Allow public read marketplace_rules" ON public.marketplace_rules;
DROP POLICY IF EXISTS "Allow public update marketplace_rules" ON public.marketplace_rules;

CREATE POLICY "Users can read own mkt_rules"
ON public.marketplace_rules FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own mkt_rules"
ON public.marketplace_rules FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own mkt_rules"
ON public.marketplace_rules FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own mkt_rules"
ON public.marketplace_rules FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- PRODUTO_IMPORT_JOBS
DROP POLICY IF EXISTS "Permitir acesso público a produto_import_jobs" ON public.produto_import_jobs;

CREATE POLICY "Users can read own produto_import_jobs"
ON public.produto_import_jobs FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own produto_import_jobs"
ON public.produto_import_jobs FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own produto_import_jobs"
ON public.produto_import_jobs FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own produto_import_jobs"
ON public.produto_import_jobs FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- PRODUTO_MARKETPLACE_MAP
DROP POLICY IF EXISTS "Allow public all mkt_map" ON public.produto_marketplace_map;

CREATE POLICY "Users can read own mkt_map"
ON public.produto_marketplace_map FOR SELECT TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own mkt_map"
ON public.produto_marketplace_map FOR INSERT TO authenticated
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own mkt_map"
ON public.produto_marketplace_map FOR UPDATE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own mkt_map"
ON public.produto_marketplace_map FOR DELETE TO authenticated
USING (public.user_has_empresa_access(empresa_id));

-- MARKETPLACE_TRANSACTION_ITEMS
DROP POLICY IF EXISTS "Allow public all mkt_items" ON public.marketplace_transaction_items;

CREATE POLICY "Users can read own mkt_items"
ON public.marketplace_transaction_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.marketplace_transactions mt 
  WHERE mt.id = transaction_id AND public.user_has_empresa_access(mt.empresa_id)
));

CREATE POLICY "Users can insert own mkt_items"
ON public.marketplace_transaction_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.marketplace_transactions mt 
  WHERE mt.id = transaction_id AND public.user_has_empresa_access(mt.empresa_id)
));

CREATE POLICY "Users can update own mkt_items"
ON public.marketplace_transaction_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.marketplace_transactions mt 
  WHERE mt.id = transaction_id AND public.user_has_empresa_access(mt.empresa_id)
));

CREATE POLICY "Users can delete own mkt_items"
ON public.marketplace_transaction_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.marketplace_transactions mt 
  WHERE mt.id = transaction_id AND public.user_has_empresa_access(mt.empresa_id)
));

-- RECEBIMENTOS
DROP POLICY IF EXISTS "Allow public all recebimentos" ON public.recebimentos;

CREATE POLICY "Users can read own recebimentos"
ON public.recebimentos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

CREATE POLICY "Users can insert own recebimentos"
ON public.recebimentos FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));

CREATE POLICY "Users can update own recebimentos"
ON public.recebimentos FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.compras c WHERE c.id = compra_id AND public.user_has_empresa_access(c.empresa_id)
));