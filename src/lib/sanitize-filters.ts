/**
 * Helper para sanitizar filtros de vendas antes de enviar para a RPC.
 * Garante que filtros vazios/undefined/array vazio nunca sejam aplicados.
 * 
 * Regras:
 * - Strings: aplicar apenas se trim(value).length > 0
 * - Selects: aplicar apenas se value != null && value != "" && value != "todos"
 * - Arrays: aplicar apenas se Array.isArray(value) && value.length > 0
 * - Numeros: aplicar apenas se value != null (0 e valido)
 * - Range numerico: aplicar gte/lte apenas se limite existir
 */

/**
 * Sanitiza string: retorna null se vazia ou undefined
 */
export function sanitizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Sanitiza valor de select: retorna null se vazio, undefined ou "todos"
 */
export function sanitizeSelect(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "todos" || trimmed === "todas") return null;
  return trimmed;
}

/**
 * Sanitiza array: retorna null se vazio ou nao for array
 */
export function sanitizeArray<T>(value: T[] | null | undefined): T[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value;
}

/**
 * Sanitiza numero: retorna null se undefined ou nao for numero
 * Importante: 0 e considerado valido
 */
export function sanitizeNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || isNaN(value)) return null;
  return value;
}

/**
 * Sanitiza busca: retorna null se menor que 2 caracteres
 */
export function sanitizeBusca(value: string | null | undefined, minLength = 2): string | null {
  const sanitized = sanitizeString(value);
  if (sanitized === null) return null;
  return sanitized.length >= minLength ? sanitized : null;
}

/**
 * Interface para filtros de vendas
 */
export interface SalesFilters {
  canal?: string | null;
  conta?: string | null;
  statusVenda?: string | null;
  busca?: string | null;
  tipoEnvio?: string | null;
  temCusto?: string | null;
  pedidoId?: string | null;
  sku?: string | null;
}

/**
 * Interface para parametros de RPC sanitizados
 */
export interface SanitizedRpcParams {
  p_canal: string | null;
  p_conta: string | null;
  p_status: string | null;
  p_busca: string | null;
  p_tipo_envio: string | null;
  p_tem_custo: string | null;
}

/**
 * Sanitiza todos os filtros de vendas e retorna parametros prontos para RPC
 */
export function sanitizeSalesFilters(filters: SalesFilters): SanitizedRpcParams {
  const sanitized: SanitizedRpcParams = {
    p_canal: sanitizeSelect(filters.canal),
    p_conta: sanitizeString(filters.conta),
    p_status: sanitizeSelect(filters.statusVenda),
    p_busca: sanitizeBusca(filters.busca),
    p_tipo_envio: sanitizeSelect(filters.tipoEnvio),
    p_tem_custo: sanitizeSelect(filters.temCusto),
  };

  // Log para debug: mostrar quais filtros foram efetivamente aplicados
  const filtrosAtivos = Object.entries(sanitized)
    .filter(([_, v]) => v !== null)
    .map(([k]) => k);

  if (filtrosAtivos.length > 0) {
    console.debug("[Vendas] Filtros ativos:", filtrosAtivos, sanitized);
  }

  return sanitized;
}

/**
 * Valida e garante que periodo tem valores validos
 * Retorna periodo padrao (ultimos 7 dias) se valores invalidos
 */
export function ensureValidPeriod(
  inicio: string | null | undefined,
  fim: string | null | undefined
): { periodoInicio: string; periodoFim: string } {
  const isValidDate = (d: string | null | undefined): boolean => {
    if (!d) return false;
    const trimmed = d.trim();
    // Formato YYYY-MM-DD
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  };

  if (isValidDate(inicio) && isValidDate(fim)) {
    return {
      periodoInicio: inicio!.trim(),
      periodoFim: fim!.trim(),
    };
  }

  // Fallback: ultimos 7 dias
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje);
  seteDiasAtras.setDate(hoje.getDate() - 6);

  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  console.warn("[Vendas] Periodo invalido, usando ultimos 7 dias:", {
    recebido: { inicio, fim },
    padrao: { inicio: formatDate(seteDiasAtras), fim: formatDate(hoje) },
  });

  return {
    periodoInicio: formatDate(seteDiasAtras),
    periodoFim: formatDate(hoje),
  };
}
