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

export function useBalancoPatrimonial(empresaId?: string, mes?: number, ano?: number) {
  // Hook de patrimônio para dados de bens e PL
  const patrimonio = usePatrimonio(empresaId);

  // Calcular data de referência (último dia do mês selecionado)
  const dataReferencia = mes && ano
    ? new Date(ano, mes, 0).toISOString().split("T")[0] // último dia do mês
    : new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: ["balanco-patrimonial", empresaId, mes, ano],
    queryFn: async (): Promise<DadosBalanco> => {
      // ===== ATIVO CIRCULANTE =====

      // Buscar dados de estoque (quantidade * custo_medio) - filtrado por empresa
      let estoqueQuery = supabase
        .from("estoque")
        .select("quantidade, custo_medio");
      
      if (empresaId) {
        estoqueQuery = estoqueQuery.eq("empresa_id", empresaId);
      }
      
      const { data: estoqueData } = await estoqueQuery;
      
      const valorEstoque = (estoqueData || []).reduce((acc, item) => {
        return acc + (item.quantidade || 0) * (item.custo_medio || 0);
      }, 0);

      // Buscar contas a receber pendentes até a data de referência
      let contasReceberQuery = supabase
        .from("contas_a_receber")
        .select("valor_em_aberto")
        .in("status", ["em_aberto", "parcialmente_recebido"])
        .lte("data_emissao", dataReferencia);
      
      if (empresaId) {
        contasReceberQuery = contasReceberQuery.eq("empresa_id", empresaId);
      }
      
      const { data: contasReceber } = await contasReceberQuery;
      
      const valorContasReceber = (contasReceber || []).reduce((acc, item) => {
        return acc + (item.valor_em_aberto || 0);
      }, 0);

      // Buscar créditos de ICMS ativos até a data de referência
      let creditosIcmsQuery = supabase
        .from("creditos_icms")
        .select("valor_credito")
        .eq("status_credito", "ativo")
        .lte("data_lancamento", dataReferencia);
      
      if (empresaId) {
        creditosIcmsQuery = creditosIcmsQuery.eq("empresa_id", empresaId);
      }
      
      const { data: creditosIcms } = await creditosIcmsQuery;
      
      const valorCreditoIcms = (creditosIcms || []).reduce((acc, item) => {
        return acc + (item.valor_credito || 0);
      }, 0);

      // ===== PASSIVO CIRCULANTE =====

      // Buscar contas a pagar pendentes (fornecedores) até a data de referência
      let contasPagarQuery = supabase
        .from("contas_a_pagar")
        .select("valor_em_aberto")
        .in("status", ["em_aberto", "parcialmente_pago"])
        .lte("data_emissao", dataReferencia);
      
      if (empresaId) {
        contasPagarQuery = contasPagarQuery.eq("empresa_id", empresaId);
      }
      
      const { data: contasPagar } = await contasPagarQuery;
      
      const valorContasPagar = (contasPagar || []).reduce((acc, item) => {
        return acc + (item.valor_em_aberto || 0);
      }, 0);

      // ===== CAIXA (Movimentos Financeiros) até a data de referência =====

      let movimentosQuery = supabase
        .from("movimentos_financeiros")
        .select("tipo, valor")
        .lte("data", dataReferencia);
      
      if (empresaId) {
        movimentosQuery = movimentosQuery.eq("empresa_id", empresaId);
      }
      
      const { data: movimentos } = await movimentosQuery;
      
      const saldoCaixa = (movimentos || []).reduce((acc, mov) => {
        if (mov.tipo === "entrada") {
          return acc + (mov.valor || 0);
        } else {
          return acc - (mov.valor || 0);
        }
      }, 0);

      // ===== BENS PATRIMONIAIS (filtrados por data de aquisição) =====
      const bens = patrimonio.bens.filter(b => b.ativo && b.data_aquisicao <= dataReferencia);
      
      const totalInvestimentos = bens
        .filter(b => b.tipo === "investimento")
        .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

      const totalImobilizado = bens
        .filter(b => b.tipo === "imobilizado")
        .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

      const totalIntangivel = bens
        .filter(b => b.tipo === "intangivel")
        .reduce((acc, b) => acc + (b.valor_aquisicao - (b.depreciacao_acumulada || 0)), 0);

      // ===== PATRIMÔNIO LÍQUIDO (filtrado por data) =====
      const movimentosPL = patrimonio.movimentosPL.filter(m => m.data_referencia <= dataReferencia);
      
      const capitalSocial = movimentosPL
        .filter(m => m.grupo_pl === "capital_social")
        .reduce((acc, m) => acc + m.valor, 0);

      const reservas = movimentosPL
        .filter(m => m.grupo_pl === "reservas")
        .reduce((acc, m) => acc + m.valor, 0);

      const lucrosAcumulados = movimentosPL
        .filter(m => m.grupo_pl === "lucros_acumulados")
        .reduce((acc, m) => acc + m.valor, 0);

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
            investimentos: totalInvestimentos,
            imobilizado: totalImobilizado,
            intangivel: totalIntangivel,
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
          capitalSocial,
          reservas,
          lucrosAcumulados,
        },
      };
    },
    enabled: !!empresaId && !patrimonio.isLoading,
  });
}
