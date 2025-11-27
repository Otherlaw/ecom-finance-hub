// Sistema de Validação do ECOM FINANCE
// Regras de negócio e validações para garantir integridade dos dados

import { formatCurrency } from "./mock-data";

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ImportValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  duplicates: DuplicateEntry[];
  summary: ImportSummary;
}

export interface DuplicateEntry {
  hash: string;
  data: string;
  descricao: string;
  valor: number;
  origem: string;
  count: number;
}

export interface ImportSummary {
  totalRecords: number;
  validRecords: number;
  duplicateRecords: number;
  invalidRecords: number;
  tinyRecordsExcluded: number;
}

// Gerar hash único para detectar duplicidade
export const generateHash = (data: string, descricao: string, valor: number, origem: string): string => {
  const normalized = `${data.trim()}|${descricao.trim().toLowerCase()}|${valor.toFixed(2)}|${origem.trim().toLowerCase()}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

// REGRA CRÍTICA: Verificar se dado é do Tiny
export const isTinySource = (origem: string | undefined): boolean => {
  if (!origem) return false;
  const normalized = origem.toLowerCase().trim();
  return normalized === 'tiny' || 
         normalized === 'caixa tiny' || 
         normalized.includes('tiny');
};

// Validar se dado pode ser classificado como receita
export const canBeRevenue = (origem: string): boolean => {
  // Tiny NUNCA pode ser receita
  if (isTinySource(origem)) {
    return false;
  }
  
  const validRevenueSources = [
    'mercado livre',
    'shopee',
    'shein',
    'tiktok shop',
    'amazon',
    'marketplace',
    'venda direta'
  ];
  
  const normalized = origem.toLowerCase().trim();
  return validRevenueSources.some(source => normalized.includes(source));
};

// Validar dados de importação
export const validateImportData = (records: Array<{
  data: string;
  descricao: string;
  valor: number;
  origem: string;
  tipo: string;
}>): ImportValidation => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const duplicates: DuplicateEntry[] = [];
  const hashMap = new Map<string, { count: number; entry: typeof records[0] }>();

  let validRecords = 0;
  let duplicateRecords = 0;
  let invalidRecords = 0;
  let tinyRecordsExcluded = 0;

  records.forEach((record, index) => {
    const hash = generateHash(record.data, record.descricao, record.valor, record.origem);

    // Verificar duplicidade
    if (hashMap.has(hash)) {
      const existing = hashMap.get(hash)!;
      existing.count++;
      duplicateRecords++;
      
      if (existing.count === 2) {
        duplicates.push({
          hash,
          data: record.data,
          descricao: record.descricao,
          valor: record.valor,
          origem: record.origem,
          count: existing.count
        });
      }
    } else {
      hashMap.set(hash, { count: 1, entry: record });
    }

    // REGRA CRÍTICA: Tiny classificado como receita é ERRO
    if (isTinySource(record.origem) && record.tipo === 'receita') {
      errors.push({
        field: `registro_${index}`,
        message: `ERRO CRÍTICO: Registro "${record.descricao}" do Caixa Tiny está classificado como receita. Tiny NUNCA é receita.`,
        severity: 'error'
      });
      tinyRecordsExcluded++;
      invalidRecords++;
      return;
    }

    // Validar valor
    if (record.valor <= 0 && record.tipo === 'receita') {
      warnings.push({
        field: `registro_${index}`,
        message: `Receita com valor zero ou negativo: ${record.descricao}`,
        severity: 'warning'
      });
    }

    // Validar data
    if (!record.data || record.data.length < 8) {
      errors.push({
        field: `registro_${index}`,
        message: `Data inválida no registro: ${record.descricao}`,
        severity: 'error'
      });
      invalidRecords++;
      return;
    }

    validRecords++;
  });

  // Adicionar duplicatas ao warnings
  duplicates.forEach(dup => {
    warnings.push({
      field: 'duplicidade',
      message: `Registro duplicado detectado: ${dup.descricao} - ${formatCurrency(dup.valor)} (${dup.count}x)`,
      severity: 'warning'
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    duplicates,
    summary: {
      totalRecords: records.length,
      validRecords,
      duplicateRecords,
      invalidRecords,
      tinyRecordsExcluded
    }
  };
};

// Validar fechamento mensal completo
export const validateFechamentoMensal = (data: {
  receitaBruta: number;
  receitaLiquida: number;
  deducoes: number;
  lucroBruto: number;
  custos: number;
  despesas: number;
  lucroLiquido: number;
  tinyValuesAsRevenue?: number;
}): ImportValidation => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // REGRA 1: Tiny como receita é ERRO CRÍTICO
  if (data.tinyValuesAsRevenue && data.tinyValuesAsRevenue > 0) {
    errors.push({
      field: 'tiny_como_receita',
      message: `ERRO CRÍTICO: ${formatCurrency(data.tinyValuesAsRevenue)} do Caixa Tiny foi incluído como receita. Isso é PROIBIDO.`,
      severity: 'error'
    });
  }

  // REGRA 2: Validar cálculo de receita líquida
  const expectedReceitaLiquida = data.receitaBruta - data.deducoes;
  const diffReceita = Math.abs(expectedReceitaLiquida - data.receitaLiquida);
  if (diffReceita > 0.01) {
    errors.push({
      field: 'receita_liquida',
      message: `Divergência: Receita Líquida esperada ${formatCurrency(expectedReceitaLiquida)}, encontrado ${formatCurrency(data.receitaLiquida)}`,
      severity: 'error'
    });
  }

  // REGRA 3: Validar cálculo de lucro bruto
  const expectedLucroBruto = data.receitaLiquida - data.custos;
  const diffLucro = Math.abs(expectedLucroBruto - data.lucroBruto);
  if (diffLucro > 0.01) {
    warnings.push({
      field: 'lucro_bruto',
      message: `Atenção: Lucro Bruto esperado ${formatCurrency(expectedLucroBruto)}, encontrado ${formatCurrency(data.lucroBruto)}`,
      severity: 'warning'
    });
  }

  // REGRA 4: Validar cálculo de lucro líquido
  const expectedLucroLiquido = data.lucroBruto - data.despesas;
  const diffLucroLiq = Math.abs(expectedLucroLiquido - data.lucroLiquido);
  if (diffLucroLiq > 0.01) {
    warnings.push({
      field: 'lucro_liquido',
      message: `Atenção: Lucro Líquido esperado ${formatCurrency(expectedLucroLiquido)}, encontrado ${formatCurrency(data.lucroLiquido)}`,
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    duplicates: [],
    summary: {
      totalRecords: 1,
      validRecords: errors.length === 0 ? 1 : 0,
      duplicateRecords: 0,
      invalidRecords: errors.length > 0 ? 1 : 0,
      tinyRecordsExcluded: data.tinyValuesAsRevenue ? 1 : 0
    }
  };
};

// Mapeamento de abas da planilha
export const SPREADSHEET_TAB_MAPPING: Record<string, {
  target: string;
  description: string;
  requiredColumns: string[];
}> = {
  'DRE': {
    target: 'dre',
    description: 'Demonstração do Resultado do Exercício',
    requiredColumns: ['Descrição', 'Valor']
  },
  'CONSOLIDADO': {
    target: 'consolidado',
    description: 'Receitas, deduções, marketplace e custos',
    requiredColumns: ['Mês', 'Operação', 'Receita Bruta', 'Deduções']
  },
  'CREDITO': {
    target: 'icms',
    description: 'Créditos de ICMS',
    requiredColumns: ['NCM', 'Valor', 'Alíquota']
  },
  'FECHAMENTO EXCHANGE': {
    target: 'fechamento_exchange',
    description: 'Mercado Livre, Shopee, Shein',
    requiredColumns: ['Canal', 'Receita', 'Taxas']
  },
  'RESUMO DE NOTAS': {
    target: 'notas_fiscais',
    description: 'Entradas fiscais',
    requiredColumns: ['Número NF', 'Valor', 'CFOP']
  },
  'LANÇAMENTOS EXCHANGE': {
    target: 'lancamentos',
    description: 'Lançamentos detalhados por item',
    requiredColumns: ['Data', 'Descrição', 'Valor']
  }
};

// Categorias válidas para dados do Tiny
export const TINY_VALID_CATEGORIES = [
  'Contas a Pagar',
  'Contas Pagas',
  'Movimentação Bancária',
  'Despesa Operacional',
  'Pagamento Fornecedor',
  'Transferência',
  'Ajuste de Caixa'
];

// Categorias que NUNCA podem receber dados do Tiny
export const TINY_FORBIDDEN_CATEGORIES = [
  'Receita',
  'Receita Bruta',
  'Vendas',
  'Faturamento',
  'Receita de Marketplace',
  'Receita Líquida'
];
