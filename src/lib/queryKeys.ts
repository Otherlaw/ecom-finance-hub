/**
 * Query Keys centralizadas para React Query
 * 
 * Evita inconsistências de cache causadas por chaves diferentes
 * referenciando o mesmo dado.
 */

// ============= FLUXO DE CAIXA =============
/**
 * Prefixo para invalidação parcial de fluxo de caixa.
 * Use com queryClient.invalidateQueries({ queryKey: FLUXO_CAIXA_KEY_PREFIX })
 * para invalidar TODAS as queries de fluxo de caixa independente dos parâmetros.
 */
export const FLUXO_CAIXA_KEY_PREFIX = ["fluxo-caixa-meu"] as const;

/**
 * Gera a queryKey completa para fluxo de caixa com parâmetros.
 * Use em useQuery para buscar dados específicos.
 */
export function fluxoCaixaKey(
  periodoInicio?: string,
  periodoFim?: string,
  empresaId?: string
) {
  return ["fluxo-caixa-meu", periodoInicio, periodoFim, empresaId] as const;
}

// ============= MOVIMENTOS FINANCEIROS =============
export const MOVIMENTOS_FINANCEIROS_KEY_PREFIX = ["movimentos_financeiros"] as const;

// ============= DRE =============
export const DRE_KEY_PREFIX = ["dre"] as const;
export const DRE_DATA_KEY_PREFIX = ["dre_data"] as const;
export const DRE_MOVIMENTOS_MEU_KEY_PREFIX = ["dre-movimentos-meu"] as const;
