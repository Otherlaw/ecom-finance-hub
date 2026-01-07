// ============= ICMS Credit Module Data Types & Logic (Restructured) =============

import { mockEmpresas, canUseICMSCredit, Empresa, RegimeTributario } from "./empresas-data";
import { mockFornecedores, Fornecedor } from "./fornecedores-data";

// ============= Enums & Types =============

export type TipoCreditoICMS = 'compensavel' | 'nao_compensavel';
export type OrigemCredito = 'compra_mercadoria' | 'compra_insumo' | 'devolucao_venda' | 'frete' | 'energia_eletrica' | 'ativo_imobilizado' | 'outro';
export type TipoAjuste = 'positivo' | 'negativo' | 'estorno';
export type StatusCredito = 'ativo' | 'estornado' | 'compensado' | 'expirado';

// ============= Interfaces =============

export interface NotaFiscalXML {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    uf: string;
  };
  destinatario: {
    cnpj: string;
    razaoSocial: string;
  };
  itens: NotaFiscalItem[];
  valorTotal: number;
  icmsTotal: number;
  ipiTotal: number;
  stTotal: number;
  freteTotal?: number;
  descontoTotal?: number;
  outrasDepesas?: number;
}

export interface NotaFiscalItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  cstCsosn: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  baseCalculoIcms: number;
  aliquotaIcms: number;
  valorIcms: number;
  icmsST?: number;
  baseCalculoST?: number;
  aliquotaIPI?: number;
  valorIPI?: number;
  pis?: number;
  cofins?: number;
  // Campos adicionais para ST detalhado
  grupoICMS?: string;           // Nome do grupo (ICMS00, ICMS10, ICMS60, etc.)
  cstNumero?: string;           // Apenas número CST (ex: "10")
  isSubstituicaoTributaria?: boolean; // Flag para identificar item ST
  pMVAST?: number;              // % MVA da ST (quando houver)
  pICMSST?: number;             // Alíquota ICMS-ST
}

export interface CreditoICMS {
  id: string;
  empresa: string;
  empresaId?: string;
  
  // Classificação do crédito
  tipoCredito: TipoCreditoICMS;
  origemCredito: string; // Pode ser OrigemCredito padrão ou custom_UUID
  statusCredito: StatusCredito;
  
  // Dados da NF
  notaFiscalId?: string;
  chaveAcesso?: string;
  numeroNF?: string;
  
  // Dados do item/operação
  ncm: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ufOrigem: string;
  cfop?: string;
  
  // Valores de ICMS
  aliquotaIcms: number;
  valorIcmsDestacado: number;
  percentualAproveitamento: number;
  valorCreditoBruto: number;
  valorAjustes: number;
  valorCredito: number; // = valorCreditoBruto + valorAjustes
  
  // Controle
  dataLancamento: string;
  dataCompetencia: string; // Mês/ano de competência
  responsavel?: string;
  observacoes?: string;
  
  // Vínculo com fornecedor (para notas adquiridas)
  fornecedorId?: string;
  fornecedorNome?: string;
  
  // Ajustes vinculados
  ajustes?: AjusteCredito[];
}

export interface AjusteCredito {
  id: string;
  creditoId: string;
  tipoAjuste: TipoAjuste;
  motivo: string;
  valor: number;
  dataAjuste: string;
  observacoes?: string;
}

export interface NotaCreditoAdquirida {
  id: string;
  empresaId: string;
  empresa: string;
  fornecedorId: string;
  fornecedorNome: string;
  numeroNF: string;
  chaveAcesso?: string;
  dataOperacao: string;
  valorOperacao: number;
  valorCreditoGerado: number;
  aliquotaMedia: number;
  observacoes?: string;
  dataCadastro: string;
}

export interface PerfilCreditoEmpresa {
  empresaId: string;
  regime: RegimeTributario;
  cfopsCredito: string[]; // CFOPs que geram crédito
  tiposOperacaoCredito: OrigemCredito[];
  freteGeraCred: boolean;
  devolucaoGeraCredito: boolean;
  aliquotaMedia: number;
  observacoes?: string;
}

export interface ICMSRecommendation {
  icmsDebito: number;
  totalCreditosCompensaveis: number;
  totalCreditosNaoCompensaveis: number;
  icmsLiquido: number;
  suficiente: boolean;
  valorFaltante: number;
  valorNotasNecessario: number;
  aliquotaMedia: number;
  mensagem: string;
}

export interface ResumoICMSEmpresa {
  empresaId: string;
  empresaNome: string;
  regimeTributario: RegimeTributario;
  podeCompensarCredito: boolean;
  
  // Créditos Compensáveis
  creditosBrutos: number;
  ajustesPositivos: number;
  ajustesNegativos: number;
  creditosLiquidos: number;
  
  // Créditos Não Compensáveis
  creditosInformativos: number;
  
  // Por origem
  creditosPorOrigem: {
    compra_mercadoria: number;
    compra_insumo: number;
    devolucao_venda: number;
    frete: number;
    energia_eletrica: number;
    ativo_imobilizado: number;
    outro: number;
  };
  
  // Débito e Saldo
  icmsDebito: number;
  saldoICMS: number;
  percentualCobertura: number;
}

// ============= Configuration =============

export const ORIGEM_CREDITO_CONFIG: Record<OrigemCredito, { label: string; color: string; bgColor: string }> = {
  compra_mercadoria: { label: 'Compra de Mercadoria', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  compra_insumo: { label: 'Compra de Insumo', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  devolucao_venda: { label: 'Devolução de Venda', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  frete: { label: 'Frete', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  energia_eletrica: { label: 'Energia Elétrica', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  ativo_imobilizado: { label: 'Ativo Imobilizado', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  outro: { label: 'Outro', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const TIPO_CREDITO_CONFIG: Record<TipoCreditoICMS, { label: string; color: string; bgColor: string; description: string }> = {
  compensavel: { 
    label: 'Compensável', 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    description: 'Crédito válido para compensação de ICMS devido'
  },
  nao_compensavel: { 
    label: 'Não Compensável', 
    color: 'text-blue-600', 
    bgColor: 'bg-blue-50',
    description: 'Crédito informativo, não utilizado na compensação'
  },
};

export const STATUS_CREDITO_CONFIG: Record<StatusCredito, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'text-success' },
  estornado: { label: 'Estornado', color: 'text-destructive' },
  compensado: { label: 'Compensado', color: 'text-blue-600' },
  expirado: { label: 'Expirado', color: 'text-muted-foreground' },
};

// CFOPs que tipicamente geram crédito de ICMS
export const CFOPS_CREDITO_PADRAO = [
  '1102', '1403', '1556', '1949', // Entradas internas
  '2102', '2403', '2556', '2949', // Entradas interestaduais
];

// Marcador especial para erro de NFSe
export const NFSE_ERROR_MARKER = "__NFSE_NOT_SUPPORTED__";

// Função auxiliar para detectar se XML é NFSe
export const isNFSeXML = (xmlContent: string): boolean => {
  const xmlLower = xmlContent.toLowerCase();
  return (
    xmlLower.includes("<nfse") ||
    xmlLower.includes("<compnfse") ||
    xmlLower.includes("<consultarnfse") ||
    xmlLower.includes("<infnfse") ||
    xmlLower.includes("nfse.xsd") ||
    xmlLower.includes("<servico>") ||
    xmlLower.includes("<tomador>") ||
    xmlLower.includes("<prestador>") ||
    xmlLower.includes("<listnfse") ||
    // Verifica ausência total de tags de NF-e junto com tags de serviço
    (!xmlLower.includes("<infnfe") && xmlLower.includes("<iss"))
  );
};

// ============= XML Parser for NF-e =============
export const parseNFeXML = (xmlContent: string): NotaFiscalXML | null => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      console.error("XML parsing error:", parseError.textContent);
      return null;
    }

    const infNFe = xmlDoc.querySelector("infNFe") || xmlDoc.querySelector("*|infNFe");
    if (!infNFe) {
      // Detectar se é NFSe antes de retornar null genérico
      if (isNFSeXML(xmlContent)) {
        console.error("XML is NFSe (service invoice), not NF-e");
        // Retornar objeto com marcador de erro para que o chamador possa identificar
        return { error: NFSE_ERROR_MARKER } as any;
      }
      console.error("Invalid NF-e XML: infNFe not found");
      return null;
    }

    const chaveAcesso = infNFe.getAttribute("Id")?.replace("NFe", "") || "";

    const ide = infNFe.querySelector("ide");
    const numero = ide?.querySelector("nNF")?.textContent || "";
    const serie = ide?.querySelector("serie")?.textContent || "";
    const dataEmissao = ide?.querySelector("dhEmi")?.textContent?.substring(0, 10) || "";

    const emit = infNFe.querySelector("emit");
    const emitCnpj = emit?.querySelector("CNPJ")?.textContent || "";
    const emitRazaoSocial = emit?.querySelector("xNome")?.textContent || "";
    const emitUf = emit?.querySelector("enderEmit UF")?.textContent || 
                   emit?.querySelector("enderEmit")?.querySelector("UF")?.textContent || "";

    const dest = infNFe.querySelector("dest");
    const destCnpj = dest?.querySelector("CNPJ")?.textContent || "";
    const destRazaoSocial = dest?.querySelector("xNome")?.textContent || "";

    const detElements = infNFe.querySelectorAll("det");
    const itens: NotaFiscalItem[] = [];

    detElements.forEach((det) => {
      const prod = det.querySelector("prod");
      const imposto = det.querySelector("imposto");
      const icms = imposto?.querySelector("ICMS");
      
      // Detectar qual grupo ICMS está sendo usado
      const gruposICMS = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS41', 'ICMS50',
                          'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90', 'ICMSSN101', 
                          'ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900'];
      let grupoICMS = '';
      let icmsGroup: Element | null = null;

      for (const grupo of gruposICMS) {
        const found = icms?.querySelector(grupo);
        if (found) {
          grupoICMS = grupo;
          icmsGroup = found;
          break;
        }
      }
      
      // Fallback para primeiro elemento filho se não encontrou grupo específico
      if (!icmsGroup) {
        icmsGroup = icms?.firstElementChild || null;
      }
      
      // Extract IPI data
      const ipi = imposto?.querySelector("IPI");
      const ipiTrib = ipi?.querySelector("IPITrib");
      
      // IPI values - IPITrib contains taxable IPI, IPINT is non-taxable
      const aliquotaIPI = parseFloat(ipiTrib?.querySelector("pIPI")?.textContent || "0");
      const valorIPI = parseFloat(ipiTrib?.querySelector("vIPI")?.textContent || "0");
      
      // ICMS ST values - IMPORTANTE: vICMSST é o imposto, vBCST é apenas base de cálculo
      const baseCalculoST = parseFloat(icmsGroup?.querySelector("vBCST")?.textContent || "0");
      const icmsST = parseFloat(icmsGroup?.querySelector("vICMSST")?.textContent || "0");
      const pMVAST = parseFloat(icmsGroup?.querySelector("pMVAST")?.textContent || "0");
      const pICMSST = parseFloat(icmsGroup?.querySelector("pICMSST")?.textContent || "0");
      
      // CST vem do grupo encontrado
      const cstCompleto = icmsGroup?.querySelector("CST")?.textContent || 
                          icmsGroup?.querySelector("CSOSN")?.textContent || "";
      const cstNumero = cstCompleto.slice(-2); // Pega últimos 2 dígitos
      
      // Grupos com ST: ICMS10 (tributado + ST), ICMS30 (isento + ST), 
      // ICMS60 (cobrado anteriormente por ST), ICMS70 (reduzido + ST)
      const gruposComST = ['ICMS10', 'ICMS30', 'ICMS60', 'ICMS70', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500'];
      const isSubstituicaoTributaria = gruposComST.includes(grupoICMS) || icmsST > 0;

      const item: NotaFiscalItem = {
        codigo: prod?.querySelector("cProd")?.textContent || "",
        descricao: prod?.querySelector("xProd")?.textContent || "",
        ncm: prod?.querySelector("NCM")?.textContent || "",
        cfop: prod?.querySelector("CFOP")?.textContent || "",
        cstCsosn: cstCompleto,
        quantidade: parseFloat(prod?.querySelector("qCom")?.textContent || "0"),
        valorUnitario: parseFloat(prod?.querySelector("vUnCom")?.textContent || "0"),
        valorTotal: parseFloat(prod?.querySelector("vProd")?.textContent || "0"),
        baseCalculoIcms: parseFloat(icmsGroup?.querySelector("vBC")?.textContent || "0"),
        aliquotaIcms: parseFloat(icmsGroup?.querySelector("pICMS")?.textContent || "0"),
        valorIcms: parseFloat(icmsGroup?.querySelector("vICMS")?.textContent || "0"),
        icmsST: icmsST,
        baseCalculoST: baseCalculoST,
        aliquotaIPI: aliquotaIPI,
        valorIPI: valorIPI,
        pis: parseFloat(imposto?.querySelector("PIS")?.querySelector("vPIS")?.textContent || "0"),
        cofins: parseFloat(imposto?.querySelector("COFINS")?.querySelector("vCOFINS")?.textContent || "0"),
        // Campos adicionais para ST
        grupoICMS,
        cstNumero,
        isSubstituicaoTributaria,
        pMVAST,
        pICMSST,
      };

      itens.push(item);
    });

    const total = infNFe.querySelector("total ICMSTot");
    const valorTotal = parseFloat(total?.querySelector("vNF")?.textContent || "0");
    const icmsTotal = parseFloat(total?.querySelector("vICMS")?.textContent || "0");
    const ipiTotal = parseFloat(total?.querySelector("vIPI")?.textContent || "0");
    const stTotal = parseFloat(total?.querySelector("vST")?.textContent || "0");
    const freteTotal = parseFloat(total?.querySelector("vFrete")?.textContent || "0");
    const descontoTotal = parseFloat(total?.querySelector("vDesc")?.textContent || "0");
    const outrasDepesas = parseFloat(total?.querySelector("vOutro")?.textContent || "0");

    return {
      chaveAcesso,
      numero,
      serie,
      dataEmissao,
      emitente: {
        cnpj: emitCnpj,
        razaoSocial: emitRazaoSocial,
        uf: emitUf,
      },
      destinatario: {
        cnpj: destCnpj,
        razaoSocial: destRazaoSocial,
      },
      itens,
      valorTotal,
      icmsTotal,
      ipiTotal,
      stTotal,
      freteTotal,
      descontoTotal,
      outrasDepesas,
    };
  } catch (error) {
    console.error("Error parsing NF-e XML:", error);
    return null;
  }
};

// ============= ICMS Calculation Functions =============
export const calcularICMS = (
  valorTotal: number,
  aliquotaIcms: number,
  percentualAproveitamento: number = 100,
  valorIcmsDestacado?: number
): { valorIcmsDestacado: number; valorCredito: number } => {
  const icmsDestacado = valorIcmsDestacado ?? (valorTotal * (aliquotaIcms / 100));
  const credito = icmsDestacado * (percentualAproveitamento / 100);

  return {
    valorIcmsDestacado: Math.round(icmsDestacado * 100) / 100,
    valorCredito: Math.round(credito * 100) / 100,
  };
};

// Determina o tipo de crédito baseado no regime da empresa
export const determinarTipoCredito = (empresaNome: string, empresas: Empresa[]): TipoCreditoICMS => {
  const empresa = empresas.find(e => 
    e.nome.toUpperCase().includes(empresaNome.toUpperCase()) || 
    empresaNome.toUpperCase().includes(e.nome.split(' ')[0].toUpperCase())
  );
  
  if (!empresa) return 'compensavel';
  return canUseICMSCredit(empresa.regimeTributario) ? 'compensavel' : 'nao_compensavel';
};

// ============= Generate Credits from NF-e =============
export const generateCreditsFromNFe = (
  nfe: NotaFiscalXML,
  empresa: string,
  origemCredito: OrigemCredito = 'compra_mercadoria',
  fornecedorId?: string,
  fornecedorNome?: string
): CreditoICMS[] => {
  const credits: CreditoICMS[] = [];
  const tipoCredito = determinarTipoCredito(empresa, mockEmpresas);
  const hoje = new Date().toISOString().split("T")[0];
  const competencia = `${hoje.substring(0, 7)}`;

  nfe.itens.forEach((item, index) => {
    if (item.valorIcms > 0) {
      const credit: CreditoICMS = {
        id: `${nfe.chaveAcesso}-${index}`,
        empresa,
        tipoCredito,
        origemCredito,
        statusCredito: 'ativo',
        notaFiscalId: nfe.chaveAcesso,
        chaveAcesso: nfe.chaveAcesso,
        numeroNF: nfe.numero,
        ncm: item.ncm,
        cfop: item.cfop,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        ufOrigem: nfe.emitente.uf,
        aliquotaIcms: item.aliquotaIcms,
        valorIcmsDestacado: item.valorIcms,
        percentualAproveitamento: 100,
        valorCreditoBruto: item.valorIcms,
        valorAjustes: 0,
        valorCredito: item.valorIcms,
        dataLancamento: hoje,
        dataCompetencia: competencia,
        fornecedorId,
        fornecedorNome,
        observacoes: `Importado automaticamente da NF ${nfe.numero}`,
      };
      credits.push(credit);
    }
  });

  return credits;
};

// ============= Calcular Resumo por Empresa =============
export const calcularResumoEmpresa = (
  creditos: CreditoICMS[],
  empresaNome: string,
  icmsDebito: number
): ResumoICMSEmpresa => {
  const empresa = mockEmpresas.find(e => 
    e.nome.toUpperCase().includes(empresaNome.toUpperCase()) || 
    empresaNome.toUpperCase().includes(e.nome.split(' ')[0].toUpperCase())
  );
  
  const creditosEmpresa = creditos.filter(c => 
    c.empresa.toUpperCase().includes(empresaNome.toUpperCase()) ||
    empresaNome.toUpperCase().includes(c.empresa.toUpperCase())
  );
  
  const creditosCompensaveis = creditosEmpresa.filter(c => c.tipoCredito === 'compensavel' && c.statusCredito === 'ativo');
  const creditosNaoCompensaveis = creditosEmpresa.filter(c => c.tipoCredito === 'nao_compensavel' && c.statusCredito === 'ativo');
  
  const creditosBrutos = creditosCompensaveis.reduce((sum, c) => sum + c.valorCreditoBruto, 0);
  const ajustesPositivos = creditosCompensaveis.reduce((sum, c) => sum + (c.valorAjustes > 0 ? c.valorAjustes : 0), 0);
  const ajustesNegativos = creditosCompensaveis.reduce((sum, c) => sum + (c.valorAjustes < 0 ? Math.abs(c.valorAjustes) : 0), 0);
  const creditosLiquidos = creditosBrutos + ajustesPositivos - ajustesNegativos;
  
  const creditosInformativos = creditosNaoCompensaveis.reduce((sum, c) => sum + c.valorCredito, 0);
  
  const podeCompensarCredito = empresa ? canUseICMSCredit(empresa.regimeTributario) : true;
  const debitoEfetivo = podeCompensarCredito ? icmsDebito : 0;
  const saldoICMS = creditosLiquidos - debitoEfetivo;
  const percentualCobertura = debitoEfetivo > 0 ? (creditosLiquidos / debitoEfetivo) * 100 : 100;
  
  return {
    empresaId: empresa?.id || '',
    empresaNome,
    regimeTributario: empresa?.regimeTributario || 'lucro_presumido',
    podeCompensarCredito,
    creditosBrutos,
    ajustesPositivos,
    ajustesNegativos,
    creditosLiquidos,
    creditosInformativos,
    creditosPorOrigem: {
      compra_mercadoria: creditosCompensaveis.filter(c => c.origemCredito === 'compra_mercadoria').reduce((s, c) => s + c.valorCredito, 0),
      compra_insumo: creditosCompensaveis.filter(c => c.origemCredito === 'compra_insumo').reduce((s, c) => s + c.valorCredito, 0),
      devolucao_venda: creditosCompensaveis.filter(c => c.origemCredito === 'devolucao_venda').reduce((s, c) => s + c.valorCredito, 0),
      frete: creditosCompensaveis.filter(c => c.origemCredito === 'frete').reduce((s, c) => s + c.valorCredito, 0),
      energia_eletrica: creditosCompensaveis.filter(c => c.origemCredito === 'energia_eletrica').reduce((s, c) => s + c.valorCredito, 0),
      ativo_imobilizado: creditosCompensaveis.filter(c => c.origemCredito === 'ativo_imobilizado').reduce((s, c) => s + c.valorCredito, 0),
      outro: creditosCompensaveis.filter(c => c.origemCredito === 'outro').reduce((s, c) => s + c.valorCredito, 0),
    },
    icmsDebito: debitoEfetivo,
    saldoICMS,
    percentualCobertura,
  };
};

// ============= Recommendation Calculator =============
export const calculateRecommendation = (
  icmsDebito: number,
  totalCreditosCompensaveis: number,
  totalCreditosNaoCompensaveis: number = 0,
  aliquotaMedia: number = 8
): ICMSRecommendation => {
  const icmsLiquido = icmsDebito - totalCreditosCompensaveis;
  const suficiente = icmsLiquido <= 0;
  const valorFaltante = suficiente ? 0 : icmsLiquido;
  const valorNotasNecessario = valorFaltante > 0 ? (valorFaltante / (aliquotaMedia / 100)) : 0;

  let mensagem: string;
  if (suficiente) {
    mensagem = `Seus créditos compensáveis de ICMS (${formatCurrency(totalCreditosCompensaveis)}) são suficientes para cobrir o ICMS devido (${formatCurrency(icmsDebito)}) neste período.`;
  } else {
    mensagem = `Faltam ${formatCurrency(valorFaltante)} em crédito de ICMS para zerar o imposto. Isso corresponde aproximadamente a ${formatCurrency(valorNotasNecessario)} em notas fiscais com alíquota média de ${aliquotaMedia}%.`;
  }

  return {
    icmsDebito,
    totalCreditosCompensaveis,
    totalCreditosNaoCompensaveis,
    icmsLiquido,
    suficiente,
    valorFaltante,
    valorNotasNecessario: Math.round(valorNotasNecessario * 100) / 100,
    aliquotaMedia,
    mensagem,
  };
};

// ============= Validation Functions =============
export interface CreditoICMSValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateCreditoICMS = (credito: Partial<CreditoICMS>): CreditoICMSValidation => {
  const errors: Record<string, string> = {};

  if (!credito.empresa?.trim()) {
    errors.empresa = "Campo obrigatório";
  }

  if (!credito.ncm?.trim()) {
    errors.ncm = "Campo obrigatório";
  } else if (!/^\d{8}$/.test(credito.ncm.replace(/\./g, ""))) {
    errors.ncm = "NCM deve ter 8 dígitos";
  }

  if (!credito.quantidade || credito.quantidade <= 0) {
    errors.quantidade = "Quantidade deve ser maior que zero";
  }

  if (!credito.valorUnitario || credito.valorUnitario <= 0) {
    errors.valorUnitario = "Valor unitário deve ser maior que zero";
  }

  if (!credito.valorTotal || credito.valorTotal <= 0) {
    errors.valorTotal = "Valor total deve ser maior que zero";
  }

  if (!credito.ufOrigem?.trim()) {
    errors.ufOrigem = "Campo obrigatório";
  } else if (!/^[A-Z]{2}$/.test(credito.ufOrigem.toUpperCase())) {
    errors.ufOrigem = "UF inválida";
  }

  if (credito.aliquotaIcms === undefined || credito.aliquotaIcms < 0) {
    errors.aliquotaIcms = "Alíquota deve ser maior ou igual a zero";
  } else if (credito.aliquotaIcms > 100) {
    errors.aliquotaIcms = "Alíquota não pode ser maior que 100%";
  }

  if (credito.percentualAproveitamento === undefined || credito.percentualAproveitamento < 0) {
    errors.percentualAproveitamento = "Percentual deve ser maior ou igual a zero";
  } else if (credito.percentualAproveitamento > 100) {
    errors.percentualAproveitamento = "Percentual não pode ser maior que 100%";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= Mock Data for Stored Credits (Restructured) =============
export const mockCreditosICMS: CreditoICMS[] = [
  {
    id: "cred-001",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "compra_mercadoria",
    statusCredito: "ativo",
    numeroNF: "12345",
    ncm: "85287200",
    cfop: "2102",
    descricao: "Televisor LCD 50 polegadas",
    quantidade: 50,
    valorUnitario: 1200,
    valorTotal: 60000,
    ufOrigem: "SP",
    aliquotaIcms: 12,
    valorIcmsDestacado: 7200,
    percentualAproveitamento: 100,
    valorCreditoBruto: 7200,
    valorAjustes: 0,
    valorCredito: 7200,
    dataLancamento: "2024-10-05",
    dataCompetencia: "2024-10",
    observacoes: "Compra para revenda",
  },
  {
    id: "cred-002",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "compra_mercadoria",
    statusCredito: "ativo",
    numeroNF: "12346",
    ncm: "84713012",
    cfop: "2102",
    descricao: "Notebook Core i5",
    quantidade: 30,
    valorUnitario: 2500,
    valorTotal: 75000,
    ufOrigem: "PR",
    aliquotaIcms: 12,
    valorIcmsDestacado: 9000,
    percentualAproveitamento: 100,
    valorCreditoBruto: 9000,
    valorAjustes: 0,
    valorCredito: 9000,
    dataLancamento: "2024-10-10",
    dataCompetencia: "2024-10",
    observacoes: "Importação via fornecedor nacional",
  },
  {
    id: "cred-003",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "compra_mercadoria",
    statusCredito: "ativo",
    numeroNF: "12347",
    ncm: "85171231",
    cfop: "1102",
    descricao: "Smartphone Android 128GB",
    quantidade: 100,
    valorUnitario: 800,
    valorTotal: 80000,
    ufOrigem: "MG",
    aliquotaIcms: 12,
    valorIcmsDestacado: 9600,
    percentualAproveitamento: 100,
    valorCreditoBruto: 9600,
    valorAjustes: 0,
    valorCredito: 9600,
    dataLancamento: "2024-10-15",
    dataCompetencia: "2024-10",
    observacoes: "",
  },
  {
    id: "cred-004",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "devolucao_venda",
    statusCredito: "ativo",
    numeroNF: "98765",
    ncm: "85171231",
    cfop: "1411",
    descricao: "Devolução - Smartphone defeituoso",
    quantidade: 5,
    valorUnitario: 800,
    valorTotal: 4000,
    ufOrigem: "SP",
    aliquotaIcms: 18,
    valorIcmsDestacado: 720,
    percentualAproveitamento: 100,
    valorCreditoBruto: 720,
    valorAjustes: 0,
    valorCredito: 720,
    dataLancamento: "2024-10-18",
    dataCompetencia: "2024-10",
    observacoes: "Devolução de cliente - garantia",
  },
  {
    id: "cred-005",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "ativo_imobilizado",
    statusCredito: "ativo",
    numeroNF: "77777",
    ncm: "99999999",
    descricao: "Nota fiscal de crédito adquirida",
    quantidade: 1,
    valorUnitario: 50000,
    valorTotal: 50000,
    ufOrigem: "SP",
    aliquotaIcms: 8,
    valorIcmsDestacado: 4000,
    percentualAproveitamento: 100,
    valorCreditoBruto: 4000,
    valorAjustes: 0,
    valorCredito: 4000,
    dataLancamento: "2024-10-20",
    dataCompetencia: "2024-10",
    fornecedorId: "forn-012",
    fornecedorNome: "Créditos Fiscais SP Ltda",
    observacoes: "Nota de crédito comprada para compensação",
  },
  {
    id: "cred-006",
    empresa: "INPARI",
    tipoCredito: "nao_compensavel",
    origemCredito: "compra_mercadoria",
    statusCredito: "ativo",
    numeroNF: "54321",
    ncm: "94035000",
    cfop: "2102",
    descricao: "Móvel para escritório",
    quantidade: 20,
    valorUnitario: 450,
    valorTotal: 9000,
    ufOrigem: "SC",
    aliquotaIcms: 7,
    valorIcmsDestacado: 630,
    percentualAproveitamento: 100,
    valorCreditoBruto: 630,
    valorAjustes: 0,
    valorCredito: 630,
    dataLancamento: "2024-10-18",
    dataCompetencia: "2024-10",
    observacoes: "Material de escritório - Simples Nacional (informativo)",
  },
  {
    id: "cred-007",
    empresa: "INPARI",
    tipoCredito: "nao_compensavel",
    origemCredito: "compra_mercadoria",
    statusCredito: "ativo",
    numeroNF: "54322",
    ncm: "84716052",
    cfop: "2102",
    descricao: "Monitor LED 24 polegadas",
    quantidade: 15,
    valorUnitario: 600,
    valorTotal: 9000,
    ufOrigem: "RS",
    aliquotaIcms: 12,
    valorIcmsDestacado: 1080,
    percentualAproveitamento: 100,
    valorCreditoBruto: 1080,
    valorAjustes: 0,
    valorCredito: 1080,
    dataLancamento: "2024-10-20",
    dataCompetencia: "2024-10",
    observacoes: "Simples Nacional - apenas controle interno",
  },
  {
    id: "cred-008",
    empresa: "EXCHANGE",
    tipoCredito: "compensavel",
    origemCredito: "frete",
    statusCredito: "ativo",
    numeroNF: "CT-e 88888",
    ncm: "00000000",
    cfop: "2353",
    descricao: "Frete sobre compra de mercadorias",
    quantidade: 1,
    valorUnitario: 5000,
    valorTotal: 5000,
    ufOrigem: "SP",
    aliquotaIcms: 12,
    valorIcmsDestacado: 600,
    percentualAproveitamento: 100,
    valorCreditoBruto: 600,
    valorAjustes: 0,
    valorCredito: 600,
    dataLancamento: "2024-10-22",
    dataCompetencia: "2024-10",
    observacoes: "Crédito de frete sobre mercadorias",
  },
];

// Mock data para notas de crédito adquiridas
export const mockNotasAdquiridas: NotaCreditoAdquirida[] = [
  {
    id: "nca-001",
    empresaId: "emp-001",
    empresa: "EXCHANGE",
    fornecedorId: "forn-012",
    fornecedorNome: "Créditos Fiscais SP Ltda",
    numeroNF: "77777",
    dataOperacao: "2024-10-20",
    valorOperacao: 50000,
    valorCreditoGerado: 4000,
    aliquotaMedia: 8,
    observacoes: "Compra de nota para compensar saldo negativo de ICMS",
    dataCadastro: "2024-10-20",
  },
];

// ============= Utilities =============
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatDate = (date: string): string => {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

export const formatCompetencia = (competencia: string): string => {
  if (!competencia) return "";
  const [year, month] = competencia.split("-");
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(month) - 1]}/${year}`;
};

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const EMPRESAS = ["EXCHANGE", "INPARI"];
