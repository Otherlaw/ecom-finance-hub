// Assis.Fin - Intelligent Financial Assistant Data Types and Engine

export type AlertSeverity = 'critico' | 'alto' | 'medio' | 'baixo' | 'informativo';

export type AlertCategory = 
  | 'fiscal'
  | 'tributario'
  | 'financeiro'
  | 'operacional'
  | 'contabil'
  | 'checklist'
  | 'notas_fiscais';

export type AlertStatus = 'novo' | 'em_analise' | 'resolvido' | 'ignorado';

export interface AssistantAlert {
  id: string;
  titulo: string;
  descricao: string;
  descricaoCompleta: string;
  categoria: AlertCategory;
  severidade: AlertSeverity;
  status: AlertStatus;
  empresa?: string;
  canal?: string;
  dataDeteccao: Date;
  dataAtualizacao?: Date;
  impactoEstimado?: string;
  acaoRecomendada: string;
  linkDestino?: string;
  dadosContexto?: Record<string, any>;
  resolvidoPor?: string;
  dataResolucao?: Date;
}

export interface AssistantConfig {
  silenciado: boolean;
  silenciadoAte?: Date;
  alertasAtivos: boolean;
  categoriasAtivas: AlertCategory[];
  severidadesMinimas: AlertSeverity[];
  intervaloAnalise: number; // em minutos
}

// Categoria labels e cores
export const CATEGORY_CONFIG: Record<AlertCategory, { label: string; color: string; icon: string }> = {
  fiscal: { label: 'Risco Fiscal', color: 'text-red-500', icon: 'AlertTriangle' },
  tributario: { label: 'Risco Tributário', color: 'text-orange-500', icon: 'Receipt' },
  financeiro: { label: 'Risco Financeiro', color: 'text-amber-500', icon: 'TrendingDown' },
  operacional: { label: 'Risco Operacional', color: 'text-yellow-500', icon: 'Settings' },
  contabil: { label: 'Risco Contábil', color: 'text-blue-500', icon: 'FileText' },
  checklist: { label: 'Status Checklist', color: 'text-purple-500', icon: 'CheckSquare' },
  notas_fiscais: { label: 'Notas Fiscais', color: 'text-cyan-500', icon: 'FileSpreadsheet' },
};

export const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  critico: { label: 'Crítico', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-500' },
  alto: { label: 'Alto', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-500' },
  medio: { label: 'Médio', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-500' },
  baixo: { label: 'Baixo', color: 'text-blue-700', bgColor: 'bg-blue-100', borderColor: 'border-blue-500' },
  informativo: { label: 'Info', color: 'text-gray-700', bgColor: 'bg-gray-100', borderColor: 'border-gray-400' },
};

export const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  novo: { label: 'Novo', color: 'text-red-600' },
  em_analise: { label: 'Em Análise', color: 'text-yellow-600' },
  resolvido: { label: 'Resolvido', color: 'text-green-600' },
  ignorado: { label: 'Ignorado', color: 'text-gray-500' },
};

// Frases do personagem por severidade
export const ASSISTANT_PHRASES: Record<AlertSeverity, string[]> = {
  critico: [
    "⚠️ Atenção urgente! Detectei um problema crítico que precisa de ação imediata.",
    "🚨 Alerta crítico! Isso requer sua atenção agora.",
    "❗ Situação crítica detectada. Recomendo resolver o quanto antes.",
  ],
  alto: [
    "📊 Identifiquei algo importante que merece sua atenção.",
    "⚡ Detectei uma situação de risco alto no sistema.",
    "🔍 Encontrei algo que precisa ser verificado com prioridade.",
  ],
  medio: [
    "📝 Notei algo que vale a pena revisar quando possível.",
    "💡 Tenho uma observação importante para compartilhar.",
    "📋 Detectei uma situação que requer atenção moderada.",
  ],
  baixo: [
    "💬 Apenas uma observação rápida para você.",
    "📌 Notei algo que pode ser útil saber.",
    "ℹ️ Uma dica rápida para otimizar suas operações.",
  ],
  informativo: [
    "📢 Uma informação que pode ser relevante.",
    "✨ Compartilhando um insight sobre seus dados.",
    "📊 Análise concluída com algumas observações.",
  ],
};

// Mock de alertas para demonstração
export const generateMockAlerts = (): AssistantAlert[] => {
  const now = new Date();
  const alerts: AssistantAlert[] = [
    {
      id: 'alert-1',
      titulo: 'Crédito de ICMS Insuficiente',
      descricao: 'O crédito de ICMS da Exchange está 23% abaixo do débito estimado para o período.',
      descricaoCompleta: 'Analisando os dados de vendas e notas fiscais de entrada, identifiquei que o crédito de ICMS acumulado está significativamente abaixo do débito estimado. Isso resultará em ICMS a pagar no fechamento do período.\n\nDados da análise:\n- Débito ICMS estimado: R$ 45.230,00\n- Crédito ICMS disponível: R$ 34.850,00\n- Diferença: R$ 10.380,00 (23% de déficit)\n\nImpacto: Pagamento adicional de ICMS no próximo vencimento.',
      categoria: 'tributario',
      severidade: 'alto',
      status: 'novo',
      empresa: 'Exchange',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 30),
      impactoEstimado: 'R$ 10.380,00 em ICMS adicional',
      acaoRecomendada: 'Considere aumentar compras com destaque de ICMS ou revisar as notas já importadas para garantir que todos os créditos foram aproveitados.',
      linkDestino: '/icms',
      dadosContexto: {
        debitoEstimado: 45230,
        creditoDisponivel: 34850,
        diferenca: 10380,
        percentualDeficit: 23,
      },
    },
    {
      id: 'alert-2',
      titulo: 'Checklist Mercado Livre Incompleto',
      descricao: 'O checklist de fechamento do Mercado Livre para Nov/2025 está 65% concluído.',
      descricaoCompleta: 'O período está se encerrando e ainda existem etapas pendentes no checklist de fechamento do canal Mercado Livre.\n\nEtapas pendentes:\n- Baixar relatório de tarifas (obrigatório)\n- Conferir repasses financeiros\n- Upload do extrato de vendas\n\nRecomendo concluir estas etapas antes do fechamento para evitar atrasos na contabilização.',
      categoria: 'checklist',
      severidade: 'medio',
      status: 'novo',
      empresa: 'Exchange',
      canal: 'Mercado Livre',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 60 * 2),
      acaoRecomendada: 'Acesse o checklist do Mercado Livre e complete as etapas pendentes.',
      linkDestino: '/checklist-fechamento',
      dadosContexto: {
        percentualConcluido: 65,
        etapasPendentes: 3,
        etapasTotal: 8,
      },
    },
    {
      id: 'alert-3',
      titulo: 'Possível Pagamento Duplicado',
      descricao: 'Detectei dois pagamentos similares para o mesmo fornecedor em intervalo curto.',
      descricaoCompleta: 'Foram identificados dois pagamentos com características muito similares:\n\nPagamento 1:\n- Fornecedor: Distribuidora XYZ\n- Valor: R$ 8.450,00\n- Data: 25/11/2025\n- NF: 12345\n\nPagamento 2:\n- Fornecedor: Distribuidora XYZ\n- Valor: R$ 8.450,00\n- Data: 26/11/2025\n- NF: 12345\n\nA mesma NF foi referenciada em ambos os pagamentos, o que pode indicar uma duplicidade.',
      categoria: 'financeiro',
      severidade: 'alto',
      status: 'novo',
      empresa: 'Exchange',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 45),
      impactoEstimado: 'R$ 8.450,00 em pagamento potencialmente duplicado',
      acaoRecomendada: 'Verifique os pagamentos e confirme se houve duplicidade. Se confirmado, solicite estorno ou crédito ao fornecedor.',
      linkDestino: '/fluxo-caixa',
      dadosContexto: {
        valorPagamento: 8450,
        fornecedor: 'Distribuidora XYZ',
        nfReferenciada: '12345',
      },
    },
    {
      id: 'alert-4',
      titulo: 'NF sem NCM Cadastrado',
      descricao: '3 itens da NF 45678 estão sem código NCM, o que pode gerar problemas fiscais.',
      descricaoCompleta: 'A Nota Fiscal 45678 importada recentemente possui itens sem o código NCM (Nomenclatura Comum do Mercosul) cadastrado.\n\nItens afetados:\n- Item 2: Produto ABC (quantidade: 50)\n- Item 5: Produto DEF (quantidade: 30)\n- Item 8: Produto GHI (quantidade: 20)\n\nA ausência do NCM pode:\n- Impossibilitar o cálculo correto de ICMS\n- Gerar problemas em auditorias fiscais\n- Dificultar a classificação tributária',
      categoria: 'notas_fiscais',
      severidade: 'medio',
      status: 'novo',
      empresa: 'Exchange',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 120),
      acaoRecomendada: 'Acesse a NF e complete o cadastro do NCM para os itens pendentes.',
      linkDestino: '/icms',
      dadosContexto: {
        numeroNF: '45678',
        itensAfetados: 3,
        itensTotal: 10,
      },
    },
    {
      id: 'alert-5',
      titulo: 'Queda na Margem Bruta',
      descricao: 'A margem bruta caiu 8% nos últimos 30 dias comparado ao período anterior.',
      descricaoCompleta: 'Análise comparativa detectou uma queda significativa na margem bruta:\n\nPeríodo anterior (Out/2025):\n- Faturamento: R$ 485.000,00\n- CMV: R$ 290.000,00\n- Margem Bruta: 40,2%\n\nPeríodo atual (Nov/2025):\n- Faturamento: R$ 512.000,00\n- CMV: R$ 347.000,00\n- Margem Bruta: 32,2%\n\nA queda de 8 pontos percentuais pode indicar:\n- Aumento nos custos de aquisição\n- Pressão de preços nos marketplaces\n- Mix de produtos menos rentável',
      categoria: 'financeiro',
      severidade: 'alto',
      status: 'em_analise',
      empresa: 'Exchange',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      impactoEstimado: 'Redução de ~R$ 41.000 no lucro bruto',
      acaoRecomendada: 'Analise o mix de produtos vendidos e revise a precificação. Verifique se houve aumento nos custos de fornecedores.',
      linkDestino: '/dre',
      dadosContexto: {
        margemAnterior: 40.2,
        margemAtual: 32.2,
        variacaoPP: -8,
        impactoValor: 41000,
      },
    },
    {
      id: 'alert-6',
      titulo: 'Empresa Simples Nacional com Alto Volume',
      descricao: 'Inpari está próxima do limite de faturamento do Simples Nacional.',
      descricaoCompleta: 'A empresa Inpari, optante pelo Simples Nacional, está acumulando faturamento que pode ultrapassar o limite anual.\n\nFaturamento acumulado 2025: R$ 4.200.000,00\nLimite Simples Nacional: R$ 4.800.000,00\nMargem disponível: R$ 600.000,00\n\nCom a média mensal atual de R$ 380.000,00, a empresa pode ultrapassar o limite em aproximadamente 1,5 meses.\n\nConsequências do desenquadramento:\n- Mudança para Lucro Presumido ou Real\n- Aumento da carga tributária\n- Necessidade de adequação contábil',
      categoria: 'tributario',
      severidade: 'critico',
      status: 'novo',
      empresa: 'Inpari',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 15),
      impactoEstimado: 'Possível desenquadramento do Simples Nacional',
      acaoRecomendada: 'Consulte o contador sobre planejamento tributário. Considere estratégias como abertura de nova empresa ou migração planejada de regime.',
      linkDestino: '/empresas',
      dadosContexto: {
        faturamentoAcumulado: 4200000,
        limiteSimples: 4800000,
        margemDisponivel: 600000,
        mediaMensal: 380000,
      },
    },
    {
      id: 'alert-7',
      titulo: 'Fluxo de Caixa Projetado Negativo',
      descricao: 'Projeção indica fluxo de caixa negativo para os próximos 15 dias.',
      descricaoCompleta: 'Com base nas contas a pagar cadastradas e na previsão de recebimentos, o fluxo de caixa ficará negativo:\n\nSaldo atual: R$ 125.000,00\nContas a pagar (15 dias): R$ 185.000,00\nRecebimentos previstos: R$ 45.000,00\nSaldo projetado: -R$ 15.000,00\n\nPrincipais compromissos:\n- Fornecedor A: R$ 65.000 (venc. 05/12)\n- Impostos: R$ 48.000 (venc. 10/12)\n- Folha: R$ 72.000 (venc. 05/12)',
      categoria: 'financeiro',
      severidade: 'critico',
      status: 'novo',
      empresa: 'Exchange',
      dataDeteccao: new Date(now.getTime() - 1000 * 60 * 5),
      impactoEstimado: 'Déficit de R$ 15.000 em 15 dias',
      acaoRecomendada: 'Antecipe recebíveis se possível, negocie prazos com fornecedores ou considere linha de crédito emergencial.',
      linkDestino: '/fluxo-caixa',
      dadosContexto: {
        saldoAtual: 125000,
        contasPagar: 185000,
        recebimentosPrevistos: 45000,
        saldoProjetado: -15000,
      },
    },
  ];

  return alerts;
};

// Função para gerar ID único
export const generateAlertId = (): string => {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Função para obter frase aleatória do assistente
export const getAssistantPhrase = (severidade: AlertSeverity): string => {
  const phrases = ASSISTANT_PHRASES[severidade];
  return phrases[Math.floor(Math.random() * phrases.length)];
};

// Função para formatar data relativa
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays} dias atrás`;
  
  return date.toLocaleDateString('pt-BR');
};
