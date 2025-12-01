import { supabase } from "@/integrations/supabase/client";

export const MOCK_CARD_DATA = {
  nome: "Cartão Corporativo Exchange (Mock)",
  instituicao_financeira: "Banco Fictício 999",
  ultimos_digitos: "9999",
  tipo: "credito" as const,
  limite_credito: 999999.99,
  dia_fechamento: 25,
  dia_vencimento: 5,
  observacoes: "Cartão fictício para testes de importação OFX",
  ativo: true,
};

export async function ensureMockCardExists(empresaId?: string) {
  try {
    // Verificar se existe algum cartão cadastrado
    const { data: existingCards, error: fetchError } = await supabase
      .from("credit_cards")
      .select("id")
      .limit(1);

    if (fetchError) {
      console.error("Erro ao verificar cartões:", fetchError);
      return null;
    }

    // Se já existe algum cartão, não criar o mock
    if (existingCards && existingCards.length > 0) {
      return null;
    }

    // Buscar primeira empresa ativa se não foi fornecida
    let targetEmpresaId = empresaId;
    if (!targetEmpresaId) {
      const { data: empresas, error: empresasError } = await supabase
        .from("empresas")
        .select("id")
        .eq("ativo", true)
        .limit(1)
        .single();

      if (empresasError || !empresas) {
        console.error("Nenhuma empresa ativa encontrada para criar cartão mock");
        return null;
      }
      targetEmpresaId = empresas.id;
    }

    // Criar cartão mock
    const { data: mockCard, error: insertError } = await supabase
      .from("credit_cards")
      .insert({
        ...MOCK_CARD_DATA,
        empresa_id: targetEmpresaId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar cartão mock:", insertError);
      return null;
    }

    console.log("Cartão mock criado com sucesso:", mockCard.id);
    return mockCard;
  } catch (error) {
    console.error("Erro ao garantir cartão mock:", error);
    return null;
  }
}

export async function updateMockInvoice(mockCardId: string) {
  try {
    // Buscar fatura de maio/2024 sem cartão vinculado
    const { data: invoices, error: fetchError } = await supabase
      .from("credit_card_invoices")
      .select("id")
      .eq("mes_referencia", "2024-05-01")
      .is("credit_card_id", null)
      .limit(1);

    if (fetchError || !invoices || invoices.length === 0) {
      return null;
    }

    // Atualizar fatura para vincular ao cartão mock
    const { error: updateError } = await supabase
      .from("credit_card_invoices")
      .update({ credit_card_id: mockCardId })
      .eq("id", invoices[0].id);

    if (updateError) {
      console.error("Erro ao vincular fatura mock:", updateError);
      return null;
    }

    console.log("Fatura mock vinculada ao cartão:", mockCardId);
    return invoices[0];
  } catch (error) {
    console.error("Erro ao atualizar fatura mock:", error);
    return null;
  }
}
