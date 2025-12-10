import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePatrimonio } from "./usePatrimonio";

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
      intangivel: number;
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

export function useBalancoPatrimonial(empresaId?: string) {
  // Hook de patrimônio para dados de bens e PL
  const patrimonio = usePatrimonio(empresaId);

  return useQuery({
    queryKey: ["balanco-patrimonial", empresaId],
    queryFn: async (): Promise<DadosBalanco> => {
      // ===== ATIVO CIRCULANTE =====

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

      // ===== PASSIVO CIRCULANTE =====

      // Buscar contas a pagar pendentes (fornecedores)
      const { data: contasPagar } = await supabase
        .from("contas_a_pagar")
        .select("valor_em_aberto")
        .in("status", ["em_aberto", "parcialmente_pago"]);
      
      const valorContasPagar = (contasPagar || []).reduce((acc, item) => {
        return acc + (item.valor_em_aberto || 0);
      }, 0);

      // ===== CAIXA (Movimentos Financeiros) =====

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

      // ===== BENS PATRIMONIAIS (do hook usePatrimonio) =====
      const totaisBens = patrimonio.calcularTotaisBens();

      // ===== PATRIMÔNIO LÍQUIDO (do hook usePatrimonio) =====
      const saldosPL = patrimonio.calcularSaldosPL();

      // Valores fixos (futuramente podem vir de configuração ou outras tabelas)
      const obrigacoesFiscais = 0;
      const obrigacoesTrabalhistas = 0;

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
            investimentos: totaisBens.totalInvestimentos,
            imobilizado: totaisBens.totalImobilizado,
            intangivel: totaisBens.totalIntangivel,
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
          capitalSocial: saldosPL.capitalSocial,
          reservas: saldosPL.reservas,
          lucrosAcumulados: saldosPL.lucrosAcumulados,
        },
      };
    },
    enabled: !patrimonio.isLoading, // Aguarda o hook de patrimônio carregar
  });
}
