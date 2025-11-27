// ============= Empresas Module Data Types =============

export type RegimeTributario = 'simples_nacional' | 'lucro_presumido' | 'lucro_real';

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  regimeTributario: RegimeTributario;
  marketplaces: string[];
  usuarios: number;
  status: 'ativo' | 'inativo';
  dataCadastro: string;
  dataAtualizacao: string;
}

export const REGIME_TRIBUTARIO_CONFIG: Record<RegimeTributario, { label: string; shortLabel: string; color: string; bgColor: string }> = {
  simples_nacional: { 
    label: 'Simples Nacional', 
    shortLabel: 'SN',
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100 border-blue-300' 
  },
  lucro_presumido: { 
    label: 'Lucro Presumido', 
    shortLabel: 'LP',
    color: 'text-amber-700', 
    bgColor: 'bg-amber-100 border-amber-300' 
  },
  lucro_real: { 
    label: 'Lucro Real', 
    shortLabel: 'LR',
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-100 border-emerald-300' 
  },
};

// Verifica se empresa pode usar créditos de ICMS para compensação
export const canUseICMSCredit = (regime: RegimeTributario): boolean => {
  return regime === 'lucro_presumido' || regime === 'lucro_real';
};

// Mensagem de aviso para Simples Nacional
export const SIMPLES_NACIONAL_ICMS_WARNING = 
  "Atenção: Esta empresa está cadastrada como Simples Nacional. Créditos de ICMS não são utilizados da mesma forma que no regime normal. Use estas informações apenas para controle interno, não para planejamento de compensação tributária.";

// Mock data
export const mockEmpresas: Empresa[] = [
  {
    id: "emp-001",
    nome: "Exchange Comercial",
    cnpj: "12.345.678/0001-90",
    regimeTributario: "lucro_presumido",
    marketplaces: ["Mercado Livre", "Shopee", "Shein"],
    usuarios: 3,
    status: "ativo",
    dataCadastro: "2024-01-15",
    dataAtualizacao: "2024-10-20",
  },
  {
    id: "emp-002",
    nome: "Inpari Distribuição",
    cnpj: "98.765.432/0001-10",
    regimeTributario: "simples_nacional",
    marketplaces: ["Mercado Livre"],
    usuarios: 2,
    status: "ativo",
    dataCadastro: "2024-02-10",
    dataAtualizacao: "2024-10-18",
  },
];

// Validation
export interface EmpresaValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateEmpresa = (empresa: Partial<Empresa>): EmpresaValidation => {
  const errors: Record<string, string> = {};

  if (!empresa.nome?.trim()) {
    errors.nome = "Nome da empresa é obrigatório";
  }

  if (!empresa.cnpj?.trim()) {
    errors.cnpj = "CNPJ é obrigatório";
  } else if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(empresa.cnpj)) {
    errors.cnpj = "CNPJ inválido (formato: 00.000.000/0000-00)";
  }

  if (!empresa.regimeTributario) {
    errors.regimeTributario = "Regime tributário é obrigatório";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Format CNPJ
export const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18);
};

// Get empresa by name (for compatibility with existing code)
export const getEmpresaByName = (empresas: Empresa[], nome: string): Empresa | undefined => {
  return empresas.find(e => e.nome.toUpperCase().includes(nome.toUpperCase()) || nome.toUpperCase().includes(e.nome.split(' ')[0].toUpperCase()));
};

// Get regime label with company name
export const getEmpresaComRegime = (empresa: Empresa): string => {
  const regime = REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario];
  return `${empresa.nome} – ${regime.label}`;
};
