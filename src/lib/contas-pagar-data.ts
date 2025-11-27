// ============= Contas a Pagar Module Data Types & Logic =============

import { Empresa, mockEmpresas, REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit } from './empresas-data';
import { mockSuppliers, Supplier } from './purchases-data';

// ============= Enums & Types =============
export type StatusContaPagar = 'em_aberto' | 'parcialmente_pago' | 'pago' | 'vencido' | 'cancelado';
export type TipoLancamento = 'despesa_operacional' | 'compra_mercadoria' | 'imposto_tributo' | 'servico' | 'folha_pagamento' | 'outro';
export type FormaPagamento = 'pix' | 'boleto' | 'transferencia' | 'cartao' | 'dinheiro' | 'cheque' | 'outro';
export type CondicaoPagamento = 'a_vista' | 'parcelado';
export type Periodicidade = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';

// ============= Interfaces =============
export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: 'despesa' | 'receita';
  grupo: string;
  impactaDRE: boolean;
}

export interface CentroCusto {
  id: string;
  nome: string;
  descricao?: string;
  status: 'ativo' | 'inativo';
}

export interface ContaBancaria {
  id: string;
  empresaId: string;
  nome: string;
  banco: string;
  agencia: string;
  conta: string;
  tipo: 'corrente' | 'poupanca' | 'carteira_digital' | 'caixa';
  saldoAtual: number;
  status: 'ativo' | 'inativo';
}

export interface Pagamento {
  id: string;
  contaPagarId: string;
  dataPagamento: string;
  valorPago: number;
  juros: number;
  multa: number;
  desconto: number;
  valorTotal: number;
  formaPagamento: FormaPagamento;
  contaBancariaId?: string;
  comprovante?: string;
  observacoes?: string;
  dataCadastro: string;
}

export interface ContaPagar {
  id: string;
  empresaId: string;
  fornecedorId?: string;
  fornecedorNome: string;
  descricao: string;
  documento?: string;
  tipoLancamento: TipoLancamento;
  dataEmissao: string;
  dataVencimento: string;
  valorOriginal: number;
  valorPago: number;
  valorEmAberto: number;
  condicaoPagamento: CondicaoPagamento;
  numeroParcelas?: number;
  parcelaAtual?: number;
  parcelaPaiId?: string; // Para vincular parcelas ao título original
  status: StatusContaPagar;
  formaPagamento?: FormaPagamento;
  categoriaId: string;
  centroCustoId?: string;
  contaBancariaId?: string;
  observacoes?: string;
  anexos?: string[];
  nfVinculadaId?: string;
  compraVinculadaId?: string;
  recorrente: boolean;
  periodicidade?: Periodicidade;
  quantidadeRecorrencias?: number;
  conciliado: boolean;
  pagamentos: Pagamento[];
  dataCadastro: string;
  dataAtualizacao: string;
}

export interface ContaPagarFormData {
  empresaId: string;
  fornecedorId?: string;
  fornecedorNome: string;
  descricao: string;
  documento?: string;
  tipoLancamento: TipoLancamento;
  dataEmissao: string;
  dataVencimento: string;
  valorOriginal: number;
  condicaoPagamento: CondicaoPagamento;
  numeroParcelas?: number;
  formaPagamento?: FormaPagamento;
  categoriaId: string;
  centroCustoId?: string;
  observacoes?: string;
  recorrente: boolean;
  periodicidade?: Periodicidade;
  quantidadeRecorrencias?: number;
}

// ============= Status Configuration =============
export const STATUS_CONTA_PAGAR: Record<StatusContaPagar, { label: string; color: string; bgColor: string }> = {
  em_aberto: { label: "Em Aberto", color: "text-blue-700", bgColor: "bg-blue-100 border-blue-300" },
  parcialmente_pago: { label: "Parcial", color: "text-amber-700", bgColor: "bg-amber-100 border-amber-300" },
  pago: { label: "Pago", color: "text-emerald-700", bgColor: "bg-emerald-100 border-emerald-300" },
  vencido: { label: "Vencido", color: "text-red-700", bgColor: "bg-red-100 border-red-300" },
  cancelado: { label: "Cancelado", color: "text-gray-700", bgColor: "bg-gray-100 border-gray-300" },
};

export const TIPO_LANCAMENTO: Record<TipoLancamento, { label: string; icon: string }> = {
  despesa_operacional: { label: "Despesa Operacional", icon: "📊" },
  compra_mercadoria: { label: "Compra de Mercadoria", icon: "📦" },
  imposto_tributo: { label: "Imposto/Tributo", icon: "🏛️" },
  servico: { label: "Serviço", icon: "🔧" },
  folha_pagamento: { label: "Folha de Pagamento", icon: "👥" },
  outro: { label: "Outro", icon: "📋" },
};

export const FORMA_PAGAMENTO: Record<FormaPagamento, { label: string; icon: string }> = {
  pix: { label: "PIX", icon: "⚡" },
  boleto: { label: "Boleto", icon: "📄" },
  transferencia: { label: "Transferência", icon: "🏦" },
  cartao: { label: "Cartão", icon: "💳" },
  dinheiro: { label: "Dinheiro", icon: "💵" },
  cheque: { label: "Cheque", icon: "📝" },
  outro: { label: "Outro", icon: "📋" },
};

export const PERIODICIDADE: Record<Periodicidade, { label: string; dias: number }> = {
  semanal: { label: "Semanal", dias: 7 },
  quinzenal: { label: "Quinzenal", dias: 15 },
  mensal: { label: "Mensal", dias: 30 },
  bimestral: { label: "Bimestral", dias: 60 },
  trimestral: { label: "Trimestral", dias: 90 },
  semestral: { label: "Semestral", dias: 180 },
  anual: { label: "Anual", dias: 365 },
};

// ============= Mock Data =============
export const mockCategorias: CategoriaFinanceira[] = [
  { id: "cat-001", nome: "Compra de Mercadorias", tipo: "despesa", grupo: "CMV", impactaDRE: true },
  { id: "cat-002", nome: "Despesas Administrativas", tipo: "despesa", grupo: "Despesas Operacionais", impactaDRE: true },
  { id: "cat-003", nome: "Impostos e Taxas", tipo: "despesa", grupo: "Impostos", impactaDRE: true },
  { id: "cat-004", nome: "Folha de Pagamento", tipo: "despesa", grupo: "Despesas com Pessoal", impactaDRE: true },
  { id: "cat-005", nome: "Frete e Logística", tipo: "despesa", grupo: "Despesas Operacionais", impactaDRE: true },
  { id: "cat-006", nome: "Marketing e Publicidade", tipo: "despesa", grupo: "Despesas Operacionais", impactaDRE: true },
  { id: "cat-007", nome: "Aluguel e IPTU", tipo: "despesa", grupo: "Despesas Fixas", impactaDRE: true },
  { id: "cat-008", nome: "Serviços Terceirizados", tipo: "despesa", grupo: "Despesas Operacionais", impactaDRE: true },
  { id: "cat-009", nome: "Energia e Água", tipo: "despesa", grupo: "Despesas Fixas", impactaDRE: true },
  { id: "cat-010", nome: "Taxas de Marketplace", tipo: "despesa", grupo: "Deduções", impactaDRE: true },
];

export const mockCentrosCusto: CentroCusto[] = [
  { id: "cc-001", nome: "E-commerce", descricao: "Operação de marketplace", status: "ativo" },
  { id: "cc-002", nome: "Inpari", descricao: "Operação Inpari", status: "ativo" },
  { id: "cc-003", nome: "Exchange", descricao: "Operação Exchange", status: "ativo" },
  { id: "cc-004", nome: "Administrativo", descricao: "Despesas administrativas", status: "ativo" },
  { id: "cc-005", nome: "Contabilidade", descricao: "Despesas contábeis", status: "ativo" },
];

export const mockContasBancarias: ContaBancaria[] = [
  { id: "cb-001", empresaId: "emp-001", nome: "Conta Principal Exchange", banco: "Itaú", agencia: "1234", conta: "56789-0", tipo: "corrente", saldoAtual: 125000, status: "ativo" },
  { id: "cb-002", empresaId: "emp-001", nome: "Conta Digital Exchange", banco: "Inter", agencia: "0001", conta: "12345-6", tipo: "carteira_digital", saldoAtual: 35000, status: "ativo" },
  { id: "cb-003", empresaId: "emp-002", nome: "Conta Inpari", banco: "Bradesco", agencia: "4321", conta: "98765-0", tipo: "corrente", saldoAtual: 48000, status: "ativo" },
  { id: "cb-004", empresaId: "emp-001", nome: "Caixa Físico", banco: "-", agencia: "-", conta: "-", tipo: "caixa", saldoAtual: 5000, status: "ativo" },
];

export const mockContasPagar: ContaPagar[] = [
  {
    id: "cp-001",
    empresaId: "emp-001",
    fornecedorId: "forn-001",
    fornecedorNome: "Samsung Brasil",
    descricao: "Compra de TVs 50 polegadas - NF 12345",
    documento: "12345",
    tipoLancamento: "compra_mercadoria",
    dataEmissao: "2024-10-05",
    dataVencimento: "2024-11-05",
    valorOriginal: 72500,
    valorPago: 0,
    valorEmAberto: 72500,
    condicaoPagamento: "a_vista",
    status: "em_aberto",
    formaPagamento: "boleto",
    categoriaId: "cat-001",
    centroCustoId: "cc-003",
    recorrente: false,
    conciliado: false,
    pagamentos: [],
    nfVinculadaId: "nf-001",
    compraVinculadaId: "comp-001",
    dataCadastro: "2024-10-05",
    dataAtualizacao: "2024-10-05",
  },
  {
    id: "cp-002",
    empresaId: "emp-001",
    fornecedorId: "forn-002",
    fornecedorNome: "Dell Technologies",
    descricao: "Compra de Notebooks - NF 12346 (1/3)",
    documento: "12346",
    tipoLancamento: "compra_mercadoria",
    dataEmissao: "2024-10-10",
    dataVencimento: "2024-10-25",
    valorOriginal: 28000,
    valorPago: 28000,
    valorEmAberto: 0,
    condicaoPagamento: "parcelado",
    numeroParcelas: 3,
    parcelaAtual: 1,
    status: "pago",
    formaPagamento: "boleto",
    categoriaId: "cat-001",
    centroCustoId: "cc-003",
    recorrente: false,
    conciliado: true,
    pagamentos: [
      {
        id: "pag-001",
        contaPagarId: "cp-002",
        dataPagamento: "2024-10-25",
        valorPago: 28000,
        juros: 0,
        multa: 0,
        desconto: 0,
        valorTotal: 28000,
        formaPagamento: "boleto",
        contaBancariaId: "cb-001",
        dataCadastro: "2024-10-25",
      }
    ],
    nfVinculadaId: "nf-002",
    compraVinculadaId: "comp-002",
    dataCadastro: "2024-10-10",
    dataAtualizacao: "2024-10-25",
  },
  {
    id: "cp-003",
    empresaId: "emp-001",
    fornecedorId: "forn-002",
    fornecedorNome: "Dell Technologies",
    descricao: "Compra de Notebooks - NF 12346 (2/3)",
    documento: "12346",
    tipoLancamento: "compra_mercadoria",
    dataEmissao: "2024-10-10",
    dataVencimento: "2024-11-25",
    valorOriginal: 28000,
    valorPago: 0,
    valorEmAberto: 28000,
    condicaoPagamento: "parcelado",
    numeroParcelas: 3,
    parcelaAtual: 2,
    parcelaPaiId: "cp-002",
    status: "em_aberto",
    formaPagamento: "boleto",
    categoriaId: "cat-001",
    centroCustoId: "cc-003",
    recorrente: false,
    conciliado: false,
    pagamentos: [],
    nfVinculadaId: "nf-002",
    compraVinculadaId: "comp-002",
    dataCadastro: "2024-10-10",
    dataAtualizacao: "2024-10-10",
  },
  {
    id: "cp-004",
    empresaId: "emp-001",
    fornecedorId: "forn-002",
    fornecedorNome: "Dell Technologies",
    descricao: "Compra de Notebooks - NF 12346 (3/3)",
    documento: "12346",
    tipoLancamento: "compra_mercadoria",
    dataEmissao: "2024-10-10",
    dataVencimento: "2024-12-25",
    valorOriginal: 28000,
    valorPago: 0,
    valorEmAberto: 28000,
    condicaoPagamento: "parcelado",
    numeroParcelas: 3,
    parcelaAtual: 3,
    parcelaPaiId: "cp-002",
    status: "em_aberto",
    formaPagamento: "boleto",
    categoriaId: "cat-001",
    centroCustoId: "cc-003",
    recorrente: false,
    conciliado: false,
    pagamentos: [],
    nfVinculadaId: "nf-002",
    compraVinculadaId: "comp-002",
    dataCadastro: "2024-10-10",
    dataAtualizacao: "2024-10-10",
  },
  {
    id: "cp-005",
    empresaId: "emp-001",
    fornecedorNome: "Imobiliária Central",
    descricao: "Aluguel - Outubro 2024",
    documento: "ALQ-10-2024",
    tipoLancamento: "despesa_operacional",
    dataEmissao: "2024-10-01",
    dataVencimento: "2024-10-10",
    valorOriginal: 8500,
    valorPago: 8500,
    valorEmAberto: 0,
    condicaoPagamento: "a_vista",
    status: "pago",
    formaPagamento: "pix",
    categoriaId: "cat-007",
    centroCustoId: "cc-004",
    recorrente: true,
    periodicidade: "mensal",
    conciliado: true,
    pagamentos: [
      {
        id: "pag-002",
        contaPagarId: "cp-005",
        dataPagamento: "2024-10-10",
        valorPago: 8500,
        juros: 0,
        multa: 0,
        desconto: 0,
        valorTotal: 8500,
        formaPagamento: "pix",
        contaBancariaId: "cb-001",
        dataCadastro: "2024-10-10",
      }
    ],
    dataCadastro: "2024-10-01",
    dataAtualizacao: "2024-10-10",
  },
  {
    id: "cp-006",
    empresaId: "emp-001",
    fornecedorNome: "Folha de Pagamento",
    descricao: "Salários - Outubro 2024",
    documento: "FP-10-2024",
    tipoLancamento: "folha_pagamento",
    dataEmissao: "2024-10-01",
    dataVencimento: "2024-11-05",
    valorOriginal: 35000,
    valorPago: 0,
    valorEmAberto: 35000,
    condicaoPagamento: "a_vista",
    status: "em_aberto",
    formaPagamento: "transferencia",
    categoriaId: "cat-004",
    centroCustoId: "cc-004",
    recorrente: true,
    periodicidade: "mensal",
    conciliado: false,
    pagamentos: [],
    dataCadastro: "2024-10-01",
    dataAtualizacao: "2024-10-01",
  },
  {
    id: "cp-007",
    empresaId: "emp-001",
    fornecedorNome: "Contador Silva & Associados",
    descricao: "Honorários Contábeis - Outubro",
    documento: "HON-10-2024",
    tipoLancamento: "servico",
    dataEmissao: "2024-10-01",
    dataVencimento: "2024-10-15",
    valorOriginal: 2500,
    valorPago: 2500,
    valorEmAberto: 0,
    condicaoPagamento: "a_vista",
    status: "pago",
    formaPagamento: "pix",
    categoriaId: "cat-008",
    centroCustoId: "cc-005",
    recorrente: true,
    periodicidade: "mensal",
    conciliado: true,
    pagamentos: [
      {
        id: "pag-003",
        contaPagarId: "cp-007",
        dataPagamento: "2024-10-15",
        valorPago: 2500,
        juros: 0,
        multa: 0,
        desconto: 0,
        valorTotal: 2500,
        formaPagamento: "pix",
        contaBancariaId: "cb-002",
        dataCadastro: "2024-10-15",
      }
    ],
    dataCadastro: "2024-10-01",
    dataAtualizacao: "2024-10-15",
  },
  {
    id: "cp-008",
    empresaId: "emp-001",
    fornecedorNome: "Receita Federal",
    descricao: "DAS Simples Nacional - Outubro",
    documento: "DAS-10-2024",
    tipoLancamento: "imposto_tributo",
    dataEmissao: "2024-10-01",
    dataVencimento: "2024-10-20",
    valorOriginal: 15000,
    valorPago: 0,
    valorEmAberto: 15000,
    condicaoPagamento: "a_vista",
    status: "vencido",
    formaPagamento: "boleto",
    categoriaId: "cat-003",
    centroCustoId: "cc-003",
    recorrente: true,
    periodicidade: "mensal",
    conciliado: false,
    pagamentos: [],
    dataCadastro: "2024-10-01",
    dataAtualizacao: "2024-10-21",
  },
  {
    id: "cp-009",
    empresaId: "emp-002",
    fornecedorId: "forn-004",
    fornecedorNome: "LG Electronics",
    descricao: "Compra de Monitores - NF 12348",
    documento: "12348",
    tipoLancamento: "compra_mercadoria",
    dataEmissao: "2024-10-12",
    dataVencimento: "2024-11-12",
    valorOriginal: 20800,
    valorPago: 10400,
    valorEmAberto: 10400,
    condicaoPagamento: "a_vista",
    status: "parcialmente_pago",
    formaPagamento: "boleto",
    categoriaId: "cat-001",
    centroCustoId: "cc-002",
    recorrente: false,
    conciliado: false,
    pagamentos: [
      {
        id: "pag-004",
        contaPagarId: "cp-009",
        dataPagamento: "2024-10-20",
        valorPago: 10400,
        juros: 0,
        multa: 0,
        desconto: 0,
        valorTotal: 10400,
        formaPagamento: "pix",
        contaBancariaId: "cb-003",
        dataCadastro: "2024-10-20",
      }
    ],
    nfVinculadaId: "nf-005",
    compraVinculadaId: "comp-005",
    dataCadastro: "2024-10-12",
    dataAtualizacao: "2024-10-20",
  },
  {
    id: "cp-010",
    empresaId: "emp-001",
    fornecedorNome: "Correios / Jadlog",
    descricao: "Fretes do Período - Outubro",
    documento: "FRETE-10-2024",
    tipoLancamento: "despesa_operacional",
    dataEmissao: "2024-10-25",
    dataVencimento: "2024-11-10",
    valorOriginal: 42000,
    valorPago: 0,
    valorEmAberto: 42000,
    condicaoPagamento: "a_vista",
    status: "em_aberto",
    formaPagamento: "boleto",
    categoriaId: "cat-005",
    centroCustoId: "cc-001",
    recorrente: false,
    conciliado: false,
    pagamentos: [],
    dataCadastro: "2024-10-25",
    dataAtualizacao: "2024-10-25",
  },
  {
    id: "cp-011",
    empresaId: "emp-001",
    fornecedorNome: "Google Ads",
    descricao: "Marketing Digital - Outubro",
    documento: "ADS-10-2024",
    tipoLancamento: "despesa_operacional",
    dataEmissao: "2024-10-31",
    dataVencimento: "2024-11-15",
    valorOriginal: 25000,
    valorPago: 0,
    valorEmAberto: 25000,
    condicaoPagamento: "a_vista",
    status: "em_aberto",
    formaPagamento: "cartao",
    categoriaId: "cat-006",
    centroCustoId: "cc-001",
    recorrente: true,
    periodicidade: "mensal",
    conciliado: false,
    pagamentos: [],
    dataCadastro: "2024-10-31",
    dataAtualizacao: "2024-10-31",
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

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const formatDateToISO = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

export const isOverdue = (vencimento: string, status: StatusContaPagar): boolean => {
  if (status === 'pago' || status === 'cancelado') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseDate(vencimento);
  return dueDate < today;
};

export const getDaysUntilDue = (vencimento: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseDate(vencimento);
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// ============= Calculation Functions =============
export interface ContasPagarSummary {
  totalEmAberto: number;
  totalVencido: number;
  totalPago: number;
  totalParcial: number;
  quantidadeEmAberto: number;
  quantidadeVencido: number;
  quantidadePago: number;
  venceHoje: number;
  venceSemana: number;
  venceMes: number;
  totalGeral: number;
}

export const calculateSummary = (contas: ContaPagar[]): ContasPagarSummary => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekFromNow = addDays(today, 7);
  const monthFromNow = addDays(today, 30);

  let totalEmAberto = 0;
  let totalVencido = 0;
  let totalPago = 0;
  let totalParcial = 0;
  let quantidadeEmAberto = 0;
  let quantidadeVencido = 0;
  let quantidadePago = 0;
  let venceHoje = 0;
  let venceSemana = 0;
  let venceMes = 0;

  contas.forEach(conta => {
    const dueDate = parseDate(conta.dataVencimento);

    if (conta.status === 'pago') {
      totalPago += conta.valorOriginal;
      quantidadePago++;
    } else if (conta.status === 'vencido' || (conta.status === 'em_aberto' && isOverdue(conta.dataVencimento, conta.status))) {
      totalVencido += conta.valorEmAberto;
      quantidadeVencido++;
    } else if (conta.status === 'parcialmente_pago') {
      totalParcial += conta.valorEmAberto;
    } else if (conta.status === 'em_aberto') {
      totalEmAberto += conta.valorEmAberto;
      quantidadeEmAberto++;

      // Vence hoje
      if (dueDate.getTime() === today.getTime()) {
        venceHoje += conta.valorEmAberto;
      }
      // Vence na semana
      if (dueDate <= weekFromNow && dueDate > today) {
        venceSemana += conta.valorEmAberto;
      }
      // Vence no mês
      if (dueDate <= monthFromNow && dueDate > today) {
        venceMes += conta.valorEmAberto;
      }
    }
  });

  return {
    totalEmAberto,
    totalVencido,
    totalPago,
    totalParcial,
    quantidadeEmAberto,
    quantidadeVencido,
    quantidadePago,
    venceHoje,
    venceSemana,
    venceMes,
    totalGeral: totalEmAberto + totalVencido + totalParcial,
  };
};

// ============= Generate Parcelas =============
export const generateParcelas = (
  conta: ContaPagarFormData,
  numeroParcelas: number
): ContaPagarFormData[] => {
  const parcelas: ContaPagarFormData[] = [];
  const valorParcela = Math.round((conta.valorOriginal / numeroParcelas) * 100) / 100;
  const baseDate = parseDate(conta.dataVencimento);

  for (let i = 0; i < numeroParcelas; i++) {
    const vencimento = addDays(baseDate, i * 30);
    const valorAjustado = i === numeroParcelas - 1 
      ? conta.valorOriginal - (valorParcela * (numeroParcelas - 1))
      : valorParcela;

    parcelas.push({
      ...conta,
      valorOriginal: valorAjustado,
      dataVencimento: formatDateToISO(vencimento),
      numeroParcelas,
      descricao: `${conta.descricao} (${i + 1}/${numeroParcelas})`,
    });
  }

  return parcelas;
};

// ============= Validation =============
export interface ContaPagarValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateContaPagar = (data: Partial<ContaPagarFormData>): ContaPagarValidation => {
  const errors: Record<string, string> = {};

  if (!data.empresaId) {
    errors.empresaId = "Empresa é obrigatória";
  }

  if (!data.fornecedorNome?.trim()) {
    errors.fornecedorNome = "Fornecedor é obrigatório";
  }

  if (!data.descricao?.trim()) {
    errors.descricao = "Descrição é obrigatória";
  }

  if (!data.dataEmissao) {
    errors.dataEmissao = "Data de emissão é obrigatória";
  }

  if (!data.dataVencimento) {
    errors.dataVencimento = "Data de vencimento é obrigatória";
  }

  if (!data.valorOriginal || data.valorOriginal <= 0) {
    errors.valorOriginal = "Valor deve ser maior que zero";
  }

  if (!data.tipoLancamento) {
    errors.tipoLancamento = "Tipo de lançamento é obrigatório";
  }

  if (!data.categoriaId) {
    errors.categoriaId = "Categoria é obrigatória";
  }

  if (data.condicaoPagamento === 'parcelado' && (!data.numeroParcelas || data.numeroParcelas < 2)) {
    errors.numeroParcelas = "Número de parcelas deve ser maior que 1";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// ============= Import Validation =============
export interface ImportRow {
  empresa: string;
  fornecedor: string;
  descricao: string;
  documento?: string;
  tipoLancamento: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  categoria: string;
  centroCusto?: string;
  formaPagamento?: string;
}

export interface ImportResult {
  success: boolean;
  row: number;
  data?: ContaPagarFormData;
  errors?: string[];
}

export const validateImportRow = (row: ImportRow, rowNumber: number, empresas: Empresa[]): ImportResult => {
  const errors: string[] = [];

  // Validate empresa
  const empresa = empresas.find(e => 
    e.nome.toLowerCase().includes(row.empresa.toLowerCase()) ||
    row.empresa.toLowerCase().includes(e.nome.split(' ')[0].toLowerCase())
  );
  if (!empresa) {
    errors.push(`Empresa "${row.empresa}" não encontrada`);
  }

  // Validate required fields
  if (!row.fornecedor?.trim()) errors.push("Fornecedor é obrigatório");
  if (!row.descricao?.trim()) errors.push("Descrição é obrigatória");
  if (!row.dataEmissao) errors.push("Data de emissão é obrigatória");
  if (!row.dataVencimento) errors.push("Data de vencimento é obrigatória");
  if (!row.valor || isNaN(row.valor) || row.valor <= 0) errors.push("Valor inválido");

  // Validate tipo lancamento
  const tipoLancamentoMap: Record<string, TipoLancamento> = {
    'despesa operacional': 'despesa_operacional',
    'compra de mercadoria': 'compra_mercadoria',
    'compra': 'compra_mercadoria',
    'imposto': 'imposto_tributo',
    'tributo': 'imposto_tributo',
    'serviço': 'servico',
    'servico': 'servico',
    'folha': 'folha_pagamento',
    'salário': 'folha_pagamento',
    'outro': 'outro',
  };
  const tipoLancamento = tipoLancamentoMap[row.tipoLancamento.toLowerCase()] || 'outro';

  // Validate categoria
  const categoria = mockCategorias.find(c => 
    c.nome.toLowerCase().includes(row.categoria.toLowerCase())
  );
  if (!categoria) {
    errors.push(`Categoria "${row.categoria}" não encontrada`);
  }

  if (errors.length > 0) {
    return { success: false, row: rowNumber, errors };
  }

  return {
    success: true,
    row: rowNumber,
    data: {
      empresaId: empresa!.id,
      fornecedorNome: row.fornecedor,
      descricao: row.descricao,
      documento: row.documento,
      tipoLancamento,
      dataEmissao: row.dataEmissao,
      dataVencimento: row.dataVencimento,
      valorOriginal: row.valor,
      condicaoPagamento: 'a_vista',
      categoriaId: categoria!.id,
      centroCustoId: row.centroCusto ? mockCentrosCusto.find(c => c.nome.toLowerCase().includes(row.centroCusto!.toLowerCase()))?.id : undefined,
      recorrente: false,
    }
  };
};

// ============= Export to DRE =============
export interface DREContribution {
  categoriaId: string;
  categoriaNome: string;
  grupo: string;
  valorTotal: number;
  quantidade: number;
}

export const calculateDREContribution = (contas: ContaPagar[], periodo: { inicio: string; fim: string }): DREContribution[] => {
  const contributions = new Map<string, DREContribution>();

  // Filter by period and paid status (regime de caixa)
  const contasDoPeriodo = contas.filter(conta => {
    if (conta.status !== 'pago' && conta.status !== 'parcialmente_pago') return false;
    
    const dataPagamento = conta.pagamentos[0]?.dataPagamento;
    if (!dataPagamento) return false;
    
    return dataPagamento >= periodo.inicio && dataPagamento <= periodo.fim;
  });

  contasDoPeriodo.forEach(conta => {
    const categoria = mockCategorias.find(c => c.id === conta.categoriaId);
    if (!categoria || !categoria.impactaDRE) return;

    const existing = contributions.get(conta.categoriaId);
    if (existing) {
      existing.valorTotal += conta.valorPago;
      existing.quantidade++;
    } else {
      contributions.set(conta.categoriaId, {
        categoriaId: conta.categoriaId,
        categoriaNome: categoria.nome,
        grupo: categoria.grupo,
        valorTotal: conta.valorPago,
        quantidade: 1,
      });
    }
  });

  return Array.from(contributions.values()).sort((a, b) => b.valorTotal - a.valorTotal);
};

// ============= Cash Flow Projection =============
export interface CashFlowProjection {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'saida';
  saldoAcumulado?: number;
}

export const projectCashFlow = (contas: ContaPagar[], dias: number = 30): CashFlowProjection[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = addDays(today, dias);

  const projections: CashFlowProjection[] = [];

  contas
    .filter(conta => 
      (conta.status === 'em_aberto' || conta.status === 'vencido' || conta.status === 'parcialmente_pago') &&
      parseDate(conta.dataVencimento) <= endDate
    )
    .forEach(conta => {
      projections.push({
        data: conta.dataVencimento,
        descricao: conta.descricao,
        valor: conta.valorEmAberto,
        tipo: 'saida',
      });
    });

  // Sort by date
  projections.sort((a, b) => a.data.localeCompare(b.data));

  return projections;
};

// Re-export for convenience
export { mockEmpresas, mockSuppliers, REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit };
export type { Empresa, Supplier };
