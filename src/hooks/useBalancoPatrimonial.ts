import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DadosBalanco {
  ativo: {
    circulante: {
      caixa: number;
      estoque: number;
      contasReceber: number;
      creditoIcms: number;
      creditosRecuperar: number;
    };
    naoCirculante: {
      investimentos: number;
      imobilizado: number;
    };
  };
  passivo: {
    circulante: {
      fornecedores: number;
      obrigacoesFiscais: number;
      obrigacoesTrabalhistas: number;
      contasPagar: number;
    };
    naoCirculante: {
      emprestimosLP: number;
    };
  };
  patrimonioLiquido: {
    capitalSocial: number;
    reservas: number;
    lucrosAcumulados: number;
  };
}

export function useBalancoPatrimonial(dataReferencia?: string) {
  return useQuery({
    queryKey: ["balanco-patrimonial", dataReferencia],
    queryFn: async (): Promise<DadosBalanco> => {
      // Buscar dados de estoque (quantidade * custo_medio)
      const { data: estoqueData } = await supabase
        .from("estoque")
        .select("quantidade, custo_medio");
      
      const valorEstoque = (estoqueData || []).reduce((acc, item) => {
        return acc + (item.quantidade || 0) * (item.custo_medio || 0);
      }, 0);

      // Buscar contas a receber pendentes
      const { data: contasReceber } = await supabase
        .from("contas_a_receber")
        .select("valor_em_aberto")
        .in("status", ["em_aberto", "parcialmente_recebido"]);
      
      const valorContasReceber = (contasReceber || []).reduce((acc, item) => {
        return acc + (item.valor_em_aberto || 0);
      }, 0);

      // Buscar créditos de ICMS ativos
      const { data: creditosIcms } = await supabase
        .from("creditos_icms")
        .select("valor_credito")
        .eq("status_credito", "ativo");
      
      const valorCreditoIcms = (creditosIcms || []).reduce((acc, item) => {
        return acc + (item.valor_credito || 0);
      }, 0);

      // Buscar contas a pagar pendentes (fornecedores)
      const { data: contasPagar } = await supabase
        .from("contas_a_pagar")
        .select("valor_em_aberto, tipo_lancamento")
        .in("status", ["em_aberto", "parcialmente_pago"]);
      
      const valorContasPagar = (contasPagar || []).reduce((acc, item) => {
        return acc + (item.valor_em_aberto || 0);
      }, 0);

      // Buscar saldo de movimentos financeiros para caixa
      const { data: movimentos } = await supabase
        .from("movimentos_financeiros")
        .select("tipo, valor");
      
      const saldoCaixa = (movimentos || []).reduce((acc, mov) => {
        if (mov.tipo === "entrada") {
          return acc + (mov.valor || 0);
        } else {
          return acc - (mov.valor || 0);
        }
      }, 0);

      // Valores que precisam ser configurados manualmente (por enquanto zerados ou valores padrão)
      // Esses campos podem ser adicionados no cadastro de empresas futuramente
      const capitalSocial = 50000; // Valor padrão - pode ser configurado
      const reservas = 0;
      const investimentos = 0;
      const imobilizado = 0;
      const obrigacoesFiscais = 0;
      const obrigacoesTrabalhistas = 0;

      // Calcular lucros acumulados (simplificado: ativos - passivos - capital)
      const totalAtivos = Math.max(0, saldoCaixa) + valorEstoque + valorContasReceber + valorCreditoIcms + investimentos + imobilizado;
      const totalPassivos = valorContasPagar + obrigacoesFiscais + obrigacoesTrabalhistas;
      const lucrosAcumulados = totalAtivos - totalPassivos - capitalSocial - reservas;

      return {
        ativo: {
          circulante: {
            caixa: Math.max(0, saldoCaixa),
            estoque: valorEstoque,
            contasReceber: valorContasReceber,
            creditoIcms: valorCreditoIcms,
            creditosRecuperar: 0,
          },
          naoCirculante: {
            investimentos,
            imobilizado,
          },
        },
        passivo: {
          circulante: {
            fornecedores: valorContasPagar,
            obrigacoesFiscais,
            obrigacoesTrabalhistas,
            contasPagar: 0, // Já incluso em fornecedores
          },
          naoCirculante: {
            emprestimosLP: 0,
          },
        },
        patrimonioLiquido: {
          capitalSocial,
          reservas,
          lucrosAcumulados: Math.max(0, lucrosAcumulados),
        },
      };
    },
  });
}
