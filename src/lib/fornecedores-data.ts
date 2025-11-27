// ============= Fornecedores Module Data Types & Logic =============

// Regime tributário do fornecedor
export type RegimeTributarioFornecedor = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'mei' | 'nao_informado';

// Tipo de fornecedor
export type TipoFornecedor = 'mercadoria' | 'servico' | 'credito_icms' | 'transportadora' | 'outro';

// Origem
export type OrigemFornecedor = 'nacional' | 'importado';

// Segmento
export type SegmentoFornecedor = 
  | 'eletronicos' 
  | 'embalagens' 
  | 'creditos_fiscais' 
  | 'logistica' 
  | 'informatica' 
  | 'servicos_contabeis'
  | 'servicos_gerais'
  | 'utilidades'
  | 'outro';

// Forma de pagamento padrão
export type FormaPagamentoPadrao = 'a_vista' | 'prazo' | 'boleto' | 'pix' | 'cartao' | 'misto';

// ============= Interfaces =============

export interface EnderecoFornecedor {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  pais: string;
}

export interface ContatoFornecedor {
  nome?: string;
  email?: string;
  telefoneFixo?: string;
  celularWhatsApp?: string;
  site?: string;
}

export interface CondicoesPagamento {
  formaPagamento: FormaPagamentoPadrao;
  prazoMedioDias?: number;
  observacoes?: string;
}

export interface Fornecedor {
  id: string;
  // Identificação básica
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  cpf?: string;
  inscricaoEstadual?: string;
  regimeTributario?: RegimeTributarioFornecedor;
  
  // Classificação
  tipo: TipoFornecedor;
  origem: OrigemFornecedor;
  segmento: SegmentoFornecedor;
  
  // Endereço
  endereco: EnderecoFornecedor;
  
  // Contato
  contato: ContatoFornecedor;
  
  // Condições comerciais
  condicoesPagamento: CondicoesPagamento;
  
  // Observações
  observacoes?: string;
  
  // Status e controle
  status: 'ativo' | 'inativo';
  dataCadastro: string;
  dataAtualizacao: string;
  
  // Indicadores (calculados)
  totalCompras?: number;
  totalContasPagar?: number;
  totalCreditosICMS?: number;
}

// ============= Configurações =============

export const TIPO_FORNECEDOR_CONFIG: Record<TipoFornecedor, { label: string; color: string; bgColor: string }> = {
  mercadoria: { label: 'Mercadoria', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  servico: { label: 'Serviço', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  credito_icms: { label: 'Crédito ICMS', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  transportadora: { label: 'Transportadora', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  outro: { label: 'Outro', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const REGIME_TRIBUTARIO_FORNECEDOR_CONFIG: Record<RegimeTributarioFornecedor, { label: string; shortLabel: string }> = {
  simples_nacional: { label: 'Simples Nacional', shortLabel: 'SN' },
  lucro_presumido: { label: 'Lucro Presumido', shortLabel: 'LP' },
  lucro_real: { label: 'Lucro Real', shortLabel: 'LR' },
  mei: { label: 'MEI', shortLabel: 'MEI' },
  nao_informado: { label: 'Não Informado', shortLabel: '-' },
};

export const ORIGEM_FORNECEDOR_CONFIG: Record<OrigemFornecedor, { label: string }> = {
  nacional: { label: 'Nacional' },
  importado: { label: 'Importado' },
};

export const SEGMENTO_FORNECEDOR_CONFIG: Record<SegmentoFornecedor, { label: string }> = {
  eletronicos: { label: 'Eletrônicos' },
  embalagens: { label: 'Embalagens' },
  creditos_fiscais: { label: 'Créditos Fiscais' },
  logistica: { label: 'Logística' },
  informatica: { label: 'Informática' },
  servicos_contabeis: { label: 'Serviços Contábeis' },
  servicos_gerais: { label: 'Serviços Gerais' },
  utilidades: { label: 'Utilidades (Energia, Internet, etc.)' },
  outro: { label: 'Outro' },
};

export const FORMA_PAGAMENTO_PADRAO_CONFIG: Record<FormaPagamentoPadrao, { label: string }> = {
  a_vista: { label: 'À Vista' },
  prazo: { label: 'A Prazo' },
  boleto: { label: 'Boleto' },
  pix: { label: 'Pix' },
  cartao: { label: 'Cartão' },
  misto: { label: 'Misto' },
};

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// ============= Mock Data =============

export const mockFornecedores: Fornecedor[] = [
  {
    id: 'forn-001',
    razaoSocial: 'Samsung Brasil Ltda',
    nomeFantasia: 'Samsung',
    cnpj: '12.345.678/0001-90',
    inscricaoEstadual: '123.456.789.012',
    regimeTributario: 'lucro_real',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'eletronicos',
    endereco: {
      logradouro: 'Av. Paulista',
      numero: '1000',
      complemento: 'Andar 15',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310-100',
      pais: 'Brasil',
    },
    contato: {
      nome: 'João Silva',
      email: 'vendas@samsung.com.br',
      telefoneFixo: '(11) 3333-4444',
      celularWhatsApp: '(11) 99999-8888',
      site: 'www.samsung.com.br',
    },
    condicoesPagamento: {
      formaPagamento: 'prazo',
      prazoMedioDias: 28,
      observacoes: 'Pagamento em 28 dias após emissão da NF',
    },
    observacoes: 'Fornecedor principal de TVs e smartphones',
    status: 'ativo',
    dataCadastro: '2024-01-15',
    dataAtualizacao: '2024-10-20',
    totalCompras: 72500,
    totalContasPagar: 15000,
  },
  {
    id: 'forn-002',
    razaoSocial: 'Dell Technologies do Brasil Ltda',
    nomeFantasia: 'Dell',
    cnpj: '23.456.789/0001-01',
    inscricaoEstadual: '234.567.890.123',
    regimeTributario: 'lucro_real',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'informatica',
    endereco: {
      logradouro: 'Rod. Anhanguera',
      numero: '5000',
      bairro: 'Industrial',
      cidade: 'Hortolândia',
      uf: 'SP',
      cep: '13184-970',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Maria Santos',
      email: 'corporativo@dell.com.br',
      telefoneFixo: '(19) 4444-5555',
      celularWhatsApp: '(19) 98888-7777',
      site: 'www.dell.com.br',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 21,
    },
    status: 'ativo',
    dataCadastro: '2024-02-10',
    dataAtualizacao: '2024-10-18',
    totalCompras: 84000,
  },
  {
    id: 'forn-003',
    razaoSocial: 'Xiaomi do Brasil Ltda',
    nomeFantasia: 'Xiaomi',
    cnpj: '34.567.890/0001-12',
    regimeTributario: 'lucro_presumido',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'eletronicos',
    endereco: {
      logradouro: 'Rua das Nações Unidas',
      numero: '2000',
      bairro: 'Brooklin',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '04578-000',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Carlos Lima',
      email: 'vendas@xiaomi.com.br',
      celularWhatsApp: '(11) 97777-6666',
    },
    condicoesPagamento: {
      formaPagamento: 'prazo',
      prazoMedioDias: 14,
    },
    status: 'ativo',
    dataCadastro: '2024-03-05',
    dataAtualizacao: '2024-10-15',
    totalCompras: 168600,
  },
  {
    id: 'forn-004',
    razaoSocial: 'LG Electronics do Brasil Ltda',
    nomeFantasia: 'LG',
    cnpj: '45.678.901/0001-23',
    regimeTributario: 'lucro_real',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'eletronicos',
    endereco: {
      logradouro: 'Av. Brasil',
      numero: '1500',
      bairro: 'Centro',
      cidade: 'Manaus',
      uf: 'AM',
      cep: '69005-020',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Ana Oliveira',
      email: 'comercial@lg.com.br',
      telefoneFixo: '(92) 3333-2222',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 28,
    },
    status: 'ativo',
    dataCadastro: '2024-04-20',
    dataAtualizacao: '2024-10-10',
    totalCompras: 20800,
  },
  {
    id: 'forn-005',
    razaoSocial: 'Harman do Brasil Ind. Eletrônica Ltda',
    nomeFantasia: 'JBL Brasil',
    cnpj: '56.789.012/0001-34',
    regimeTributario: 'lucro_presumido',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'eletronicos',
    endereco: {
      logradouro: 'Rua Industrial',
      numero: '800',
      bairro: 'Industrial',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13050-000',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Pedro Costa',
      email: 'vendas@jbl.com.br',
      celularWhatsApp: '(19) 99888-5555',
    },
    condicoesPagamento: {
      formaPagamento: 'pix',
      prazoMedioDias: 7,
    },
    status: 'ativo',
    dataCadastro: '2024-05-10',
    dataAtualizacao: '2024-10-05',
    totalCompras: 25500,
  },
  {
    id: 'forn-006',
    razaoSocial: 'Kingston Technology',
    nomeFantasia: 'Kingston',
    cnpj: '67.890.123/0001-45',
    regimeTributario: 'lucro_presumido',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'informatica',
    endereco: {
      logradouro: 'Rua da Tecnologia',
      numero: '500',
      bairro: 'Centro',
      cidade: 'Curitiba',
      uf: 'PR',
      cep: '80010-000',
      pais: 'Brasil',
    },
    contato: {
      email: 'vendas@kingston.com.br',
      telefoneFixo: '(41) 3222-1111',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 14,
    },
    status: 'ativo',
    dataCadastro: '2024-07-01',
    dataAtualizacao: '2024-10-22',
    totalCompras: 14400,
  },
  {
    id: 'forn-007',
    razaoSocial: 'Logitech Brasil Ltda',
    nomeFantasia: 'Logitech',
    cnpj: '78.901.234/0001-56',
    regimeTributario: 'lucro_presumido',
    tipo: 'mercadoria',
    origem: 'nacional',
    segmento: 'informatica',
    endereco: {
      logradouro: 'Av. das Américas',
      numero: '3000',
      bairro: 'Barra da Tijuca',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      cep: '22640-100',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Roberto Mendes',
      email: 'comercial@logitech.com.br',
      celularWhatsApp: '(21) 98765-4321',
    },
    condicoesPagamento: {
      formaPagamento: 'prazo',
      prazoMedioDias: 21,
    },
    status: 'ativo',
    dataCadastro: '2024-07-20',
    dataAtualizacao: '2024-10-20',
    totalCompras: 19000,
  },
  {
    id: 'forn-008',
    razaoSocial: 'Transportadora Rápida Ltda',
    nomeFantasia: 'Rápida Logística',
    cnpj: '33.444.555/0001-66',
    regimeTributario: 'simples_nacional',
    tipo: 'transportadora',
    origem: 'nacional',
    segmento: 'logistica',
    endereco: {
      logradouro: 'Rod. Presidente Dutra',
      numero: 'KM 200',
      bairro: 'Industrial',
      cidade: 'Guarulhos',
      uf: 'SP',
      cep: '07034-000',
      pais: 'Brasil',
    },
    contato: {
      nome: 'José Transportes',
      email: 'frete@rapida.com',
      telefoneFixo: '(11) 7777-8888',
      celularWhatsApp: '(11) 96666-5555',
    },
    condicoesPagamento: {
      formaPagamento: 'pix',
      prazoMedioDias: 7,
    },
    observacoes: 'Transportadora principal para envios de marketplace',
    status: 'ativo',
    dataCadastro: '2024-02-01',
    dataAtualizacao: '2024-10-25',
    totalContasPagar: 3500,
  },
  {
    id: 'forn-009',
    razaoSocial: 'Contabilidade Silva e Associados',
    nomeFantasia: 'Contabilidade Silva',
    cnpj: '44.555.666/0001-77',
    regimeTributario: 'simples_nacional',
    tipo: 'servico',
    origem: 'nacional',
    segmento: 'servicos_contabeis',
    endereco: {
      logradouro: 'Rua dos Contadores',
      numero: '100',
      complemento: 'Sala 501',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01010-010',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Dr. Silva',
      email: 'silva@contabil.com',
      telefoneFixo: '(11) 9999-0000',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 5,
      observacoes: 'Honorários mensais',
    },
    status: 'ativo',
    dataCadastro: '2024-01-01',
    dataAtualizacao: '2024-10-01',
    totalContasPagar: 2500,
  },
  {
    id: 'forn-010',
    razaoSocial: 'CPFL Energia',
    nomeFantasia: 'CPFL',
    cnpj: '55.666.777/0001-88',
    regimeTributario: 'lucro_real',
    tipo: 'servico',
    origem: 'nacional',
    segmento: 'utilidades',
    endereco: {
      logradouro: 'Rua da Energia',
      numero: '1',
      bairro: 'Centro',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13010-000',
      pais: 'Brasil',
    },
    contato: {
      telefoneFixo: '0800-010-0011',
      site: 'www.cpfl.com.br',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 10,
    },
    status: 'ativo',
    dataCadastro: '2024-01-01',
    dataAtualizacao: '2024-10-20',
    totalContasPagar: 850,
  },
  {
    id: 'forn-011',
    razaoSocial: 'Vivo S.A.',
    nomeFantasia: 'Vivo Internet',
    cnpj: '66.777.888/0001-99',
    regimeTributario: 'lucro_real',
    tipo: 'servico',
    origem: 'nacional',
    segmento: 'utilidades',
    endereco: {
      logradouro: 'Av. das Telecomunicações',
      numero: '100',
      bairro: 'Alphaville',
      cidade: 'Barueri',
      uf: 'SP',
      cep: '06454-000',
      pais: 'Brasil',
    },
    contato: {
      telefoneFixo: '10315',
      site: 'www.vivo.com.br',
    },
    condicoesPagamento: {
      formaPagamento: 'boleto',
      prazoMedioDias: 15,
    },
    status: 'ativo',
    dataCadastro: '2024-01-01',
    dataAtualizacao: '2024-10-15',
    totalContasPagar: 350,
  },
  {
    id: 'forn-012',
    razaoSocial: 'Créditos Fiscais Brasil Ltda',
    nomeFantasia: 'CF Brasil',
    cnpj: '88.999.000/0001-11',
    regimeTributario: 'lucro_presumido',
    tipo: 'credito_icms',
    origem: 'nacional',
    segmento: 'creditos_fiscais',
    endereco: {
      logradouro: 'Rua Fiscal',
      numero: '500',
      bairro: 'Centro',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01000-000',
      pais: 'Brasil',
    },
    contato: {
      nome: 'Fernando Créditos',
      email: 'fernando@cfbrasil.com',
      celularWhatsApp: '(11) 94444-3333',
    },
    condicoesPagamento: {
      formaPagamento: 'pix',
      prazoMedioDias: 0,
      observacoes: 'Comissão de 2,5% sobre o valor do crédito',
    },
    observacoes: 'Fornecedor de notas fiscais para crédito de ICMS',
    status: 'ativo',
    dataCadastro: '2024-06-01',
    dataAtualizacao: '2024-10-20',
    totalCreditosICMS: 45000,
  },
];

// ============= Utility Functions =============

export const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

export const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
};

export const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers.replace(/^(\d{5})(\d{3})$/, '$1-$2');
};

export const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length === 11) {
    return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return numbers.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: string): string => {
  if (!date) return '-';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

// ============= Validation =============

export interface FornecedorValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateFornecedor = (fornecedor: Partial<Fornecedor>): FornecedorValidation => {
  const errors: Record<string, string> = {};

  if (!fornecedor.razaoSocial?.trim()) {
    errors.razaoSocial = 'Razão Social é obrigatória';
  }

  if (!fornecedor.cnpj?.trim()) {
    errors.cnpj = 'CNPJ é obrigatório';
  } else {
    const cnpjNumbers = fornecedor.cnpj.replace(/\D/g, '');
    if (cnpjNumbers.length !== 14) {
      errors.cnpj = 'CNPJ deve ter 14 dígitos';
    }
  }

  if (!fornecedor.tipo) {
    errors.tipo = 'Tipo de fornecedor é obrigatório';
  }

  if (!fornecedor.endereco?.uf) {
    errors.uf = 'UF é obrigatória';
  }

  if (!fornecedor.endereco?.cidade?.trim()) {
    errors.cidade = 'Cidade é obrigatória';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= Helper Functions =============

export const getFornecedorById = (fornecedores: Fornecedor[], id: string): Fornecedor | undefined => {
  return fornecedores.find(f => f.id === id);
};

export const getFornecedorByCNPJ = (fornecedores: Fornecedor[], cnpj: string): Fornecedor | undefined => {
  const cnpjNumbers = cnpj.replace(/\D/g, '');
  return fornecedores.find(f => f.cnpj.replace(/\D/g, '') === cnpjNumbers);
};

export const canDeleteFornecedor = (fornecedor: Fornecedor): { canDelete: boolean; reason?: string } => {
  if (fornecedor.totalCompras && fornecedor.totalCompras > 0) {
    return { canDelete: false, reason: 'Fornecedor possui compras vinculadas' };
  }
  if (fornecedor.totalContasPagar && fornecedor.totalContasPagar > 0) {
    return { canDelete: false, reason: 'Fornecedor possui contas a pagar vinculadas' };
  }
  if (fornecedor.totalCreditosICMS && fornecedor.totalCreditosICMS > 0) {
    return { canDelete: false, reason: 'Fornecedor possui créditos de ICMS vinculados' };
  }
  return { canDelete: true };
};

// Create empty fornecedor template
export const createEmptyFornecedor = (): Partial<Fornecedor> => ({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  regimeTributario: 'nao_informado',
  tipo: 'mercadoria',
  origem: 'nacional',
  segmento: 'outro',
  endereco: {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    pais: 'Brasil',
  },
  contato: {
    nome: '',
    email: '',
    telefoneFixo: '',
    celularWhatsApp: '',
    site: '',
  },
  condicoesPagamento: {
    formaPagamento: 'boleto',
    prazoMedioDias: 14,
    observacoes: '',
  },
  observacoes: '',
  status: 'ativo',
});

// Create fornecedor from NF XML data
export const createFornecedorFromNF = (
  razaoSocial: string,
  cnpj: string,
  inscricaoEstadual?: string,
  endereco?: Partial<EnderecoFornecedor>
): Partial<Fornecedor> => ({
  ...createEmptyFornecedor(),
  razaoSocial,
  cnpj,
  inscricaoEstadual,
  endereco: {
    logradouro: endereco?.logradouro || '',
    numero: endereco?.numero || '',
    complemento: endereco?.complemento || '',
    bairro: endereco?.bairro || '',
    cidade: endereco?.cidade || '',
    uf: endereco?.uf || '',
    cep: endereco?.cep || '',
    pais: 'Brasil',
  },
});
