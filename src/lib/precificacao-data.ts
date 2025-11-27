// ============= Precificação Module Data Types & Logic =============

import { RegimeTributario } from './empresas-data';

// Marketplaces suportados
export type MarketplaceId = 'mercadolivre' | 'shopee' | 'shein' | 'tiktok' | 'amazon' | 'outro';

// Tipo de gasto extra
export type TipoGastoExtra = 'fixo' | 'percentual';

// Base de cálculo para percentuais
export type BaseCalculo = 'preco_venda' | 'receita_liquida' | 'comissao';

// ============= Interfaces =============

export interface MarketplaceConfig {
  id: MarketplaceId;
  nome: string;
  cor: string;
  comissaoPadrao: number; // %
  tarifaFixaPadrao: number; // R$
  taxasExtras: TaxaMarketplace[];
  regrasEspeciais?: string;
}

export interface TaxaMarketplace {
  id: string;
  descricao: string;
  tipo: TipoGastoExtra;
  valor: number;
  baseCalculo?: BaseCalculo;
  ativo: boolean;
}

export interface GastoExtra {
  id: string;
  descricao: string;
  tipo: TipoGastoExtra;
  valor: number;
  baseCalculo: BaseCalculo;
}

export interface DadosTributacao {
  icmsAliquota: number;
  icmsValor: number;
  icmsCredito: number;
  stValor: number;
  ipiAliquota: number;
  ipiValor: number;
  difalAliquota: number;
  difalValor: number;
  fundoFiscalDifal: number;
  pisAliquota: number;
  cofinsAliquota: number;
  simplesAliquota: number;
}

export interface DadosCustoNF {
  nfNumero: string;
  nfChave?: string;
  fornecedor: string;
  dataEmissao: string;
  itemDescricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  // Detalhes do cálculo
  freteNF: number;
  freteRateado: number;
  despesasAcessorias: number;
  despesasRateadas: number;
  descontosNF: number;
  descontosRateados: number;
  valorTotalNF: number;
  proporcaoItem: number;
  custoEfetivo: number;
  custoEfetivoPorUnidade: number;
  // Dados fiscais da NF
  icmsDestacado: number;
  icmsAliquota: number;
  stDestacado: number;
  ipiDestacado: number;
  ipiAliquota: number;
}

export interface SimulacaoPrecificacao {
  // Contexto
  empresaId: string;
  empresaNome: string;
  regimeTributario: RegimeTributario;
  produtoId?: string;
  produtoNome?: string;
  marketplace: MarketplaceId;
  
  // Custo
  custoBase: number;
  custoNF?: DadosCustoNF;
  
  // Tributação
  tributacao: DadosTributacao;
  
  // Marketplace
  comissao: number;
  tarifaFixa: number;
  taxasExtras: TaxaMarketplace[];
  
  // Frete
  freteVenda: number;
  freteGratisML: boolean;
  
  // Gastos extras
  gastosExtras: GastoExtra[];
  
  // Margem e preço
  margemDesejada: number;
  precoVendaManual?: number; // OPCIONAL - para simulação
}

export interface ResultadoPrecificacao {
  custoBase: number;
  tributosTotal: number;
  comissaoTotal: number;
  tarifasTotal: number;
  freteTotal: number;
  gastosExtrasTotal: number;
  custoTotalVariavel: number;
  precoSugerido: number;
  // Se preço manual informado
  precoManual?: number;
  margemManual?: number;
  margemManualPercent?: number;
}

// ============= Configurações de Marketplaces =============

export const MARKETPLACE_CONFIG: Record<MarketplaceId, MarketplaceConfig> = {
  mercadolivre: {
    id: 'mercadolivre',
    nome: 'Mercado Livre',
    cor: 'hsl(48, 96%, 53%)',
    comissaoPadrao: 13,
    tarifaFixaPadrao: 6.00,
    taxasExtras: [
      { id: 'ml-anuncio-premium', descricao: 'Taxa anúncio premium', tipo: 'percentual', valor: 3, baseCalculo: 'preco_venda', ativo: false },
    ],
    regrasEspeciais: 'Frete grátis para comprador em anúncios até R$ 79,00',
  },
  shopee: {
    id: 'shopee',
    nome: 'Shopee',
    cor: 'hsl(16, 100%, 50%)',
    comissaoPadrao: 14,
    tarifaFixaPadrao: 2.00,
    taxasExtras: [
      { id: 'shopee-ads', descricao: 'Taxa Shopee Ads', tipo: 'percentual', valor: 5, baseCalculo: 'preco_venda', ativo: false },
      { id: 'shopee-11-11', descricao: 'Campanha 11.11', tipo: 'percentual', valor: 5, baseCalculo: 'preco_venda', ativo: false },
      { id: 'shopee-12-12', descricao: 'Campanha 12.12', tipo: 'percentual', valor: 5, baseCalculo: 'preco_venda', ativo: false },
    ],
  },
  shein: {
    id: 'shein',
    nome: 'Shein',
    cor: 'hsl(0, 0%, 15%)',
    comissaoPadrao: 10,
    tarifaFixaPadrao: 0,
    taxasExtras: [],
  },
  tiktok: {
    id: 'tiktok',
    nome: 'TikTok Shop',
    cor: 'hsl(0, 0%, 0%)',
    comissaoPadrao: 8,
    tarifaFixaPadrao: 2.00,
    taxasExtras: [
      { id: 'tiktok-ads', descricao: 'Taxa TikTok Ads', tipo: 'percentual', valor: 3, baseCalculo: 'preco_venda', ativo: false },
    ],
  },
  amazon: {
    id: 'amazon',
    nome: 'Amazon',
    cor: 'hsl(31, 100%, 50%)',
    comissaoPadrao: 15,
    tarifaFixaPadrao: 0,
    taxasExtras: [
      { id: 'amazon-fba', descricao: 'Taxa FBA', tipo: 'fixo', valor: 8.00, ativo: false },
    ],
  },
  outro: {
    id: 'outro',
    nome: 'Outro Canal',
    cor: 'hsl(220, 10%, 50%)',
    comissaoPadrao: 10,
    tarifaFixaPadrao: 0,
    taxasExtras: [],
  },
};

export const MARKETPLACES_LIST = Object.values(MARKETPLACE_CONFIG);

// ============= Alíquotas por Regime Tributário =============

export const ALIQUOTAS_REGIME: Record<RegimeTributario, { icms: number; pis: number; cofins: number; simples: number }> = {
  simples_nacional: {
    icms: 0,
    pis: 0,
    cofins: 0,
    simples: 6.0,
  },
  lucro_presumido: {
    icms: 18,
    pis: 0.65,
    cofins: 3.0,
    simples: 0,
  },
  lucro_real: {
    icms: 18,
    pis: 1.65,
    cofins: 7.6,
    simples: 0,
  },
};

// ============= Funções de Cálculo =============

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

// Calcular custo efetivo por unidade a partir de dados da NF
export const calcularCustoEfetivoNF = (dados: {
  valorTotalItem: number;
  quantidade: number;
  freteNF: number;
  despesasAcessorias: number;
  descontos: number;
  valorTotalNF: number;
}): DadosCustoNF => {
  const { valorTotalItem, quantidade, freteNF, despesasAcessorias, descontos, valorTotalNF } = dados;
  
  // Proporção do item no total da NF
  const proporcaoItem = valorTotalNF > 0 ? valorTotalItem / valorTotalNF : 1;
  
  // Rateio proporcional
  const freteRateado = freteNF * proporcaoItem;
  const despesasRateadas = despesasAcessorias * proporcaoItem;
  const descontosRateados = descontos * proporcaoItem;
  
  // Custo total do item
  const custoEfetivo = valorTotalItem + freteRateado + despesasRateadas - descontosRateados;
  
  // Custo por unidade
  const custoEfetivoPorUnidade = quantidade > 0 ? custoEfetivo / quantidade : 0;
  
  return {
    nfNumero: '',
    fornecedor: '',
    dataEmissao: '',
    itemDescricao: '',
    quantidade,
    valorUnitario: valorTotalItem / quantidade,
    valorTotalItem,
    freteNF,
    freteRateado: Math.round(freteRateado * 100) / 100,
    despesasAcessorias,
    despesasRateadas: Math.round(despesasRateadas * 100) / 100,
    descontosNF: descontos,
    descontosRateados: Math.round(descontosRateados * 100) / 100,
    valorTotalNF,
    proporcaoItem: Math.round(proporcaoItem * 10000) / 100,
    custoEfetivo: Math.round(custoEfetivo * 100) / 100,
    custoEfetivoPorUnidade: Math.round(custoEfetivoPorUnidade * 100) / 100,
    icmsDestacado: 0,
    icmsAliquota: 0,
    stDestacado: 0,
    ipiDestacado: 0,
    ipiAliquota: 0,
  };
};

// Calcular preço sugerido baseado na margem desejada
export const calcularPrecoSugerido = (
  custoBase: number,
  margemDesejada: number,
  comissaoPercent: number,
  tarifaFixa: number,
  tributosPercent: number,
  freteVenda: number,
  gastosExtrasFixos: number,
  gastosExtrasPercent: number
): number => {
  // Fórmula: Preço = (CustoBase + Gastos Fixos) / (1 - Margem% - Comissão% - Tributos% - GastosExtras%)
  const totalPercentual = (margemDesejada + comissaoPercent + tributosPercent + gastosExtrasPercent) / 100;
  const totalFixo = custoBase + tarifaFixa + freteVenda + gastosExtrasFixos;
  
  const denominador = 1 - totalPercentual;
  
  if (denominador <= 0) {
    return 0; // Margem impossível
  }
  
  return Math.round((totalFixo / denominador) * 100) / 100;
};

// Calcular resultado completo da precificação (focado em preço sugerido)
export const calcularResultadoPrecificacao = (simulacao: SimulacaoPrecificacao): ResultadoPrecificacao => {
  const { 
    custoBase, tributacao, comissao, tarifaFixa, taxasExtras, 
    freteVenda, gastosExtras, margemDesejada, regimeTributario, precoVendaManual 
  } = simulacao;
  
  // Calcular percentuais de tributos
  let tributosPercent = 0;
  if (regimeTributario === 'simples_nacional') {
    tributosPercent = tributacao.simplesAliquota;
  } else {
    tributosPercent = tributacao.icmsAliquota + tributacao.pisAliquota + tributacao.cofinsAliquota;
  }
  
  // Calcular gastos extras
  const gastosExtrasFixos = gastosExtras.filter(g => g.tipo === 'fixo').reduce((sum, g) => sum + g.valor, 0);
  const gastosExtrasPercent = gastosExtras.filter(g => g.tipo === 'percentual').reduce((sum, g) => sum + g.valor, 0);
  
  // Taxas extras ativas (percentuais)
  const taxasExtrasPercent = taxasExtras.filter(t => t.ativo && t.tipo === 'percentual').reduce((sum, t) => sum + t.valor, 0);
  const taxasExtrasFixas = taxasExtras.filter(t => t.ativo && t.tipo === 'fixo').reduce((sum, t) => sum + t.valor, 0);
  
  const comissaoTotal = comissao + taxasExtrasPercent;
  const tarifaTotal = tarifaFixa + taxasExtrasFixas;
  
  // Calcular preço sugerido
  const precoSugerido = calcularPrecoSugerido(
    custoBase,
    margemDesejada,
    comissaoTotal,
    tarifaTotal,
    tributosPercent,
    freteVenda,
    gastosExtrasFixos,
    gastosExtrasPercent
  );
  
  // Calcular custos com base no preço sugerido
  const tributosTotal = (precoSugerido * tributosPercent) / 100;
  const comissaoValor = (precoSugerido * comissaoTotal) / 100;
  const gastosExtrasTotal = gastosExtrasFixos + (precoSugerido * gastosExtrasPercent) / 100;
  
  const custoTotalVariavel = custoBase + tributosTotal + comissaoValor + tarifaTotal + freteVenda + gastosExtrasTotal;
  
  // Se tem preço manual, calcular margem real
  let margemManual: number | undefined;
  let margemManualPercent: number | undefined;
  
  if (precoVendaManual && precoVendaManual > 0) {
    const tributosManual = (precoVendaManual * tributosPercent) / 100;
    const comissaoManual = (precoVendaManual * comissaoTotal) / 100;
    const gastosExtrasManual = gastosExtrasFixos + (precoVendaManual * gastosExtrasPercent) / 100;
    const custoTotalManual = custoBase + tributosManual + comissaoManual + tarifaTotal + freteVenda + gastosExtrasManual;
    
    margemManual = precoVendaManual - custoTotalManual;
    margemManualPercent = (margemManual / precoVendaManual) * 100;
  }
  
  return {
    custoBase,
    tributosTotal,
    comissaoTotal: comissaoValor,
    tarifasTotal: tarifaTotal,
    freteTotal: freteVenda,
    gastosExtrasTotal,
    custoTotalVariavel,
    precoSugerido,
    precoManual: precoVendaManual,
    margemManual,
    margemManualPercent,
  };
};

// Verificar se é frete grátis ML (até R$ 79)
export const isFreteGratisML = (precoVenda: number): boolean => {
  return precoVenda > 0 && precoVenda <= 79;
};

// Criar simulação inicial
export const criarSimulacaoInicial = (
  empresaId: string,
  empresaNome: string,
  regimeTributario: RegimeTributario,
  marketplace: MarketplaceId
): SimulacaoPrecificacao => {
  const config = MARKETPLACE_CONFIG[marketplace];
  const aliquotas = ALIQUOTAS_REGIME[regimeTributario];
  
  return {
    empresaId,
    empresaNome,
    regimeTributario,
    marketplace,
    custoBase: 0,
    tributacao: {
      icmsAliquota: aliquotas.icms,
      icmsValor: 0,
      icmsCredito: 0,
      stValor: 0,
      ipiAliquota: 0,
      ipiValor: 0,
      difalAliquota: 0,
      difalValor: 0,
      fundoFiscalDifal: 0,
      pisAliquota: aliquotas.pis,
      cofinsAliquota: aliquotas.cofins,
      simplesAliquota: aliquotas.simples,
    },
    comissao: config.comissaoPadrao,
    tarifaFixa: config.tarifaFixaPadrao,
    taxasExtras: config.taxasExtras.map(t => ({ ...t })),
    freteVenda: 0,
    freteGratisML: false,
    gastosExtras: [],
    margemDesejada: 20,
  };
};

// Sugestões de gastos extras
export const GASTOS_EXTRAS_SUGESTOES: Array<{ descricao: string; tipo: TipoGastoExtra; valor: number; baseCalculo: BaseCalculo }> = [
  { descricao: 'Cupom de desconto vendedor', tipo: 'percentual', valor: 10, baseCalculo: 'preco_venda' },
  { descricao: 'Taxa campanha data dupla', tipo: 'percentual', valor: 5, baseCalculo: 'preco_venda' },
  { descricao: 'Custo de nota comprada (ICMS)', tipo: 'percentual', valor: 2.5, baseCalculo: 'preco_venda' },
  { descricao: 'Embalagem especial', tipo: 'fixo', valor: 3.00, baseCalculo: 'preco_venda' },
  { descricao: 'Taxa de processamento', tipo: 'fixo', valor: 1.50, baseCalculo: 'preco_venda' },
];
