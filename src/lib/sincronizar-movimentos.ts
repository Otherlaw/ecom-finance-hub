/**
 * Utilitário para sincronização retroativa de dados com o Motor de Entrada Unificada (MEU)
 * 
 * Este módulo identifica e sincroniza dados que ainda não estão na tabela movimentos_financeiros.
 */

import { supabase } from "@/integrations/supabase/client";
import { registrarMovimentoFinanceiro, TipoMovimento, OrigemMovimento } from "./movimentos-financeiros";

export interface SincronizacaoResultado {
  contasPagarSincronizadas: number;
  contasReceberSincronizadas: number;
  marketplaceSincronizados: number;
  erros: string[];
}

/**
 * Sincroniza contas a pagar já pagas que não estão no MEU
 */
async function sincronizarContasPagar(): Promise<{ sincronizadas: number; erros: string[] }> {
  const erros: string[] = [];
  let sincronizadas = 0;

  // Buscar contas pagas
  const { data: contasPagas, error: fetchError } = await supabase
    .from("contas_a_pagar")
    .select(`
      *,
      categoria:categorias_financeiras(id, nome, tipo),
      centro_custo:centros_de_custo(id, nome)
    `)
    .eq("status", "pago")
    .not("data_pagamento", "is", null);

  if (fetchError) {
    erros.push(`Erro ao buscar contas a pagar: ${fetchError.message}`);
    return { sincronizadas, erros };
  }

  if (!contasPagas || contasPagas.length === 0) {
    return { sincronizadas, erros };
  }

  // Buscar movimentos existentes para essas contas
  const contaIds = contasPagas.map(c => c.id);
  const { data: movimentosExistentes } = await supabase
    .from("movimentos_financeiros")
    .select("referencia_id")
    .eq("origem", "contas_pagar")
    .in("referencia_id", contaIds);

  const idsExistentes = new Set((movimentosExistentes || []).map(m => m.referencia_id));

  // Sincronizar apenas as que não existem
  for (const conta of contasPagas) {
    if (idsExistentes.has(conta.id)) continue;

    try {
      await registrarMovimentoFinanceiro({
        data: conta.data_pagamento!,
        tipo: "saida" as TipoMovimento,
        origem: "contas_pagar" as OrigemMovimento,
        descricao: conta.descricao,
        valor: conta.valor_pago || conta.valor_total,
        empresaId: conta.empresa_id,
        referenciaId: conta.id,
        categoriaId: conta.categoria_id || undefined,
        categoriaNome: (conta.categoria as any)?.nome || undefined,
        centroCustoId: conta.centro_custo_id || undefined,
        centroCustoNome: (conta.centro_custo as any)?.nome || undefined,
        formaPagamento: conta.forma_pagamento || undefined,
        fornecedorNome: conta.fornecedor_nome,
        observacoes: conta.observacoes || undefined,
      });
      sincronizadas++;
    } catch (err: any) {
      erros.push(`Conta a pagar ${conta.id}: ${err.message}`);
    }
  }

  return { sincronizadas, erros };
}

/**
 * Sincroniza contas a receber já recebidas que não estão no MEU
 */
async function sincronizarContasReceber(): Promise<{ sincronizadas: number; erros: string[] }> {
  const erros: string[] = [];
  let sincronizadas = 0;

  // Buscar contas recebidas
  const { data: contasRecebidas, error: fetchError } = await supabase
    .from("contas_a_receber")
    .select(`
      *,
      categoria:categorias_financeiras(id, nome, tipo),
      centro_custo:centros_de_custo(id, nome)
    `)
    .in("status", ["recebido", "parcialmente_recebido"])
    .gt("valor_recebido", 0);

  if (fetchError) {
    erros.push(`Erro ao buscar contas a receber: ${fetchError.message}`);
    return { sincronizadas, erros };
  }

  if (!contasRecebidas || contasRecebidas.length === 0) {
    return { sincronizadas, erros };
  }

  // Buscar movimentos existentes
  const contaIds = contasRecebidas.map(c => c.id);
  const { data: movimentosExistentes } = await supabase
    .from("movimentos_financeiros")
    .select("referencia_id")
    .eq("origem", "contas_receber")
    .in("referencia_id", contaIds);

  const idsExistentes = new Set((movimentosExistentes || []).map(m => m.referencia_id));

  // Sincronizar apenas as que não existem
  for (const conta of contasRecebidas) {
    if (idsExistentes.has(conta.id)) continue;

    try {
      await registrarMovimentoFinanceiro({
        data: conta.data_recebimento || conta.data_vencimento,
        tipo: "entrada" as TipoMovimento,
        origem: "contas_receber" as OrigemMovimento,
        descricao: conta.descricao,
        valor: conta.valor_recebido,
        empresaId: conta.empresa_id,
        referenciaId: conta.id,
        categoriaId: conta.categoria_id || undefined,
        categoriaNome: (conta.categoria as any)?.nome || undefined,
        centroCustoId: conta.centro_custo_id || undefined,
        centroCustoNome: (conta.centro_custo as any)?.nome || undefined,
        formaPagamento: conta.forma_recebimento || undefined,
        clienteNome: conta.cliente_nome,
        observacoes: conta.observacoes || undefined,
      });
      sincronizadas++;
    } catch (err: any) {
      erros.push(`Conta a receber ${conta.id}: ${err.message}`);
    }
  }

  return { sincronizadas, erros };
}

/**
 * Sincroniza transações marketplace que representam CAIXA REAL (repasses, saques, etc.)
 * 
 * IMPORTANTE: NÃO sincroniza vendas individuais (tipo_transacao='venda')!
 * Vendas são tratadas na aba Vendas (competência), não no Fluxo de Caixa.
 * 
 * Tipos que SÃO sincronizados para caixa:
 * - repasse: dinheiro efetivamente transferido para a conta bancária
 * - saque: saque do saldo do marketplace
 * - devolucao_repasse: estorno de repasse
 * - taxa_financeira: taxa cobrada pelo marketplace
 */
async function sincronizarMarketplace(): Promise<{ sincronizadas: number; erros: string[] }> {
  const erros: string[] = [];
  let sincronizadas = 0;

  // CORREÇÃO: Buscar apenas transações que representam movimentação REAL de caixa
  // Excluir vendas (tipo_transacao='venda') que são competência, não caixa
  const tiposCaixa = ['repasse', 'saque', 'devolucao_repasse', 'taxa_financeira', 'estorno'];
  
  const { data: transacoes, error: fetchError } = await supabase
    .from("marketplace_transactions")
    .select(`
      *,
      categoria:categorias_financeiras(id, nome, tipo),
      centro_custo:centros_de_custo(id, nome, codigo)
    `)
    .eq("status", "conciliado")
    .in("tipo_transacao", tiposCaixa);

  if (fetchError) {
    erros.push(`Erro ao buscar marketplace: ${fetchError.message}`);
    return { sincronizadas, erros };
  }

  if (!transacoes || transacoes.length === 0) {
    return { sincronizadas, erros };
  }

  // Buscar movimentos existentes
  const transIds = transacoes.map(t => t.id);
  const { data: movimentosExistentes } = await supabase
    .from("movimentos_financeiros")
    .select("referencia_id")
    .eq("origem", "marketplace")
    .in("referencia_id", transIds);

  const idsExistentes = new Set((movimentosExistentes || []).map(m => m.referencia_id));

  // Sincronizar apenas as que não existem
  for (const transacao of transacoes) {
    if (idsExistentes.has(transacao.id)) continue;

    // Determinar tipo do movimento baseado no tipo_transacao
    const isEntrada = ['repasse', 'saque'].includes(transacao.tipo_transacao);
    const tipoMovimento = isEntrada ? "entrada" : "saida";

    try {
      await registrarMovimentoFinanceiro({
        data: transacao.data_repasse || transacao.data_transacao,
        tipo: tipoMovimento as TipoMovimento,
        origem: "marketplace" as OrigemMovimento,
        descricao: `[${transacao.canal}] ${transacao.descricao || transacao.tipo_transacao}`,
        valor: Math.abs(transacao.valor_liquido || transacao.valor_bruto || 0),
        empresaId: transacao.empresa_id,
        referenciaId: transacao.id,
        categoriaId: transacao.categoria_id || undefined,
        categoriaNome: (transacao.categoria as any)?.nome || undefined,
        centroCustoId: transacao.centro_custo_id || undefined,
        centroCustoNome: (transacao.centro_custo as any)?.nome || undefined,
        responsavelId: transacao.responsavel_id || undefined,
        formaPagamento: "marketplace",
      });
      sincronizadas++;
    } catch (err: any) {
      erros.push(`Marketplace ${transacao.id}: ${err.message}`);
    }
  }

  return { sincronizadas, erros };
}

/**
 * Executa a sincronização completa de todos os módulos
 */
export async function sincronizarTodosMovimentos(): Promise<SincronizacaoResultado> {
  console.log("[Sincronização MEU] Iniciando sincronização retroativa...");

  const resultadoCP = await sincronizarContasPagar();
  console.log(`[Sincronização MEU] Contas a Pagar: ${resultadoCP.sincronizadas} sincronizadas`);

  const resultadoCR = await sincronizarContasReceber();
  console.log(`[Sincronização MEU] Contas a Receber: ${resultadoCR.sincronizadas} sincronizadas`);

  const resultadoMkt = await sincronizarMarketplace();
  console.log(`[Sincronização MEU] Marketplace: ${resultadoMkt.sincronizadas} sincronizados`);

  const erros = [
    ...resultadoCP.erros,
    ...resultadoCR.erros,
    ...resultadoMkt.erros,
  ];

  if (erros.length > 0) {
    console.warn("[Sincronização MEU] Erros encontrados:", erros);
  }

  console.log("[Sincronização MEU] Sincronização concluída!");

  return {
    contasPagarSincronizadas: resultadoCP.sincronizadas,
    contasReceberSincronizadas: resultadoCR.sincronizadas,
    marketplaceSincronizados: resultadoMkt.sincronizadas,
    erros,
  };
}

/**
 * Conta quantos registros precisam ser sincronizados
 */
export async function contarPendentesSincronizacao(): Promise<{
  contasPagar: number;
  contasReceber: number;
  marketplace: number;
}> {
  // Contas a pagar pagas
  const { count: cpTotal } = await supabase
    .from("contas_a_pagar")
    .select("*", { count: "exact", head: true })
    .eq("status", "pago");

  const { count: cpSincronizadas } = await supabase
    .from("movimentos_financeiros")
    .select("*", { count: "exact", head: true })
    .eq("origem", "contas_pagar");

  // Contas a receber
  const { count: crTotal } = await supabase
    .from("contas_a_receber")
    .select("*", { count: "exact", head: true })
    .in("status", ["recebido", "parcialmente_recebido"])
    .gt("valor_recebido", 0);

  const { count: crSincronizadas } = await supabase
    .from("movimentos_financeiros")
    .select("*", { count: "exact", head: true })
    .eq("origem", "contas_receber");

  // Marketplace - APENAS tipos que representam caixa real (não vendas)
  const tiposCaixa = ['repasse', 'saque', 'devolucao_repasse', 'taxa_financeira', 'estorno'];
  const { count: mktTotal } = await supabase
    .from("marketplace_transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "conciliado")
    .in("tipo_transacao", tiposCaixa);

  const { count: mktSincronizadas } = await supabase
    .from("movimentos_financeiros")
    .select("*", { count: "exact", head: true })
    .eq("origem", "marketplace");

  return {
    contasPagar: Math.max(0, (cpTotal || 0) - (cpSincronizadas || 0)),
    contasReceber: Math.max(0, (crTotal || 0) - (crSincronizadas || 0)),
    marketplace: Math.max(0, (mktTotal || 0) - (mktSincronizadas || 0)),
  };
}
