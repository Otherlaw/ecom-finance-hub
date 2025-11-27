// ============= ICMS Credit Module Data Types & Logic =============

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
  pis?: number;
  cofins?: number;
}

export interface CreditoICMS {
  id: string;
  empresa: string;
  notaFiscalId?: string;
  chaveAcesso?: string;
  numeroNF?: string;
  ncm: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ufOrigem: string;
  aliquotaIcms: number;
  valorIcmsDestacado: number;
  percentualAproveitamento: number;
  valorCredito: number;
  dataLancamento: string;
  responsavel?: string;
  observacoes?: string;
}

export interface ICMSRecommendation {
  icmsDebito: number;
  totalCreditos: number;
  icmsLiquido: number;
  suficiente: boolean;
  valorFaltante: number;
  valorNotasNecessario: number;
  aliquotaMedia: number;
  mensagem: string;
}

// ============= XML Parser for NF-e =============
export const parseNFeXML = (xmlContent: string): NotaFiscalXML | null => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Check for parsing errors
    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      console.error("XML parsing error:", parseError.textContent);
      return null;
    }

    // Get infNFe element (main container)
    const infNFe = xmlDoc.querySelector("infNFe") || xmlDoc.querySelector("*|infNFe");
    if (!infNFe) {
      console.error("Invalid NF-e XML: infNFe not found");
      return null;
    }

    // Extract chave de acesso from Id attribute
    const chaveAcesso = infNFe.getAttribute("Id")?.replace("NFe", "") || "";

    // Extract ide (identification)
    const ide = infNFe.querySelector("ide");
    const numero = ide?.querySelector("nNF")?.textContent || "";
    const serie = ide?.querySelector("serie")?.textContent || "";
    const dataEmissao = ide?.querySelector("dhEmi")?.textContent?.substring(0, 10) || "";

    // Extract emit (emitter)
    const emit = infNFe.querySelector("emit");
    const emitCnpj = emit?.querySelector("CNPJ")?.textContent || "";
    const emitRazaoSocial = emit?.querySelector("xNome")?.textContent || "";
    const emitUf = emit?.querySelector("enderEmit UF")?.textContent || 
                   emit?.querySelector("enderEmit")?.querySelector("UF")?.textContent || "";

    // Extract dest (destination)
    const dest = infNFe.querySelector("dest");
    const destCnpj = dest?.querySelector("CNPJ")?.textContent || "";
    const destRazaoSocial = dest?.querySelector("xNome")?.textContent || "";

    // Extract items (det)
    const detElements = infNFe.querySelectorAll("det");
    const itens: NotaFiscalItem[] = [];

    detElements.forEach((det) => {
      const prod = det.querySelector("prod");
      const imposto = det.querySelector("imposto");
      const icms = imposto?.querySelector("ICMS");
      
      // Find ICMS group (ICMS00, ICMS10, ICMS20, etc.)
      const icmsGroup = icms?.querySelector("[class^='ICMS']") || 
                        icms?.firstElementChild;

      const item: NotaFiscalItem = {
        codigo: prod?.querySelector("cProd")?.textContent || "",
        descricao: prod?.querySelector("xProd")?.textContent || "",
        ncm: prod?.querySelector("NCM")?.textContent || "",
        cfop: prod?.querySelector("CFOP")?.textContent || "",
        cstCsosn: icmsGroup?.querySelector("CST")?.textContent || 
                  icmsGroup?.querySelector("CSOSN")?.textContent || "",
        quantidade: parseFloat(prod?.querySelector("qCom")?.textContent || "0"),
        valorUnitario: parseFloat(prod?.querySelector("vUnCom")?.textContent || "0"),
        valorTotal: parseFloat(prod?.querySelector("vProd")?.textContent || "0"),
        baseCalculoIcms: parseFloat(icmsGroup?.querySelector("vBC")?.textContent || "0"),
        aliquotaIcms: parseFloat(icmsGroup?.querySelector("pICMS")?.textContent || "0"),
        valorIcms: parseFloat(icmsGroup?.querySelector("vICMS")?.textContent || "0"),
        icmsST: parseFloat(icmsGroup?.querySelector("vICMSST")?.textContent || "0"),
        pis: parseFloat(imposto?.querySelector("PIS")?.querySelector("vPIS")?.textContent || "0"),
        cofins: parseFloat(imposto?.querySelector("COFINS")?.querySelector("vCOFINS")?.textContent || "0"),
      };

      itens.push(item);
    });

    // Extract totals
    const total = infNFe.querySelector("total ICMSTot");
    const valorTotal = parseFloat(total?.querySelector("vNF")?.textContent || "0");
    const icmsTotal = parseFloat(total?.querySelector("vICMS")?.textContent || "0");

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

// ============= Generate Credits from NF-e =============
export const generateCreditsFromNFe = (
  nfe: NotaFiscalXML,
  empresa: string
): CreditoICMS[] => {
  const credits: CreditoICMS[] = [];

  nfe.itens.forEach((item, index) => {
    // Only generate credit for items with ICMS > 0
    if (item.valorIcms > 0) {
      const credit: CreditoICMS = {
        id: `${nfe.chaveAcesso}-${index}`,
        empresa,
        notaFiscalId: nfe.chaveAcesso,
        chaveAcesso: nfe.chaveAcesso,
        numeroNF: nfe.numero,
        ncm: item.ncm,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
        ufOrigem: nfe.emitente.uf,
        aliquotaIcms: item.aliquotaIcms,
        valorIcmsDestacado: item.valorIcms,
        percentualAproveitamento: 100,
        valorCredito: item.valorIcms, // 100% aproveitamento por padrão
        dataLancamento: new Date().toISOString().split("T")[0],
        observacoes: `Importado automaticamente da NF ${nfe.numero}`,
      };
      credits.push(credit);
    }
  });

  return credits;
};

// ============= Recommendation Calculator =============
export const calculateRecommendation = (
  icmsDebito: number,
  totalCreditos: number,
  aliquotaMedia: number = 8
): ICMSRecommendation => {
  const icmsLiquido = icmsDebito - totalCreditos;
  const suficiente = icmsLiquido <= 0;
  const valorFaltante = suficiente ? 0 : icmsLiquido;
  const valorNotasNecessario = valorFaltante > 0 ? (valorFaltante / (aliquotaMedia / 100)) : 0;

  let mensagem: string;
  if (suficiente) {
    mensagem = `Seus créditos de ICMS (${formatCurrency(totalCreditos)}) são suficientes para compensar o ICMS devido (${formatCurrency(icmsDebito)}) neste período.`;
  } else {
    mensagem = `Faltam ${formatCurrency(valorFaltante)} em crédito de ICMS para zerar o imposto. Isso corresponde, aproximadamente, a ${formatCurrency(valorNotasNecessario)} em notas fiscais com alíquota média de ${aliquotaMedia}%.`;
  }

  return {
    icmsDebito,
    totalCreditos,
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

// ============= Mock Data for Stored Credits =============
export const mockCreditosICMS: CreditoICMS[] = [
  {
    id: "cred-001",
    empresa: "EXCHANGE",
    numeroNF: "12345",
    ncm: "85287200",
    descricao: "Televisor LCD 50 polegadas",
    quantidade: 50,
    valorUnitario: 1200,
    valorTotal: 60000,
    ufOrigem: "SP",
    aliquotaIcms: 12,
    valorIcmsDestacado: 7200,
    percentualAproveitamento: 100,
    valorCredito: 7200,
    dataLancamento: "2024-10-05",
    observacoes: "Compra para revenda",
  },
  {
    id: "cred-002",
    empresa: "EXCHANGE",
    numeroNF: "12346",
    ncm: "84713012",
    descricao: "Notebook Core i5",
    quantidade: 30,
    valorUnitario: 2500,
    valorTotal: 75000,
    ufOrigem: "PR",
    aliquotaIcms: 12,
    valorIcmsDestacado: 9000,
    percentualAproveitamento: 100,
    valorCredito: 9000,
    dataLancamento: "2024-10-10",
    observacoes: "Importação via fornecedor nacional",
  },
  {
    id: "cred-003",
    empresa: "EXCHANGE",
    numeroNF: "12347",
    ncm: "85171231",
    descricao: "Smartphone Android 128GB",
    quantidade: 100,
    valorUnitario: 800,
    valorTotal: 80000,
    ufOrigem: "MG",
    aliquotaIcms: 12,
    valorIcmsDestacado: 9600,
    percentualAproveitamento: 100,
    valorCredito: 9600,
    dataLancamento: "2024-10-15",
    observacoes: "",
  },
  {
    id: "cred-004",
    empresa: "INPARI",
    numeroNF: "54321",
    ncm: "94035000",
    descricao: "Móvel para escritório",
    quantidade: 20,
    valorUnitario: 450,
    valorTotal: 9000,
    ufOrigem: "SC",
    aliquotaIcms: 7,
    valorIcmsDestacado: 630,
    percentualAproveitamento: 100,
    valorCredito: 630,
    dataLancamento: "2024-10-18",
    observacoes: "Material de escritório",
  },
  {
    id: "cred-005",
    empresa: "INPARI",
    numeroNF: "54322",
    ncm: "84716052",
    descricao: "Monitor LED 24 polegadas",
    quantidade: 15,
    valorUnitario: 600,
    valorTotal: 9000,
    ufOrigem: "RS",
    aliquotaIcms: 12,
    valorIcmsDestacado: 1080,
    percentualAproveitamento: 100,
    valorCredito: 1080,
    dataLancamento: "2024-10-20",
    observacoes: "",
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

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export const EMPRESAS = ["EXCHANGE", "INPARI"];
