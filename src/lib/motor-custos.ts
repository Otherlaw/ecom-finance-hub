/**
 * MOTOR DE CUSTOS V1 - Custo Médio Contínuo
 * 
 * Funções utilitárias para cálculo de custo médio ponderado móvel,
 * gestão de estoque e geração de registros de CMV.
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TIPOS =============

export interface Produto {
  id: string;
  empresa_id: string;
  codigo_interno: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  subcategoria?: string;
  unidade_medida: string;
  ncm?: string;
  cfop_venda?: string;
  cfop_compra?: string;
  situacao_tributaria?: string;
  fornecedor_principal_id?: string;
  fornecedor_principal_nome?: string;
  preco_venda_sugerido: number;
  estoque_atual: number;
  custo_medio_atual: number;
  ultima_atualizacao_custo?: string;
  canais: ChannelMapping[];
  status: "ativo" | "inativo";
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ChannelMapping {
  channel: string;
  sku: string;
  anuncioId?: string;
  codigoInterno?: string;
}

export interface MovimentacaoEstoque {
  id: string;
  empresa_id: string;
  produto_id: string;
  tipo: "entrada" | "saida";
  motivo: "compra" | "venda" | "ajuste_positivo" | "ajuste_negativo" | "devolucao_compra" | "devolucao_venda" | "transferencia";
  origem: string;
  referencia_id?: string;
  documento?: string;
  data: string;
  quantidade: number;
  custo_unitario: number;
  custo_total: number;
  estoque_anterior: number;
  estoque_posterior: number;
  custo_medio_anterior: number;
  custo_medio_posterior: number;
  observacoes?: string;
  created_at: string;
}

export interface CMVRegistro {
  id: string;
  empresa_id: string;
  produto_id: string;
  origem: "marketplace" | "manual" | "ajuste" | "devolucao";
  referencia_id?: string;
  data: string;
  quantidade: number;
  custo_unitario_momento: number;
  custo_total: number;
  preco_venda_unitario?: number;
  receita_total?: number;
  margem_bruta?: number;
  margem_percentual?: number;
  canal?: string;
  observacoes?: string;
  created_at: string;
  // Joins
  produto?: Produto;
}

export interface EntradaEstoqueInput {
  produtoId: string;
  empresaId: string;
  quantidade: number;
  custoUnitario: number;
  origem: string;
  referenciaId?: string;
  documento?: string;
  data: string;
  observacoes?: string;
}

export interface SaidaEstoqueInput {
  produtoId: string;
  empresaId: string;
  quantidade: number;
  origem: "marketplace" | "manual" | "ajuste" | "devolucao";
  referenciaId?: string;
  data: string;
  precoVendaUnitario?: number;
  receitaTotal?: number;
  canal?: string;
  observacoes?: string;
}

// ============= CÁLCULO DE CUSTO MÉDIO PONDERADO MÓVEL =============

/**
 * Calcula o novo custo médio ponderado após uma entrada de estoque.
 * 
 * Fórmula: Novo Custo Médio = (Estoque Atual × Custo Médio Atual + Quantidade Entrada × Custo Unitário) / (Estoque Atual + Quantidade Entrada)
 */
export function calcularNovoCustoMedio(
  estoqueAtual: number,
  custoMedioAtual: number,
  quantidadeEntrada: number,
  custoUnitarioEntrada: number
): number {
  // Caso especial: estoque zerado - custo médio = custo da entrada
  if (estoqueAtual <= 0) {
    return Math.round(custoUnitarioEntrada * 100) / 100;
  }

  const valorEstoqueAtual = estoqueAtual * custoMedioAtual;
  const valorEntrada = quantidadeEntrada * custoUnitarioEntrada;
  const novoEstoque = estoqueAtual + quantidadeEntrada;
  
  if (novoEstoque <= 0) {
    return 0;
  }
  
  const novoCustoMedio = (valorEstoqueAtual + valorEntrada) / novoEstoque;
  return Math.round(novoCustoMedio * 100) / 100;
}

/**
 * Calcula a margem de uma venda.
 */
export function calcularMargem(
  receitaTotal: number,
  custoTotal: number
): { margemBruta: number; margemPercentual: number } {
  const margemBruta = receitaTotal - custoTotal;
  const margemPercentual = receitaTotal > 0 ? (margemBruta / receitaTotal) * 100 : 0;
  
  return {
    margemBruta: Math.round(margemBruta * 100) / 100,
    margemPercentual: Math.round(margemPercentual * 100) / 100,
  };
}

// ============= OPERAÇÕES DE ESTOQUE =============

/**
 * Registra uma entrada de estoque (compra) e atualiza o custo médio do produto.
 * 
 * Fluxo:
 * 1. Busca dados atuais do produto
 * 2. Calcula novo custo médio
 * 3. Registra movimentação de estoque
 * 4. Atualiza produto com novo estoque e custo médio
 */
export async function registrarEntradaEstoque(input: EntradaEstoqueInput): Promise<string> {
  const { produtoId, empresaId, quantidade, custoUnitario, origem, referenciaId, documento, data, observacoes } = input;

  // 1. Buscar dados atuais do produto
  const { data: produto, error: produtoError } = await supabase
    .from("produtos")
    .select("estoque_atual, custo_medio_atual")
    .eq("id", produtoId)
    .single();

  if (produtoError || !produto) {
    throw new Error(`Produto não encontrado: ${produtoError?.message}`);
  }

  const estoqueAnterior = Number(produto.estoque_atual) || 0;
  const custoMedioAnterior = Number(produto.custo_medio_atual) || 0;

  // 2. Calcular novo custo médio
  const novoCustoMedio = calcularNovoCustoMedio(
    estoqueAnterior,
    custoMedioAnterior,
    quantidade,
    custoUnitario
  );
  const novoEstoque = estoqueAnterior + quantidade;
  const custoTotal = quantidade * custoUnitario;

  // 3. Registrar movimentação de estoque
  const { data: movimentacao, error: movError } = await supabase
    .from("movimentacoes_estoque")
    .insert({
      empresa_id: empresaId,
      produto_id: produtoId,
      tipo: "entrada",
      motivo: "compra",
      origem,
      referencia_id: referenciaId || null,
      documento: documento || null,
      data,
      quantidade,
      custo_unitario: custoUnitario,
      custo_total: custoTotal,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: custoMedioAnterior,
      custo_medio_posterior: novoCustoMedio,
      observacoes: observacoes || null,
    })
    .select("id")
    .single();

  if (movError) {
    throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
  }

  // 4. Atualizar produto
  const { error: updateError } = await supabase
    .from("produtos")
    .update({
      estoque_atual: novoEstoque,
      custo_medio_atual: novoCustoMedio,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", produtoId);

  if (updateError) {
    throw new Error(`Erro ao atualizar produto: ${updateError.message}`);
  }

  return movimentacao.id;
}

/**
 * Registra uma saída de estoque (venda) e gera registro de CMV.
 * 
 * Fluxo:
 * 1. Busca dados atuais do produto
 * 2. Valida se há estoque suficiente
 * 3. Calcula CMV usando custo médio atual
 * 4. Registra movimentação de estoque
 * 5. Registra CMV
 * 6. Atualiza estoque do produto (custo médio não muda em saída)
 */
export async function registrarSaidaEstoque(input: SaidaEstoqueInput): Promise<{ movimentacaoId: string; cmvId: string }> {
  const { produtoId, empresaId, quantidade, origem, referenciaId, data, precoVendaUnitario, receitaTotal, canal, observacoes } = input;

  // 1. Buscar dados atuais do produto
  const { data: produto, error: produtoError } = await supabase
    .from("produtos")
    .select("estoque_atual, custo_medio_atual")
    .eq("id", produtoId)
    .single();

  if (produtoError || !produto) {
    throw new Error(`Produto não encontrado: ${produtoError?.message}`);
  }

  const estoqueAnterior = Number(produto.estoque_atual) || 0;
  const custoMedioAtual = Number(produto.custo_medio_atual) || 0;

  // 2. Validar estoque (warning, não bloqueia - pode haver estoque negativo em situações reais)
  if (estoqueAnterior < quantidade) {
    console.warn(`[Motor de Custos] Atenção: Estoque insuficiente para produto ${produtoId}. Estoque: ${estoqueAnterior}, Quantidade: ${quantidade}`);
  }

  // 3. Calcular CMV
  const custoTotal = quantidade * custoMedioAtual;
  const novoEstoque = estoqueAnterior - quantidade;

  // Calcular margem se houver dados de venda
  let margemBruta: number | null = null;
  let margemPercentual: number | null = null;
  if (receitaTotal && receitaTotal > 0) {
    const margem = calcularMargem(receitaTotal, custoTotal);
    margemBruta = margem.margemBruta;
    margemPercentual = margem.margemPercentual;
  }

  // 4. Registrar movimentação de estoque
  const { data: movimentacao, error: movError } = await supabase
    .from("movimentacoes_estoque")
    .insert({
      empresa_id: empresaId,
      produto_id: produtoId,
      tipo: "saida",
      motivo: "venda",
      origem,
      referencia_id: referenciaId || null,
      data,
      quantidade,
      custo_unitario: custoMedioAtual,
      custo_total: custoTotal,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: custoMedioAtual,
      custo_medio_posterior: custoMedioAtual, // Custo médio não muda em saída
      observacoes: observacoes || null,
    })
    .select("id")
    .single();

  if (movError) {
    throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
  }

  // 5. Registrar CMV
  const { data: cmv, error: cmvError } = await supabase
    .from("cmv_registros")
    .insert({
      empresa_id: empresaId,
      produto_id: produtoId,
      origem,
      referencia_id: referenciaId || null,
      data,
      quantidade,
      custo_unitario_momento: custoMedioAtual,
      custo_total: custoTotal,
      preco_venda_unitario: precoVendaUnitario || null,
      receita_total: receitaTotal || null,
      margem_bruta: margemBruta,
      margem_percentual: margemPercentual,
      canal: canal || null,
      observacoes: observacoes || null,
    })
    .select("id")
    .single();

  if (cmvError) {
    throw new Error(`Erro ao registrar CMV: ${cmvError.message}`);
  }

  // 6. Atualizar estoque do produto
  const { error: updateError } = await supabase
    .from("produtos")
    .update({
      estoque_atual: novoEstoque,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", produtoId);

  if (updateError) {
    throw new Error(`Erro ao atualizar produto: ${updateError.message}`);
  }

  return { movimentacaoId: movimentacao.id, cmvId: cmv.id };
}

/**
 * Ajusta o estoque manualmente (para inventário, correções, etc.)
 */
export async function ajustarEstoque(
  produtoId: string,
  empresaId: string,
  novoEstoque: number,
  novoCustoMedio: number | null,
  observacoes?: string
): Promise<string> {
  // Buscar dados atuais
  const { data: produto, error: produtoError } = await supabase
    .from("produtos")
    .select("estoque_atual, custo_medio_atual")
    .eq("id", produtoId)
    .single();

  if (produtoError || !produto) {
    throw new Error(`Produto não encontrado: ${produtoError?.message}`);
  }

  const estoqueAnterior = Number(produto.estoque_atual) || 0;
  const custoMedioAnterior = Number(produto.custo_medio_atual) || 0;
  const custoMedioFinal = novoCustoMedio !== null ? novoCustoMedio : custoMedioAnterior;
  
  const diferenca = novoEstoque - estoqueAnterior;
  const tipo = diferenca >= 0 ? "entrada" : "saida";
  const motivo = diferenca >= 0 ? "ajuste_positivo" : "ajuste_negativo";

  // Registrar movimentação
  const { data: movimentacao, error: movError } = await supabase
    .from("movimentacoes_estoque")
    .insert({
      empresa_id: empresaId,
      produto_id: produtoId,
      tipo,
      motivo,
      origem: "manual",
      data: new Date().toISOString().split("T")[0],
      quantidade: Math.abs(diferenca),
      custo_unitario: custoMedioFinal,
      custo_total: Math.abs(diferenca) * custoMedioFinal,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: custoMedioAnterior,
      custo_medio_posterior: custoMedioFinal,
      observacoes: observacoes || "Ajuste manual de estoque",
    })
    .select("id")
    .single();

  if (movError) {
    throw new Error(`Erro ao registrar ajuste: ${movError.message}`);
  }

  // Atualizar produto
  const { error: updateError } = await supabase
    .from("produtos")
    .update({
      estoque_atual: novoEstoque,
      custo_medio_atual: custoMedioFinal,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", produtoId);

  if (updateError) {
    throw new Error(`Erro ao atualizar produto: ${updateError.message}`);
  }

  return movimentacao.id;
}

// ============= CONSULTAS =============

/**
 * Busca o resumo de CMV por período.
 */
export async function buscarResumoCMV(
  empresaId: string,
  dataInicio: string,
  dataFim: string
): Promise<{
  totalCMV: number;
  totalReceita: number;
  margemBrutaTotal: number;
  margemPercentualMedia: number;
  quantidadeVendida: number;
  registros: number;
}> {
  const { data, error } = await supabase
    .from("cmv_registros")
    .select("custo_total, receita_total, margem_bruta, quantidade")
    .eq("empresa_id", empresaId)
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (error) {
    throw new Error(`Erro ao buscar CMV: ${error.message}`);
  }

  const registros = data || [];
  const totalCMV = registros.reduce((sum, r) => sum + (Number(r.custo_total) || 0), 0);
  const totalReceita = registros.reduce((sum, r) => sum + (Number(r.receita_total) || 0), 0);
  const margemBrutaTotal = registros.reduce((sum, r) => sum + (Number(r.margem_bruta) || 0), 0);
  const quantidadeVendida = registros.reduce((sum, r) => sum + (Number(r.quantidade) || 0), 0);
  const margemPercentualMedia = totalReceita > 0 ? (margemBrutaTotal / totalReceita) * 100 : 0;

  return {
    totalCMV: Math.round(totalCMV * 100) / 100,
    totalReceita: Math.round(totalReceita * 100) / 100,
    margemBrutaTotal: Math.round(margemBrutaTotal * 100) / 100,
    margemPercentualMedia: Math.round(margemPercentualMedia * 100) / 100,
    quantidadeVendida,
    registros: registros.length,
  };
}
