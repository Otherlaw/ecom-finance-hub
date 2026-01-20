/**
 * ARQUITETURA DE DADOS - ECOM FINANCE
 * 
 * Este arquivo define as fontes de verdade de cada módulo do sistema
 * para garantir consistência e evitar duplicidade no fechamento mensal.
 * 
 * ═══════════════════════════════════════════════════════════════════
 * REGRA PRINCIPAL: SEPARAÇÃO COMPETÊNCIA vs CAIXA
 * ═══════════════════════════════════════════════════════════════════
 * 
 * - COMPETÊNCIA (regime='competencia'): Quando o FATO GERADOR ocorreu
 *   → Usado para DRE, análise de margem, receita por período
 * 
 * - CAIXA (regime='caixa'): Quando o DINHEIRO ENTROU/SAIU
 *   → Usado para Fluxo de Caixa, saldo bancário, liquidez
 * 
 * ═══════════════════════════════════════════════════════════════════
 * MÓDULOS E SUAS FONTES DE VERDADE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1) ABA VENDAS (Competência)
 *    ─────────────────────────
 *    FONTE: marketplace_transactions (tipo_transacao='venda')
 *    AGRUPAMENTO: Por pedido_id
 *    REGIME: competencia
 *    
 *    Mostra:
 *    ✓ Vendas por pedido com data da venda
 *    ✓ Valor bruto, comissão, tarifa, frete vendedor, ads, imposto
 *    ✓ CMV calculado via marketplace_transaction_items + produtos
 *    ✓ Margem de contribuição (MC)
 *    
 *    NÃO mostra:
 *    ✗ Repasses bancários
 *    ✗ Saldos de conta
 *    ✗ Transações não relacionadas a vendas
 * 
 * 2) ABA FLUXO DE CAIXA (Caixa)
 *    ───────────────────────────
 *    FONTE: movimentos_financeiros (regime='caixa')
 *    REGIME: caixa
 *    
 *    Mostra:
 *    ✓ Transações bancárias (origem='banco')
 *    ✓ Repasses de marketplace consolidados
 *    ✓ Pagamentos efetuados (origem='contas_pagar')
 *    ✓ Recebimentos efetuados (origem='contas_receber')
 *    ✓ Lançamentos manuais (origem='manual')
 *    ✓ Pagamentos de cartão de crédito
 *    
 *    NÃO mostra:
 *    ✗ Vendas individuais (bruto de marketplace)
 *    ✗ Comissões/tarifas individuais (essas estão no DRE via competência)
 *    ✗ Qualquer dado com regime='competencia'
 * 
 * 3) ABA CONCILIAÇÃO (Ligação)
 *    ──────────────────────────
 *    FUNÇÃO: Conectar repasses bancários com pedidos/taxas
 *    
 *    Fluxos:
 *    ✓ Importar OFX bancário → bank_transactions
 *    ✓ Categorizar transações bancárias
 *    ✓ Vincular repasse a período de vendas
 *    ✓ Reconciliar cartões com faturas
 *    ✓ Reconciliar marketplace com vendas
 * 
 * 4) ABA CHECKLIST (Controle)
 *    ─────────────────────────
 *    FUNÇÃO: Controlar o que falta importar/validar para fechamento
 *    
 *    Comportamento ao importar relatórios:
 *    ✓ Salvar arquivo no storage
 *    ✓ Parsear e extrair linhas
 *    ✓ MERGE por pedido_id (complementar dados, não criar duplicata)
 *    ✓ Atualizar status do checklist item
 *    
 *    REGRA CRÍTICA DE MERGE:
 *    - Se pedido_id já existe: ATUALIZA campos faltantes (comissão, frete, etc.)
 *    - Se pedido_id não existe: CRIA nova transação
 *    - Nunca criar venda duplicada para mesmo pedido
 * 
 * 5) DRE (Competência)
 *    ──────────────────
 *    FONTE: movimentos_financeiros (regime='competencia' ou ambos)
 *    
 *    Composição:
 *    ✓ RECEITA: vendas de marketplace (valor_bruto)
 *    ✓ (-) CUSTOS: CMV (custo das mercadorias vendidas)
 *    ✓ (-) DEDUÇÕES: comissões, tarifas, frete vendedor, ads
 *    ✓ (-) IMPOSTOS: sobre faturamento
 *    ✓ (-) DESPESAS: operacionais, administrativas, pessoal
 *    ✓ = RESULTADO LÍQUIDO
 * 
 * ═══════════════════════════════════════════════════════════════════
 * COMO EVITAR DUPLICIDADE NO FECHAMENTO
 * ═══════════════════════════════════════════════════════════════════
 * 
 * 1. RECEITA vem APENAS de marketplace_transactions (competência)
 *    - Nunca somar repasses bancários como receita
 *    - Repasses são MOVIMENTO DE CAIXA, não receita
 * 
 * 2. CUSTOS/DESPESAS vêm de:
 *    - CMV: registros de cmv_registros ou cálculo via itens vendidos
 *    - Taxas: embutidas nas transações de marketplace
 *    - Despesas: contas_a_pagar pagas + movimentos manuais
 * 
 * 3. Cartão de crédito:
 *    - Transações individuais → DRE (despesas por categoria)
 *    - Pagamento da fatura → Fluxo de Caixa (saída consolidada)
 * 
 * 4. Contas a pagar/receber:
 *    - Título emitido → Não impacta caixa ainda
 *    - Título pago/recebido → Impacta caixa (movimentos_financeiros)
 * 
 * ═══════════════════════════════════════════════════════════════════
 * CONSTRAINT DE UNICIDADE PARA MARKETPLACE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Tabela: marketplace_transactions
 * Constraint: uq_mkt_tx_key (empresa_id, canal, referencia_externa, tipo_transacao, tipo_lancamento)
 * 
 * Isso garante que mesmo importando o mesmo relatório múltiplas vezes,
 * não haverá duplicação de registros.
 * 
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS E CONSTANTES
// ═══════════════════════════════════════════════════════════════════

export type RegimeContabil = 'competencia' | 'caixa';

export type OrigemMovimento = 
  | 'cartao' 
  | 'banco' 
  | 'contas_pagar' 
  | 'contas_receber' 
  | 'marketplace' 
  | 'manual';

export const ORIGENS_CAIXA: OrigemMovimento[] = [
  'banco',
  'contas_pagar', // quando pago
  'contas_receber', // quando recebido
  'manual',
  'cartao', // pagamento de fatura
];

export const ORIGENS_COMPETENCIA: OrigemMovimento[] = [
  'marketplace', // vendas individuais
  'cartao', // despesas individuais
];

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se uma transação deve aparecer no Fluxo de Caixa
 */
export function deveAparecerNoCaixa(regime: RegimeContabil, origem: OrigemMovimento): boolean {
  // Fluxo de Caixa só mostra regime='caixa'
  if (regime !== 'caixa') return false;
  
  // E apenas origens de movimentação real de dinheiro
  return ORIGENS_CAIXA.includes(origem) || origem === 'marketplace'; // repasses
}

/**
 * Verifica se uma transação deve aparecer no DRE
 */
export function deveAparecerNoDRE(regime: RegimeContabil): boolean {
  // DRE usa competência (quando o fato gerador ocorreu)
  return regime === 'competencia';
}

/**
 * Determina o regime baseado na origem e tipo
 */
export function determinarRegime(
  origem: OrigemMovimento, 
  tipoTransacao?: string
): RegimeContabil {
  // Vendas de marketplace são competência
  if (origem === 'marketplace' && tipoTransacao === 'venda') {
    return 'competencia';
  }
  
  // Repasses de marketplace são caixa
  if (origem === 'marketplace' && tipoTransacao === 'repasse') {
    return 'caixa';
  }
  
  // Transações bancárias são caixa
  if (origem === 'banco') {
    return 'caixa';
  }
  
  // Contas pagas/recebidas são caixa
  if (origem === 'contas_pagar' || origem === 'contas_receber') {
    return 'caixa';
  }
  
  // Cartão de crédito:
  // - Transação individual → competência (despesa quando ocorreu)
  // - Pagamento de fatura → caixa (quando pagou)
  if (origem === 'cartao') {
    return 'caixa'; // por padrão, mas pode ser override
  }
  
  return 'caixa';
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS PARA MERGE DE MARKETPLACE
// ═══════════════════════════════════════════════════════════════════

export interface DadosComplementares {
  comissao?: number;
  tarifa?: number;
  frete_vendedor?: number;
  ads?: number;
  imposto?: number;
  conta_nome?: string;
  tipo_envio?: string;
}

/**
 * Mescla dados novos com existentes, priorizando valores não-nulos
 */
export function mesclarDadosVenda(
  existente: DadosComplementares,
  novo: DadosComplementares
): DadosComplementares {
  return {
    comissao: novo.comissao ?? existente.comissao,
    tarifa: novo.tarifa ?? existente.tarifa,
    frete_vendedor: novo.frete_vendedor ?? existente.frete_vendedor,
    ads: novo.ads ?? existente.ads,
    imposto: novo.imposto ?? existente.imposto,
    conta_nome: novo.conta_nome ?? existente.conta_nome,
    tipo_envio: novo.tipo_envio ?? existente.tipo_envio,
  };
}
