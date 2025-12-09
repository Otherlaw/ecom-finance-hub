// Checklist de Fechamento por Canal - Tipos e Dados

export type ChecklistStatus = 'pendente' | 'em_andamento' | 'concluido' | 'nao_aplicavel';

// ========================================
// CHECKLIST FINANCEIRO - Tipos e Configurações
// ========================================

export type SecaoId = 
  | 'importacoes' 
  | 'conciliacoes' 
  | 'contas' 
  | 'estoque_cmv' 
  | 'canais' 
  | 'finalizacao';

export interface ChecklistEtapaConfig {
  codigo: string;
  nome: string;
  descricao: string;
  importancia: string;
  linkAcao: string;
  secao: SecaoId;
}

export const SECOES_CHECKLIST: Record<SecaoId, { nome: string; icone: string; ordem: number }> = {
  importacoes: { nome: 'Importações Necessárias', icone: 'Upload', ordem: 1 },
  conciliacoes: { nome: 'Conciliações', icone: 'GitCompare', ordem: 2 },
  contas: { nome: 'Contas do Período', icone: 'Receipt', ordem: 3 },
  estoque_cmv: { nome: 'Estoque e CMV', icone: 'Package', ordem: 4 },
  canais: { nome: 'Checklist por Canal', icone: 'Store', ordem: 5 },
  finalizacao: { nome: 'Finalização', icone: 'CheckCircle', ordem: 6 },
};

export const ETAPAS_PADRAO: ChecklistEtapaConfig[] = [
  // SEÇÃO 1 - IMPORTAÇÕES NECESSÁRIAS
  {
    codigo: 'importar_extrato_bancario',
    nome: 'Importar extrato bancário (OFX/CSV)',
    descricao: 'Importe todos os extratos das contas bancárias da empresa',
    importancia: 'Essencial para conciliação bancária e fluxo de caixa real',
    linkAcao: '/conciliacao?tab=bancaria',
    secao: 'importacoes',
  },
  {
    codigo: 'importar_extrato_cartoes',
    nome: 'Importar extrato de cartões',
    descricao: 'Importe as faturas dos cartões de crédito corporativos',
    importancia: 'Necessário para controle de despesas e conciliação de cartões',
    linkAcao: '/conciliacao?tab=cartoes',
    secao: 'importacoes',
  },
  {
    codigo: 'importar_marketplace_ml',
    nome: 'Importar relatórios Mercado Livre',
    descricao: 'Importe os relatórios de vendas e tarifas do Mercado Livre',
    importancia: 'Base para cálculo de receita líquida e CMV do canal',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'importacoes',
  },
  {
    codigo: 'importar_marketplace_shopee',
    nome: 'Importar relatórios Shopee',
    descricao: 'Importe os relatórios de vendas e tarifas da Shopee',
    importancia: 'Base para cálculo de receita líquida e CMV do canal',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'importacoes',
  },
  {
    codigo: 'importar_marketplace_shein',
    nome: 'Importar relatórios Shein',
    descricao: 'Importe os relatórios de vendas e tarifas da Shein',
    importancia: 'Base para cálculo de receita líquida e CMV do canal',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'importacoes',
  },
  {
    codigo: 'importar_marketplace_tiktok',
    nome: 'Importar relatórios TikTok Shop',
    descricao: 'Importe os relatórios de vendas e tarifas do TikTok Shop',
    importancia: 'Base para cálculo de receita líquida e CMV do canal',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'importacoes',
  },

  // SEÇÃO 2 - CONCILIAÇÕES
  {
    codigo: 'conciliacao_bancaria',
    nome: 'Conciliação Bancária',
    descricao: 'Categorize e concilie todas as transações bancárias do período',
    importancia: 'Garante que todas as movimentações estejam corretamente classificadas no DRE',
    linkAcao: '/conciliacao?tab=bancaria',
    secao: 'conciliacoes',
  },
  {
    codigo: 'conciliacao_cartoes',
    nome: 'Conciliação de Cartões',
    descricao: 'Categorize e concilie todas as transações de cartão de crédito',
    importancia: 'Garante controle de despesas e correta alocação por categoria',
    linkAcao: '/conciliacao?tab=cartoes',
    secao: 'conciliacoes',
  },
  {
    codigo: 'conciliacao_marketplace',
    nome: 'Conciliação Marketplace',
    descricao: 'Categorize e concilie todas as transações de marketplaces',
    importancia: 'Garante que receitas e taxas estejam corretamente classificadas',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'conciliacoes',
  },

  // SEÇÃO 3 - CONTAS DO PERÍODO
  {
    codigo: 'contas_pagar_revisadas',
    nome: 'Contas a pagar revisadas',
    descricao: 'Revise todas as contas a pagar do período, garantindo categorização',
    importancia: 'Evita duplicidades e garante projeção correta de fluxo de caixa',
    linkAcao: '/contas-pagar',
    secao: 'contas',
  },
  {
    codigo: 'contas_receber_revisadas',
    nome: 'Contas a receber revisadas',
    descricao: 'Revise todas as contas a receber, incluindo recebimentos pendentes',
    importancia: 'Garante visibilidade de entradas futuras e inadimplência',
    linkAcao: '/contas-receber',
    secao: 'contas',
  },
  {
    codigo: 'categorias_preenchidas',
    nome: 'Categorias e centros de custo preenchidos',
    descricao: 'Verifique se todas as contas possuem categoria e centro de custo',
    importancia: 'Essencial para relatórios gerenciais e DRE correto',
    linkAcao: '/plano-contas',
    secao: 'contas',
  },

  // SEÇÃO 4 - ESTOQUE E CMV
  {
    codigo: 'nfes_importadas',
    nome: 'NF-es de compra importadas',
    descricao: 'Importe todas as notas fiscais de compra do período',
    importancia: 'Base para cálculo do custo de aquisição e crédito de ICMS',
    linkAcao: '/compras',
    secao: 'estoque_cmv',
  },
  {
    codigo: 'estoque_confirmado',
    nome: 'Entradas de estoque confirmadas',
    descricao: 'Confirme os recebimentos e entradas de estoque das compras',
    importancia: 'Garante custo médio correto e posição de estoque atualizada',
    linkAcao: '/estoque-sku',
    secao: 'estoque_cmv',
  },
  {
    codigo: 'cmv_calculado',
    nome: 'CMV calculado',
    descricao: 'Verifique se o CMV foi calculado para todas as vendas do período',
    importancia: 'Essencial para margem bruta e lucro líquido corretos',
    linkAcao: '/cmv-relatorio',
    secao: 'estoque_cmv',
  },

  // SEÇÃO 5 - CHECKLIST POR CANAL (agrupado)
  {
    codigo: 'canal_ml_completo',
    nome: 'Mercado Livre - Fechamento completo',
    descricao: 'Vendas, tarifas, devoluções, estornos e receita líquida validados',
    importancia: 'Garante integridade dos dados do maior marketplace',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'canais',
  },
  {
    codigo: 'canal_shopee_completo',
    nome: 'Shopee - Fechamento completo',
    descricao: 'Vendas, taxas, devoluções e pendências zeradas',
    importancia: 'Garante integridade dos dados da Shopee',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'canais',
  },
  {
    codigo: 'canal_shein_completo',
    nome: 'Shein - Fechamento completo',
    descricao: 'Vendas, taxas, devoluções e pendências zeradas',
    importancia: 'Garante integridade dos dados da Shein',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'canais',
  },
  {
    codigo: 'canal_tiktok_completo',
    nome: 'TikTok Shop - Fechamento completo',
    descricao: 'Vendas, taxas, devoluções e pendências zeradas',
    importancia: 'Garante integridade dos dados do TikTok Shop',
    linkAcao: '/conciliacao?tab=marketplace',
    secao: 'canais',
  },

  // SEÇÃO 6 - FINALIZAÇÃO
  {
    codigo: 'revisar_dre',
    nome: 'Revisar DRE do mês',
    descricao: 'Analise o DRE consolidado e verifique se os números fazem sentido',
    importancia: 'Última validação antes de considerar o período fechado',
    linkAcao: '/dre',
    secao: 'finalizacao',
  },
  {
    codigo: 'validar_margem_bruta',
    nome: 'Validar margem bruta',
    descricao: 'Confira se a margem bruta está dentro do esperado',
    importancia: 'Indica eficiência operacional e precificação adequada',
    linkAcao: '/dre',
    secao: 'finalizacao',
  },
  {
    codigo: 'validar_lucro_liquido',
    nome: 'Validar lucro líquido',
    descricao: 'Confira o resultado final do período',
    importancia: 'Indica saúde financeira geral da operação',
    linkAcao: '/dre',
    secao: 'finalizacao',
  },
  {
    codigo: 'confirmar_revisao',
    nome: 'Confirmar revisão geral do período',
    descricao: 'Marque como concluído após revisar todos os itens acima',
    importancia: 'Sinaliza que o checklist operacional foi completado',
    linkAcao: '/fechamento',
    secao: 'finalizacao',
  },
];

export interface ChecklistItemArquivo {
  id: string;
  checklistItemId: string;
  nomeArquivo: string;
  url: string;
  dataUpload: Date;
}

export interface TemplateChecklistItem {
  id: string;
  nome: string;
  descricao?: string;
  tipoEtapa: 'baixar_relatorio' | 'conferir_valores' | 'conciliacao' | 'upload_arquivo' | 'validacao' | 'outro';
  exigeUpload: boolean;
  obrigatorio: boolean;
  ordem: number;
}

export interface TemplateChecklistCanal {
  id: string;
  canalId: string;
  canalNome: string;
  nomeTemplate: string;
  itens: TemplateChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklistMensalId: string;
  nome: string;
  descricao?: string;
  tipoEtapa: string;
  ordem: number;
  status: ChecklistStatus;
  obrigatorio: boolean;
  exigeUpload: boolean;
  observacoes?: string;
  dataHoraConclusao?: Date;
  responsavel?: string;
  arquivos: ChecklistItemArquivo[];
}

export interface ChecklistMensal {
  id: string;
  empresaId: string;
  empresaNome: string;
  canalId: string;
  canalNome: string;
  mes: number;
  ano: number;
  status: ChecklistStatus;
  itens: ChecklistItem[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CanalMarketplace {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ativo: boolean;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  canaisAtivos: string[];
}

// Canais disponíveis
export const canaisMarketplace: CanalMarketplace[] = [
  { id: 'mercado_livre', nome: 'Mercado Livre', cor: 'hsl(48, 96%, 53%)', icone: 'ShoppingBag', ativo: true },
  { id: 'shopee', nome: 'Shopee', cor: 'hsl(16, 100%, 50%)', icone: 'Store', ativo: true },
  { id: 'shein', nome: 'Shein', cor: 'hsl(0, 0%, 15%)', icone: 'Shirt', ativo: true },
  { id: 'tiktok', nome: 'TikTok Shop', cor: 'hsl(340, 82%, 52%)', icone: 'Music', ativo: true },
];

// Empresas mock
export const empresasMock: Empresa[] = [
  { 
    id: 'exchange', 
    nome: 'Exchange Comercial', 
    cnpj: '12.345.678/0001-90',
    canaisAtivos: ['mercado_livre', 'shopee', 'shein', 'tiktok']
  },
  { 
    id: 'inpari', 
    nome: 'Inpari Distribuição', 
    cnpj: '98.765.432/0001-10',
    canaisAtivos: ['mercado_livre', 'shopee']
  },
];

// Templates de checklist por canal
export const templatesChecklist: TemplateChecklistCanal[] = [
  {
    id: 'template_ml',
    canalId: 'mercado_livre',
    canalNome: 'Mercado Livre',
    nomeTemplate: 'Fechamento Mensal Mercado Livre',
    itens: [
      { id: 'ml_1', nome: 'Baixar relatório de vendas detalhado', descricao: 'Acessar o portal do vendedor e exportar o relatório completo de vendas do período', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 1 },
      { id: 'ml_2', nome: 'Baixar relatório de tarifas', descricao: 'Exportar relatório de tarifas e comissões cobradas pelo Mercado Livre', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 2 },
      { id: 'ml_3', nome: 'Baixar relatório de anúncios (ADS)', descricao: 'Exportar relatório de gastos com publicidade Product Ads', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: false, ordem: 3 },
      { id: 'ml_4', nome: 'Conferir devoluções e cancelamentos', descricao: 'Verificar todas as devoluções e cancelamentos do período e seus respectivos estornos', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 4 },
      { id: 'ml_5', nome: 'Conferir repasses financeiros', descricao: 'Comparar os repasses recebidos com os valores calculados no relatório de vendas', tipoEtapa: 'conciliacao', exigeUpload: false, obrigatorio: true, ordem: 5 },
      { id: 'ml_6', nome: 'Conferir custos de Mercado Envios', descricao: 'Verificar custos de frete e logística do Mercado Envios', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 6 },
      { id: 'ml_7', nome: 'Baixar relatório de Mercado Pago', descricao: 'Exportar extrato completo do Mercado Pago', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 7 },
      { id: 'ml_8', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', exigeUpload: false, obrigatorio: true, ordem: 8 },
    ]
  },
  {
    id: 'template_shopee',
    canalId: 'shopee',
    canalNome: 'Shopee',
    nomeTemplate: 'Fechamento Mensal Shopee',
    itens: [
      { id: 'sh_1', nome: 'Baixar relatório de pedidos', descricao: 'Exportar relatório completo de pedidos do Seller Center', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 1 },
      { id: 'sh_2', nome: 'Baixar extrato de liquidação', descricao: 'Exportar extrato de liquidação financeira da Shopee', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 2 },
      { id: 'sh_3', nome: 'Baixar relatório de taxas e comissões', descricao: 'Exportar detalhamento de taxas, comissões e descontos', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 3 },
      { id: 'sh_4', nome: 'Conferir devoluções', descricao: 'Verificar todas as devoluções e estornos do período', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 4 },
      { id: 'sh_5', nome: 'Conferir repasses ShopeePay', descricao: 'Verificar repasses recebidos via ShopeePay', tipoEtapa: 'conciliacao', exigeUpload: false, obrigatorio: true, ordem: 5 },
      { id: 'sh_6', nome: 'Baixar relatório de Ads Shopee', descricao: 'Exportar relatório de gastos com anúncios', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: false, ordem: 6 },
      { id: 'sh_7', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', exigeUpload: false, obrigatorio: true, ordem: 7 },
    ]
  },
  {
    id: 'template_shein',
    canalId: 'shein',
    canalNome: 'Shein',
    nomeTemplate: 'Fechamento Mensal Shein',
    itens: [
      { id: 'sn_1', nome: 'Baixar relatório de vendas Shein', descricao: 'Exportar relatório de vendas do portal Shein Marketplace', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 1 },
      { id: 'sn_2', nome: 'Baixar extrato financeiro', descricao: 'Exportar extrato de pagamentos e repasses', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 2 },
      { id: 'sn_3', nome: 'Conferir taxas e comissões', descricao: 'Verificar comissões cobradas pela Shein', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 3 },
      { id: 'sn_4', nome: 'Conferir devoluções', descricao: 'Verificar devoluções e cancelamentos do período', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 4 },
      { id: 'sn_5', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', exigeUpload: false, obrigatorio: true, ordem: 5 },
    ]
  },
  {
    id: 'template_tiktok',
    canalId: 'tiktok',
    canalNome: 'TikTok Shop',
    nomeTemplate: 'Fechamento Mensal TikTok Shop',
    itens: [
      { id: 'tt_1', nome: 'Baixar relatório de vendas TikTok', descricao: 'Exportar relatório completo de vendas do TikTok Seller Center', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 1 },
      { id: 'tt_2', nome: 'Baixar extrato financeiro TikTok', descricao: 'Exportar extrato de pagamentos e liquidações', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: true, ordem: 2 },
      { id: 'tt_3', nome: 'Conferir comissões e taxas', descricao: 'Verificar comissões cobradas pelo TikTok Shop', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 3 },
      { id: 'tt_4', nome: 'Baixar relatório de Ads TikTok', descricao: 'Exportar relatório de gastos com anúncios', tipoEtapa: 'baixar_relatorio', exigeUpload: true, obrigatorio: false, ordem: 4 },
      { id: 'tt_5', nome: 'Conferir devoluções', descricao: 'Verificar devoluções e cancelamentos', tipoEtapa: 'conferir_valores', exigeUpload: false, obrigatorio: true, ordem: 5 },
      { id: 'tt_6', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', exigeUpload: false, obrigatorio: true, ordem: 6 },
    ]
  },
];

// Checklists mock (dados de exemplo)
export const checklistsMock: ChecklistMensal[] = [
  {
    id: 'cl_exchange_ml_052025',
    empresaId: 'exchange',
    empresaNome: 'Exchange Comercial',
    canalId: 'mercado_livre',
    canalNome: 'Mercado Livre',
    mes: 5,
    ano: 2025,
    status: 'em_andamento',
    criadoEm: new Date('2025-05-01'),
    atualizadoEm: new Date('2025-05-15'),
    itens: [
      { id: 'cli_1', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Baixar relatório de vendas detalhado', descricao: 'Acessar o portal do vendedor e exportar o relatório completo de vendas do período', tipoEtapa: 'baixar_relatorio', ordem: 1, status: 'concluido', obrigatorio: true, exigeUpload: true, dataHoraConclusao: new Date('2025-05-10'), responsavel: 'Admin', arquivos: [{ id: 'arq_1', checklistItemId: 'cli_1', nomeArquivo: 'relatorio_vendas_ml_mai2025.xlsx', url: '#', dataUpload: new Date('2025-05-10') }] },
      { id: 'cli_2', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Baixar relatório de tarifas', descricao: 'Exportar relatório de tarifas e comissões cobradas pelo Mercado Livre', tipoEtapa: 'baixar_relatorio', ordem: 2, status: 'concluido', obrigatorio: true, exigeUpload: true, dataHoraConclusao: new Date('2025-05-10'), responsavel: 'Admin', arquivos: [{ id: 'arq_2', checklistItemId: 'cli_2', nomeArquivo: 'tarifas_ml_mai2025.xlsx', url: '#', dataUpload: new Date('2025-05-10') }] },
      { id: 'cli_3', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Baixar relatório de anúncios (ADS)', descricao: 'Exportar relatório de gastos com publicidade Product Ads', tipoEtapa: 'baixar_relatorio', ordem: 3, status: 'em_andamento', obrigatorio: false, exigeUpload: true, arquivos: [] },
      { id: 'cli_4', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Conferir devoluções e cancelamentos', descricao: 'Verificar todas as devoluções e cancelamentos do período e seus respectivos estornos', tipoEtapa: 'conferir_valores', ordem: 4, status: 'pendente', obrigatorio: true, exigeUpload: false, arquivos: [] },
      { id: 'cli_5', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Conferir repasses financeiros', descricao: 'Comparar os repasses recebidos com os valores calculados no relatório de vendas', tipoEtapa: 'conciliacao', ordem: 5, status: 'pendente', obrigatorio: true, exigeUpload: false, arquivos: [] },
      { id: 'cli_6', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Conferir custos de Mercado Envios', descricao: 'Verificar custos de frete e logística do Mercado Envios', tipoEtapa: 'conferir_valores', ordem: 6, status: 'pendente', obrigatorio: true, exigeUpload: false, arquivos: [] },
      { id: 'cli_7', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Baixar relatório de Mercado Pago', descricao: 'Exportar extrato completo do Mercado Pago', tipoEtapa: 'baixar_relatorio', ordem: 7, status: 'pendente', obrigatorio: true, exigeUpload: true, arquivos: [] },
      { id: 'cli_8', checklistMensalId: 'cl_exchange_ml_052025', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', ordem: 8, status: 'pendente', obrigatorio: true, exigeUpload: false, arquivos: [] },
    ]
  },
  {
    id: 'cl_exchange_shopee_052025',
    empresaId: 'exchange',
    empresaNome: 'Exchange Comercial',
    canalId: 'shopee',
    canalNome: 'Shopee',
    mes: 5,
    ano: 2025,
    status: 'concluido',
    criadoEm: new Date('2025-05-01'),
    atualizadoEm: new Date('2025-05-20'),
    itens: [
      { id: 'cli_sh_1', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Baixar relatório de pedidos', descricao: 'Exportar relatório completo de pedidos do Seller Center', tipoEtapa: 'baixar_relatorio', ordem: 1, status: 'concluido', obrigatorio: true, exigeUpload: true, dataHoraConclusao: new Date('2025-05-12'), responsavel: 'Financeiro', arquivos: [{ id: 'arq_sh_1', checklistItemId: 'cli_sh_1', nomeArquivo: 'pedidos_shopee_mai2025.xlsx', url: '#', dataUpload: new Date('2025-05-12') }] },
      { id: 'cli_sh_2', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Baixar extrato de liquidação', descricao: 'Exportar extrato de liquidação financeira da Shopee', tipoEtapa: 'baixar_relatorio', ordem: 2, status: 'concluido', obrigatorio: true, exigeUpload: true, dataHoraConclusao: new Date('2025-05-12'), responsavel: 'Financeiro', arquivos: [{ id: 'arq_sh_2', checklistItemId: 'cli_sh_2', nomeArquivo: 'liquidacao_shopee_mai2025.xlsx', url: '#', dataUpload: new Date('2025-05-12') }] },
      { id: 'cli_sh_3', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Baixar relatório de taxas e comissões', descricao: 'Exportar detalhamento de taxas, comissões e descontos', tipoEtapa: 'baixar_relatorio', ordem: 3, status: 'concluido', obrigatorio: true, exigeUpload: true, dataHoraConclusao: new Date('2025-05-13'), responsavel: 'Financeiro', arquivos: [{ id: 'arq_sh_3', checklistItemId: 'cli_sh_3', nomeArquivo: 'taxas_shopee_mai2025.xlsx', url: '#', dataUpload: new Date('2025-05-13') }] },
      { id: 'cli_sh_4', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Conferir devoluções', descricao: 'Verificar todas as devoluções e estornos do período', tipoEtapa: 'conferir_valores', ordem: 4, status: 'concluido', obrigatorio: true, exigeUpload: false, dataHoraConclusao: new Date('2025-05-15'), responsavel: 'Financeiro', arquivos: [] },
      { id: 'cli_sh_5', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Conferir repasses ShopeePay', descricao: 'Verificar repasses recebidos via ShopeePay', tipoEtapa: 'conciliacao', ordem: 5, status: 'concluido', obrigatorio: true, exigeUpload: false, dataHoraConclusao: new Date('2025-05-18'), responsavel: 'Financeiro', arquivos: [] },
      { id: 'cli_sh_6', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Baixar relatório de Ads Shopee', descricao: 'Exportar relatório de gastos com anúncios', tipoEtapa: 'baixar_relatorio', ordem: 6, status: 'nao_aplicavel', obrigatorio: false, exigeUpload: true, observacoes: 'Não houve gastos com Ads neste mês', arquivos: [] },
      { id: 'cli_sh_7', checklistMensalId: 'cl_exchange_shopee_052025', nome: 'Validar totais com DRE', descricao: 'Conferir se os totais batem com o DRE do período', tipoEtapa: 'validacao', ordem: 7, status: 'concluido', obrigatorio: true, exigeUpload: false, dataHoraConclusao: new Date('2025-05-20'), responsavel: 'Admin', arquivos: [] },
    ]
  },
];

// Funções utilitárias
export function getStatusLabel(status: ChecklistStatus): string {
  const labels: Record<ChecklistStatus, string> = {
    pendente: 'Pendente',
    em_andamento: 'Em andamento',
    concluido: 'Concluído',
    nao_aplicavel: 'N/A',
  };
  return labels[status];
}

export function getStatusColor(status: ChecklistStatus): string {
  const colors: Record<ChecklistStatus, string> = {
    pendente: 'bg-muted text-muted-foreground',
    em_andamento: 'bg-warning/10 text-warning border-warning/20',
    concluido: 'bg-success/10 text-success border-success/20',
    nao_aplicavel: 'bg-secondary text-secondary-foreground',
  };
  return colors[status];
}

export function calcularProgresso(itens: ChecklistItem[]): { concluidos: number; total: number; percentual: number } {
  const itensObrigatorios = itens.filter(i => i.obrigatorio);
  const concluidos = itensObrigatorios.filter(i => i.status === 'concluido' || i.status === 'nao_aplicavel').length;
  const total = itensObrigatorios.length;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  return { concluidos, total, percentual };
}

export function getChecklistStatus(itens: ChecklistItem[]): ChecklistStatus {
  const { concluidos, total } = calcularProgresso(itens);
  
  if (concluidos === total && total > 0) return 'concluido';
  if (concluidos === 0) {
    const emAndamento = itens.some(i => i.status === 'em_andamento');
    return emAndamento ? 'em_andamento' : 'pendente';
  }
  return 'em_andamento';
}

export function getMeses(): { value: number; label: string }[] {
  return [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ];
}

export function getMesNome(mes: number): string {
  const meses = getMeses();
  return meses.find(m => m.value === mes)?.label || '';
}
