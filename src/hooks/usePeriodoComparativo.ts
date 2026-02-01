import { useMemo } from "react";
import { differenceInDays, subDays, format } from "date-fns";

/**
 * Representa a variação entre dois períodos
 */
export interface VariacaoPeriodo {
  valor: number;           // Valor absoluto do período atual
  valorAnterior: number;   // Valor absoluto do período anterior
  variacao: number;        // Diferença absoluta (atual - anterior)
  variacaoPct: number;     // Variação percentual
  trend: "up" | "down" | "neutral";
}

/**
 * Calcula as datas do período anterior baseado no período atual
 * Por exemplo: se período atual é 7 dias, período anterior são os 7 dias antes disso
 */
export function calcularPeriodoAnterior(
  periodoInicio: string | Date,
  periodoFim: string | Date
): { inicioAnterior: string; fimAnterior: string } {
  const inicio = typeof periodoInicio === "string" ? new Date(periodoInicio) : periodoInicio;
  const fim = typeof periodoFim === "string" ? new Date(periodoFim) : periodoFim;
  
  // Calcula quantos dias tem o período atual
  const diasPeriodo = differenceInDays(fim, inicio) + 1;
  
  // Período anterior termina 1 dia antes do início do período atual
  const fimAnterior = subDays(inicio, 1);
  // Período anterior tem a mesma duração
  const inicioAnterior = subDays(fimAnterior, diasPeriodo - 1);
  
  return {
    inicioAnterior: format(inicioAnterior, "yyyy-MM-dd"),
    fimAnterior: format(fimAnterior, "yyyy-MM-dd"),
  };
}

/**
 * Calcula a variação entre dois valores
 */
export function calcularVariacao(
  valorAtual: number,
  valorAnterior: number,
  inverterTrend = false // Para métricas onde menor é melhor (ex: despesas)
): VariacaoPeriodo {
  const variacao = valorAtual - valorAnterior;
  const variacaoPct = valorAnterior !== 0 
    ? ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100 
    : valorAtual > 0 ? 100 : 0;
  
  let trend: "up" | "down" | "neutral" = "neutral";
  if (Math.abs(variacaoPct) > 0.1) {
    if (inverterTrend) {
      trend = variacao < 0 ? "up" : "down"; // Menos despesa é bom
    } else {
      trend = variacao > 0 ? "up" : "down"; // Mais receita é bom
    }
  }
  
  return {
    valor: valorAtual,
    valorAnterior,
    variacao,
    variacaoPct,
    trend,
  };
}

/**
 * Hook para calcular período anterior baseado no período atual
 */
export function usePeriodoAnterior(periodoInicio: string, periodoFim: string) {
  return useMemo(() => {
    return calcularPeriodoAnterior(periodoInicio, periodoFim);
  }, [periodoInicio, periodoFim]);
}

/**
 * Formata a label do período anterior
 */
export function formatarLabelPeriodoAnterior(periodoInicio: string, periodoFim: string): string {
  const { inicioAnterior, fimAnterior } = calcularPeriodoAnterior(periodoInicio, periodoFim);
  const inicio = new Date(inicioAnterior);
  const fim = new Date(fimAnterior);
  const dias = differenceInDays(fim, inicio) + 1;
  
  if (dias === 1) return "vs dia anterior";
  if (dias === 7) return "vs 7 dias anteriores";
  if (dias >= 28 && dias <= 31) return "vs mês anterior";
  return `vs ${dias} dias anteriores`;
}
