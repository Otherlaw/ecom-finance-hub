
-- =====================================================
-- FASE 1: CORREÇÕES CRÍTICAS IMEDIATAS
-- =====================================================

-- 1.1 Restringir acesso a Tokens de Integração (apenas admins)
DROP POLICY IF EXISTS "Users can read own integracao_tokens" ON public.integracao_tokens;
DROP POLICY IF EXISTS "Users can insert own integracao_tokens" ON public.integracao_tokens;
DROP POLICY IF EXISTS "Users can update own integracao_tokens" ON public.integracao_tokens;
DROP POLICY IF EXISTS "Users can delete own integracao_tokens" ON public.integracao_tokens;

CREATE POLICY "Only admins can read integracao_tokens" 
ON public.integracao_tokens FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert integracao_tokens" 
ON public.integracao_tokens FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update integracao_tokens" 
ON public.integracao_tokens FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete integracao_tokens" 
ON public.integracao_tokens FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- 1.2 Restringir acesso a Config de Integração (apenas admins)
DROP POLICY IF EXISTS "Users can read own integracao_config" ON public.integracao_config;
DROP POLICY IF EXISTS "Users can insert own integracao_config" ON public.integracao_config;
DROP POLICY IF EXISTS "Users can update own integracao_config" ON public.integracao_config;
DROP POLICY IF EXISTS "Users can delete own integracao_config" ON public.integracao_config;

CREATE POLICY "Only admins can read integracao_config" 
ON public.integracao_config FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert integracao_config" 
ON public.integracao_config FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update integracao_config" 
ON public.integracao_config FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete integracao_config" 
ON public.integracao_config FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- 1.3 Corrigir Fornecedores (remover IS NULL check que expõe dados órfãos)
DROP POLICY IF EXISTS "Users can read own fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can insert own fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can update own fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Users can delete own fornecedores" ON public.fornecedores;

CREATE POLICY "Users can read own fornecedores" 
ON public.fornecedores FOR SELECT 
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can insert own fornecedores" 
ON public.fornecedores FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can update own fornecedores" 
ON public.fornecedores FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id));

CREATE POLICY "Users can delete own fornecedores" 
ON public.fornecedores FOR DELETE 
USING (public.user_has_empresa_access(empresa_id));

-- =====================================================
-- FASE 2: SEGREGAÇÃO POR PAPEL (ROLE-BASED)
-- =====================================================

-- 2.1 Criar função de verificação de acesso financeiro
CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'financeiro', 'socio')
  )
$$;

-- 2.2 Restringir Credit Cards a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can insert own credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can update own credit_cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can delete own credit_cards" ON public.credit_cards;

CREATE POLICY "Financial users can read credit_cards" 
ON public.credit_cards FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert credit_cards" 
ON public.credit_cards FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update credit_cards" 
ON public.credit_cards FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete credit_cards" 
ON public.credit_cards FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

-- 2.3 Restringir Bank Transactions a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can insert own bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can update own bank_transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Users can delete own bank_transactions" ON public.bank_transactions;

CREATE POLICY "Financial users can read bank_transactions" 
ON public.bank_transactions FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert bank_transactions" 
ON public.bank_transactions FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update bank_transactions" 
ON public.bank_transactions FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete bank_transactions" 
ON public.bank_transactions FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

-- 2.4 Restringir Contas a Pagar a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users can insert own contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users can update own contas_a_pagar" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Users can delete own contas_a_pagar" ON public.contas_a_pagar;

CREATE POLICY "Financial users can read contas_a_pagar" 
ON public.contas_a_pagar FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert contas_a_pagar" 
ON public.contas_a_pagar FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update contas_a_pagar" 
ON public.contas_a_pagar FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete contas_a_pagar" 
ON public.contas_a_pagar FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

-- 2.5 Restringir Contas a Receber a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Users can insert own contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Users can update own contas_a_receber" ON public.contas_a_receber;
DROP POLICY IF EXISTS "Users can delete own contas_a_receber" ON public.contas_a_receber;

CREATE POLICY "Financial users can read contas_a_receber" 
ON public.contas_a_receber FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert contas_a_receber" 
ON public.contas_a_receber FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update contas_a_receber" 
ON public.contas_a_receber FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete contas_a_receber" 
ON public.contas_a_receber FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

-- 2.6 Restringir Credit Card Invoices a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON public.credit_card_invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON public.credit_card_invoices;

CREATE POLICY "Financial users can read credit_card_invoices" 
ON public.credit_card_invoices FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_cards cc
    WHERE cc.id = credit_card_invoices.credit_card_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can insert credit_card_invoices" 
ON public.credit_card_invoices FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.credit_cards cc
    WHERE cc.id = credit_card_invoices.credit_card_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can update credit_card_invoices" 
ON public.credit_card_invoices FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_cards cc
    WHERE cc.id = credit_card_invoices.credit_card_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can delete credit_card_invoices" 
ON public.credit_card_invoices FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_cards cc
    WHERE cc.id = credit_card_invoices.credit_card_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

-- 2.7 Restringir Credit Card Transactions a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own cc_transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Users can insert own cc_transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Users can update own cc_transactions" ON public.credit_card_transactions;
DROP POLICY IF EXISTS "Users can delete own cc_transactions" ON public.credit_card_transactions;

CREATE POLICY "Financial users can read credit_card_transactions" 
ON public.credit_card_transactions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_card_invoices i
    JOIN public.credit_cards cc ON cc.id = i.credit_card_id
    WHERE i.id = credit_card_transactions.invoice_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can insert credit_card_transactions" 
ON public.credit_card_transactions FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.credit_card_invoices i
    JOIN public.credit_cards cc ON cc.id = i.credit_card_id
    WHERE i.id = credit_card_transactions.invoice_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can update credit_card_transactions" 
ON public.credit_card_transactions FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_card_invoices i
    JOIN public.credit_cards cc ON cc.id = i.credit_card_id
    WHERE i.id = credit_card_transactions.invoice_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

CREATE POLICY "Financial users can delete credit_card_transactions" 
ON public.credit_card_transactions FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.credit_card_invoices i
    JOIN public.credit_cards cc ON cc.id = i.credit_card_id
    WHERE i.id = credit_card_transactions.invoice_id
    AND public.user_has_empresa_access(cc.empresa_id)
  ) 
  AND public.has_financial_access(auth.uid())
);

-- 2.8 Restringir Créditos ICMS a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Users can insert own creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Users can update own creditos_icms" ON public.creditos_icms;
DROP POLICY IF EXISTS "Users can delete own creditos_icms" ON public.creditos_icms;

CREATE POLICY "Financial users can read creditos_icms" 
ON public.creditos_icms FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert creditos_icms" 
ON public.creditos_icms FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update creditos_icms" 
ON public.creditos_icms FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete creditos_icms" 
ON public.creditos_icms FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

-- 2.9 Restringir Movimentos Financeiros a usuários com acesso financeiro
DROP POLICY IF EXISTS "Users can read own movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Users can insert own movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Users can update own movimentos" ON public.movimentos_financeiros;
DROP POLICY IF EXISTS "Users can delete own movimentos" ON public.movimentos_financeiros;

CREATE POLICY "Financial users can read movimentos_financeiros" 
ON public.movimentos_financeiros FOR SELECT 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can insert movimentos_financeiros" 
ON public.movimentos_financeiros FOR INSERT 
WITH CHECK (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can update movimentos_financeiros" 
ON public.movimentos_financeiros FOR UPDATE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));

CREATE POLICY "Financial users can delete movimentos_financeiros" 
ON public.movimentos_financeiros FOR DELETE 
USING (public.user_has_empresa_access(empresa_id) AND public.has_financial_access(auth.uid()));
