/**
 * Utilitários de validação e extração de CNPJ/CPF
 */

/**
 * Valida dígitos verificadores de um CNPJ (14 dígitos puros)
 */
export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  
  // Rejeitar CNPJs com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;
  
  const calcDigit = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  const d1 = calcDigit(digits, w1);
  if (d1 !== parseInt(digits[12])) return false;
  
  const d2 = calcDigit(digits, w2);
  if (d2 !== parseInt(digits[13])) return false;
  
  return true;
}

/**
 * Extrai todos os possíveis CNPJs de um texto usando regex,
 * valida cada um e retorna a lista de CNPJs válidos (somente dígitos).
 */
export function extrairCNPJsDeTexto(texto: string): string[] {
  if (!texto) return [];
  
  const encontrados = new Set<string>();
  
  // CNPJ com máscara: XX.XXX.XXX/XXXX-XX
  const regexMascara = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
  let match: RegExpExecArray | null;
  
  while ((match = regexMascara.exec(texto)) !== null) {
    const limpo = match[0].replace(/\D/g, '');
    if (validarCNPJ(limpo)) encontrados.add(limpo);
  }
  
  // CNPJ sem máscara: sequência de 14 dígitos
  const regexPuro = /(?<!\d)\d{14}(?!\d)/g;
  while ((match = regexPuro.exec(texto)) !== null) {
    if (validarCNPJ(match[0])) encontrados.add(match[0]);
  }
  
  return Array.from(encontrados);
}

/**
 * Formata CNPJ com máscara: XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
}
