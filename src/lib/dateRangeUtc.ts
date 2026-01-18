/**
 * Helper para conversão de date range para formato UTC consistente.
 * Resolve o problema de fuso horário onde "Hoje" pegava parte de ontem.
 * 
 * Uso:
 * const { startUtcIso, endUtcIsoExclusive } = buildUtcRange({ from, to });
 * // startUtcIso = início do dia (00:00:00) em UTC
 * // endUtcIsoExclusive = início do dia seguinte ao "to" (exclusivo)
 */

import { startOfDay, addDays } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface UtcRange {
  startUtcIso: string;
  endUtcIsoExclusive: string;
}

/**
 * Converte um DateRange local para timestamps UTC formatados como ISO strings.
 * 
 * @param dateRange - Objeto com datas 'from' e 'to' no horário local
 * @returns Objeto com strings ISO para início (inclusivo) e fim (exclusivo)
 * 
 * Exemplo:
 * - Input: { from: 2026-01-18 (local), to: 2026-01-18 (local) }
 * - Output: { 
 *     startUtcIso: "2026-01-18T03:00:00.000Z" (meia-noite BR em UTC),
 *     endUtcIsoExclusive: "2026-01-19T03:00:00.000Z" 
 *   }
 */
export function buildUtcRange(dateRange: DateRange): UtcRange {
  // startOfDay pega o início do dia no fuso local
  const localStart = startOfDay(dateRange.from);
  const localEnd = startOfDay(addDays(dateRange.to, 1));
  
  // toISOString converte para UTC automaticamente
  // Ex: 2026-01-18 00:00:00 BRT (UTC-3) → 2026-01-18T03:00:00.000Z
  return {
    startUtcIso: localStart.toISOString(),
    endUtcIsoExclusive: localEnd.toISOString(),
  };
}

/**
 * Converte strings de data (YYYY-MM-DD) para timestamps UTC.
 * Útil quando as datas já vêm como strings do PeriodFilter.
 */
export function buildUtcRangeFromStrings(startDate: string, endDate: string): UtcRange {
  // Criar datas interpretando como local (não UTC)
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  
  const localStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
  const localEnd = new Date(endYear, endMonth - 1, endDay + 1, 0, 0, 0, 0);
  
  return {
    startUtcIso: localStart.toISOString(),
    endUtcIsoExclusive: localEnd.toISOString(),
  };
}
