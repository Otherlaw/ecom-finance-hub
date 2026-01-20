/**
 * Helpers centralizados para conversão de date range para formato UTC consistente.
 * 
 * PADRONIZAÇÃO UTC BRASIL (UTC-3):
 * - "Hoje" no Brasil (ex: 20/01 00:00 até 23:59 BRT) = 20/01 03:00 UTC até 21/01 02:59:59.999 UTC
 * - Todas as telas (Dashboard, Vendas, KPIs, Fluxo) devem usar estas funções
 * 
 * As RPCs do banco (get_dashboard_metrics, get_vendas_por_pedido, etc.) recebem
 * datas como strings DATE (YYYY-MM-DD) e convertem internamente com date_to_br_timestamptz.
 * 
 * Para queries diretas no frontend (ex: Top Produtos), usar buildUtcRangeFromStrings.
 */

import { startOfDay, addDays, format } from "date-fns";

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
 * Exemplo para Brasil (UTC-3):
 * - Input: { from: 2026-01-20 (local), to: 2026-01-20 (local) }
 * - Output: { 
 *     startUtcIso: "2026-01-20T03:00:00.000Z" (meia-noite BRT em UTC),
 *     endUtcIsoExclusive: "2026-01-21T03:00:00.000Z" (meia-noite do dia seguinte)
 *   }
 */
export function buildUtcRange(dateRange: DateRange): UtcRange {
  // startOfDay pega o início do dia no fuso local
  const localStart = startOfDay(dateRange.from);
  const localEnd = startOfDay(addDays(dateRange.to, 1));
  
  // toISOString converte para UTC automaticamente
  // Ex: 2026-01-20 00:00:00 BRT (UTC-3) → 2026-01-20T03:00:00.000Z
  return {
    startUtcIso: localStart.toISOString(),
    endUtcIsoExclusive: localEnd.toISOString(),
  };
}

/**
 * Converte strings de data (YYYY-MM-DD) para timestamps UTC no fuso Brasil (UTC-3).
 * 
 * IMPORTANTE: Esta é a função padrão para queries diretas no frontend.
 * Usa timezone fixo Brasil (UTC-3) para garantir consistência com as RPCs SQL.
 * 
 * A conversão segue a mesma lógica de date_to_br_timestamptz no banco:
 * - "2026-01-20" → "2026-01-20T03:00:00.000Z" (meia-noite BR = 03:00 UTC)
 * 
 * @param startDate - Data inicial no formato "YYYY-MM-DD"
 * @param endDate - Data final no formato "YYYY-MM-DD"
 * @returns Objeto com strings ISO para início (inclusivo) e fim (exclusivo)
 */
export function buildUtcRangeFromStrings(startDate: string, endDate: string): UtcRange {
  // Converter diretamente para UTC usando offset Brasil (-03:00)
  // Isso replica exatamente a lógica de date_to_br_timestamptz no SQL:
  // (p_date::TEXT || 'T00:00:00-03:00')::TIMESTAMPTZ
  
  // Início: meia-noite Brasil do dia inicial
  const startUtcIso = new Date(`${startDate}T00:00:00-03:00`).toISOString();
  
  // Fim exclusivo: meia-noite Brasil do dia seguinte ao final
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const nextDay = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1, 3, 0, 0, 0));
  const endUtcIsoExclusive = nextDay.toISOString();
  
  return {
    startUtcIso,
    endUtcIsoExclusive,
  };
}

/**
 * Converte um DateRange para strings DATE (YYYY-MM-DD).
 * Útil para passar para RPCs que esperam datas como strings.
 * 
 * @param dateRange - Objeto com datas 'from' e 'to'
 * @returns Objeto com strings de data no formato "YYYY-MM-DD"
 */
export function formatDateRangeForRpc(dateRange: DateRange): { periodoInicio: string; periodoFim: string } {
  return {
    periodoInicio: format(dateRange.from, "yyyy-MM-dd"),
    periodoFim: format(dateRange.to, "yyyy-MM-dd"),
  };
}
