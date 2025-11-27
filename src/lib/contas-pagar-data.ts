// ============= Contas a Pagar Module Data Types =============

import { Empresa, mockEmpresas, REGIME_TRIBUTARIO_CONFIG } from './empresas-data';

// Status do título
export type StatusContaPagar = 'em_aberto' | 'parcialmente_pago' | 'pago' | 'vencido' | 'cancelado';

// Tipo de lançamento
export type TipoLancamento = 'despesa_operacional' | 'compra_mercadoria' | 'imposto' | 'servico' | 'outro';

// Forma de pagamento
export type FormaPagamento = 'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'outro';

// Periodicidade para recorrência
export type Periodicidade = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

// ============= Interfaces =============

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  grupo: string;
  ativo: boolean;
}

export interface CentroCusto {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo: 'corrente' | 'poupanca' | 'digital' | 'caixa';
  saldoAtual: number;
  empresaId: string;
  ativo: boolean;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cnpjCpf: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  ativo: boolean;
}

export interface Anexo {
  id: string;
  nome: string;
  tipo: 'boleto' | 'nf' | 'comprovante' | 'outro';
  url: string;
  dataUpload: string;
}

export interface Pagamento {
  id: string;
  contaPagarId: string;
  parcelaId?: string;
  dataPagamento: string;
  valorPrincipal: number;
  jurosMulta: number;
  desconto: number;
  valorTotal: number;
  formaPagamento: FormaPagamento;
  contaBancariaId: string;
  observacoes?: string;
  comprovante?: string;
}

export interface Parcela {
  id: string;
  contaPagarId: string;
  numero: number;
  dataVencimento: string;
  valorOriginal: number;
  valorPago: number;
  valorEmAberto: number;
  status: StatusContaPagar;
}

export interface ContaPagar {
  id: string;
  empresaId: string;
  fornecedorId: string;
  descricao: string;
  documento?: string;
  tipoLancamento: TipoLancamento;
  dataEmissao: string;
  dataVencimento: string;
  valorTotal: number;
  valorPago: number;
  valorEmAberto: number;
  status: StatusContaPagar;
  formaPagamento?: FormaPagamento;
  contaBancariaId?: string;
  categoriaId: string;
  centroCustoId?: string;
  observacoes?: string;
  anexos: Anexo[];
  parcelas: Parcela[];
  pagamentos: Pagamento[];
  // Vínculos
  nfId?: string;
  compraId?: string;
  // Recorrência
  recorrente: boolean;
  periodicidade?: Periodicidade;
  totalRecorrencias?: number;
  recorrenciaAtual?: number;
  // Controle
  conciliado: boolean;
  dataCriacao: string;
  dataAtualizacao: string;
}

// ============= Configurações de Status =============

export const STATUS_CONTA_PAGAR: Record<StatusContaPagar, { label: string; color: string; bgColor: string }> = {
  em_aberto: { label: 'Em Aberto', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300' },
  parcialmente_pago: { label: 'Parcial', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300' },
  pago: { label: 'Pago', color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300' },
  vencido: { label: 'Vencido', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bgColor: 'bg-gray-100 border-gray-300' },
};

export const TIPO_LANCAMENTO: Record<TipoLancamento, { label: string; icon: string }> = {
  despesa_operacional: { label: 'Despesa Operacional', icon: 'Building2' },
  compra_mercadoria: { label: 'Compra de Mercadoria', icon: 'Package' },
  imposto: { label: 'Imposto/Tributo', icon: 'Receipt' },
  servico: { label: 'Serviço', icon: 'Wrench' },
  outro: { label: 'Outro', icon: 'MoreHorizontal' },
};

export const FORMA_PAGAMENTO: Record<FormaPagamento, { label: string; icon: string }> = {
  pix: { label: 'Pix', icon: 'Zap' },
  boleto: { label: 'Boleto', icon: 'FileText' },
  transferencia: { label: 'Transferência', icon: 'ArrowLeftRight' },
  cartao: { label: 'Cartão', icon: 'CreditCard' },
  dinheiro: { label: 'Dinheiro', icon: 'Banknote' },
  outro: { label: 'Outro', icon: 'MoreHorizontal' },
};

export const PERIODICIDADE_CONFIG: Record<Periodicidade, { label: string; dias: number }> = {
  semanal: { label: 'Semanal', dias: 7 },
  quinzenal: { label: 'Quinzenal', dias: 15 },
  mensal: { label: 'Mensal', dias: 30 },
  bimestral: { label: 'Bimestral', dias: 60 },
  trimestral: { label: 'Trimestral', dias: 90 },
  semestral: { label: 'Semestral', dias: 180 },
  anual: { label: 'Anual', dias: 365 },
};

// ============= Mock Data =============

export const mockCategorias: CategoriaFinanceira[] = [
  { id: 'cat-001', nome: 'Compra de Mercadorias', tipo: 'despesa', grupo: 'CMV', ativo: true },
  { id: 'cat-002', nome: 'Fretes e Transportes', tipo: 'despesa', grupo: 'Logística', ativo: true },
  { id: 'cat-003', nome: 'Impostos e Tributos', tipo: 'despesa', grupo: 'Fiscal', ativo: true },
  { id: 'cat-004', nome: 'Despesas Administrativas', tipo: 'despesa', grupo: 'Administrativo', ativo: true },
  { id: 'cat-005', nome: 'Serviços de Terceiros', tipo: 'despesa', grupo: 'Operacional', ativo: true },
  { id: 'cat-006', nome: 'Marketing e Publicidade', tipo: 'despesa', grupo: 'Marketing', ativo: true },
  { id: 'cat-007', nome: 'Taxas de Marketplace', tipo: 'despesa', grupo: 'Canais', ativo: true },
  { id: 'cat-008', nome: 'Folha de Pagamento', tipo: 'despesa', grupo: 'Pessoal', ativo: true },
  { id: 'cat-009', nome: 'Aluguel e Condomínio', tipo: 'despesa', grupo: 'Infraestrutura', ativo: true },
  { id: 'cat-010', nome: 'Energia e Telecomunicações', tipo: 'despesa', grupo: 'Infraestrutura', ativo: true },
];

export const mockCentrosCusto: CentroCusto[] = [
  { id: 'cc-001', nome: 'E-commerce Geral', descricao: 'Operações gerais de e-commerce', ativo: true },
  { id: 'cc-002', nome: 'Mercado Livre', descricao: 'Operações específicas do ML', ativo: true },
  { id: 'cc-003', nome: 'Shopee', descricao: 'Operações específicas da Shopee', ativo: true },
  { id: 'cc-004', nome: 'Shein', descricao: 'Operações específicas da Shein', ativo: true },
  { id: 'cc-005', nome: 'TikTok Shop', descricao: 'Operações do TikTok', ativo: true },
  { id: 'cc-006', nome: 'Administrativo', descricao: 'Despesas administrativas gerais', ativo: true },
];

export const mockContasBancarias: ContaBancaria[] = [
  { id: 'cb-001', nome: 'Conta Principal Exchange', banco: 'Itaú', agencia: '1234', conta: '56789-0', tipo: 'corrente', saldoAtual: 45000, empresaId: 'emp-001', ativo: true },
  { id: 'cb-002', nome: 'Conta Digital Exchange', banco: 'Nubank', agencia: '', conta: '987654321', tipo: 'digital', saldoAtual: 12500, empresaId: 'emp-001', ativo: true },
  { id: 'cb-003', nome: 'Caixa Exchange', banco: '', agencia: '', conta: '', tipo: 'caixa', saldoAtual: 2500, empresaId: 'emp-001', ativo: true },
  { id: 'cb-004', nome: 'Conta Inpari', banco: 'Bradesco', agencia: '5678', conta: '12345-6', tipo: 'corrente', saldoAtual: 18000, empresaId: 'emp-002', ativo: true },
];

export const mockFornecedores: Fornecedor[] = [
  { id: 'forn-001', nome: 'Distribuidora ABC', cnpjCpf: '11.222.333/0001-44', email: 'contato@abc.com', telefone: '(11) 3333-4444', ativo: true },
  { id: 'forn-002', nome: 'Importadora XYZ', cnpjCpf: '22.333.444/0001-55', email: 'vendas@xyz.com', telefone: '(11) 5555-6666', ativo: true },
  { id: 'forn-003', nome: 'Transportadora Rápida', cnpjCpf: '33.444.555/0001-66', email: 'frete@rapida.com', telefone: '(11) 7777-8888', ativo: true },
  { id: 'forn-004', nome: 'Contabilidade Silva', cnpjCpf: '44.555.666/0001-77', email: 'silva@contabil.com', telefone: '(11) 9999-0000', ativo: true },
  { id: 'forn-005', nome: 'Energia Elétrica CPFL', cnpjCpf: '55.666.777/0001-88', ativo: true },
  { id: 'forn-006', nome: 'Internet Vivo', cnpjCpf: '66.777.888/0001-99', ativo: true },
];

// Gerar datas para os mocks
const hoje = new Date();
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const mockContasPagar: ContaPagar[] = [
  {
    id: 'cp-001',
    empresaId: 'emp-001',
    fornecedorId: 'forn-001',
    descricao: 'Compra de mercadorias - Lote 2024/11',
    documento: 'NF 12345',
    tipoLancamento: 'compra_mercadoria',
    dataEmissao: formatDate(addDays(hoje, -10)),
    dataVencimento: formatDate(addDays(hoje, 5)),
    valorTotal: 15000,
    valorPago: 0,
    valorEmAberto: 15000,
    status: 'em_aberto',
    formaPagamento: 'boleto',
    categoriaId: 'cat-001',
    centroCustoId: 'cc-001',
    anexos: [],
    parcelas: [],
    pagamentos: [],
    nfId: 'nf-001',
    compraId: 'comp-001',
    recorrente: false,
    conciliado: false,
    dataCriacao: formatDate(addDays(hoje, -10)),
    dataAtualizacao: formatDate(addDays(hoje, -10)),
  },
  {
    id: 'cp-002',
    empresaId: 'emp-001',
    fornecedorId: 'forn-003',
    descricao: 'Frete envios Mercado Livre - Nov/2024',
    documento: 'FAT-789',
    tipoLancamento: 'despesa_operacional',
    dataEmissao: formatDate(addDays(hoje, -5)),
    dataVencimento: formatDate(addDays(hoje, -2)),
    valorTotal: 3500,
    valorPago: 0,
    valorEmAberto: 3500,
    status: 'vencido',
    formaPagamento: 'pix',
    categoriaId: 'cat-002',
    centroCustoId: 'cc-002',
    anexos: [],
    parcelas: [],
    pagamentos: [],
    recorrente: false,
    conciliado: false,
    dataCriacao: formatDate(addDays(hoje, -5)),
    dataAtualizacao: formatDate(addDays(hoje, -5)),
  },
  {
    id: 'cp-003',
    empresaId: 'emp-001',
    fornecedorId: 'forn-004',
    descricao: 'Honorários contábeis - Nov/2024',
    documento: 'RPA 456',
    tipoLancamento: 'servico',
    dataEmissao: formatDate(addDays(hoje, -15)),
    dataVencimento: formatDate(hoje),
    valorTotal: 2500,
    valorPago: 2500,
    valorEmAberto: 0,
    status: 'pago',
    formaPagamento: 'transferencia',
    contaBancariaId: 'cb-001',
    categoriaId: 'cat-005',
    centroCustoId: 'cc-006',
    anexos: [],
    parcelas: [],
    pagamentos: [
      {
        id: 'pag-001',
        contaPagarId: 'cp-003',
        dataPagamento: formatDate(addDays(hoje, -1)),
        valorPrincipal: 2500,
        jurosMulta: 0,
        desconto: 0,
        valorTotal: 2500,
        formaPagamento: 'transferencia',
        contaBancariaId: 'cb-001',
      }
    ],
    recorrente: true,
    periodicidade: 'mensal',
    conciliado: true,
    dataCriacao: formatDate(addDays(hoje, -15)),
    dataAtualizacao: formatDate(addDays(hoje, -1)),
  },
  {
    id: 'cp-004',
    empresaId: 'emp-002',
    fornecedorId: 'forn-002',
    descricao: 'Compra produtos importados',
    documento: 'NF 67890',
    tipoLancamento: 'compra_mercadoria',
    dataEmissao: formatDate(addDays(hoje, -20)),
    dataVencimento: formatDate(addDays(hoje, -15)),
    valorTotal: 25000,
    valorPago: 12500,
    valorEmAberto: 12500,
    status: 'parcialmente_pago',
    formaPagamento: 'boleto',
    categoriaId: 'cat-001',
    centroCustoId: 'cc-001',
    anexos: [],
    parcelas: [
      { id: 'parc-001', contaPagarId: 'cp-004', numero: 1, dataVencimento: formatDate(addDays(hoje, -15)), valorOriginal: 12500, valorPago: 12500, valorEmAberto: 0, status: 'pago' },
      { id: 'parc-002', contaPagarId: 'cp-004', numero: 2, dataVencimento: formatDate(addDays(hoje, 15)), valorOriginal: 12500, valorPago: 0, valorEmAberto: 12500, status: 'em_aberto' },
    ],
    pagamentos: [
      {
        id: 'pag-002',
        contaPagarId: 'cp-004',
        parcelaId: 'parc-001',
        dataPagamento: formatDate(addDays(hoje, -15)),
        valorPrincipal: 12500,
        jurosMulta: 0,
        desconto: 0,
        valorTotal: 12500,
        formaPagamento: 'boleto',
        contaBancariaId: 'cb-004',
      }
    ],
    nfId: 'nf-002',
    recorrente: false,
    conciliado: false,
    dataCriacao: formatDate(addDays(hoje, -20)),
    dataAtualizacao: formatDate(addDays(hoje, -15)),
  },
  {
    id: 'cp-005',
    empresaId: 'emp-001',
    fornecedorId: 'forn-005',
    descricao: 'Energia elétrica - Nov/2024',
    documento: 'Fatura Nov',
    tipoLancamento: 'despesa_operacional',
    dataEmissao: formatDate(addDays(hoje, -8)),
    dataVencimento: formatDate(addDays(hoje, 7)),
    valorTotal: 850,
    valorPago: 0,
    valorEmAberto: 850,
    status: 'em_aberto',
    formaPagamento: 'boleto',
    categoriaId: 'cat-010',
    centroCustoId: 'cc-006',
    anexos: [],
    parcelas: [],
    pagamentos: [],
    recorrente: true,
    periodicidade: 'mensal',
    conciliado: false,
    dataCriacao: formatDate(addDays(hoje, -8)),
    dataAtualizacao: formatDate(addDays(hoje, -8)),
  },
  {
    id: 'cp-006',
    empresaId: 'emp-001',
    fornecedorId: 'forn-006',
    descricao: 'Internet fibra - Nov/2024',
    documento: 'Fatura Internet',
    tipoLancamento: 'despesa_operacional',
    dataEmissao: formatDate(addDays(hoje, -5)),
    dataVencimento: formatDate(addDays(hoje, 10)),
    valorTotal: 350,
    valorPago: 0,
    valorEmAberto: 350,
    status: 'em_aberto',
    formaPagamento: 'boleto',
    categoriaId: 'cat-010',
    centroCustoId: 'cc-006',
    anexos: [],
    parcelas: [],
    pagamentos: [],
    recorrente: true,
    periodicidade: 'mensal',
    conciliado: false,
    dataCriacao: formatDate(addDays(hoje, -5)),
    dataAtualizacao: formatDate(addDays(hoje, -5)),
  },
];

// ============= Utility Functions =============

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export const parseDateBR = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getDaysUntilDue = (dataVencimento: string): number => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = parseDateBR(dataVencimento);
  const diffTime = vencimento.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getStatusFromDate = (conta: ContaPagar): StatusContaPagar => {
  if (conta.status === 'pago' || conta.status === 'cancelado') return conta.status;
  if (conta.valorPago > 0 && conta.valorEmAberto > 0) return 'parcialmente_pago';
  const diasAteVencimento = getDaysUntilDue(conta.dataVencimento);
  if (diasAteVencimento < 0) return 'vencido';
  return 'em_aberto';
};

// ============= Validation =============

export interface ContaPagarValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateContaPagar = (conta: Partial<ContaPagar>): ContaPagarValidation => {
  const errors: Record<string, string> = {};

  if (!conta.empresaId) {
    errors.empresaId = 'Empresa é obrigatória';
  }
  if (!conta.fornecedorId) {
    errors.fornecedorId = 'Fornecedor é obrigatório';
  }
  if (!conta.descricao?.trim()) {
    errors.descricao = 'Descrição é obrigatória';
  }
  if (!conta.tipoLancamento) {
    errors.tipoLancamento = 'Tipo de lançamento é obrigatório';
  }
  if (!conta.dataEmissao) {
    errors.dataEmissao = 'Data de emissão é obrigatória';
  }
  if (!conta.dataVencimento) {
    errors.dataVencimento = 'Data de vencimento é obrigatória';
  }
  if (!conta.valorTotal || conta.valorTotal <= 0) {
    errors.valorTotal = 'Valor total deve ser maior que zero';
  }
  if (!conta.categoriaId) {
    errors.categoriaId = 'Categoria financeira é obrigatória';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= Summary Calculations =============

export interface ContasPagarSummary {
  totalEmAberto: number;
  totalVencido: number;
  totalHoje: number;
  totalSemana: number;
  totalMes: number;
  quantidadeEmAberto: number;
  quantidadeVencido: number;
  quantidadeHoje: number;
  quantidadeSemana: number;
}

export const calculateContasPagarSummary = (contas: ContaPagar[]): ContasPagarSummary => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  
  const emAberto = contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado');
  
  const vencido = emAberto.filter(c => getDaysUntilDue(c.dataVencimento) < 0);
  const venceHoje = emAberto.filter(c => getDaysUntilDue(c.dataVencimento) === 0);
  const venceSemana = emAberto.filter(c => {
    const dias = getDaysUntilDue(c.dataVencimento);
    return dias >= 0 && dias <= 7;
  });
  const venceMes = emAberto.filter(c => {
    const dias = getDaysUntilDue(c.dataVencimento);
    return dias >= 0 && dias <= 30;
  });

  return {
    totalEmAberto: emAberto.reduce((sum, c) => sum + c.valorEmAberto, 0),
    totalVencido: vencido.reduce((sum, c) => sum + c.valorEmAberto, 0),
    totalHoje: venceHoje.reduce((sum, c) => sum + c.valorEmAberto, 0),
    totalSemana: venceSemana.reduce((sum, c) => sum + c.valorEmAberto, 0),
    totalMes: venceMes.reduce((sum, c) => sum + c.valorEmAberto, 0),
    quantidadeEmAberto: emAberto.length,
    quantidadeVencido: vencido.length,
    quantidadeHoje: venceHoje.length,
    quantidadeSemana: venceSemana.length,
  };
};

// ============= Parcelamento Helper =============

export const generateParcelas = (
  valorTotal: number,
  numeroParcelas: number,
  dataVencimentoPrimeira: string,
  periodicidade: Periodicidade = 'mensal'
): Parcela[] => {
  const valorParcela = Math.floor((valorTotal / numeroParcelas) * 100) / 100;
  const resto = Math.round((valorTotal - valorParcela * numeroParcelas) * 100) / 100;
  
  const parcelas: Parcela[] = [];
  let dataAtual = parseDateBR(dataVencimentoPrimeira);
  
  for (let i = 0; i < numeroParcelas; i++) {
    const valor = i === numeroParcelas - 1 ? valorParcela + resto : valorParcela;
    parcelas.push({
      id: `parc-temp-${i + 1}`,
      contaPagarId: '',
      numero: i + 1,
      dataVencimento: formatDate(dataAtual),
      valorOriginal: valor,
      valorPago: 0,
      valorEmAberto: valor,
      status: 'em_aberto',
    });
    
    dataAtual = addDays(dataAtual, PERIODICIDADE_CONFIG[periodicidade].dias);
  }
  
  return parcelas;
};

// ============= Import/Export Helpers =============

export interface ImportResult {
  sucesso: number;
  erros: Array<{ linha: number; motivo: string }>;
}

export const validateImportRow = (
  row: Record<string, string>,
  empresas: Empresa[],
  fornecedores: Fornecedor[],
  categorias: CategoriaFinanceira[]
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!row.empresa || !empresas.find(e => e.nome.toLowerCase() === row.empresa.toLowerCase())) {
    errors.push('Empresa não encontrada');
  }
  if (!row.fornecedor || !fornecedores.find(f => f.nome.toLowerCase() === row.fornecedor.toLowerCase())) {
    errors.push('Fornecedor não encontrado');
  }
  if (!row.descricao?.trim()) {
    errors.push('Descrição é obrigatória');
  }
  if (!row.dataVencimento || !/^\d{2}\/\d{2}\/\d{4}$/.test(row.dataVencimento)) {
    errors.push('Data de vencimento inválida (use DD/MM/AAAA)');
  }
  if (!row.valor || isNaN(parseFloat(row.valor.replace(',', '.')))) {
    errors.push('Valor inválido');
  }
  if (!row.categoria || !categorias.find(c => c.nome.toLowerCase() === row.categoria.toLowerCase())) {
    errors.push('Categoria não encontrada');
  }
  
  return { valid: errors.length === 0, errors };
};

// ============= Reports Helpers =============

export interface RelatorioContasPagar {
  porCategoria: Array<{ categoria: string; valor: number; percentual: number }>;
  porFornecedor: Array<{ fornecedor: string; valor: number; quantidade: number }>;
  porStatus: Array<{ status: StatusContaPagar; valor: number; quantidade: number }>;
  projecaoSaidas: Array<{ data: string; valor: number; acumulado: number }>;
}

export const generateRelatorio = (
  contas: ContaPagar[],
  categorias: CategoriaFinanceira[],
  fornecedores: Fornecedor[]
): RelatorioContasPagar => {
  const totalGeral = contas.reduce((sum, c) => sum + c.valorTotal, 0);
  
  // Por categoria
  const categoriaMap = new Map<string, number>();
  contas.forEach(c => {
    const cat = categorias.find(cat => cat.id === c.categoriaId)?.nome || 'Sem categoria';
    categoriaMap.set(cat, (categoriaMap.get(cat) || 0) + c.valorTotal);
  });
  const porCategoria = Array.from(categoriaMap.entries())
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      percentual: totalGeral > 0 ? (valor / totalGeral) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Por fornecedor
  const fornecedorMap = new Map<string, { valor: number; quantidade: number }>();
  contas.forEach(c => {
    const forn = fornecedores.find(f => f.id === c.fornecedorId)?.nome || 'Sem fornecedor';
    const atual = fornecedorMap.get(forn) || { valor: 0, quantidade: 0 };
    fornecedorMap.set(forn, { valor: atual.valor + c.valorTotal, quantidade: atual.quantidade + 1 });
  });
  const porFornecedor = Array.from(fornecedorMap.entries())
    .map(([fornecedor, data]) => ({
      fornecedor,
      valor: data.valor,
      quantidade: data.quantidade,
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Por status
  const statusMap = new Map<StatusContaPagar, { valor: number; quantidade: number }>();
  contas.forEach(c => {
    const atual = statusMap.get(c.status) || { valor: 0, quantidade: 0 };
    statusMap.set(c.status, { valor: atual.valor + c.valorTotal, quantidade: atual.quantidade + 1 });
  });
  const porStatus = Array.from(statusMap.entries())
    .map(([status, data]) => ({
      status,
      valor: data.valor,
      quantidade: data.quantidade,
    }));
  
  // Projeção de saídas (próximos 30 dias)
  const contasEmAberto = contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado');
  const saidasPorData = new Map<string, number>();
  contasEmAberto.forEach(c => {
    saidasPorData.set(c.dataVencimento, (saidasPorData.get(c.dataVencimento) || 0) + c.valorEmAberto);
  });
  
  let acumulado = 0;
  const projecaoSaidas = Array.from(saidasPorData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, valor]) => {
      acumulado += valor;
      return { data, valor, acumulado };
    });
  
  return { porCategoria, porFornecedor, porStatus, projecaoSaidas };
};
