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
    // K Inicial (Capital Inicial) - valor configurado na empresa
    capitalInicial: number;
    capitalSocial: number;
    reservas: number;
    lucrosAcumulados: number;
  };
}

export function useBalancoPatrimonial(empresaId?: string) {
  return useQuery({
    queryKey: ["balanco-patrimonial", empresaId],
    queryFn: async (): Promise<DadosBalanco> => {
      // Buscar capital_inicial da empresa (K Inicial)
      let capitalInicial = 0;
      if (empresaId) {
        const { data: empresaData } = await supabase
          .from("empresas")
          .select("capital_inicial")
          .eq("id", empresaId)
          .maybeSingle();
        capitalInicial = empresaData?.capital_inicial || 0;
      } else {
        // Se não tiver empresaId, buscar a primeira empresa do usuário
        const { data: empresas } = await supabase
          .from("empresas")
          .select("capital_inicial")
          .limit(1);
        capitalInicial = empresas?.[0]?.capital_inicial || 0;
      }

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

      // Valores configuráveis (futuramente podem vir da empresa também)
      const reservas = 0;
      const investimentos = 0;
      const imobilizado = 0;
      const obrigacoesFiscais = 0;
      const obrigacoesTrabalhistas = 0;

      // Calcular lucros acumulados
      // PL = K Inicial + Lucros Acumulados (simplificado)
      const totalAtivos = Math.max(0, saldoCaixa) + valorEstoque + valorContasReceber + valorCreditoIcms + investimentos + imobilizado;
      const totalPassivos = valorContasPagar + obrigacoesFiscais + obrigacoesTrabalhistas;
      const lucrosAcumulados = totalAtivos - totalPassivos - capitalInicial - reservas;

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
            contasPagar: 0,
          },
          naoCirculante: {
            emprestimosLP: 0,
          },
        },
        patrimonioLiquido: {
          capitalInicial, // K Inicial vindo da configuração da empresa
          capitalSocial: 0, // Mantido para compatibilidade (agora usamos capitalInicial)
          reservas,
          lucrosAcumulados,
        },
      };
    },
  });
}
