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

// Zerado - fornecedores devem ser cadastrados pelo usuário
export const mockFornecedores: Fornecedor[] = [];
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

  // CNPJ é opcional, mas se informado deve ter 14 dígitos
  if (fornecedor.cnpj?.trim()) {
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
