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
  freteRateado: number;
  despesasAcessorias: number;
  descontos: number;
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
  
  // Preço e resultado
  precoVenda: number;
  margemDesejada: number;
}

export interface ResultadoPrecificacao {
  custoBase: number;
  tributosTotal: number;
  comissaoTotal: number;
  tarifasTotal: number;
  freteTotal: number;
  gastosExtrasTotal: number;
  custoTotalVariavel: number;
  receitaBruta: number;
  receitaLiquida: number;
  margemContribuicao: number;
  margemContribuicaoPercent: number;
  precoMinimoRecomendado: number;
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
    icms: 0, // Simples Nacional tem alíquota única
    pis: 0,
    cofins: 0,
    simples: 6.0, // Alíquota média para comércio - faixa inicial
  },
  lucro_presumido: {
    icms: 18, // ICMS interno SP (pode variar)
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
  totalItensNF: number;
  valorTotalNF: number;
}): { custoTotal: number; custoPorUnidade: number } => {
  const { valorTotalItem, quantidade, freteNF, despesasAcessorias, descontos, totalItensNF, valorTotalNF } = dados;
  
  // Proporção do item no total da NF
  const proporcao = valorTotalItem / valorTotalNF;
  
  // Rateio proporcional
  const freteRateado = freteNF * proporcao;
  const despesasRateadas = despesasAcessorias * proporcao;
  const descontosRateados = descontos * proporcao;
  
  // Custo total do item
  const custoTotal = valorTotalItem + freteRateado + despesasRateadas - descontosRateados;
  
  // Custo por unidade
  const custoPorUnidade = custoTotal / quantidade;
  
  return { custoTotal, custoPorUnidade };
};

// Calcular tributação com base no regime
export const calcularTributacao = (
  precoVenda: number,
  custoBase: number,
  regime: RegimeTributario,
  tributacaoManual?: Partial<DadosTributacao>
): DadosTributacao => {
  const aliquotas = ALIQUOTAS_REGIME[regime];
  
  // Valores padrão baseados no regime
  const tributacaoPadrao: DadosTributacao = {
    icmsAliquota: aliquotas.icms,
    icmsValor: regime !== 'simples_nacional' ? (precoVenda * aliquotas.icms) / 100 : 0,
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
  };
  
  // Merge com valores manuais se fornecidos
  return {
    ...tributacaoPadrao,
    ...tributacaoManual,
  };
};

// Calcular resultado completo da precificação
export const calcularResultadoPrecificacao = (simulacao: SimulacaoPrecificacao): ResultadoPrecificacao => {
  const { custoBase, tributacao, comissao, tarifaFixa, taxasExtras, freteVenda, gastosExtras, precoVenda, margemDesejada, regimeTributario } = simulacao;
  
  // 1. Tributos totais
  let tributosTotal = 0;
  if (regimeTributario === 'simples_nacional') {
    // Simples Nacional - alíquota única sobre faturamento
    tributosTotal = (precoVenda * tributacao.simplesAliquota) / 100;
  } else {
    // ICMS (débito - crédito)
    const icmsDebito = (precoVenda * tributacao.icmsAliquota) / 100;
    const icmsLiquido = Math.max(0, icmsDebito - tributacao.icmsCredito);
    
    // PIS e COFINS
    const pis = (precoVenda * tributacao.pisAliquota) / 100;
    const cofins = (precoVenda * tributacao.cofinsAliquota) / 100;
    
    // ST, IPI, DIFAL
    tributosTotal = icmsLiquido + pis + cofins + tributacao.stValor + tributacao.ipiValor + tributacao.difalValor + tributacao.fundoFiscalDifal;
  }
  
  // 2. Comissão do marketplace
  const comissaoTotal = (precoVenda * comissao) / 100;
  
  // 3. Tarifas fixas + extras
  let tarifasTotal = tarifaFixa;
  taxasExtras.filter(t => t.ativo).forEach(taxa => {
    if (taxa.tipo === 'fixo') {
      tarifasTotal += taxa.valor;
    } else {
      const base = taxa.baseCalculo === 'preco_venda' ? precoVenda : 
                   taxa.baseCalculo === 'comissao' ? comissaoTotal : precoVenda;
      tarifasTotal += (base * taxa.valor) / 100;
    }
  });
  
  // 4. Frete
  const freteTotal = freteVenda;
  
  // 5. Gastos extras
  let gastosExtrasTotal = 0;
  gastosExtras.forEach(gasto => {
    if (gasto.tipo === 'fixo') {
      gastosExtrasTotal += gasto.valor;
    } else {
      const base = gasto.baseCalculo === 'preco_venda' ? precoVenda :
                   gasto.baseCalculo === 'receita_liquida' ? (precoVenda - comissaoTotal - tarifasTotal) :
                   gasto.baseCalculo === 'comissao' ? comissaoTotal : precoVenda;
      gastosExtrasTotal += (base * gasto.valor) / 100;
    }
  });
  
  // 6. Custo total variável
  const custoTotalVariavel = custoBase + tributosTotal + comissaoTotal + tarifasTotal + freteTotal + gastosExtrasTotal;
  
  // 7. Receitas
  const receitaBruta = precoVenda;
  const receitaLiquida = precoVenda - comissaoTotal - tarifasTotal;
  
  // 8. Margem de contribuição
  const margemContribuicao = precoVenda - custoTotalVariavel;
  const margemContribuicaoPercent = precoVenda > 0 ? (margemContribuicao / precoVenda) * 100 : 0;
  
  // 9. Preço mínimo recomendado para atingir margem desejada
  // Fórmula: Preço = (CustoBase + Gastos Fixos) / (1 - Margem% - Comissão% - Tributos%)
  const percentuaisTotais = (comissao + tributacao.simplesAliquota + (regimeTributario !== 'simples_nacional' ? tributacao.icmsAliquota + tributacao.pisAliquota + tributacao.cofinsAliquota : 0)) / 100;
  const gastosFixosTotais = custoBase + tarifaFixa + freteTotal + gastosExtras.filter(g => g.tipo === 'fixo').reduce((sum, g) => sum + g.valor, 0);
  const gastosPercentuaisTotais = gastosExtras.filter(g => g.tipo === 'percentual').reduce((sum, g) => sum + g.valor, 0) / 100;
  
  const denominador = 1 - (margemDesejada / 100) - percentuaisTotais - gastosPercentuaisTotais;
  const precoMinimoRecomendado = denominador > 0 ? gastosFixosTotais / denominador : 0;
  
  return {
    custoBase,
    tributosTotal,
    comissaoTotal,
    tarifasTotal,
    freteTotal,
    gastosExtrasTotal,
    custoTotalVariavel,
    receitaBruta,
    receitaLiquida,
    margemContribuicao,
    margemContribuicaoPercent,
    precoMinimoRecomendado: Math.max(precoMinimoRecomendado, custoTotalVariavel),
  };
};

// Verificar se é frete grátis ML (até R$ 79)
export const isFreteGratisML = (precoVenda: number): boolean => {
  return precoVenda <= 79;
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
    precoVenda: 0,
    margemDesejada: 20,
  };
};

// Exemplo de gastos extras comuns
export const GASTOS_EXTRAS_SUGESTOES: Array<{ descricao: string; tipo: TipoGastoExtra; valor: number; baseCalculo: BaseCalculo }> = [
  { descricao: 'Cupom de desconto vendedor', tipo: 'percentual', valor: 10, baseCalculo: 'preco_venda' },
  { descricao: 'Taxa campanha data dupla', tipo: 'percentual', valor: 5, baseCalculo: 'preco_venda' },
  { descricao: 'Custo de nota comprada (ICMS)', tipo: 'percentual', valor: 2.5, baseCalculo: 'preco_venda' },
  { descricao: 'Embalagem especial', tipo: 'fixo', valor: 3.00, baseCalculo: 'preco_venda' },
  { descricao: 'Taxa de processamento', tipo: 'fixo', valor: 1.50, baseCalculo: 'preco_venda' },
];
