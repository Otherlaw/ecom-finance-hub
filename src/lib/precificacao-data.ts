// ============= Precificação Module Data Types & Logic =============

import { RegimeTributario } from './empresas-data';

// Marketplaces suportados
export type MarketplaceId = 'mercadolivre' | 'shopee' | 'shein' | 'tiktok' | 'amazon' | 'outro';

// Tipo de gasto extra
export type TipoGastoExtra = 'fixo' | 'percentual';

// Base de cálculo para percentuais
export type BaseCalculo = 'preco_venda' | 'receita_liquida' | 'comissao';

// Opções de nota baixa
export type NotaBaixaOpcao = 'nenhuma' | '1/2' | '1/3' | '1/4' | '1/5' | 'personalizado';

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
  difalAtivo: boolean;
  difalAliquota: number;
  difalValor: number;
  fundoFiscalDifal: number;
  pisAliquota: number;
  cofinsAliquota: number;
  simplesAliquota: number;
  // Imposto estimado com alíquota média
  usarImpostoEstimado: boolean;
  icmsEstimado: number; // % ICMS médio estimado
  pisCofinsEstimado: number; // % PIS/COFINS médio estimado
  // Reforma Tributária 2026+ (IVA Dual)
  simularReformaTributaria: boolean;
  cbsAliquota: number; // % CBS (IVA Federal) - previsão ~8.8%
  ibsAliquota: number; // % IBS (IVA Estadual/Municipal) - previsão ~17.7%
}

export interface NotaBaixaConfig {
  ativa: boolean;
  opcao: NotaBaixaOpcao;
  percentualPersonalizado: number; // valor entre 0 e 100
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
  stRateado: number;
  ipiDestacado: number;
  ipiRateado: number;
  ipiAliquota: number;
  // Nota baixa - valores ajustados para valor real
  notaBaixa?: NotaBaixaConfig;
  fatorMultiplicador?: number;
  custoEfetivoReal?: number;
  custoEfetivoPorUnidadeReal?: number;
  stReal?: number;
  ipiReal?: number;
}

// Configuração de Falso Desconto (Shopee)
export interface FalsoDescontoConfig {
  ativo: boolean;
  acrescimoPercent: number; // % de acréscimo sobre preço base (default 30)
  descontoPercent: number;  // % de desconto exibido ao cliente (default 30)
  comissaoSobrePrecoListado: boolean; // Se comissão incide sobre preço listado ou final
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
  notaBaixa: NotaBaixaConfig;
  
  // Tributação
  tributacao: DadosTributacao;
  
  // Marketplace
  comissao: number;
  tarifaFixa: number;
  taxasExtras: TaxaMarketplace[];
  taxasExtrasAtivas: boolean;
  
  // Falso Desconto (Shopee)
  falsoDesconto: FalsoDescontoConfig;
  
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
  tributosPercent: number; // % de tributos usado no cálculo
  comissaoTotal: number;
  tarifasTotal: number;
  freteTotal: number;
  gastosExtrasTotal: number;
  difalTotal: number;
  custoTotalVariavel: number;
  custoTotalVariavelSemDifal: number;
  precoSugerido: number;
  // Margens
  margemComDifal: number;
  margemComDifalPercent: number;
  margemSemDifal: number;
  margemSemDifalPercent: number;
  // Se preço manual informado
  precoManual?: number;
  margemManualComDifal?: number;
  margemManualComDifalPercent?: number;
  margemManualSemDifal?: number;
  margemManualSemDifalPercent?: number;
  // Falso Desconto (Shopee)
  falsoDesconto?: {
    precoBase: number;        // Preço técnico para margem desejada
    precoListado: number;     // Preço exibido antes do desconto
    descontoPercent: number;  // % desconto exibido
    descontoValor: number;    // Valor do desconto em R$
    precoFinalCliente: number; // Preço após desconto (= preço base)
  };
  // Comparação Reforma Tributária 2026+ (IVA Dual)
  comparacaoReforma?: {
    tributosAtualPercent: number;
    tributosReformaPercent: number;
    precoSugeridoReforma: number;
    margemReforma: number;
    margemReformaPercent: number;
    diferencaMargemReais: number;
    diferencaMargemPercent: number;
  };
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

// ============= Opções de Nota Baixa =============

export const NOTA_BAIXA_OPCOES: { value: NotaBaixaOpcao; label: string; fator: number }[] = [
  { value: 'nenhuma', label: 'Nota com valor integral', fator: 1 },
  { value: '1/2', label: '1/2 da nota (50%)', fator: 2 },
  { value: '1/3', label: '1/3 da nota (33,3%)', fator: 3 },
  { value: '1/4', label: '1/4 da nota (25%)', fator: 4 },
  { value: '1/5', label: '1/5 da nota (20%)', fator: 5 },
  { value: 'personalizado', label: 'Percentual personalizado', fator: 0 },
];

export const getFatorNotaBaixa = (config: NotaBaixaConfig): number => {
  if (!config.ativa) return 1;
  
  const opcao = NOTA_BAIXA_OPCOES.find(o => o.value === config.opcao);
  if (opcao && opcao.fator > 0) return opcao.fator;
  
  if (config.opcao === 'personalizado' && config.percentualPersonalizado > 0) {
    return 100 / config.percentualPersonalizado;
  }
  
  return 1;
};

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
  stItem?: number;
  ipiItem?: number;
}, notaBaixa?: NotaBaixaConfig): DadosCustoNF => {
  const { valorTotalItem, quantidade, freteNF, despesasAcessorias, descontos, valorTotalNF, stItem = 0, ipiItem = 0 } = dados;
  
  // Proporção do item no total da NF
  const proporcaoItem = valorTotalNF > 0 ? valorTotalItem / valorTotalNF : 1;
  
  // Rateio proporcional
  const freteRateado = freteNF * proporcaoItem;
  const despesasRateadas = despesasAcessorias * proporcaoItem;
  const descontosRateados = descontos * proporcaoItem;
  
  // ST e IPI rateados (se não vieram do item, ratear pelo total)
  const stRateado = stItem > 0 ? stItem : 0;
  const ipiRateado = ipiItem > 0 ? ipiItem : 0;
  
  // Custo total do item (incluindo ST e IPI que compõem custo de aquisição)
  const custoEfetivo = valorTotalItem + freteRateado + despesasRateadas - descontosRateados + stRateado + ipiRateado;
  
  // Custo por unidade
  const custoEfetivoPorUnidade = quantidade > 0 ? custoEfetivo / quantidade : 0;
  
  // Calcular fator de nota baixa
  const fatorMultiplicador = notaBaixa ? getFatorNotaBaixa(notaBaixa) : 1;
  
  // Valores ajustados para o valor real (quando nota baixa)
  const custoEfetivoReal = custoEfetivo * fatorMultiplicador;
  const custoEfetivoPorUnidadeReal = custoEfetivoPorUnidade * fatorMultiplicador;
  const stReal = stRateado * fatorMultiplicador;
  const ipiReal = ipiRateado * fatorMultiplicador;
  
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
    stRateado: Math.round(stRateado * 100) / 100,
    ipiDestacado: 0,
    ipiRateado: Math.round(ipiRateado * 100) / 100,
    ipiAliquota: 0,
    // Nota baixa
    notaBaixa,
    fatorMultiplicador,
    custoEfetivoReal: Math.round(custoEfetivoReal * 100) / 100,
    custoEfetivoPorUnidadeReal: Math.round(custoEfetivoPorUnidadeReal * 100) / 100,
    stReal: Math.round(stReal * 100) / 100,
    ipiReal: Math.round(ipiReal * 100) / 100,
  };
};

// Estimar preço mínimo baseado nos custos já conhecidos
export const estimarPrecoMinimo = (simulacao: SimulacaoPrecificacao): number => {
  const { custoBase, tributacao, comissao, tarifaFixa, taxasExtras, taxasExtrasAtivas, gastosExtras, regimeTributario } = simulacao;
  
  if (custoBase <= 0) return 0;
  
  // Calcular percentuais de tributos
  let tributosPercent = 0;
  if (tributacao.usarImpostoEstimado) {
    // Usar alíquotas médias estipuladas ou CBS/IBS da reforma
    if (tributacao.simularReformaTributaria) {
      tributosPercent = tributacao.cbsAliquota + tributacao.ibsAliquota;
    } else {
      tributosPercent = tributacao.icmsEstimado + tributacao.pisCofinsEstimado;
    }
  } else if (regimeTributario === 'simples_nacional') {
    tributosPercent = tributacao.simplesAliquota;
  } else {
    tributosPercent = tributacao.icmsAliquota + tributacao.pisAliquota + tributacao.cofinsAliquota;
  }
  
  // Gastos extras percentuais
  const gastosExtrasPercent = gastosExtras.filter(g => g.tipo === 'percentual').reduce((sum, g) => sum + g.valor, 0);
  const gastosExtrasFixos = gastosExtras.filter(g => g.tipo === 'fixo').reduce((sum, g) => sum + g.valor, 0);
  
  // Taxas extras ativas (percentuais)
  const taxasExtrasPercent = taxasExtrasAtivas ? taxasExtras.filter(t => t.ativo && t.tipo === 'percentual').reduce((sum, t) => sum + t.valor, 0) : 0;
  const taxasExtrasFixas = taxasExtrasAtivas ? taxasExtras.filter(t => t.ativo && t.tipo === 'fixo').reduce((sum, t) => sum + t.valor, 0) : 0;
  
  const comissaoTotal = comissao + taxasExtrasPercent;
  const tarifaTotal = tarifaFixa + taxasExtrasFixas;
  
  // Preço mínimo apenas para cobrir custos (margem 0)
  const totalPercentual = (comissaoTotal + tributosPercent + gastosExtrasPercent) / 100;
  const totalFixo = custoBase + tarifaTotal + gastosExtrasFixos;
  
  const denominador = 1 - totalPercentual;
  
  if (denominador <= 0) return 0;
  
  return totalFixo / denominador;
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
  gastosExtrasPercent: number,
  difalValor: number = 0
): number => {
  // Fórmula: Preço = (CustoBase + Gastos Fixos + DIFAL) / (1 - Margem% - Comissão% - Tributos% - GastosExtras%)
  const totalPercentual = (margemDesejada + comissaoPercent + tributosPercent + gastosExtrasPercent) / 100;
  const totalFixo = custoBase + tarifaFixa + freteVenda + gastosExtrasFixos + difalValor;
  
  const denominador = 1 - totalPercentual;
  
  if (denominador <= 0) {
    return 0; // Margem impossível
  }
  
  return Math.round((totalFixo / denominador) * 100) / 100;
};

// Calcular resultado completo da precificação (focado em preço sugerido)
export const calcularResultadoPrecificacao = (simulacao: SimulacaoPrecificacao): ResultadoPrecificacao => {
  const { 
    custoBase, tributacao, comissao, tarifaFixa, taxasExtras, taxasExtrasAtivas,
    freteVenda, gastosExtras, margemDesejada, regimeTributario, precoVendaManual,
    falsoDesconto, marketplace
  } = simulacao;
  
  // Calcular percentuais de tributos (regime atual ou estimado)
  let tributosPercent = 0;
  let tributosPercentReforma = 0;
  
  if (tributacao.usarImpostoEstimado) {
    // Usar alíquotas médias estipuladas
    tributosPercent = tributacao.icmsEstimado + tributacao.pisCofinsEstimado;
    // Calcular também com reforma para comparação
    tributosPercentReforma = tributacao.cbsAliquota + tributacao.ibsAliquota;
  } else if (regimeTributario === 'simples_nacional') {
    tributosPercent = tributacao.simplesAliquota;
    tributosPercentReforma = tributacao.cbsAliquota + tributacao.ibsAliquota;
  } else {
    tributosPercent = tributacao.icmsAliquota + tributacao.pisAliquota + tributacao.cofinsAliquota;
    tributosPercentReforma = tributacao.cbsAliquota + tributacao.ibsAliquota;
  }
  
  // Calcular gastos extras
  const gastosExtrasFixos = gastosExtras.filter(g => g.tipo === 'fixo').reduce((sum, g) => sum + g.valor, 0);
  const gastosExtrasPercent = gastosExtras.filter(g => g.tipo === 'percentual').reduce((sum, g) => sum + g.valor, 0);
  
  // Taxas extras ativas (apenas se taxasExtrasAtivas está habilitado)
  const taxasExtrasPercent = taxasExtrasAtivas ? taxasExtras.filter(t => t.ativo && t.tipo === 'percentual').reduce((sum, t) => sum + t.valor, 0) : 0;
  const taxasExtrasFixas = taxasExtrasAtivas ? taxasExtras.filter(t => t.ativo && t.tipo === 'fixo').reduce((sum, t) => sum + t.valor, 0) : 0;
  
  const comissaoTotal = comissao + taxasExtrasPercent;
  const tarifaTotal = tarifaFixa + taxasExtrasFixas;
  
  // DIFAL (valor fixo quando ativo)
  const difalTotal = tributacao.difalAtivo ? (tributacao.difalValor + tributacao.fundoFiscalDifal) : 0;
  
  // Calcular preço sugerido COM DIFAL (preço base / preço final ao cliente)
  const precoSugerido = calcularPrecoSugerido(
    custoBase,
    margemDesejada,
    comissaoTotal,
    tarifaTotal,
    tributosPercent,
    freteVenda,
    gastosExtrasFixos,
    gastosExtrasPercent,
    difalTotal
  );
  
  // Calcular custos com base no preço sugerido (preço final ao cliente)
  const tributosTotal = (precoSugerido * tributosPercent) / 100;
  const comissaoValor = (precoSugerido * comissaoTotal) / 100;
  const gastosExtrasTotal = gastosExtrasFixos + (precoSugerido * gastosExtrasPercent) / 100;
  
  const custoTotalVariavel = custoBase + tributosTotal + comissaoValor + tarifaTotal + freteVenda + gastosExtrasTotal + difalTotal;
  const custoTotalVariavelSemDifal = custoBase + tributosTotal + comissaoValor + tarifaTotal + freteVenda + gastosExtrasTotal;
  
  // Margens calculadas sobre o preço final ao cliente
  const margemComDifal = precoSugerido - custoTotalVariavel;
  const margemComDifalPercent = precoSugerido > 0 ? (margemComDifal / precoSugerido) * 100 : 0;
  const margemSemDifal = precoSugerido - custoTotalVariavelSemDifal;
  const margemSemDifalPercent = precoSugerido > 0 ? (margemSemDifal / precoSugerido) * 100 : 0;
  
  // Se tem preço manual, calcular margens reais
  let margemManualComDifal: number | undefined;
  let margemManualComDifalPercent: number | undefined;
  let margemManualSemDifal: number | undefined;
  let margemManualSemDifalPercent: number | undefined;
  
  if (precoVendaManual && precoVendaManual > 0) {
    const tributosManual = (precoVendaManual * tributosPercent) / 100;
    const comissaoManual = (precoVendaManual * comissaoTotal) / 100;
    const gastosExtrasManual = gastosExtrasFixos + (precoVendaManual * gastosExtrasPercent) / 100;
    
    const custoTotalManualComDifal = custoBase + tributosManual + comissaoManual + tarifaTotal + freteVenda + gastosExtrasManual + difalTotal;
    const custoTotalManualSemDifal = custoBase + tributosManual + comissaoManual + tarifaTotal + freteVenda + gastosExtrasManual;
    
    margemManualComDifal = precoVendaManual - custoTotalManualComDifal;
    margemManualComDifalPercent = (margemManualComDifal / precoVendaManual) * 100;
    margemManualSemDifal = precoVendaManual - custoTotalManualSemDifal;
    margemManualSemDifalPercent = (margemManualSemDifal / precoVendaManual) * 100;
  }
  
  // Calcular Falso Desconto para Shopee
  let falsoDescontoResult: ResultadoPrecificacao['falsoDesconto'];
  if (marketplace === 'shopee' && falsoDesconto?.ativo && precoSugerido > 0) {
    const precoBase = precoSugerido; // Preço técnico para margem desejada
    const acrescimo = falsoDesconto.acrescimoPercent / 100;
    const desconto = falsoDesconto.descontoPercent / 100;
    
    // Preço listado = preço base × (1 + acréscimo%)
    const precoListado = Math.round(precoBase * (1 + acrescimo) * 100) / 100;
    
    // Desconto em R$
    const descontoValor = Math.round(precoListado * desconto * 100) / 100;
    
    // Preço final ao cliente
    const precoFinalCliente = Math.round((precoListado - descontoValor) * 100) / 100;
    
    falsoDescontoResult = {
      precoBase,
      precoListado,
      descontoPercent: falsoDesconto.descontoPercent,
      descontoValor,
      precoFinalCliente,
    };
  }
  
  // Calcular comparação com Reforma Tributária 2026+ se houver alíquotas configuradas
  let comparacaoReforma: ResultadoPrecificacao['comparacaoReforma'];
  if (tributosPercentReforma > 0 && tributosPercent !== tributosPercentReforma) {
    const precoSugeridoReforma = calcularPrecoSugerido(
      custoBase,
      margemDesejada,
      comissaoTotal,
      tarifaTotal,
      tributosPercentReforma,
      freteVenda,
      gastosExtrasFixos,
      gastosExtrasPercent,
      difalTotal
    );
    
    const tributosReforma = (precoSugeridoReforma * tributosPercentReforma) / 100;
    const comissaoReforma = (precoSugeridoReforma * comissaoTotal) / 100;
    const gastosExtrasReforma = gastosExtrasFixos + (precoSugeridoReforma * gastosExtrasPercent) / 100;
    const custoTotalReforma = custoBase + tributosReforma + comissaoReforma + tarifaTotal + freteVenda + gastosExtrasReforma + difalTotal;
    
    const margemReforma = precoSugeridoReforma - custoTotalReforma;
    const margemReformaPercent = precoSugeridoReforma > 0 ? (margemReforma / precoSugeridoReforma) * 100 : 0;
    
    comparacaoReforma = {
      tributosAtualPercent: tributosPercent,
      tributosReformaPercent: tributosPercentReforma,
      precoSugeridoReforma,
      margemReforma,
      margemReformaPercent,
      diferencaMargemReais: margemReforma - margemComDifal,
      diferencaMargemPercent: margemReformaPercent - margemComDifalPercent,
    };
  }
  
  return {
    custoBase,
    tributosTotal,
    tributosPercent,
    comissaoTotal: comissaoValor,
    tarifasTotal: tarifaTotal,
    freteTotal: freteVenda,
    gastosExtrasTotal,
    difalTotal,
    custoTotalVariavel,
    custoTotalVariavelSemDifal,
    precoSugerido,
    margemComDifal,
    margemComDifalPercent,
    margemSemDifal,
    margemSemDifalPercent,
    precoManual: precoVendaManual,
    margemManualComDifal,
    margemManualComDifalPercent,
    margemManualSemDifal,
    margemManualSemDifalPercent,
    falsoDesconto: falsoDescontoResult,
    comparacaoReforma,
  };
};

// Verificar se é frete grátis ML (até R$ 79)
export const isFreteGratisML = (precoVenda: number): boolean => {
  return precoVenda > 0 && precoVenda <= 79;
};

// Verificar se deve habilitar configuração de frete para ML
export const deveHabilitarFreteML = (simulacao: SimulacaoPrecificacao): boolean => {
  // Se já tem preço manual > 79, habilita
  if (simulacao.precoVendaManual && simulacao.precoVendaManual > 79) return true;
  
  // Se já tem custo base, estimar preço mínimo
  if (simulacao.custoBase > 0) {
    const precoMinimo = estimarPrecoMinimo(simulacao);
    // Se preço mínimo já está perto ou acima de 79, habilita
    if (precoMinimo >= 75) return true;
  }
  
  // Se custo base sozinho já é alto, habilita
  if (simulacao.custoBase >= 50) return true;
  
  return false;
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
    notaBaixa: {
      ativa: false,
      opcao: 'nenhuma',
      percentualPersonalizado: 50,
    },
    tributacao: {
      icmsAliquota: aliquotas.icms,
      icmsValor: 0,
      icmsCredito: 0,
      stValor: 0,
      ipiAliquota: 0,
      ipiValor: 0,
      difalAtivo: false,
      difalAliquota: 0,
      difalValor: 0,
      fundoFiscalDifal: 0,
      pisAliquota: aliquotas.pis,
      cofinsAliquota: aliquotas.cofins,
      simplesAliquota: aliquotas.simples,
      usarImpostoEstimado: false,
      icmsEstimado: 18,
      pisCofinsEstimado: 9.25,
      simularReformaTributaria: false,
      cbsAliquota: 8.8, // Previsão CBS (IVA Federal)
      ibsAliquota: 17.7, // Previsão IBS (IVA Estadual/Municipal)
    },
    comissao: config.comissaoPadrao,
    tarifaFixa: config.tarifaFixaPadrao,
    taxasExtras: config.taxasExtras.map(t => ({ ...t })),
    taxasExtrasAtivas: false,
    falsoDesconto: {
      ativo: false,
      acrescimoPercent: 30,
      descontoPercent: 30,
      comissaoSobrePrecoListado: false, // Shopee cobra sobre preço final
    },
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
