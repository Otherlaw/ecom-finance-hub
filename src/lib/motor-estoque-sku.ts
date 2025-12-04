/**
 * MOTOR DE ESTOQUE V1 - Controle por SKU
 * 
 * Funções para gestão de estoque e custo médio por SKU/variação.
 * Integra com movimentacoes_estoque e cmv_registros.
 */

import { supabase } from "@/integrations/supabase/client";
import { calcularNovoCustoMedio, calcularMargem } from "./motor-custos";

// ============= TIPOS =============

export interface EntradaEstoqueSKUInput {
  skuId: string;
  empresaId: string;
  quantidade: number;
  custoUnitario: number;
  origem: string;
  referenciaId?: string;
  documento?: string;
  data: string;
  observacoes?: string;
}

export interface SaidaEstoqueSKUInput {
  skuId: string;
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

export interface AjusteEstoqueSKUInput {
  skuId: string;
  empresaId: string;
  novoEstoque: number;
  novoCustoMedio?: number;
  observacoes?: string;
}

export interface SKUComEstoque {
  id: string;
  produto_id: string;
  empresa_id: string;
  codigo_sku: string;
  variacao: Record<string, string>;
  estoque_atual: number;
  custo_medio_atual: number;
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Busca dados do SKU
 */
async function buscarSKU(skuId: string): Promise<SKUComEstoque> {
  const { data, error } = await supabase
    .from("produto_skus")
    .select("id, produto_id, empresa_id, codigo_sku, variacao, estoque_atual, custo_medio_atual")
    .eq("id", skuId)
    .single();

  if (error || !data) {
    throw new Error(`SKU não encontrado: ${error?.message || "ID inválido"}`);
  }

  return {
    ...data,
    variacao: (data.variacao as Record<string, string>) || {},
    estoque_atual: Number(data.estoque_atual) || 0,
    custo_medio_atual: Number(data.custo_medio_atual) || 0,
  };
}

/**
 * Atualiza estoque e custo médio do SKU
 */
async function atualizarSKU(
  skuId: string,
  novoEstoque: number,
  novoCustoMedio: number
): Promise<void> {
  const { error } = await supabase
    .from("produto_skus")
    .update({
      estoque_atual: novoEstoque,
      custo_medio_atual: novoCustoMedio,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", skuId);

  if (error) {
    throw new Error(`Erro ao atualizar SKU: ${error.message}`);
  }
}

/**
 * Sincroniza estoque do produto pai (soma de todos os SKUs)
 */
async function sincronizarEstoqueProduto(produtoId: string): Promise<void> {
  // Buscar soma de estoque de todos os SKUs do produto
  const { data: skus, error: skusError } = await supabase
    .from("produto_skus")
    .select("estoque_atual, custo_medio_atual")
    .eq("produto_id", produtoId)
    .eq("ativo", true);

  if (skusError) {
    console.error("Erro ao sincronizar estoque do produto:", skusError);
    return;
  }

  const estoqueTotal = (skus || []).reduce((sum, s) => sum + Number(s.estoque_atual || 0), 0);
  
  // Calcular custo médio ponderado do produto
  const valorTotal = (skus || []).reduce(
    (sum, s) => sum + (Number(s.estoque_atual || 0) * Number(s.custo_medio_atual || 0)),
    0
  );
  const custoMedioProduto = estoqueTotal > 0 ? valorTotal / estoqueTotal : 0;

  // Atualizar produto pai
  const { error: updateError } = await supabase
    .from("produtos")
    .update({
      estoque_atual: estoqueTotal,
      custo_medio_atual: Math.round(custoMedioProduto * 100) / 100,
      ultima_atualizacao_custo: new Date().toISOString(),
    })
    .eq("id", produtoId);

  if (updateError) {
    console.error("Erro ao atualizar produto pai:", updateError);
  }
}

// ============= OPERAÇÕES DE ESTOQUE POR SKU =============

/**
 * Registra uma entrada de estoque por SKU (compra)
 * 
 * Fluxo:
 * 1. Busca dados atuais do SKU
 * 2. Calcula novo custo médio ponderado
 * 3. Registra movimentação de estoque
 * 4. Atualiza SKU com novo estoque e custo
 * 5. Sincroniza estoque do produto pai
 */
export async function registrarEntradaEstoqueSKU(
  input: EntradaEstoqueSKUInput
): Promise<string> {
  const { skuId, empresaId, quantidade, custoUnitario, origem, referenciaId, documento, data, observacoes } = input;

  // 1. Buscar dados do SKU
  const sku = await buscarSKU(skuId);

  // 2. Calcular novo custo médio
  const novoCustoMedio = calcularNovoCustoMedio(
    sku.estoque_atual,
    sku.custo_medio_atual,
    quantidade,
    custoUnitario
  );
  const novoEstoque = sku.estoque_atual + quantidade;
  const custoTotal = quantidade * custoUnitario;

  // 3. Registrar movimentação de estoque
  const { data: movimentacao, error: movError } = await supabase
    .from("movimentacoes_estoque")
    .insert({
      empresa_id: empresaId,
      produto_id: sku.produto_id,
      sku_id: skuId,
      tipo: "entrada",
      motivo: "compra",
      origem,
      referencia_id: referenciaId || null,
      documento: documento || null,
      data,
      quantidade,
      custo_unitario: custoUnitario,
      custo_total: custoTotal,
      estoque_anterior: sku.estoque_atual,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: sku.custo_medio_atual,
      custo_medio_posterior: novoCustoMedio,
      observacoes: observacoes || null,
    })
    .select("id")
    .single();

  if (movError) {
    throw new Error(`Erro ao registrar movimentação: ${movError.message}`);
  }

  // 4. Atualizar SKU
  await atualizarSKU(skuId, novoEstoque, novoCustoMedio);

  // 5. Sincronizar produto pai
  await sincronizarEstoqueProduto(sku.produto_id);

  return movimentacao.id;
}

/**
 * Registra uma saída de estoque por SKU (venda) e gera registro de CMV
 * 
 * Fluxo:
 * 1. Busca dados do SKU
 * 2. Valida estoque (warning se insuficiente)
 * 3. Calcula CMV usando custo médio atual
 * 4. Registra movimentação de estoque
 * 5. Registra CMV
 * 6. Atualiza estoque do SKU
 * 7. Sincroniza produto pai
 */
export async function registrarSaidaEstoqueSKU(
  input: SaidaEstoqueSKUInput
): Promise<{ movimentacaoId: string; cmvId: string }> {
  const { skuId, empresaId, quantidade, origem, referenciaId, data, precoVendaUnitario, receitaTotal, canal, observacoes } = input;

  // 1. Buscar dados do SKU
  const sku = await buscarSKU(skuId);

  // 2. Validar estoque (warning, não bloqueia)
  if (sku.estoque_atual < quantidade) {
    console.warn(
      `[Motor Estoque SKU] Atenção: Estoque insuficiente para SKU ${sku.codigo_sku}. ` +
      `Estoque: ${sku.estoque_atual}, Quantidade: ${quantidade}`
    );
  }

  // 3. Calcular CMV
  const custoTotal = quantidade * sku.custo_medio_atual;
  const novoEstoque = sku.estoque_atual - quantidade;

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
      produto_id: sku.produto_id,
      sku_id: skuId,
      tipo: "saida",
      motivo: "venda",
      origem,
      referencia_id: referenciaId || null,
      data,
      quantidade,
      custo_unitario: sku.custo_medio_atual,
      custo_total: custoTotal,
      estoque_anterior: sku.estoque_atual,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: sku.custo_medio_atual,
      custo_medio_posterior: sku.custo_medio_atual, // Não muda em saída
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
      produto_id: sku.produto_id,
      sku_id: skuId,
      origem,
      referencia_id: referenciaId || null,
      data,
      quantidade,
      custo_unitario_momento: sku.custo_medio_atual,
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

  // 6. Atualizar SKU
  await atualizarSKU(skuId, novoEstoque, sku.custo_medio_atual);

  // 7. Sincronizar produto pai
  await sincronizarEstoqueProduto(sku.produto_id);

  return { movimentacaoId: movimentacao.id, cmvId: cmv.id };
}

/**
 * Ajusta o estoque de um SKU manualmente (inventário, correções)
 */
export async function ajustarEstoqueSKU(
  input: AjusteEstoqueSKUInput
): Promise<string> {
  const { skuId, empresaId, novoEstoque, novoCustoMedio, observacoes } = input;

  // Buscar dados atuais
  const sku = await buscarSKU(skuId);

  const custoMedioFinal = novoCustoMedio !== undefined ? novoCustoMedio : sku.custo_medio_atual;
  const diferenca = novoEstoque - sku.estoque_atual;
  const tipo = diferenca >= 0 ? "entrada" : "saida";
  const motivo = diferenca >= 0 ? "ajuste_positivo" : "ajuste_negativo";

  // Registrar movimentação
  const { data: movimentacao, error: movError } = await supabase
    .from("movimentacoes_estoque")
    .insert({
      empresa_id: empresaId,
      produto_id: sku.produto_id,
      sku_id: skuId,
      tipo,
      motivo,
      origem: "manual",
      data: new Date().toISOString().split("T")[0],
      quantidade: Math.abs(diferenca),
      custo_unitario: custoMedioFinal,
      custo_total: Math.abs(diferenca) * custoMedioFinal,
      estoque_anterior: sku.estoque_atual,
      estoque_posterior: novoEstoque,
      custo_medio_anterior: sku.custo_medio_atual,
      custo_medio_posterior: custoMedioFinal,
      observacoes: observacoes || "Ajuste manual de estoque (SKU)",
    })
    .select("id")
    .single();

  if (movError) {
    throw new Error(`Erro ao registrar ajuste: ${movError.message}`);
  }

  // Atualizar SKU
  await atualizarSKU(skuId, novoEstoque, custoMedioFinal);

  // Sincronizar produto pai
  await sincronizarEstoqueProduto(sku.produto_id);

  return movimentacao.id;
}

// ============= CONSULTAS =============

/**
 * Busca resumo de estoque por SKU para uma empresa
 */
export async function buscarResumoEstoqueSKU(
  empresaId: string
): Promise<{
  totalSkus: number;
  estoqueTotal: number;
  valorEstoque: number;
  skusSemEstoque: number;
  skusEstoqueBaixo: number;
}> {
  const { data, error } = await supabase
    .from("produto_skus")
    .select("estoque_atual, custo_medio_atual")
    .eq("empresa_id", empresaId)
    .eq("ativo", true);

  if (error) {
    throw new Error(`Erro ao buscar resumo: ${error.message}`);
  }

  const skus = data || [];
  const estoqueTotal = skus.reduce((sum, s) => sum + Number(s.estoque_atual || 0), 0);
  const valorEstoque = skus.reduce(
    (sum, s) => sum + (Number(s.estoque_atual || 0) * Number(s.custo_medio_atual || 0)),
    0
  );
  const skusSemEstoque = skus.filter(s => Number(s.estoque_atual || 0) <= 0).length;
  const skusEstoqueBaixo = skus.filter(s => {
    const estoque = Number(s.estoque_atual || 0);
    return estoque > 0 && estoque <= 5;
  }).length;

  return {
    totalSkus: skus.length,
    estoqueTotal,
    valorEstoque: Math.round(valorEstoque * 100) / 100,
    skusSemEstoque,
    skusEstoqueBaixo,
  };
}

/**
 * Busca movimentações de estoque por SKU
 */
export async function buscarMovimentacoesSKU(
  skuId: string,
  dataInicio?: string,
  dataFim?: string
): Promise<{
  id: string;
  tipo: string;
  motivo: string;
  data: string;
  quantidade: number;
  custo_unitario: number;
  estoque_posterior: number;
  custo_medio_posterior: number;
  observacoes: string | null;
}[]> {
  let query = supabase
    .from("movimentacoes_estoque")
    .select("id, tipo, motivo, data, quantidade, custo_unitario, estoque_posterior, custo_medio_posterior, observacoes")
    .eq("sku_id", skuId)
    .order("data", { ascending: false });

  if (dataInicio) {
    query = query.gte("data", dataInicio);
  }
  if (dataFim) {
    query = query.lte("data", dataFim);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar movimentações: ${error.message}`);
  }

  return data || [];
}

// ============= INTEGRAÇÃO COM COMPRAS =============

export interface ItemCompraParaEstoque {
  produtoId: string;
  produtoNome?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface CompraParaEstoque {
  id: string;
  empresaId: string;
  dataCompra: string;
  numeroNF?: string;
  itens: ItemCompraParaEstoque[];
}

/**
 * Busca ou cria um SKU padrão para um produto
 * (usado quando o produto não tem SKUs cadastrados)
 */
export async function buscarOuCriarSKUPadrao(
  produtoId: string,
  empresaId: string
): Promise<string> {
  // Buscar SKU padrão existente
  const { data: existingSku, error: searchError } = await supabase
    .from("produto_skus")
    .select("id")
    .eq("produto_id", produtoId)
    .eq("empresa_id", empresaId)
    .eq("codigo_sku", "PADRAO")
    .maybeSingle();

  if (searchError) {
    throw new Error(`Erro ao buscar SKU padrão: ${searchError.message}`);
  }

  if (existingSku) {
    return existingSku.id;
  }

  // Criar SKU padrão
  const { data: newSku, error: createError } = await supabase
    .from("produto_skus")
    .insert({
      produto_id: produtoId,
      empresa_id: empresaId,
      codigo_sku: "PADRAO",
      variacao: {},
      estoque_atual: 0,
      custo_medio_atual: 0,
      ativo: true,
      observacoes: "SKU padrão criado automaticamente",
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(`Erro ao criar SKU padrão: ${createError.message}`);
  }

  return newSku.id;
}

/**
 * Verifica se já existem movimentações para uma compra (idempotência)
 */
async function verificarIdempotenciaCompra(compraId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("movimentacoes_estoque")
    .select("id")
    .eq("referencia_id", compraId)
    .eq("origem", "compra")
    .limit(1);

  if (error) {
    console.error("Erro ao verificar idempotência:", error);
    return false;
  }

  return (data || []).length > 0;
}

/**
 * Busca dados de uma compra (mock por agora, preparado para banco)
 */
async function buscarCompra(compraId: string): Promise<CompraParaEstoque | null> {
  // TODO: Quando tabela 'compras' existir no banco, substituir por query real
  // Por agora, importa do mock
  const { mockPurchases } = await import("./purchases-data");
  
  const purchase = mockPurchases.find(p => p.id === compraId);
  if (!purchase) return null;

  // Buscar empresa_id pelo nome da empresa (mock)
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id")
    .ilike("razao_social", `%${purchase.empresa}%`)
    .maybeSingle();

  return {
    id: purchase.id,
    empresaId: empresa?.id || "",
    dataCompra: purchase.dataCompra,
    numeroNF: purchase.numeroNF,
    itens: purchase.itens
      .filter(item => item.mapeado && item.produtoId)
      .map(item => ({
        produtoId: item.produtoId!,
        produtoNome: item.produtoNome,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        valorTotal: item.valorTotal,
      })),
  };
}

/**
 * Processa uma compra para atualizar o estoque
 * 
 * Aceita:
 * - compraId (string): busca a compra e processa
 * - CompraParaEstoque (objeto): processa diretamente
 * 
 * Fluxo:
 * 1. Busca compra (se necessário)
 * 2. Verifica idempotência (não duplica movimentos)
 * 3. Para cada item mapeado:
 *    - Busca ou cria SKU padrão
 *    - Calcula custo unitário efetivo
 *    - Registra entrada no estoque
 * 4. Retorna resumo do processamento
 */
export async function processarCompraParaEstoque(
  compraOuId: string | CompraParaEstoque
): Promise<{
  success: boolean;
  processados: number;
  ignorados: number;
  movimentacoes: string[];
  erros: string[];
}> {
  const resultado = {
    success: true,
    processados: 0,
    ignorados: 0,
    movimentacoes: [] as string[],
    erros: [] as string[],
  };

  // 1. Resolver compra
  let compra: CompraParaEstoque | null;
  if (typeof compraOuId === "string") {
    compra = await buscarCompra(compraOuId);
    if (!compra) {
      return {
        ...resultado,
        success: false,
        erros: [`Compra ${compraOuId} não encontrada`],
      };
    }
  } else {
    compra = compraOuId;
  }

  // Validar empresa
  if (!compra.empresaId) {
    return {
      ...resultado,
      success: false,
      erros: ["Empresa não identificada para esta compra"],
    };
  }

  // 2. Verificar idempotência
  const jaProcessada = await verificarIdempotenciaCompra(compra.id);
  if (jaProcessada) {
    console.warn(`[Motor Estoque] Compra ${compra.id} já processada. Ignorando.`);
    return {
      ...resultado,
      success: false,
      erros: ["Compra já processada anteriormente"],
    };
  }

  // 3. Processar cada item
  for (const item of compra.itens) {
    // Ignorar itens sem produto mapeado
    if (!item.produtoId) {
      resultado.ignorados++;
      continue;
    }

    try {
      // 3.1. Buscar ou criar SKU padrão
      const skuId = await buscarOuCriarSKUPadrao(item.produtoId, compra.empresaId);

      // 3.2. Registrar entrada no estoque
      const movId = await registrarEntradaEstoqueSKU({
        skuId,
        empresaId: compra.empresaId,
        quantidade: item.quantidade,
        custoUnitario: item.valorUnitario,
        origem: "compra",
        referenciaId: compra.id,
        documento: compra.numeroNF || undefined,
        data: compra.dataCompra,
        observacoes: `Entrada via compra NF ${compra.numeroNF || "s/n"} - ${item.produtoNome || "Produto"}`,
      });

      resultado.movimentacoes.push(movId);
      resultado.processados++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      resultado.erros.push(`Item ${item.produtoNome || item.produtoId}: ${msg}`);
      resultado.success = false;
    }
  }

  return resultado;
}
