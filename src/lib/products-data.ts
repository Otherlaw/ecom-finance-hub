// ============= Products Module Data Types & Logic =============

export interface ChannelMapping {
  channel: string;
  sku: string;
  anuncioId?: string;
  codigoInterno?: string;
}

export interface Product {
  id: string;
  codigoInterno: string;
  nome: string;
  descricao: string;
  categoria: string;
  subcategoria?: string;
  unidadeMedida: string;
  ncm: string;
  cfopVenda?: string;
  cfopCompra?: string;
  situacaoTributaria?: string;
  fornecedorPrincipalId?: string;
  fornecedorPrincipalNome?: string;
  custoMedio: number;
  precoVendaSugerido?: number;
  canais: ChannelMapping[];
  status: 'ativo' | 'inativo';
  observacoes?: string;
  dataCadastro: string;
  dataAtualizacao: string;
}

export interface ProductSalesHistory {
  id: string;
  produtoId: string;
  canal: string;
  quantidade: number;
  receitaBruta: number;
  comissao: number;
  frete: number;
  receitaLiquida: number;
  margem: number;
  dataVenda: string;
  pedidoId?: string;
}

export interface ProductPurchaseHistory {
  id: string;
  produtoId: string;
  compraId: string;
  fornecedor: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  dataCompra: string;
  notaFiscal?: string;
}

export interface ProductMetrics {
  quantidadeVendida: number;
  receitaTotal: number;
  margemMedia: number;
  quantidadeComprada: number;
  custoTotal: number;
  giroEstimado: number;
}

export interface ABCItem {
  produto: Product;
  faturamento: number;
  margem: number;
  quantidade: number;
  percentualFaturamento: number;
  percentualAcumulado: number;
  categoriaABC: 'A' | 'B' | 'C';
}

// ============= Categories =============
export const CATEGORIAS_PRODUTO = [
  "Eletrônicos",
  "Celulares e Smartphones",
  "Informática",
  "Games",
  "Eletrodomésticos",
  "Móveis",
  "Moda e Acessórios",
  "Beleza e Saúde",
  "Esportes",
  "Automotivo",
  "Casa e Jardim",
  "Brinquedos",
  "Outros"
];

export const UNIDADES_MEDIDA = [
  { value: "un", label: "Unidade (un)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "l", label: "Litro (l)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "m", label: "Metro (m)" },
  { value: "m2", label: "Metro quadrado (m²)" },
  { value: "pct", label: "Pacote (pct)" },
  { value: "par", label: "Par" },
];

export const CANAIS_VENDA = [
  { id: "mercadolivre", nome: "Mercado Livre", cor: "hsl(48, 96%, 53%)" },
  { id: "shopee", nome: "Shopee", cor: "hsl(16, 100%, 50%)" },
  { id: "shein", nome: "Shein", cor: "hsl(0, 0%, 15%)" },
  { id: "tiktok", nome: "TikTok Shop", cor: "hsl(0, 0%, 0%)" },
  { id: "amazon", nome: "Amazon", cor: "hsl(31, 100%, 50%)" },
];

export const EMPRESAS = ["EXCHANGE", "INPARI"];

// ============= Mock Data =============
export const mockProducts: Product[] = [
  {
    id: "prod-001",
    codigoInterno: "SKU-TV50-001",
    nome: "Televisor Smart TV LED 50 polegadas 4K",
    descricao: "Smart TV LED 50 polegadas com resolução 4K Ultra HD",
    categoria: "Eletrônicos",
    subcategoria: "TVs",
    unidadeMedida: "un",
    ncm: "85287200",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalId: "forn-001",
    fornecedorPrincipalNome: "Samsung Brasil",
    custoMedio: 1450.00,
    precoVendaSugerido: 2199.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-TV50-4K", anuncioId: "MLB1234567890" },
      { channel: "shopee", sku: "SHOP-TV50", codigoInterno: "12345678" },
    ],
    status: "ativo",
    dataCadastro: "2024-01-15",
    dataAtualizacao: "2024-10-20",
  },
  {
    id: "prod-002",
    codigoInterno: "SKU-NB-I5-002",
    nome: "Notebook Core i5 16GB RAM SSD 512GB",
    descricao: "Notebook Intel Core i5 11ª geração, 16GB RAM, SSD 512GB",
    categoria: "Informática",
    subcategoria: "Notebooks",
    unidadeMedida: "un",
    ncm: "84713012",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalId: "forn-002",
    fornecedorPrincipalNome: "Dell Technologies",
    custoMedio: 2800.00,
    precoVendaSugerido: 3999.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-NB-I5", anuncioId: "MLB9876543210" },
      { channel: "shopee", sku: "SHOP-NB-I5" },
      { channel: "amazon", sku: "AMZN-NB-I5" },
    ],
    status: "ativo",
    dataCadastro: "2024-02-10",
    dataAtualizacao: "2024-10-18",
  },
  {
    id: "prod-003",
    codigoInterno: "SKU-CELL-128-003",
    nome: "Smartphone Android 128GB 6.5 polegadas",
    descricao: "Smartphone Android com 128GB, tela 6.5 polegadas, câmera 48MP",
    categoria: "Celulares e Smartphones",
    unidadeMedida: "un",
    ncm: "85171231",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalId: "forn-003",
    fornecedorPrincipalNome: "Xiaomi Brasil",
    custoMedio: 950.00,
    precoVendaSugerido: 1499.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-CELL-128", anuncioId: "MLB1122334455" },
      { channel: "shopee", sku: "SHOP-CELL-128" },
      { channel: "shein", sku: "SHEIN-CELL" },
    ],
    status: "ativo",
    dataCadastro: "2024-03-05",
    dataAtualizacao: "2024-10-15",
  },
  {
    id: "prod-004",
    codigoInterno: "SKU-MON24-004",
    nome: "Monitor LED 24 polegadas Full HD",
    descricao: "Monitor LED 24 polegadas Full HD IPS 75Hz",
    categoria: "Informática",
    subcategoria: "Monitores",
    unidadeMedida: "un",
    ncm: "84716052",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalId: "forn-004",
    fornecedorPrincipalNome: "LG Electronics",
    custoMedio: 520.00,
    precoVendaSugerido: 799.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-MON24", anuncioId: "MLB5566778899" },
    ],
    status: "ativo",
    dataCadastro: "2024-04-20",
    dataAtualizacao: "2024-10-10",
  },
  {
    id: "prod-005",
    codigoInterno: "SKU-FONE-BT-005",
    nome: "Fone de Ouvido Bluetooth TWS",
    descricao: "Fone de ouvido sem fio Bluetooth 5.0 com case carregador",
    categoria: "Eletrônicos",
    subcategoria: "Áudio",
    unidadeMedida: "un",
    ncm: "85183000",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalId: "forn-005",
    fornecedorPrincipalNome: "JBL Brasil",
    custoMedio: 85.00,
    precoVendaSugerido: 149.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-FONE-BT" },
      { channel: "shopee", sku: "SHOP-FONE" },
      { channel: "tiktok", sku: "TT-FONE-BT" },
    ],
    status: "ativo",
    dataCadastro: "2024-05-10",
    dataAtualizacao: "2024-10-05",
  },
  {
    id: "prod-006",
    codigoInterno: "SKU-CAD-GAME-006",
    nome: "Cadeira Gamer Ergonômica",
    descricao: "Cadeira gamer com apoio lombar, braços ajustáveis",
    categoria: "Móveis",
    subcategoria: "Cadeiras",
    unidadeMedida: "un",
    ncm: "94013000",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalNome: "DXRacer Brasil",
    custoMedio: 650.00,
    precoVendaSugerido: 999.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-CAD-GAME" },
    ],
    status: "ativo",
    dataCadastro: "2024-06-15",
    dataAtualizacao: "2024-09-28",
  },
  {
    id: "prod-007",
    codigoInterno: "SKU-SSD-500-007",
    nome: "SSD 500GB NVMe M.2",
    descricao: "SSD NVMe M.2 500GB velocidade 3500MB/s",
    categoria: "Informática",
    subcategoria: "Armazenamento",
    unidadeMedida: "un",
    ncm: "84717020",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalNome: "Kingston Technology",
    custoMedio: 180.00,
    precoVendaSugerido: 299.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-SSD-500" },
      { channel: "shopee", sku: "SHOP-SSD-500" },
    ],
    status: "ativo",
    dataCadastro: "2024-07-01",
    dataAtualizacao: "2024-10-22",
  },
  {
    id: "prod-008",
    codigoInterno: "SKU-MOUSE-GAM-008",
    nome: "Mouse Gamer RGB 12000 DPI",
    descricao: "Mouse gamer com sensor óptico 12000 DPI, iluminação RGB",
    categoria: "Informática",
    subcategoria: "Periféricos",
    unidadeMedida: "un",
    ncm: "84716060",
    cfopVenda: "5102",
    cfopCompra: "1102",
    fornecedorPrincipalNome: "Logitech Brasil",
    custoMedio: 95.00,
    precoVendaSugerido: 169.00,
    canais: [
      { channel: "mercadolivre", sku: "MLB-MOUSE-GAM" },
      { channel: "shopee", sku: "SHOP-MOUSE" },
      { channel: "tiktok", sku: "TT-MOUSE-GAM" },
    ],
    status: "ativo",
    dataCadastro: "2024-07-20",
    dataAtualizacao: "2024-10-20",
  },
];

// Mock sales history
export const mockSalesHistory: ProductSalesHistory[] = [
  // Product 001 - TV
  { id: "sale-001", produtoId: "prod-001", canal: "mercadolivre", quantidade: 45, receitaBruta: 98955, comissao: 12869, frete: 4500, receitaLiquida: 81586, margem: 25.1, dataVenda: "2024-10-01" },
  { id: "sale-002", produtoId: "prod-001", canal: "shopee", quantidade: 18, receitaBruta: 39582, comissao: 5937, frete: 1800, receitaLiquida: 31845, margem: 23.8, dataVenda: "2024-10-01" },
  // Product 002 - Notebook
  { id: "sale-003", produtoId: "prod-002", canal: "mercadolivre", quantidade: 32, receitaBruta: 127968, comissao: 16636, frete: 3200, receitaLiquida: 108132, margem: 29.5, dataVenda: "2024-10-01" },
  { id: "sale-004", produtoId: "prod-002", canal: "amazon", quantidade: 12, receitaBruta: 47988, comissao: 7198, frete: 1200, receitaLiquida: 39590, margem: 28.2, dataVenda: "2024-10-01" },
  // Product 003 - Smartphone
  { id: "sale-005", produtoId: "prod-003", canal: "mercadolivre", quantidade: 85, receitaBruta: 127415, comissao: 16564, frete: 4250, receitaLiquida: 106601, margem: 26.8, dataVenda: "2024-10-01" },
  { id: "sale-006", produtoId: "prod-003", canal: "shopee", quantidade: 120, receitaBruta: 179880, comissao: 26982, frete: 6000, receitaLiquida: 146898, margem: 24.5, dataVenda: "2024-10-01" },
  { id: "sale-007", produtoId: "prod-003", canal: "shein", quantidade: 35, receitaBruta: 52465, comissao: 10493, frete: 1750, receitaLiquida: 40222, margem: 22.1, dataVenda: "2024-10-01" },
  // Product 004 - Monitor
  { id: "sale-008", produtoId: "prod-004", canal: "mercadolivre", quantidade: 28, receitaBruta: 22372, comissao: 2908, frete: 1400, receitaLiquida: 18064, margem: 27.4, dataVenda: "2024-10-01" },
  // Product 005 - Fone
  { id: "sale-009", produtoId: "prod-005", canal: "mercadolivre", quantidade: 210, receitaBruta: 31290, comissao: 4068, frete: 2100, receitaLiquida: 25122, margem: 32.5, dataVenda: "2024-10-01" },
  { id: "sale-010", produtoId: "prod-005", canal: "shopee", quantidade: 185, receitaBruta: 27565, comissao: 4135, frete: 1850, receitaLiquida: 21580, margem: 30.2, dataVenda: "2024-10-01" },
  { id: "sale-011", produtoId: "prod-005", canal: "tiktok", quantidade: 95, receitaBruta: 14155, comissao: 1698, frete: 950, receitaLiquida: 11507, margem: 31.8, dataVenda: "2024-10-01" },
  // Product 006 - Cadeira
  { id: "sale-012", produtoId: "prod-006", canal: "mercadolivre", quantidade: 22, receitaBruta: 21978, comissao: 2857, frete: 2200, receitaLiquida: 16921, margem: 28.9, dataVenda: "2024-10-01" },
  // Product 007 - SSD
  { id: "sale-013", produtoId: "prod-007", canal: "mercadolivre", quantidade: 65, receitaBruta: 19435, comissao: 2527, frete: 650, receitaLiquida: 16258, margem: 34.2, dataVenda: "2024-10-01" },
  { id: "sale-014", produtoId: "prod-007", canal: "shopee", quantidade: 48, receitaBruta: 14352, comissao: 2153, frete: 480, receitaLiquida: 11719, margem: 32.8, dataVenda: "2024-10-01" },
  // Product 008 - Mouse
  { id: "sale-015", produtoId: "prod-008", canal: "mercadolivre", quantidade: 145, receitaBruta: 24505, comissao: 3186, frete: 1450, receitaLiquida: 19869, margem: 35.4, dataVenda: "2024-10-01" },
  { id: "sale-016", produtoId: "prod-008", canal: "shopee", quantidade: 98, receitaBruta: 16562, comissao: 2484, frete: 980, receitaLiquida: 13098, margem: 33.6, dataVenda: "2024-10-01" },
  { id: "sale-017", produtoId: "prod-008", canal: "tiktok", quantidade: 62, receitaBruta: 10478, comissao: 1257, frete: 620, receitaLiquida: 8601, margem: 34.8, dataVenda: "2024-10-01" },
];

// Mock purchase history
export const mockPurchaseHistory: ProductPurchaseHistory[] = [
  { id: "ph-001", produtoId: "prod-001", compraId: "comp-001", fornecedor: "Samsung Brasil", quantidade: 50, valorUnitario: 1450, valorTotal: 72500, dataCompra: "2024-10-05", notaFiscal: "12345" },
  { id: "ph-002", produtoId: "prod-002", compraId: "comp-002", fornecedor: "Dell Technologies", quantidade: 30, valorUnitario: 2800, valorTotal: 84000, dataCompra: "2024-10-10", notaFiscal: "12346" },
  { id: "ph-003", produtoId: "prod-003", compraId: "comp-003", fornecedor: "Xiaomi Brasil", quantidade: 100, valorUnitario: 950, valorTotal: 95000, dataCompra: "2024-10-08", notaFiscal: "12347" },
  { id: "ph-004", produtoId: "prod-003", compraId: "comp-004", fornecedor: "Xiaomi Brasil", quantidade: 80, valorUnitario: 920, valorTotal: 73600, dataCompra: "2024-10-15", notaFiscal: "12350" },
  { id: "ph-005", produtoId: "prod-004", compraId: "comp-005", fornecedor: "LG Electronics", quantidade: 40, valorUnitario: 520, valorTotal: 20800, dataCompra: "2024-10-12", notaFiscal: "12348" },
  { id: "ph-006", produtoId: "prod-005", compraId: "comp-006", fornecedor: "JBL Brasil", quantidade: 300, valorUnitario: 85, valorTotal: 25500, dataCompra: "2024-10-03", notaFiscal: "12349" },
  { id: "ph-007", produtoId: "prod-005", compraId: "comp-007", fornecedor: "JBL Brasil", quantidade: 200, valorUnitario: 82, valorTotal: 16400, dataCompra: "2024-10-18", notaFiscal: "12355" },
  { id: "ph-008", produtoId: "prod-007", compraId: "comp-008", fornecedor: "Kingston Technology", quantidade: 80, valorUnitario: 180, valorTotal: 14400, dataCompra: "2024-10-07", notaFiscal: "12351" },
  { id: "ph-009", produtoId: "prod-008", compraId: "comp-009", fornecedor: "Logitech Brasil", quantidade: 200, valorUnitario: 95, valorTotal: 19000, dataCompra: "2024-10-09", notaFiscal: "12352" },
  { id: "ph-010", produtoId: "prod-008", compraId: "comp-010", fornecedor: "Logitech Brasil", quantidade: 150, valorUnitario: 92, valorTotal: 13800, dataCompra: "2024-10-20", notaFiscal: "12358" },
];

// ============= Utility Functions =============
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatDate = (date: string): string => {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

// ============= Product Validation =============
export interface ProductValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateProduct = (product: Partial<Product>): ProductValidation => {
  const errors: Record<string, string> = {};

  if (!product.codigoInterno?.trim()) {
    errors.codigoInterno = "Código interno é obrigatório";
  }

  if (!product.nome?.trim()) {
    errors.nome = "Nome do produto é obrigatório";
  }

  if (!product.categoria?.trim()) {
    errors.categoria = "Categoria é obrigatória";
  }

  if (!product.unidadeMedida?.trim()) {
    errors.unidadeMedida = "Unidade de medida é obrigatória";
  }

  if (!product.ncm?.trim()) {
    errors.ncm = "NCM é obrigatório";
  } else if (!/^\d{8}$/.test(product.ncm.replace(/\./g, ""))) {
    errors.ncm = "NCM deve ter 8 dígitos";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= ABC Curve Calculation =============
export const calculateABCCurve = (
  products: Product[],
  salesHistory: ProductSalesHistory[]
): ABCItem[] => {
  // Aggregate sales by product
  const productSales = new Map<string, { faturamento: number; margem: number; quantidade: number }>();

  salesHistory.forEach((sale) => {
    const existing = productSales.get(sale.produtoId) || { faturamento: 0, margem: 0, quantidade: 0 };
    productSales.set(sale.produtoId, {
      faturamento: existing.faturamento + sale.receitaBruta,
      margem: existing.margem + (sale.receitaBruta * (sale.margem / 100)),
      quantidade: existing.quantidade + sale.quantidade,
    });
  });

  // Calculate total revenue
  let totalFaturamento = 0;
  productSales.forEach((data) => {
    totalFaturamento += data.faturamento;
  });

  // Create ABC items
  const items: ABCItem[] = products
    .filter((p) => productSales.has(p.id))
    .map((product) => {
      const sales = productSales.get(product.id)!;
      return {
        produto: product,
        faturamento: sales.faturamento,
        margem: sales.margem,
        quantidade: sales.quantidade,
        percentualFaturamento: totalFaturamento > 0 ? (sales.faturamento / totalFaturamento) * 100 : 0,
        percentualAcumulado: 0,
        categoriaABC: 'C' as 'A' | 'B' | 'C',
      };
    })
    .sort((a, b) => b.faturamento - a.faturamento);

  // Calculate accumulated percentage and ABC category
  let accumulated = 0;
  items.forEach((item) => {
    accumulated += item.percentualFaturamento;
    item.percentualAcumulado = accumulated;

    if (accumulated <= 80) {
      item.categoriaABC = 'A';
    } else if (accumulated <= 95) {
      item.categoriaABC = 'B';
    } else {
      item.categoriaABC = 'C';
    }
  });

  return items;
};

// ============= Product Metrics Calculation =============
export const calculateProductMetrics = (
  productId: string,
  salesHistory: ProductSalesHistory[],
  purchaseHistory: ProductPurchaseHistory[]
): ProductMetrics => {
  const sales = salesHistory.filter((s) => s.produtoId === productId);
  const purchases = purchaseHistory.filter((p) => p.produtoId === productId);

  const quantidadeVendida = sales.reduce((sum, s) => sum + s.quantidade, 0);
  const receitaTotal = sales.reduce((sum, s) => sum + s.receitaBruta, 0);
  const margemTotal = sales.reduce((sum, s) => sum + s.margem * s.quantidade, 0);
  const margemMedia = quantidadeVendida > 0 ? margemTotal / quantidadeVendida : 0;

  const quantidadeComprada = purchases.reduce((sum, p) => sum + p.quantidade, 0);
  const custoTotal = purchases.reduce((sum, p) => sum + p.valorTotal, 0);

  // Giro estimado = vendas / compras (simplificado)
  const giroEstimado = quantidadeComprada > 0 ? quantidadeVendida / quantidadeComprada : 0;

  return {
    quantidadeVendida,
    receitaTotal,
    margemMedia,
    quantidadeComprada,
    custoTotal,
    giroEstimado,
  };
};

// ============= Triangulation / Validation =============
export interface TriangulationAlert {
  tipo: 'warning' | 'error' | 'info';
  produto: Product;
  mensagem: string;
  detalhes: string;
  impacto?: number;
}

export const validateTriangulation = (
  products: Product[],
  salesHistory: ProductSalesHistory[],
  purchaseHistory: ProductPurchaseHistory[]
): TriangulationAlert[] => {
  const alerts: TriangulationAlert[] = [];

  products.forEach((product) => {
    const sales = salesHistory.filter((s) => s.produtoId === product.id);
    const purchases = purchaseHistory.filter((p) => p.produtoId === product.id);

    const quantidadeVendida = sales.reduce((sum, s) => sum + s.quantidade, 0);
    const quantidadeComprada = purchases.reduce((sum, p) => sum + p.quantidade, 0);

    // Check if sales exceed purchases significantly
    if (quantidadeVendida > quantidadeComprada * 1.2) {
      const diferenca = quantidadeVendida - quantidadeComprada;
      alerts.push({
        tipo: 'warning',
        produto: product,
        mensagem: `Vendas excedem compras em ${diferenca} unidades`,
        detalhes: `Produto "${product.nome}" foi vendido em quantidade superior ao registrado em compras/NFs. Vendido: ${quantidadeVendida}, Comprado: ${quantidadeComprada}. Verifique possível erro de estoque ou falta de notas de entrada.`,
        impacto: diferenca * product.custoMedio,
      });
    }

    // Check for products with no purchases but sales
    if (quantidadeVendida > 0 && quantidadeComprada === 0) {
      alerts.push({
        tipo: 'error',
        produto: product,
        mensagem: `Vendas sem compras registradas`,
        detalhes: `Produto "${product.nome}" possui ${quantidadeVendida} vendas, mas nenhuma compra foi registrada. Regularize a entrada fiscal.`,
      });
    }

    // Check for products with very low margin
    const avgMargin = sales.length > 0 
      ? sales.reduce((sum, s) => sum + s.margem, 0) / sales.length 
      : 0;
    
    if (avgMargin < 15 && quantidadeVendida > 10) {
      alerts.push({
        tipo: 'info',
        produto: product,
        mensagem: `Margem baixa: ${avgMargin.toFixed(1)}%`,
        detalhes: `Produto "${product.nome}" está operando com margem média de ${avgMargin.toFixed(1)}%, abaixo do recomendado. Considere revisar preços ou custos.`,
      });
    }
  });

  return alerts.sort((a, b) => {
    const priority = { error: 0, warning: 1, info: 2 };
    return priority[a.tipo] - priority[b.tipo];
  });
};
