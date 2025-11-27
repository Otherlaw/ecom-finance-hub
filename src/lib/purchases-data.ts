// ============= Purchases Module Data Types & Logic =============

import { Product } from './products-data';

export interface PurchaseItem {
  id: string;
  produtoId?: string;
  produtoNome?: string;
  codigoProdutoNF: string;
  descricaoNF: string;
  ncm: string;
  cfop: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  aliquotaIcms?: number;
  valorIcms?: number;
  mapeado: boolean;
}

export interface Purchase {
  id: string;
  empresa: string;
  fornecedor: string;
  fornecedorCnpj?: string;
  dataCompra: string;
  numeroNF?: string;
  chaveAcesso?: string;
  valorTotal: number;
  status: 'em_aberto' | 'confirmada' | 'cancelada';
  itens: PurchaseItem[];
  observacoes?: string;
  dataCadastro: string;
  dataAtualizacao: string;
}

export interface NFImportResult {
  success: boolean;
  nfNumero: string;
  chaveAcesso: string;
  fornecedor: string;
  valorTotal: number;
  itens: PurchaseItem[];
  itensMapeados: number;
  itensNaoMapeados: number;
  error?: string;
}

export interface Supplier {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  uf: string;
  status: 'ativo' | 'inativo';
}

// ============= Status Labels =============
export const STATUS_COMPRA = {
  em_aberto: { label: "Em Aberto", color: "bg-warning/10 text-warning" },
  confirmada: { label: "Confirmada", color: "bg-success/10 text-success" },
  cancelada: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
};

export const EMPRESAS = ["EXCHANGE", "INPARI"];

// ============= Mock Suppliers =============
export const mockSuppliers: Supplier[] = [
  { id: "forn-001", cnpj: "12.345.678/0001-90", razaoSocial: "Samsung Brasil", nomeFantasia: "Samsung", uf: "SP", status: "ativo" },
  { id: "forn-002", cnpj: "23.456.789/0001-01", razaoSocial: "Dell Technologies do Brasil", nomeFantasia: "Dell", uf: "SP", status: "ativo" },
  { id: "forn-003", cnpj: "34.567.890/0001-12", razaoSocial: "Xiaomi Brasil", nomeFantasia: "Xiaomi", uf: "SP", status: "ativo" },
  { id: "forn-004", cnpj: "45.678.901/0001-23", razaoSocial: "LG Electronics do Brasil", nomeFantasia: "LG", uf: "SP", status: "ativo" },
  { id: "forn-005", cnpj: "56.789.012/0001-34", razaoSocial: "Harman do Brasil", nomeFantasia: "JBL Brasil", uf: "SP", status: "ativo" },
  { id: "forn-006", cnpj: "67.890.123/0001-45", razaoSocial: "Kingston Technology", nomeFantasia: "Kingston", uf: "PR", status: "ativo" },
  { id: "forn-007", cnpj: "78.901.234/0001-56", razaoSocial: "Logitech Brasil", nomeFantasia: "Logitech", uf: "SP", status: "ativo" },
];

// ============= Mock Purchases =============
export const mockPurchases: Purchase[] = [
  {
    id: "comp-001",
    empresa: "EXCHANGE",
    fornecedor: "Samsung Brasil",
    fornecedorCnpj: "12.345.678/0001-90",
    dataCompra: "2024-10-05",
    numeroNF: "12345",
    chaveAcesso: "35241012345678000190550010000123451234567890",
    valorTotal: 72500,
    status: "confirmada",
    itens: [
      {
        id: "item-001-1",
        produtoId: "prod-001",
        produtoNome: "Televisor Smart TV LED 50 polegadas 4K",
        codigoProdutoNF: "TV50-4K",
        descricaoNF: "SMART TV LED 50 POL 4K UHD",
        ncm: "85287200",
        cfop: "1102",
        quantidade: 50,
        valorUnitario: 1450,
        valorTotal: 72500,
        aliquotaIcms: 12,
        valorIcms: 8700,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-05",
    dataAtualizacao: "2024-10-05",
  },
  {
    id: "comp-002",
    empresa: "EXCHANGE",
    fornecedor: "Dell Technologies",
    fornecedorCnpj: "23.456.789/0001-01",
    dataCompra: "2024-10-10",
    numeroNF: "12346",
    chaveAcesso: "35241023456789000101550010000123461234567891",
    valorTotal: 84000,
    status: "confirmada",
    itens: [
      {
        id: "item-002-1",
        produtoId: "prod-002",
        produtoNome: "Notebook Core i5 16GB RAM SSD 512GB",
        codigoProdutoNF: "NB-I5-16",
        descricaoNF: "NOTEBOOK I5 11GEN 16GB 512SSD",
        ncm: "84713012",
        cfop: "1102",
        quantidade: 30,
        valorUnitario: 2800,
        valorTotal: 84000,
        aliquotaIcms: 12,
        valorIcms: 10080,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-10",
    dataAtualizacao: "2024-10-10",
  },
  {
    id: "comp-003",
    empresa: "EXCHANGE",
    fornecedor: "Xiaomi Brasil",
    fornecedorCnpj: "34.567.890/0001-12",
    dataCompra: "2024-10-08",
    numeroNF: "12347",
    chaveAcesso: "35241034567890000112550010000123471234567892",
    valorTotal: 95000,
    status: "confirmada",
    itens: [
      {
        id: "item-003-1",
        produtoId: "prod-003",
        produtoNome: "Smartphone Android 128GB 6.5 polegadas",
        codigoProdutoNF: "CELL-128",
        descricaoNF: "SMARTPHONE ANDROID 128GB TELA 6.5",
        ncm: "85171231",
        cfop: "1102",
        quantidade: 100,
        valorUnitario: 950,
        valorTotal: 95000,
        aliquotaIcms: 12,
        valorIcms: 11400,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-08",
    dataAtualizacao: "2024-10-08",
  },
  {
    id: "comp-004",
    empresa: "EXCHANGE",
    fornecedor: "Xiaomi Brasil",
    fornecedorCnpj: "34.567.890/0001-12",
    dataCompra: "2024-10-15",
    numeroNF: "12350",
    valorTotal: 73600,
    status: "confirmada",
    itens: [
      {
        id: "item-004-1",
        produtoId: "prod-003",
        produtoNome: "Smartphone Android 128GB 6.5 polegadas",
        codigoProdutoNF: "CELL-128",
        descricaoNF: "SMARTPHONE ANDROID 128GB",
        ncm: "85171231",
        cfop: "1102",
        quantidade: 80,
        valorUnitario: 920,
        valorTotal: 73600,
        aliquotaIcms: 12,
        valorIcms: 8832,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-15",
    dataAtualizacao: "2024-10-15",
  },
  {
    id: "comp-005",
    empresa: "INPARI",
    fornecedor: "LG Electronics",
    fornecedorCnpj: "45.678.901/0001-23",
    dataCompra: "2024-10-12",
    numeroNF: "12348",
    valorTotal: 20800,
    status: "confirmada",
    itens: [
      {
        id: "item-005-1",
        produtoId: "prod-004",
        produtoNome: "Monitor LED 24 polegadas Full HD",
        codigoProdutoNF: "MON-24-FHD",
        descricaoNF: "MONITOR LED 24 FULL HD IPS",
        ncm: "84716052",
        cfop: "1102",
        quantidade: 40,
        valorUnitario: 520,
        valorTotal: 20800,
        aliquotaIcms: 12,
        valorIcms: 2496,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-12",
    dataAtualizacao: "2024-10-12",
  },
  {
    id: "comp-006",
    empresa: "EXCHANGE",
    fornecedor: "JBL Brasil",
    fornecedorCnpj: "56.789.012/0001-34",
    dataCompra: "2024-10-03",
    numeroNF: "12349",
    valorTotal: 25500,
    status: "confirmada",
    itens: [
      {
        id: "item-006-1",
        produtoId: "prod-005",
        produtoNome: "Fone de Ouvido Bluetooth TWS",
        codigoProdutoNF: "FONE-BT-TWS",
        descricaoNF: "FONE OUVIDO BLUETOOTH 5.0 TWS",
        ncm: "85183000",
        cfop: "1102",
        quantidade: 300,
        valorUnitario: 85,
        valorTotal: 25500,
        aliquotaIcms: 12,
        valorIcms: 3060,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-03",
    dataAtualizacao: "2024-10-03",
  },
  {
    id: "comp-007",
    empresa: "EXCHANGE",
    fornecedor: "Kingston Technology",
    fornecedorCnpj: "67.890.123/0001-45",
    dataCompra: "2024-10-07",
    numeroNF: "12351",
    valorTotal: 14400,
    status: "em_aberto",
    itens: [
      {
        id: "item-007-1",
        produtoId: "prod-007",
        produtoNome: "SSD 500GB NVMe M.2",
        codigoProdutoNF: "SSD-NVME-500",
        descricaoNF: "SSD NVME M.2 500GB 3500MB/S",
        ncm: "84717020",
        cfop: "1102",
        quantidade: 80,
        valorUnitario: 180,
        valorTotal: 14400,
        aliquotaIcms: 12,
        valorIcms: 1728,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-07",
    dataAtualizacao: "2024-10-07",
  },
  {
    id: "comp-008",
    empresa: "EXCHANGE",
    fornecedor: "Logitech Brasil",
    fornecedorCnpj: "78.901.234/0001-56",
    dataCompra: "2024-10-09",
    numeroNF: "12352",
    valorTotal: 19000,
    status: "confirmada",
    itens: [
      {
        id: "item-008-1",
        produtoId: "prod-008",
        produtoNome: "Mouse Gamer RGB 12000 DPI",
        codigoProdutoNF: "MOUSE-GAM-RGB",
        descricaoNF: "MOUSE GAMER OPTICO 12000DPI RGB",
        ncm: "84716060",
        cfop: "1102",
        quantidade: 200,
        valorUnitario: 95,
        valorTotal: 19000,
        aliquotaIcms: 12,
        valorIcms: 2280,
        mapeado: true,
      }
    ],
    dataCadastro: "2024-10-09",
    dataAtualizacao: "2024-10-09",
  },
  {
    id: "comp-009",
    empresa: "EXCHANGE",
    fornecedor: "Fornecedor Novo",
    fornecedorCnpj: "99.999.999/0001-99",
    dataCompra: "2024-10-22",
    numeroNF: "99999",
    valorTotal: 45000,
    status: "em_aberto",
    itens: [
      {
        id: "item-009-1",
        codigoProdutoNF: "PROD-NOVO-001",
        descricaoNF: "PRODUTO NOVO SEM CADASTRO",
        ncm: "85182200",
        cfop: "1102",
        quantidade: 150,
        valorUnitario: 300,
        valorTotal: 45000,
        aliquotaIcms: 12,
        valorIcms: 5400,
        mapeado: false,
      }
    ],
    observacoes: "Item pendente de mapeamento para produto do cadastro",
    dataCadastro: "2024-10-22",
    dataAtualizacao: "2024-10-22",
  },
];

// ============= Utility Functions =============
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

// ============= Purchase Validation =============
export interface PurchaseValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validatePurchase = (purchase: Partial<Purchase>): PurchaseValidation => {
  const errors: Record<string, string> = {};

  if (!purchase.empresa?.trim()) {
    errors.empresa = "Empresa é obrigatória";
  }

  if (!purchase.fornecedor?.trim()) {
    errors.fornecedor = "Fornecedor é obrigatório";
  }

  if (!purchase.dataCompra) {
    errors.dataCompra = "Data da compra é obrigatória";
  }

  if (!purchase.itens || purchase.itens.length === 0) {
    errors.itens = "A compra deve ter pelo menos um item";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= NF Import Functions =============
export const parseNFForPurchase = (xmlContent: string, products: Product[]): NFImportResult | null => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      return { success: false, nfNumero: "", chaveAcesso: "", fornecedor: "", valorTotal: 0, itens: [], itensMapeados: 0, itensNaoMapeados: 0, error: "Erro ao processar XML" };
    }

    const infNFe = xmlDoc.querySelector("infNFe") || xmlDoc.querySelector("*|infNFe");
    if (!infNFe) {
      return { success: false, nfNumero: "", chaveAcesso: "", fornecedor: "", valorTotal: 0, itens: [], itensMapeados: 0, itensNaoMapeados: 0, error: "XML inválido: infNFe não encontrado" };
    }

    const chaveAcesso = infNFe.getAttribute("Id")?.replace("NFe", "") || "";
    const ide = infNFe.querySelector("ide");
    const nfNumero = ide?.querySelector("nNF")?.textContent || "";

    const emit = infNFe.querySelector("emit");
    const fornecedor = emit?.querySelector("xNome")?.textContent || "";

    const total = infNFe.querySelector("total ICMSTot");
    const valorTotal = parseFloat(total?.querySelector("vNF")?.textContent || "0");

    const detElements = infNFe.querySelectorAll("det");
    const itens: PurchaseItem[] = [];
    let itensMapeados = 0;
    let itensNaoMapeados = 0;

    detElements.forEach((det, index) => {
      const prod = det.querySelector("prod");
      const imposto = det.querySelector("imposto");
      const icms = imposto?.querySelector("ICMS");
      const icmsGroup = icms?.firstElementChild;

      const ncm = prod?.querySelector("NCM")?.textContent || "";
      const descricao = prod?.querySelector("xProd")?.textContent || "";
      const codigo = prod?.querySelector("cProd")?.textContent || "";

      // Try to find matching product
      const matchedProduct = products.find(p => 
        p.ncm.replace(/\./g, "") === ncm.replace(/\./g, "") ||
        p.codigoInterno.toLowerCase() === codigo.toLowerCase() ||
        p.nome.toLowerCase().includes(descricao.toLowerCase().substring(0, 20))
      );

      const item: PurchaseItem = {
        id: `nf-item-${index}`,
        produtoId: matchedProduct?.id,
        produtoNome: matchedProduct?.nome,
        codigoProdutoNF: codigo,
        descricaoNF: descricao,
        ncm,
        cfop: prod?.querySelector("CFOP")?.textContent || "",
        quantidade: parseFloat(prod?.querySelector("qCom")?.textContent || "0"),
        valorUnitario: parseFloat(prod?.querySelector("vUnCom")?.textContent || "0"),
        valorTotal: parseFloat(prod?.querySelector("vProd")?.textContent || "0"),
        aliquotaIcms: parseFloat(icmsGroup?.querySelector("pICMS")?.textContent || "0"),
        valorIcms: parseFloat(icmsGroup?.querySelector("vICMS")?.textContent || "0"),
        mapeado: !!matchedProduct,
      };

      if (matchedProduct) {
        itensMapeados++;
      } else {
        itensNaoMapeados++;
      }

      itens.push(item);
    });

    return {
      success: true,
      nfNumero,
      chaveAcesso,
      fornecedor,
      valorTotal,
      itens,
      itensMapeados,
      itensNaoMapeados,
    };
  } catch (error) {
    console.error("Error parsing NF XML:", error);
    return { success: false, nfNumero: "", chaveAcesso: "", fornecedor: "", valorTotal: 0, itens: [], itensMapeados: 0, itensNaoMapeados: 0, error: "Erro interno ao processar XML" };
  }
};

// ============= Summary Calculations =============
export interface PurchaseSummary {
  totalCompras: number;
  valorTotal: number;
  comprasConfirmadas: number;
  comprasEmAberto: number;
  itensTotais: number;
  itensNaoMapeados: number;
}

export const calculatePurchaseSummary = (purchases: Purchase[]): PurchaseSummary => {
  const totalCompras = purchases.length;
  const valorTotal = purchases.reduce((sum, p) => sum + p.valorTotal, 0);
  const comprasConfirmadas = purchases.filter(p => p.status === 'confirmada').length;
  const comprasEmAberto = purchases.filter(p => p.status === 'em_aberto').length;
  
  let itensTotais = 0;
  let itensNaoMapeados = 0;
  
  purchases.forEach(p => {
    itensTotais += p.itens.length;
    itensNaoMapeados += p.itens.filter(i => !i.mapeado).length;
  });

  return {
    totalCompras,
    valorTotal,
    comprasConfirmadas,
    comprasEmAberto,
    itensTotais,
    itensNaoMapeados,
  };
};
