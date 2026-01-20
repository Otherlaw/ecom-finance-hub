-- =====================================================
-- CORREÇÃO: Remover movimentos de "venda" do Fluxo de Caixa
-- Vendas são competência, não caixa. Apenas repasses/saques são caixa.
-- =====================================================

-- Deletar movimentos financeiros que vieram de vendas de marketplace
-- Esses foram sincronizados incorretamente e duplicam dados com a aba Vendas
DELETE FROM public.movimentos_financeiros mf
WHERE mf.origem = 'marketplace'
  AND mf.referencia_id IN (
    SELECT mt.id 
    FROM public.marketplace_transactions mt 
    WHERE mt.tipo_transacao = 'venda'
  );

-- Comentário explicativo
COMMENT ON TABLE public.movimentos_financeiros IS 'Motor de Entrada Unificada (MEU) - consolida movimentações REAIS de caixa. Vendas de marketplace não entram aqui (ficam em marketplace_transactions para DRE/Vendas).';