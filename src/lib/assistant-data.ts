// ============================================
// ASSISTENTE INTELIGENTE - Data Types & Logic
// ============================================

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertCategory = 
  | 'fiscal' 
  | 'financial' 
  | 'checklist' 
  | 'closing' 
  | 'invoice' 
  | 'operational';

export type AlertStatus = 'active' | 'resolved' | 'dismissed';

export interface AssistantAlert {
  id: string;
  empresa: string;
  category: AlertCategory;
  priority: AlertPriority;
  title: string;
  message: string;
  details?: string;
  suggestedAction?: string;
  impact?: string;
  relatedModule?: string;
  relatedRoute?: string;
  createdAt: Date;
  status: AlertStatus;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AssistantConfig {
  empresa: string;
  enabledCategories: AlertCategory[];
  sensitivity: 'low' | 'medium' | 'high';
  allowedHours: { start: number; end: number };
  lastCheck: Date;
  notifications: {
    sound: boolean;
    popup: boolean;
    badge: boolean;
  };
}

// Priority configuration
export const priorityConfig: Record<AlertPriority, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  label: string;
}> = {
  critical: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: '🚨',
    label: 'Crítico'
  },
  high: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: '⚠️',
    label: 'Alto'
  },
  medium: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: '📋',
    label: 'Médio'
  },
  low: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: '💡',
    label: 'Baixo'
  },
  info: {
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    icon: 'ℹ️',
    label: 'Info'
  }
};

// Category configuration
export const categoryConfig: Record<AlertCategory, {
  label: string;
  icon: string;
  description: string;
}> = {
  fiscal: {
    label: 'Tributário',
    icon: '📊',
    description: 'Alertas de risco fiscal e tributário'
  },
  financial: {
    label: 'Financeiro',
    icon: '💰',
    description: 'Alertas de saúde financeira'
  },
  checklist: {
    label: 'Checklist',
    icon: '✅',
    description: 'Alertas de checklist por canal'
  },
  closing: {
    label: 'Fechamento',
    icon: '📅',
    description: 'Alertas de fechamento mensal'
  },
  invoice: {
    label: 'Notas Fiscais',
    icon: '📄',
    description: 'Alertas de notas fiscais'
  },
  operational: {
    label: 'Operacional',
    icon: '⚙️',
    description: 'Alertas operacionais'
  }
};

// Default configuration
export const defaultAssistantConfig: AssistantConfig = {
  empresa: 'Exchange',
  enabledCategories: ['fiscal', 'financial', 'checklist', 'closing', 'invoice', 'operational'],
  sensitivity: 'medium',
  allowedHours: { start: 6, end: 22 },
  lastCheck: new Date(),
  notifications: {
    sound: false,
    popup: true,
    badge: true
  }
};

// Generate unique ID
export const generateAlertId = (): string => {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Format date for display
export const formatAlertDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  
  return date.toLocaleDateString('pt-BR');
};

// Mock alerts for testing
export const generateMockAlerts = (): AssistantAlert[] => {
  const now = new Date();
  
  return [
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'fiscal',
      priority: 'critical',
      title: 'Saldo de ICMS Negativo',
      message: 'Você está com vendas altas, mas com saldo de créditos de ICMS negativo. Isso pode chamar atenção da Receita Federal.',
      details: 'O saldo atual de ICMS é de R$ -6.500,00. Recomendamos adquirir notas fiscais com crédito de ICMS para compensar.',
      suggestedAction: 'Importar XMLs de NF-e com ICMS destacado ou registrar créditos manualmente.',
      impact: 'Risco de autuação fiscal e multas por divergência tributária.',
      relatedModule: 'ICMS',
      relatedRoute: '/icms',
      createdAt: new Date(now.getTime() - 30 * 60000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'financial',
      priority: 'high',
      title: 'Fluxo de Caixa em Risco',
      message: 'O fluxo de caixa projetado para os próximos 7 dias está negativo em R$ 47.601,86.',
      details: 'As saídas previstas superam as entradas. É necessário revisar os pagamentos programados.',
      suggestedAction: 'Renegociar prazos com fornecedores ou antecipar recebíveis.',
      impact: 'Possível inadimplência com fornecedores e impacto no crédito.',
      relatedModule: 'Fluxo de Caixa',
      relatedRoute: '/fluxo-caixa',
      createdAt: new Date(now.getTime() - 2 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'checklist',
      priority: 'medium',
      title: 'Checklist Mercado Livre Incompleto',
      message: 'Faltam 2 etapas para concluir o checklist de fechamento do Mercado Livre de Outubro/2024.',
      details: 'Etapas pendentes: Conferir repasses financeiros, Validar comissões.',
      suggestedAction: 'Acesse o módulo de Checklist e finalize as etapas pendentes.',
      impact: 'O fechamento mensal ficará incompleto.',
      relatedModule: 'Checklist',
      relatedRoute: '/checklist-fechamento',
      createdAt: new Date(now.getTime() - 4 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'closing',
      priority: 'medium',
      title: 'Fechamento de Outubro Pendente',
      message: 'O mês de Outubro/2024 está terminando e o fechamento financeiro ainda não foi concluído.',
      details: 'Existem divergências entre os relatórios de vendas e tarifas importados.',
      suggestedAction: 'Acesse o módulo de Fechamento e revise os dados importados.',
      relatedModule: 'Fechamento',
      relatedRoute: '/fechamento',
      createdAt: new Date(now.getTime() - 6 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'invoice',
      priority: 'low',
      title: 'XMLs Importados Sem Créditos',
      message: 'Existem 3 XMLs de NF-e importados que não geraram créditos de ICMS.',
      details: 'Verifique se as notas possuem ICMS destacado ou se são elegíveis para crédito.',
      suggestedAction: 'Revisar XMLs no módulo de Crédito de ICMS.',
      relatedModule: 'ICMS',
      relatedRoute: '/icms',
      createdAt: new Date(now.getTime() - 12 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'operational',
      priority: 'info',
      title: 'Margem Líquida Negativa',
      message: 'A margem líquida do período está em -6%, abaixo da média histórica.',
      details: 'As despesas operacionais representam 55,4% do faturamento.',
      suggestedAction: 'Revisar custos operacionais e buscar otimizações.',
      relatedModule: 'DRE',
      relatedRoute: '/dre',
      createdAt: new Date(now.getTime() - 24 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Inpari',
      category: 'fiscal',
      priority: 'high',
      title: 'Regime Tributário Incompatível',
      message: 'Identificamos registros de créditos de ICMS para empresa no Simples Nacional.',
      details: 'Empresas optantes pelo Simples Nacional não podem utilizar créditos de ICMS da mesma forma.',
      suggestedAction: 'Verifique o regime tributário da empresa e ajuste os lançamentos.',
      impact: 'Risco de autuação por aproveitamento indevido de créditos.',
      relatedModule: 'Configurações',
      relatedRoute: '/configuracoes',
      createdAt: new Date(now.getTime() - 48 * 3600000),
      status: 'active'
    },
    {
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'financial',
      priority: 'medium',
      title: 'Aumento de Custos com Fornecedor',
      message: 'Os custos com o fornecedor principal aumentaram 40% este mês.',
      details: 'Isso pode indicar aumento de preços ou erro no lançamento.',
      suggestedAction: 'Revisar os lançamentos e validar com o setor de compras.',
      relatedModule: 'Conciliação',
      relatedRoute: '/conciliacao',
      createdAt: new Date(now.getTime() - 72 * 3600000),
      status: 'active'
    }
  ];
};

// ============================================
// ALERT VERIFICATION RULES
// ============================================

export interface VerificationContext {
  icmsCreditos: number;
  icmsDebitos: number;
  saldoFluxoCaixa: number;
  margemLiquida: number;
  checklistsPendentes: number;
  fechamentosConcluidos: number;
  xmlsSemCredito: number;
  empresaRegime: string;
}

export const runFiscalChecks = (context: VerificationContext): AssistantAlert[] => {
  const alerts: AssistantAlert[] = [];
  const now = new Date();

  // Check ICMS balance
  const saldoICMS = context.icmsCreditos - context.icmsDebitos;
  if (saldoICMS < 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'fiscal',
      priority: 'critical',
      title: 'Saldo de ICMS Negativo',
      message: `Você está com saldo de ICMS negativo de R$ ${Math.abs(saldoICMS).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      suggestedAction: 'Adquira notas fiscais com ICMS destacado para compensar o saldo.',
      relatedRoute: '/icms',
      createdAt: now,
      status: 'active'
    });
  }

  // Check tax regime compatibility
  if (context.empresaRegime === 'simples' && context.icmsCreditos > 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'fiscal',
      priority: 'high',
      title: 'Créditos ICMS em Regime Simples',
      message: 'Empresa no Simples Nacional registrando créditos de ICMS - isso pode ser irregular.',
      relatedRoute: '/configuracoes',
      createdAt: now,
      status: 'active'
    });
  }

  return alerts;
};

export const runFinancialChecks = (context: VerificationContext): AssistantAlert[] => {
  const alerts: AssistantAlert[] = [];
  const now = new Date();

  // Check cash flow
  if (context.saldoFluxoCaixa < 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'financial',
      priority: 'high',
      title: 'Fluxo de Caixa Negativo',
      message: `O saldo do fluxo de caixa está negativo em R$ ${Math.abs(context.saldoFluxoCaixa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      suggestedAction: 'Revisar pagamentos programados e buscar antecipar recebíveis.',
      relatedRoute: '/fluxo-caixa',
      createdAt: now,
      status: 'active'
    });
  }

  // Check margin
  if (context.margemLiquida < 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'financial',
      priority: 'medium',
      title: 'Margem Líquida Negativa',
      message: `A margem líquida está em ${context.margemLiquida.toFixed(1)}%, indicando prejuízo operacional.`,
      suggestedAction: 'Revisar custos e despesas para identificar oportunidades de redução.',
      relatedRoute: '/dre',
      createdAt: now,
      status: 'active'
    });
  }

  return alerts;
};

export const runChecklistChecks = (context: VerificationContext): AssistantAlert[] => {
  const alerts: AssistantAlert[] = [];
  const now = new Date();

  if (context.checklistsPendentes > 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'checklist',
      priority: 'medium',
      title: 'Checklists Pendentes',
      message: `Existem ${context.checklistsPendentes} checklist(s) de fechamento ainda não concluídos.`,
      suggestedAction: 'Acesse o módulo de Checklist para finalizar as etapas pendentes.',
      relatedRoute: '/checklist-fechamento',
      createdAt: now,
      status: 'active'
    });
  }

  return alerts;
};

export const runInvoiceChecks = (context: VerificationContext): AssistantAlert[] => {
  const alerts: AssistantAlert[] = [];
  const now = new Date();

  if (context.xmlsSemCredito > 0) {
    alerts.push({
      id: generateAlertId(),
      empresa: 'Exchange',
      category: 'invoice',
      priority: 'low',
      title: 'XMLs Sem Créditos Gerados',
      message: `${context.xmlsSemCredito} XML(s) foram importados mas não geraram créditos de ICMS.`,
      suggestedAction: 'Verifique se as notas possuem ICMS destacado e são elegíveis.',
      relatedRoute: '/icms',
      createdAt: now,
      status: 'active'
    });
  }

  return alerts;
};
