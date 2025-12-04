/**
 * Helpers para Movimentações Manuais
 * 
 * Funções utilitárias para criar, editar e excluir movimentações manuais
 * que vão diretamente no Motor de Entrada Unificada (MEU).
 */

import { registrarMovimentoFinanceiro, removerMovimentoFinanceiro } from './movimentos-financeiros';

export type MovimentoManualPayload = {
  id?: string;               // id do movimento_financeiro, se existir
  referenciaId?: string;     // referencia_id, se existir
  empresaId: string;
  data: string;              // 'YYYY-MM-DD'
  tipo: 'entrada' | 'saida';
  valor: number;             // sempre positivo
  descricao: string;
  categoriaId: string;
  categoriaNome?: string;
  centroCustoId?: string | null;
  centroCustoNome?: string | null;
  responsavelId?: string | null;
  formaPagamento?: string;   // 'manual', 'pix', 'dinheiro', etc.
  observacoes?: string;
};

/**
 * Cria ou atualiza uma movimentação manual no MEU.
 * 
 * - Para criar: não passa referenciaId → gera um novo com prefixo 'manual-'
 * - Para editar: passa o referenciaId existente → faz upsert
 * 
 * @param payload - Dados da movimentação manual
 * @returns { referenciaId } - ID de referência usado
 */
export async function criarOuAtualizarMovimentoManual(payload: MovimentoManualPayload) {
  // Gera UUID puro (sem prefixo) pois a coluna referencia_id é do tipo UUID
  const referenciaId =
    payload.referenciaId || (crypto.randomUUID?.() || crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5'));

  await registrarMovimentoFinanceiro({
    data: payload.data,
    tipo: payload.tipo,
    origem: 'manual',
    descricao: payload.descricao,
    valor: Math.abs(payload.valor),
    empresaId: payload.empresaId,
    referenciaId,
    categoriaId: payload.categoriaId,
    categoriaNome: payload.categoriaNome,
    centroCustoId: payload.centroCustoId || undefined,
    centroCustoNome: payload.centroCustoNome || undefined,
    responsavelId: payload.responsavelId || undefined,
    formaPagamento: payload.formaPagamento || 'manual',
    observacoes: payload.observacoes,
  });

  return { referenciaId };
}

/**
 * Exclui uma movimentação manual do MEU.
 * 
 * @param referenciaId - ID de referência da movimentação (ex: 'manual-abc123')
 */
export async function excluirMovimentoManual(referenciaId: string) {
  await removerMovimentoFinanceiro(referenciaId, 'manual');
}
