import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface HistoricoMensal {
  mes: string;
  mesLabel: string;
  faturamento: number;
  despesas: number;
  lucro: number;
}

export interface CenarioProjecao {
  faturamento: number;
  lucroLiquido: number;
  margem: number;
}

export interface ProjecaoMensal {
  month: string;
  otimista: number;
  realista: number;
  pessimista: number;
}

export interface UseProjecoesDataReturn {
  isLoading: boolean;
  hasData: boolean;
  historico: HistoricoMensal[];
  cenarios: {
    otimista: CenarioProjecao;
    realista: CenarioProjecao;
    pessimista: CenarioProjecao;
  };
  projecaoFaturamento: ProjecaoMensal[];
  projecaoLucro: ProjecaoMensal[];
  mesesProjecao: number;
}

const FATORES = {
  otimista: { crescimento: 1.20, custoReducao: 0.90 },
  realista: { crescimento: 1.05, custoReducao: 1.0 },
  pessimista: { crescimento: 0.85, custoAumento: 1.05 },
};

export function useProjecoesData(mesesProjecao: number = 6): UseProjecoesDataReturn {
  const now = new Date();
  
  // Buscar últimos 6 meses de histórico
  const { data: movimentosHistorico, isLoading } = useQuery({
    queryKey: ["projecoes-historico"],
    queryFn: async () => {
      const dataInicio = format(startOfMonth(subMonths(now, 6)), "yyyy-MM-dd");
      const dataFim = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("movimentos_financeiros")
        .select("id, data, tipo, valor")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Agrupa por mês
  const historico = useMemo((): HistoricoMensal[] => {
    if (!movimentosHistorico || movimentosHistorico.length === 0) return [];

    const porMes: Record<string, { entradas: number; saidas: number }> = {};

    movimentosHistorico.forEach((m) => {
      const mes = format(new Date(m.data), "yyyy-MM");
      if (!porMes[mes]) porMes[mes] = { entradas: 0, saidas: 0 };
      if (m.tipo === "entrada") {
        porMes[mes].entradas += Number(m.valor);
      } else {
        porMes[mes].saidas += Number(m.valor);
      }
    });

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, valores]) => ({
        mes,
        mesLabel: format(new Date(mes + "-01"), "MMM/yy", { locale: ptBR }),
        faturamento: valores.entradas,
        despesas: valores.saidas,
        lucro: valores.entradas - valores.saidas,
      }));
  }, [movimentosHistorico]);

  // Calcula médias históricas
  const mediasHistoricas = useMemo(() => {
    if (historico.length === 0) {
      return { faturamento: 0, despesas: 0, lucro: 0 };
    }
    const totalFaturamento = historico.reduce((acc, h) => acc + h.faturamento, 0);
    const totalDespesas = historico.reduce((acc, h) => acc + h.despesas, 0);
    const totalLucro = historico.reduce((acc, h) => acc + h.lucro, 0);
    const count = historico.length;
    
    return {
      faturamento: totalFaturamento / count,
      despesas: totalDespesas / count,
      lucro: totalLucro / count,
    };
  }, [historico]);

  // Calcula cenários
  const cenarios = useMemo(() => {
    const { faturamento, despesas, lucro } = mediasHistoricas;

    const calcularMargem = (fat: number, luc: number) => 
      fat > 0 ? Number(((luc / fat) * 100).toFixed(1)) : 0;

    // Otimista: +20% faturamento, -10% custos
    const fatOtimista = faturamento * FATORES.otimista.crescimento;
    const despOtimista = despesas * FATORES.otimista.custoReducao;
    const lucroOtimista = fatOtimista - despOtimista;

    // Realista: +5% faturamento, custos estáveis
    const fatRealista = faturamento * FATORES.realista.crescimento;
    const despRealista = despesas * FATORES.realista.custoReducao;
    const lucroRealista = fatRealista - despRealista;

    // Pessimista: -15% faturamento, +5% custos
    const fatPessimista = faturamento * FATORES.pessimista.crescimento;
    const despPessimista = despesas * FATORES.pessimista.custoAumento;
    const lucroPessimista = fatPessimista - despPessimista;

    return {
      otimista: {
        faturamento: fatOtimista,
        lucroLiquido: lucroOtimista,
        margem: calcularMargem(fatOtimista, lucroOtimista),
      },
      realista: {
        faturamento: fatRealista,
        lucroLiquido: lucroRealista,
        margem: calcularMargem(fatRealista, lucroRealista),
      },
      pessimista: {
        faturamento: fatPessimista,
        lucroLiquido: lucroPessimista,
        margem: calcularMargem(fatPessimista, lucroPessimista),
      },
    };
  }, [mediasHistoricas]);

  // Projeções mensais para gráficos
  const projecaoFaturamento = useMemo((): ProjecaoMensal[] => {
    const { faturamento } = mediasHistoricas;
    const projecoes: ProjecaoMensal[] = [];

    for (let i = 0; i < mesesProjecao; i++) {
      const mesProjetado = addMonths(now, i);
      const label = format(mesProjetado, "MMM", { locale: ptBR });
      
      // Aplica crescimento progressivo
      const fatorMes = 1 + (i * 0.02); // Leve crescimento mês a mês
      
      projecoes.push({
        month: label,
        otimista: Math.round(faturamento * FATORES.otimista.crescimento * fatorMes),
        realista: Math.round(faturamento * FATORES.realista.crescimento * fatorMes),
        pessimista: Math.round(faturamento * FATORES.pessimista.crescimento * fatorMes),
      });
    }

    return projecoes;
  }, [mediasHistoricas, mesesProjecao]);

  const projecaoLucro = useMemo((): ProjecaoMensal[] => {
    const { faturamento, despesas } = mediasHistoricas;
    const projecoes: ProjecaoMensal[] = [];

    for (let i = 0; i < mesesProjecao; i++) {
      const mesProjetado = addMonths(now, i);
      const label = format(mesProjetado, "MMM", { locale: ptBR });
      
      const fatorMes = 1 + (i * 0.02);
      
      const fatOtimista = faturamento * FATORES.otimista.crescimento * fatorMes;
      const fatRealista = faturamento * FATORES.realista.crescimento * fatorMes;
      const fatPessimista = faturamento * FATORES.pessimista.crescimento * fatorMes;
      
      const despOtimista = despesas * FATORES.otimista.custoReducao;
      const despRealista = despesas * FATORES.realista.custoReducao;
      const despPessimista = despesas * FATORES.pessimista.custoAumento;
      
      projecoes.push({
        month: label,
        otimista: Math.round(fatOtimista - despOtimista),
        realista: Math.round(fatRealista - despRealista),
        pessimista: Math.round(fatPessimista - despPessimista),
      });
    }

    return projecoes;
  }, [mediasHistoricas, mesesProjecao]);

  const hasData = historico.length > 0;

  return {
    isLoading,
    hasData,
    historico,
    cenarios,
    projecaoFaturamento,
    projecaoLucro,
    mesesProjecao,
  };
}
