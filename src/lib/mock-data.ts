// Mock data baseado na planilha FECHAMENTO_CONSOLIDADO.xlsx
// Sistema ECOM Finance - Dados de demonstração

export interface MonthlyData {
  month: string;
  year: number;
  receitaBruta: number;
  devolucoes: number;
  descontosComerciais: number;
  impostosSobreVendas: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  despesas: number;
  ebitda: number;
  lucroLiquido: number;
}

export interface ChannelData {
  channel: string;
  color: string;
  receitaBruta: number;
  percentual: number;
  operation?: string;
}

export interface OperationData {
  operation: string;
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  detalhes: {
    mercadoLivre: number;
    shopee: number;
    shein: number;
    tikTok?: number;
  };
}

export interface FinancialMovement {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria: string;
  origem: string;
}

// Dados consolidados do DRE - Valores da Planilha Página 1
export const dreData: MonthlyData = {
  month: "Out",
  year: 2024,
  receitaBruta: 792653.62,
  devolucoes: 868.73,
  descontosComerciais: 90024.63,
  impostosSobreVendas: 40343.74,
  receitaLiquida: 663153.98,
  custos: 271893.86,
  lucroBruto: 391260.12,
  despesas: 438861.98,
  ebitda: -47601.86,
  lucroLiquido: -47601.86,
};

// Dados mensais históricos - Valores da Planilha CONSOLIDADO
export const monthlyHistory: MonthlyData[] = [
  {
    month: "Mai",
    year: 2024,
    receitaBruta: 835645.16,
    devolucoes: 0,
    descontosComerciais: 0,
    impostosSobreVendas: 0,
    receitaLiquida: 151197.08,
    custos: 0,
    lucroBruto: 0,
    despesas: 684448.08,
    ebitda: 151197.08,
    lucroLiquido: 151197.08,
  },
  {
    month: "Jun",
    year: 2024,
    receitaBruta: 1759228.30,
    devolucoes: 0,
    descontosComerciais: 0,
    impostosSobreVendas: 0,
    receitaLiquida: 513001.42,
    custos: 0,
    lucroBruto: 0,
    despesas: 1246226.88,
    ebitda: 513001.42,
    lucroLiquido: 513001.42,
  },
  {
    month: "Jul",
    year: 2024,
    receitaBruta: 577721.87,
    devolucoes: 0,
    descontosComerciais: 229128.65,
    impostosSobreVendas: 0,
    receitaLiquida: 348593.22,
    custos: 0,
    lucroBruto: 0,
    despesas: 229128.65,
    ebitda: 348593.22,
    lucroLiquido: 348593.22,
  },
  {
    month: "Ago",
    year: 2024,
    receitaBruta: 0,
    devolucoes: 0,
    descontosComerciais: 0,
    impostosSobreVendas: 0,
    receitaLiquida: 0,
    custos: 0,
    lucroBruto: 0,
    despesas: 0,
    ebitda: 0,
    lucroLiquido: 0,
  },
  {
    month: "Set",
    year: 2024,
    receitaBruta: 0,
    devolucoes: 0,
    descontosComerciais: 0,
    impostosSobreVendas: 0,
    receitaLiquida: 0,
    custos: 0,
    lucroBruto: 0,
    despesas: 0,
    ebitda: 0,
    lucroLiquido: 0,
  },
  {
    month: "Out",
    year: 2024,
    receitaBruta: 792653.62,
    devolucoes: 868.73,
    descontosComerciais: 90024.63,
    impostosSobreVendas: 40343.74,
    receitaLiquida: 663153.98,
    custos: 271893.86,
    lucroBruto: 391260.12,
    despesas: 438861.98,
    ebitda: -47601.86,
    lucroLiquido: -47601.86,
  },
];

// ============================================
// RECEITA POR CANAL - MARKETPLACES
// ============================================
export const channelData: ChannelData[] = [
  // Exchange
  { channel: "Mercado Livre (Exchange)", color: "hsl(48, 96%, 53%)", receitaBruta: 540354.27, percentual: 46.1, operation: "Exchange" },
  { channel: "Shopee", color: "hsl(16, 100%, 50%)", receitaBruta: 99131.12, percentual: 8.5, operation: "Exchange" },
  { channel: "Shein", color: "hsl(0, 0%, 15%)", receitaBruta: 3097.43, percentual: 0.3, operation: "Exchange" },
  // Inpari
  { channel: "Mercado Livre (Inpari)", color: "hsl(48, 86%, 43%)", receitaBruta: 327142.00, percentual: 27.9, operation: "Inpari" },
];

// Receita consolidada por canal (agrupado)
export const channelDataConsolidated: ChannelData[] = [
  { channel: "Mercado Livre", color: "hsl(48, 96%, 53%)", receitaBruta: 867496.27, percentual: 74.0 },
  { channel: "Shopee", color: "hsl(16, 100%, 50%)", receitaBruta: 99131.12, percentual: 8.5 },
  { channel: "Shein", color: "hsl(0, 0%, 15%)", receitaBruta: 3097.43, percentual: 0.3 },
];

// Total de receita REAL dos marketplaces
export const totalReceitaMarketplaces = 540354.27 + 99131.12 + 3097.43 + 327142.00; // = 969724.82

// ============================================
// MOVIMENTAÇÕES FINANCEIRAS - HISTÓRICO
// ============================================
export const financialMovements: FinancialMovement[] = [
  { id: "mov-001", data: "01/06/2024", descricao: "Repasse Exchange", valor: 369054.89, tipo: "entrada", categoria: "Repasse Marketplace", origem: "banco" },
  { id: "mov-002", data: "01/06/2024", descricao: "Repasse Inpari", valor: 420448.59, tipo: "entrada", categoria: "Repasse Marketplace", origem: "banco" },
  { id: "mov-003", data: "05/06/2024", descricao: "Pagamento Fornecedor", valor: 45000, tipo: "saida", categoria: "Fornecedores", origem: "banco" },
  { id: "mov-004", data: "10/06/2024", descricao: "Folha de Pagamento", valor: 35000, tipo: "saida", categoria: "Pessoal", origem: "banco" },
  { id: "mov-005", data: "15/06/2024", descricao: "Taxas Bancárias", valor: 2500, tipo: "saida", categoria: "Taxas", origem: "banco" },
];

// Dados por operação - JUNHO 2024 (dados mais completos da planilha)
export const operationData: OperationData[] = [
  {
    operation: "Exchange",
    receitaBruta: 642582.82,
    deducoes: 691557.86,
    receitaLiquida: 320079.85,
    detalhes: {
      mercadoLivre: 540354.27,
      shopee: 99131.12,
      shein: 3097.43,
    },
  },
  {
    operation: "Inpari",
    receitaBruta: 327142.00,
    deducoes: 554669.02,
    receitaLiquida: 192921.57,
    detalhes: {
      mercadoLivre: 327142.00,
      shopee: 0,
      shein: 0,
    },
  },
];

// KPIs principais - Calculados com base nos dados reais
export const kpis = {
  faturamentoMensal: 792653.62,
  faturamentoVariacao: -8.5,
  lucroLiquido: -47601.86,
  lucroVariacao: -165.2,
  margemBruta: 49.4,
  margemBrutaVariacao: 2.1,
  margemLiquida: -6.0,
  margemLiquidaVariacao: -15.8,
  ticketMedio: 156.32,
  ticketMedioVariacao: 3.2,
  pedidos: 5072,
  pedidosVariacao: -12.1,
  cmv: 271893.86,
  cmvPercentual: 34.3,
  custoOperacional: 438861.98,
  custoOperacionalPercentual: 55.4,
};

// Fluxo de caixa - Baseado nos dados reais
export const cashFlowData = [
  { month: "Mai", entradas: 835645.16, saidas: 684448.08, saldo: 151197.08 },
  { month: "Jun", entradas: 1759228.30, saidas: 1246226.88, saldo: 513001.42 },
  { month: "Jul", entradas: 577721.87, saidas: 229128.65, saldo: 348593.22 },
  { month: "Ago", entradas: 0, saidas: 0, saldo: 0 },
  { month: "Set", entradas: 0, saidas: 0, saldo: 0 },
  { month: "Out", entradas: 792653.62, saidas: 840255.48, saldo: -47601.86 },
];

// Balanço patrimonial
export const balanceSheet = {
  ativo: {
    circulante: {
      caixa: 125000,
      estoque: 380000,
      contasReceber: 185000,
      creditosRecuperar: 42000,
      creditoIcms: 28500,
    },
    naoCirculante: {
      investimentos: 50000,
      imobilizado: 95000,
    },
  },
  passivo: {
    circulante: {
      fornecedores: 220000,
      obrigacoesFiscais: 65000,
      obrigacoesTrabalhistas: 35000,
      contasPagar: 48000,
    },
    naoCirculante: {
      emprestimos: 0,
    },
  },
  patrimonioLiquido: {
    capitalSocial: 300000,
    reservas: 50000,
    lucrosAcumulados: 187500,
  },
};

// Crédito de ICMS
export const icmsData = {
  creditoDisponivel: 28500,
  icmsDevido: 35000,
  saldoProjetado: -6500,
  notasNecessarias: 81250,
  historico: [
    { month: "Mai", credito: 22000, debito: 18000, saldo: 4000 },
    { month: "Jun", credito: 45000, debito: 42000, saldo: 3000 },
    { month: "Jul", credito: 18000, debito: 15000, saldo: 3000 },
    { month: "Ago", credito: 0, debito: 0, saldo: 0 },
    { month: "Set", credito: 0, debito: 0, saldo: 0 },
    { month: "Out", credito: 28500, debito: 35000, saldo: -6500 },
  ],
};

// Despesas por categoria
export const expensesByCategory = [
  { category: "Deduções Comerciais", value: 365723.41, percentual: 29.3 },
  { category: "Impostos e Taxas", value: 847319.93, percentual: 68.0 },
  { category: "Devoluções", value: 33183.07, percentual: 2.7 },
];

// Projeções
export const projections = {
  otimista: {
    faturamento: 950000,
    lucroLiquido: 85000,
    margem: 8.9,
  },
  realista: {
    faturamento: 820000,
    lucroLiquido: 35000,
    margem: 4.3,
  },
  pessimista: {
    faturamento: 680000,
    lucroLiquido: -25000,
    margem: -3.7,
  },
};

// ============================================
// UTILITÁRIOS DE FORMATAÇÃO
// ============================================
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

// ============================================
// VALIDAÇÕES E REGRAS DE NEGÓCIO
// ============================================

// Hash para detectar duplicidade
export const generateTransactionHash = (data: string, descricao: string, valor: number, origem: string): string => {
  return btoa(`${data}|${descricao}|${valor}|${origem}`);
};

// Validar fechamento mensal
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateFechamento = (data: {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar cálculo da receita líquida
  const expectedReceitaLiquida = data.receitaBruta - data.deducoes;
  const diff = Math.abs(expectedReceitaLiquida - data.receitaLiquida);
  if (diff > 0.01) {
    errors.push(`Divergência na receita líquida: esperado ${formatCurrency(expectedReceitaLiquida)}, encontrado ${formatCurrency(data.receitaLiquida)}`);
  }

  // Verificar valores negativos onde não deveria
  if (data.receitaBruta < 0) {
    errors.push("Receita bruta não pode ser negativa");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// Mapear abas da planilha
export const spreadsheetTabMapping = {
  "DRE": "dre",
  "CONSOLIDADO": "consolidado",
  "CREDITO": "icms",
  "FECHAMENTO EXCHANGE": "fechamentoExchange",
  "RESUMO DE NOTAS": "resumoNotas",
  "LANÇAMENTOS EXCHANGE": "lancamentosExchange",
};

// Categorias financeiras padrão
export const financialCategories = [
  "Contas a Pagar",
  "Movimentações Financeiras",
  "Repasse Marketplace",
  "Despesas Operacionais",
  "Pagamentos",
  "Transferências",
];
