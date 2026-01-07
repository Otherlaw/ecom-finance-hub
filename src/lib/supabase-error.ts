/**
 * Helper para tratamento de erros do Supabase/RLS
 * Centraliza a detecção e mensagens amigáveis para erros de permissão
 */

/**
 * Detecta se o erro é relacionado a Row Level Security
 */
export function isRlsError(error: any): boolean {
  if (!error) return false;
  
  const message = (error?.message || error?.error_description || "").toLowerCase();
  const code = error?.code;
  
  return (
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("new row violates row-level security policy") ||
    code === "42501"
  );
}

/**
 * Retorna uma mensagem amigável para o usuário
 * @param error Erro do Supabase
 * @param contexto Descrição da ação que estava sendo executada
 */
export function getFriendlyErrorMessage(error: any, contexto?: string): string {
  if (isRlsError(error)) {
    return "Sem permissão para executar esta ação. Peça para um administrador vincular seu usuário à empresa e liberar seu perfil (ex: Financeiro).";
  }
  
  // Extrair mensagem do erro
  const mensagemOriginal = 
    error?.message || 
    error?.error_description || 
    (typeof error === "string" ? error : null);
  
  if (mensagemOriginal) {
    return mensagemOriginal;
  }
  
  // Fallback
  return contexto 
    ? `Erro ao ${contexto}` 
    : "Ocorreu um erro inesperado";
}
