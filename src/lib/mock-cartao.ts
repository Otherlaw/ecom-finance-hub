import { supabase } from "@/integrations/supabase/client";

export const MOCK_EMPRESA_DATA = {
  razao_social: "Exchange E-commerce Mock Ltda.",
  nome_fantasia: "Exchange E-commerce (Mock)",
  cnpj: "99.999.999/0001-99",
  regime_tributario: "lucro_presumido",
  ativo: true,
};

export const MOCK_RESPONSAVEL_DATA = {
  nome: "Administrador Financeiro (Mock)",
  email: "admin.mock@ecomfinance.test",
  funcao: "Financeiro",
  ativo: true,
};

export const MOCK_CARD_DATA = {
  nome: "Cartão Corporativo Exchange (Mock)",
  instituicao_financeira: "Banco Fictício 999",
  ultimos_digitos: "9999",
  tipo: "credito" as const,
  limite_credito: 100000.00,
  dia_fechamento: 15,
  dia_vencimento: 20,
  observacoes: "Cartão de teste para importação OFX (mock).",
  ativo: true,
};

/**
 * Garante que existe pelo menos uma empresa padrão cadastrada
 */
export async function ensureDefaultEmpresa() {
  try {
    // Verificar se existe alguma empresa ativa
    const { data: existingEmpresas, error: fetchError } = await supabase
      .from("empresas")
      .select("id")
      .eq("ativo", true)
      .limit(1);

    if (fetchError) {
      console.error("Erro ao verificar empresas:", fetchError);
      return null;
    }

    // Se já existe empresa, retornar a primeira
    if (existingEmpresas && existingEmpresas.length > 0) {
      return existingEmpresas[0];
    }

    // Criar empresa mock
    const { data: mockEmpresa, error: insertError } = await supabase
      .from("empresas")
      .insert(MOCK_EMPRESA_DATA)
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar empresa mock:", insertError);
      return null;
    }

    console.log("Empresa mock criada com sucesso:", mockEmpresa.id);
    return mockEmpresa;
  } catch (error) {
    console.error("Erro ao garantir empresa padrão:", error);
    return null;
  }
}

/**
 * Garante que existe pelo menos um responsável padrão cadastrado
 */
export async function ensureDefaultResponsavel(empresaId?: string) {
  try {
    // Verificar se existe algum responsável ativo
    const { data: existingResponsaveis, error: fetchError } = await supabase
      .from("responsaveis")
      .select("id")
      .eq("ativo", true)
      .limit(1);

    if (fetchError) {
      console.error("Erro ao verificar responsáveis:", fetchError);
      return null;
    }

    // Se já existe responsável, retornar o primeiro
    if (existingResponsaveis && existingResponsaveis.length > 0) {
      return existingResponsaveis[0];
    }

    // Precisamos de uma empresa para criar o responsável
    let targetEmpresaId = empresaId;
    if (!targetEmpresaId) {
      const empresa = await ensureDefaultEmpresa();
      if (!empresa) {
        console.error("Não foi possível obter empresa para criar responsável");
        return null;
      }
      targetEmpresaId = empresa.id;
    }

    // Criar responsável mock com empresa_id obrigatório
    const { data: mockResponsavel, error: insertError } = await supabase
      .from("responsaveis")
      .insert({
        ...MOCK_RESPONSAVEL_DATA,
        empresa_id: targetEmpresaId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar responsável mock:", insertError);
      return null;
    }

    console.log("Responsável mock criado com sucesso:", mockResponsavel.id);
    return mockResponsavel;
  } catch (error) {
    console.error("Erro ao garantir responsável padrão:", error);
    return null;
  }
}

/**
 * Garante que existe empresa e responsável padrão
 * Retorna ambos para uso posterior
 */
export async function ensureDefaultCompanyAndUser() {
  const empresa = await ensureDefaultEmpresa();
  const responsavel = await ensureDefaultResponsavel();
  
  return { empresa, responsavel };
}

/**
 * Garante que existe pelo menos um cartão mock
 */
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

    // Garantir que existe empresa e responsável
    const { empresa, responsavel } = await ensureDefaultCompanyAndUser();
    
    if (!empresa) {
      console.error("Nenhuma empresa disponível para criar cartão mock");
      return null;
    }

    const targetEmpresaId = empresaId || empresa.id;

    // Criar cartão mock
    const { data: mockCard, error: insertError } = await supabase
      .from("credit_cards")
      .insert({
        ...MOCK_CARD_DATA,
        empresa_id: targetEmpresaId,
        responsavel_id: responsavel?.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao criar cartão mock:", insertError);
      return null;
    }

    console.log("Cartão mock criado com sucesso:", mockCard.id);
    
    // Tentar vincular fatura mock se existir
    await updateMockInvoice(mockCard.id);
    
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
