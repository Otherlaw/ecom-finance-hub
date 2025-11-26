// Mock data baseado na planilha FECHAMENTO_CONSOLIDADO.xlsx

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
}

export interface OperationData {
  operation: string;
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
}

// Dados consolidados do DRE
export const dreData: MonthlyData = {
  month: "Atual",
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

// Dados mensais históricos
export const monthlyHistory: MonthlyData[] = [
  {
    month: "Mai",
    year: 2024,
    receitaBruta: 835645.16,
    devolucoes: 1200,
    descontosComerciais: 75000,
    impostosSobreVendas: 35000,
    receitaLiquida: 151197.08,
    custos: 250000,
    lucroBruto: 320000,
    despesas: 280000,
    ebitda: 40000,
    lucroLiquido: 32000,
  },
  {
    month: "Jun",
    year: 2024,
    receitaBruta: 1759228.30,
    devolucoes: 2500,
    descontosComerciais: 120000,
    impostosSobreVendas: 85000,
    receitaLiquida: 513001.42,
    custos: 450000,
    lucroBruto: 650000,
    despesas: 520000,
    ebitda: 130000,
    lucroLiquido: 98000,
  },
  {
    month: "Jul",
    year: 2024,
    receitaBruta: 577721.87,
    devolucoes: 800,
    descontosComerciais: 65000,
    impostosSobreVendas: 28000,
    receitaLiquida: 283000,
    custos: 180000,
    lucroBruto: 230000,
    despesas: 200000,
    ebitda: 30000,
    lucroLiquido: 22000,
  },
  {
    month: "Ago",
    year: 2024,
    receitaBruta: 690000,
    devolucoes: 950,
    descontosComerciais: 78000,
    impostosSobreVendas: 33000,
    receitaLiquida: 340000,
    custos: 210000,
    lucroBruto: 280000,
    despesas: 250000,
    ebitda: 30000,
    lucroLiquido: 21000,
  },
  {
    month: "Set",
    year: 2024,
    receitaBruta: 720000,
    devolucoes: 1100,
    descontosComerciais: 82000,
    impostosSobreVendas: 36000,
    receitaLiquida: 365000,
    custos: 225000,
    lucroBruto: 300000,
    despesas: 270000,
    ebitda: 30000,
    lucroLiquido: 18000,
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

// Receita por canal
export const channelData: ChannelData[] = [
  { channel: "Mercado Livre", color: "hsl(48, 96%, 53%)", receitaBruta: 540354.27, percentual: 53.4 },
  { channel: "Caixa Tiny", color: "hsl(217, 91%, 60%)", receitaBruta: 369054.89, percentual: 36.5 },
  { channel: "Shopee", color: "hsl(16, 100%, 50%)", receitaBruta: 99131.12, percentual: 9.8 },
  { channel: "Shein", color: "hsl(0, 0%, 15%)", receitaBruta: 3097.43, percentual: 0.3 },
];

// Dados por operação
export const operationData: OperationData[] = [
  {
    operation: "Exchange",
    receitaBruta: 1011637.71,
    deducoes: 691557.86,
    receitaLiquida: 320079.85,
  },
  {
    operation: "Inpari",
    receitaBruta: 747590.59,
    deducoes: 554669.02,
    receitaLiquida: 192921.57,
  },
];

// KPIs principais
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

// Fluxo de caixa
export const cashFlowData = [
  { month: "Mai", entradas: 835645, saidas: 720000, saldo: 115645 },
  { month: "Jun", entradas: 1759228, saidas: 1450000, saldo: 309228 },
  { month: "Jul", entradas: 577721, saidas: 480000, saldo: 97721 },
  { month: "Ago", entradas: 690000, saidas: 620000, saldo: 70000 },
  { month: "Set", entradas: 720000, saidas: 680000, saldo: 40000 },
  { month: "Out", entradas: 792653, saidas: 840255, saldo: -47602 },
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
  notasNecessarias: 81250, // Para zerar ICMS (8% de 81250 = 6500)
  historico: [
    { month: "Mai", credito: 22000, debito: 18000, saldo: 4000 },
    { month: "Jun", credito: 45000, debito: 42000, saldo: 3000 },
    { month: "Jul", credito: 18000, debito: 15000, saldo: 3000 },
    { month: "Ago", credito: 25000, debito: 22000, saldo: 3000 },
    { month: "Set", credito: 28000, debito: 25500, saldo: 2500 },
    { month: "Out", credito: 28500, debito: 35000, saldo: -6500 },
  ],
};

// Despesas por categoria
export const expensesByCategory = [
  { category: "Taxas Marketplace", value: 158000, percentual: 36.0 },
  { category: "Frete", value: 98000, percentual: 22.3 },
  { category: "Marketing", value: 65000, percentual: 14.8 },
  { category: "Operacional", value: 52000, percentual: 11.8 },
  { category: "Administrativo", value: 38000, percentual: 8.7 },
  { category: "Outros", value: 27861.98, percentual: 6.4 },
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

// Formatadores
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
