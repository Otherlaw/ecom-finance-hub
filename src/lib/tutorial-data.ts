// Definição dos tutoriais do assistente Fin

export interface TutorialStep {
  id: string;
  titulo: string;
  mensagem: string;
  navegarPara?: string;
  destaque?: string;
}

export interface Tutorial {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  duracaoEstimada: string;
  steps: TutorialStep[];
}

export const TUTORIAIS: Tutorial[] = [
  {
    id: 'onboarding',
    nome: 'Primeiros Passos',
    descricao: 'Conheça as principais funcionalidades do ECOM Finance',
    icone: '🚀',
    duracaoEstimada: '5 min',
    steps: [
      {
        id: 'bem-vindo',
        titulo: 'Bem-vindo ao ECOM Finance! 👋',
        mensagem: 'Sou o Fin, seu copiloto financeiro. Vou te guiar pelas principais funcionalidades do sistema para você aproveitar ao máximo sua gestão financeira de e-commerce.',
      },
      {
        id: 'dashboard',
        titulo: 'Dashboard Principal',
        mensagem: 'Este é seu painel inicial onde você encontra um resumo completo do seu negócio: faturamento, lucro, alertas e ações pendentes. Aqui você tem uma visão rápida de como está sua operação.',
        navegarPara: '/dashboard',
      },
      {
        id: 'dre',
        titulo: 'DRE - Demonstração de Resultado',
        mensagem: 'O DRE mostra a saúde financeira do seu negócio. Aqui você vê receitas, custos, despesas e o lucro líquido. Entenda suas margens: bruta, operacional e líquida.',
        navegarPara: '/dre',
      },
      {
        id: 'fluxo-caixa',
        titulo: 'Fluxo de Caixa',
        mensagem: 'Controle todas as entradas e saídas do seu caixa. Veja o saldo atual, projeções e analise de onde vem e para onde vai seu dinheiro.',
        navegarPara: '/fluxo-caixa',
      },
      {
        id: 'conciliacao',
        titulo: 'Hub de Conciliação',
        mensagem: 'Aqui você reconcilia transações bancárias, cartões de crédito e vendas de marketplace. Categorize cada movimento para alimentar seus relatórios automaticamente.',
        navegarPara: '/conciliacao',
      },
      {
        id: 'fechamento',
        titulo: 'Checklist de Fechamento',
        mensagem: 'O checklist te guia no processo de fechamento mensal. Siga cada etapa para garantir que todos os dados estejam corretos antes de fechar o mês.',
        navegarPara: '/checklist-fechamento',
      },
      {
        id: 'assistente',
        titulo: 'Eu, o Fin!',
        mensagem: 'Sempre que precisar de ajuda, me chame! Posso responder dúvidas sobre seus números, explicar relatórios e te ajudar a tomar decisões. Basta clicar no botão flutuante.',
      },
      {
        id: 'conclusao',
        titulo: 'Pronto para começar! 🎉',
        mensagem: 'Agora você conhece as principais áreas do sistema. Explore cada módulo e, se tiver dúvidas, estou aqui para ajudar. Boa sorte com sua gestão financeira!',
        navegarPara: '/dashboard',
      },
    ],
  },
  {
    id: 'dre',
    nome: 'Entendendo o DRE',
    descricao: 'Aprenda a interpretar sua Demonstração de Resultado',
    icone: '📊',
    duracaoEstimada: '7 min',
    steps: [
      {
        id: 'intro',
        titulo: 'O que é o DRE?',
        mensagem: 'A Demonstração do Resultado do Exercício (DRE) é um relatório contábil que mostra se sua empresa teve lucro ou prejuízo em um período. Vamos entender cada parte!',
        navegarPara: '/dre',
      },
      {
        id: 'receitas',
        titulo: 'Receitas',
        mensagem: 'No topo do DRE estão suas Receitas Brutas - todo o faturamento dos seus canais de venda (Mercado Livre, Shopee, etc). É o ponto de partida para calcular sua lucratividade.',
      },
      {
        id: 'deducoes',
        titulo: 'Deduções de Receita',
        mensagem: 'Das receitas brutas, subtraímos impostos sobre vendas, devoluções e descontos concedidos. O resultado é a Receita Líquida - o que realmente entrou no caixa.',
      },
      {
        id: 'cmv',
        titulo: 'CMV - Custo da Mercadoria Vendida',
        mensagem: 'O CMV representa quanto você pagou pelas mercadorias que vendeu. Subtraindo o CMV da Receita Líquida, temos o Lucro Bruto e a Margem Bruta.',
      },
      {
        id: 'despesas',
        titulo: 'Despesas Operacionais',
        mensagem: 'Aqui entram todas as despesas para manter a operação: marketing, pessoal, administrativo, logística. O Lucro Operacional (EBITDA) mostra a eficiência da sua operação.',
      },
      {
        id: 'lucro-liquido',
        titulo: 'Lucro Líquido',
        mensagem: 'Após deduzir despesas financeiras e impostos sobre o resultado, chegamos ao Lucro Líquido - o quanto realmente sobrou para você. A Margem Líquida ideal para e-commerce é acima de 10%.',
      },
    ],
  },
  {
    id: 'compras',
    nome: 'Gestão de Compras',
    descricao: 'Aprenda a gerenciar NF-e, recebimentos e estoque',
    icone: '📦',
    duracaoEstimada: '8 min',
    steps: [
      {
        id: 'intro',
        titulo: 'Módulo de Compras',
        mensagem: 'O módulo de Compras é o centro da sua operação de entrada de mercadorias. Aqui você registra pedidos, importa NF-e e controla recebimentos.',
        navegarPara: '/compras',
      },
      {
        id: 'nfe-import',
        titulo: 'Importação de NF-e',
        mensagem: 'Importe arquivos XML de Notas Fiscais automaticamente. O sistema extrai fornecedor, produtos, valores, impostos (ICMS, IPI, ST) e cria o registro de compra.',
      },
      {
        id: 'mapeamento',
        titulo: 'Mapeamento de Produtos',
        mensagem: 'Após importar uma NF-e, vincule os itens aos seus produtos cadastrados. Isso permite rastrear custos e atualizar o estoque automaticamente.',
      },
      {
        id: 'recebimento',
        titulo: 'Registro de Recebimento',
        mensagem: 'Quando a mercadoria chegar, registre o recebimento. O sistema atualiza o estoque, calcula o custo médio e pode gerar créditos de ICMS se aplicável.',
      },
      {
        id: 'contas-pagar',
        titulo: 'Integração com Contas a Pagar',
        mensagem: 'Ao confirmar uma compra, o sistema pode gerar automaticamente um título no Contas a Pagar com o vencimento e valor corretos.',
      },
      {
        id: 'status',
        titulo: 'Acompanhamento de Status',
        mensagem: 'Acompanhe suas compras pelos status: Rascunho → Emitido → Em Trânsito → Parcial → Concluído. Cada aba mostra os pedidos em cada etapa.',
      },
    ],
  },
  {
    id: 'conciliacao',
    nome: 'Conciliação Financeira',
    descricao: 'Domine o hub de conciliação e categorização',
    icone: '🔄',
    duracaoEstimada: '6 min',
    steps: [
      {
        id: 'intro',
        titulo: 'Hub de Conciliação',
        mensagem: 'A Conciliação é onde você organiza e categoriza todas as movimentações financeiras. É essencial para ter relatórios precisos e um fechamento correto.',
        navegarPara: '/conciliacao',
      },
      {
        id: 'bancaria',
        titulo: 'Conciliação Bancária',
        mensagem: 'Importe extratos OFX ou CSV do seu banco. O sistema lista todas as transações para você categorizar com a conta financeira e centro de custo corretos.',
      },
      {
        id: 'cartoes',
        titulo: 'Conciliação de Cartões',
        mensagem: 'Importe faturas de cartão de crédito corporativo. Cada transação pode ser categorizada individualmente para aparecer corretamente no DRE.',
      },
      {
        id: 'marketplace',
        titulo: 'Conciliação de Marketplace',
        mensagem: 'Importe relatórios do Mercado Livre, Shopee e outros. O sistema aplica regras automáticas para categorizar taxas, comissões, fretes e vendas.',
      },
      {
        id: 'categorizacao',
        titulo: 'Categorização',
        mensagem: 'Cada transação precisa de uma categoria financeira (do Plano de Contas) e opcionalmente um centro de custo. Isso alimenta o DRE e relatórios gerenciais.',
      },
      {
        id: 'status-conciliacao',
        titulo: 'Status de Conciliação',
        mensagem: 'Transações passam de "Pendente" para "Conciliado" quando categorizadas. Acompanhe o progresso para garantir que tudo esteja organizado antes do fechamento.',
      },
    ],
  },
  {
    id: 'fechamento',
    nome: 'Fechamento Mensal',
    descricao: 'Guia completo para fechar o mês corretamente',
    icone: '✅',
    duracaoEstimada: '5 min',
    steps: [
      {
        id: 'intro',
        titulo: 'Fechamento Mensal',
        mensagem: 'O fechamento mensal é o processo de validar e consolidar todos os dados do mês. Vamos ver como garantir um fechamento correto e completo.',
        navegarPara: '/checklist-fechamento',
      },
      {
        id: 'importacoes',
        titulo: 'Etapa 1: Importações',
        mensagem: 'Primeiro, certifique-se de que todos os extratos bancários, faturas de cartão e relatórios de marketplace foram importados no sistema.',
      },
      {
        id: 'conciliacoes',
        titulo: 'Etapa 2: Conciliações',
        mensagem: 'Verifique se todas as transações foram categorizadas. Transações pendentes podem distorcer seus relatórios financeiros.',
      },
      {
        id: 'contas',
        titulo: 'Etapa 3: Contas do Período',
        mensagem: 'Revise as contas a pagar e a receber. Confirme que pagamentos e recebimentos do mês estão registrados corretamente.',
      },
      {
        id: 'validacao',
        titulo: 'Etapa 4: Validação Final',
        mensagem: 'Revise o DRE, analise margens e compare com meses anteriores. Se os números fazem sentido, seu fechamento está pronto!',
      },
    ],
  },
  {
    id: 'icms',
    nome: 'Créditos de ICMS',
    descricao: 'Entenda como funciona o controle de ICMS',
    icone: '💰',
    duracaoEstimada: '6 min',
    steps: [
      {
        id: 'intro',
        titulo: 'Controle de ICMS',
        mensagem: 'O módulo de ICMS ajuda você a controlar créditos tributários. Isso é essencial para empresas no Lucro Real ou Lucro Presumido.',
        navegarPara: '/icms',
      },
      {
        id: 'tipos-credito',
        titulo: 'Tipos de Crédito',
        mensagem: 'Existem créditos Compensáveis (podem abater ICMS devido) e Não Compensáveis (apenas informativos). Empresas do Simples Nacional não geram créditos compensáveis.',
      },
      {
        id: 'origem',
        titulo: 'Origem dos Créditos',
        mensagem: 'Créditos vêm de compras de mercadorias para revenda, insumos, energia elétrica e ativos imobilizados. Cada tipo tem regras específicas de aproveitamento.',
      },
      {
        id: 'importacao-xml',
        titulo: 'Importação de NF-e',
        mensagem: 'Ao importar XMLs de compras, o sistema extrai automaticamente os valores de ICMS destacado e calcula o crédito aproveitável baseado no seu regime tributário.',
      },
      {
        id: 'saldo',
        titulo: 'Saldo e Recomendações',
        mensagem: 'Acompanhe seu saldo de créditos vs débitos. O sistema recomenda se você precisa adquirir notas fiscais para complementar seus créditos.',
      },
    ],
  },
  {
    id: 'precificacao',
    nome: 'Precificação de Produtos',
    descricao: 'Calcule preços com margem garantida',
    icone: '🏷️',
    duracaoEstimada: '7 min',
    steps: [
      {
        id: 'intro',
        titulo: 'Calculadora de Preços',
        mensagem: 'A precificação é fundamental para garantir lucro. Nossa calculadora usa a abordagem "margem primeiro": você define a margem desejada e o sistema calcula o preço.',
        navegarPara: '/precificacao',
      },
      {
        id: 'custo-efetivo',
        titulo: 'Custo Efetivo',
        mensagem: 'O ponto de partida é o custo efetivo do produto: valor da NF + frete rateado + IPI + ICMS ST + outras despesas. Você pode importar de uma NF-e ou digitar manualmente.',
      },
      {
        id: 'impostos',
        titulo: 'Tributação',
        mensagem: 'Configure os impostos: ICMS, PIS, COFINS ou use a alíquota média. O sistema também suporta simulação da Reforma Tributária 2026 (CBS/IBS).',
      },
      {
        id: 'taxas-marketplace',
        titulo: 'Taxas do Marketplace',
        mensagem: 'Cada canal tem suas taxas: comissão, tarifa fixa, frete grátis acima de R$79 no ML. O sistema conhece as regras de cada marketplace.',
      },
      {
        id: 'margem',
        titulo: 'Margem de Contribuição',
        mensagem: 'Defina sua margem de contribuição desejada (ex: 20%). O sistema calcula automaticamente o preço mínimo de venda para atingir essa margem.',
      },
      {
        id: 'simulacao',
        titulo: 'Simulação',
        mensagem: 'Teste diferentes cenários: e se eu der 10% de desconto? E com DIFAL? O calculador mostra instantaneamente o impacto na sua margem.',
      },
    ],
  },
];

export function getTutorialById(id: string): Tutorial | undefined {
  return TUTORIAIS.find(t => t.id === id);
}

export function getTutorialStep(tutorialId: string, stepIndex: number): TutorialStep | undefined {
  const tutorial = getTutorialById(tutorialId);
  return tutorial?.steps[stepIndex];
}
