/**
 * Motor de Categorização Automática de Marketplace
 * 
 * Engine central para classificação automática de transações de marketplaces.
 * NÃO usa IDs hardcoded - busca/cria categorias e centros de custo por NOME.
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TIPOS =============

export interface CategorizacaoAutomatica {
  categoria_id: string | null;
  centro_custo_id: string | null;
  tipo_transacao: string;
  tipo_lancamento: 'credito' | 'debito';
  conciliado: boolean;
  regra_aplicada: string;
}

export interface TransacaoParaCategorizacao {
  id?: string;
  canal: string;
  descricao: string;
  valor_liquido: number;
  valor_bruto?: number | null;
  tipo_transacao?: string;
  tipo_lancamento?: 'credito' | 'debito';
}

export interface RegraAutomatica {
  padrao: string[];  // Padrões para match (case-insensitive, inclui parcial)
  tipo_transacao: string;
  tipo_lancamento: 'credito' | 'debito';
  categoria_nome: string;
  categoria_tipo: string;
  centro_custo_nome: string;
  prioridade: number;
}

// ============= CACHE DE CATEGORIAS E CENTROS DE CUSTO =============

let cacheCategoriasById: Map<string, { id: string; nome: string; tipo: string }> = new Map();
let cacheCategoriasByNome: Map<string, string> = new Map(); // nome -> id
let cacheCentrosCustoById: Map<string, { id: string; nome: string }> = new Map();
let cacheCentrosCustoByNome: Map<string, string> = new Map(); // nome -> id
let cacheCarregado = false;

async function carregarCaches() {
  if (cacheCarregado) return;

  // Carregar categorias
  const { data: categorias } = await supabase
    .from("categorias_financeiras")
    .select("id, nome, tipo")
    .eq("ativo", true);

  if (categorias) {
    categorias.forEach(cat => {
      cacheCategoriasById.set(cat.id, cat);
      cacheCategoriasByNome.set(cat.nome.toLowerCase().trim(), cat.id);
    });
  }

  // Carregar centros de custo
  const { data: centros } = await supabase
    .from("centros_de_custo")
    .select("id, nome")
    .eq("ativo", true);

  if (centros) {
    centros.forEach(cc => {
      cacheCentrosCustoById.set(cc.id, cc);
      cacheCentrosCustoByNome.set(cc.nome.toLowerCase().trim(), cc.id);
    });
  }

  cacheCarregado = true;
}

export function limparCaches() {
  cacheCategoriasById.clear();
  cacheCategoriasByNome.clear();
  cacheCentrosCustoById.clear();
  cacheCentrosCustoByNome.clear();
  cacheCarregado = false;
}

// ============= FUNÇÕES PARA BUSCAR/CRIAR CATEGORIA E CENTRO DE CUSTO =============

async function buscarOuCriarCategoria(nome: string, tipo: string): Promise<string | null> {
  await carregarCaches();

  const nomeNormalizado = nome.toLowerCase().trim();
  
  // Buscar no cache
  if (cacheCategoriasByNome.has(nomeNormalizado)) {
    return cacheCategoriasByNome.get(nomeNormalizado)!;
  }

  // Buscar por nome similar (com variações)
  for (const [key, id] of cacheCategoriasByNome) {
    if (key.includes(nomeNormalizado) || nomeNormalizado.includes(key)) {
      return id;
    }
  }

  // Criar nova categoria
  try {
    const { data, error } = await supabase
      .from("categorias_financeiras")
      .insert({
        nome: nome,
        tipo: tipo,
        descricao: `Categoria criada automaticamente pelo sistema de importação`,
        ativo: true,
      })
      .select("id")
      .single();

    if (error) {
      console.warn(`[Auto-Cat] Erro ao criar categoria "${nome}":`, error.message);
      return null;
    }

    // Atualizar cache
    cacheCategoriasByNome.set(nomeNormalizado, data.id);
    cacheCategoriasById.set(data.id, { id: data.id, nome, tipo });
    
    console.log(`[Auto-Cat] Categoria "${nome}" criada automaticamente`);
    return data.id;
  } catch (err) {
    console.warn(`[Auto-Cat] Erro ao criar categoria:`, err);
    return null;
  }
}

async function buscarOuCriarCentroCusto(nome: string): Promise<string | null> {
  await carregarCaches();

  const nomeNormalizado = nome.toLowerCase().trim();
  
  // Buscar no cache
  if (cacheCentrosCustoByNome.has(nomeNormalizado)) {
    return cacheCentrosCustoByNome.get(nomeNormalizado)!;
  }

  // Buscar por nome similar
  for (const [key, id] of cacheCentrosCustoByNome) {
    if (key.includes(nomeNormalizado) || nomeNormalizado.includes(key)) {
      return id;
    }
  }

  // Criar novo centro de custo
  try {
    const { data, error } = await supabase
      .from("centros_de_custo")
      .insert({
        nome: nome,
        descricao: `Centro de custo criado automaticamente pelo sistema de importação`,
        ativo: true,
      })
      .select("id")
      .single();

    if (error) {
      console.warn(`[Auto-Cat] Erro ao criar centro de custo "${nome}":`, error.message);
      return null;
    }

    // Atualizar cache
    cacheCentrosCustoByNome.set(nomeNormalizado, data.id);
    cacheCentrosCustoById.set(data.id, { id: data.id, nome });
    
    console.log(`[Auto-Cat] Centro de custo "${nome}" criado automaticamente`);
    return data.id;
  } catch (err) {
    console.warn(`[Auto-Cat] Erro ao criar centro de custo:`, err);
    return null;
  }
}

// ============= REGRAS DE CATEGORIZAÇÃO POR CANAL =============

const REGRAS_MERCADO_LIVRE: RegraAutomatica[] = [
  // TARIFAS E COMISSÕES
  {
    padrao: ["custo por vender no mercado livre", "custo por vender", "cobrar no mercado livre"],
    tipo_transacao: "tarifa_marketplace",
    tipo_lancamento: "debito",
    categoria_nome: "Tarifas de Marketplace",
    categoria_tipo: "Custos",
    centro_custo_nome: "Marketplace – Mercado Livre",
    prioridade: 100,
  },
  {
    padrao: ["comissão por venda", "comissão de venda", "comissao"],
    tipo_transacao: "comissao",
    tipo_lancamento: "debito",
    categoria_nome: "Comissões de Marketplace",
    categoria_tipo: "Custos",
    centro_custo_nome: "Marketplace – Mercado Livre",
    prioridade: 95,
  },
  {
    padrao: ["tarifa por venda", "tarifa de venda"],
    tipo_transacao: "tarifa_venda",
    tipo_lancamento: "debito",
    categoria_nome: "Tarifas de Marketplace",
    categoria_tipo: "Custos",
    centro_custo_nome: "Marketplace – Mercado Livre",
    prioridade: 95,
  },
  // ASSINATURAS
  {
    padrao: ["tarifa de assinatura", "tarifa por assinatura", "assinatura mensal", "mensalidade"],
    tipo_transacao: "assinatura",
    tipo_lancamento: "debito",
    categoria_nome: "Tarifas Fixas / Assinaturas",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Financeiro / Plataforma",
    prioridade: 90,
  },
  // PUBLICIDADE
  {
    padrao: ["campanha de publicidade", "publicidade", "anúncios", "ads", "product ads", "mercado ads"],
    tipo_transacao: "ads",
    tipo_lancamento: "debito",
    categoria_nome: "Marketing / Anúncios",
    categoria_tipo: "Despesas Comercial / Marketing",
    centro_custo_nome: "Marketing",
    prioridade: 85,
  },
  // PARCELAMENTO E JUROS
  {
    padrao: ["taxa de parcelamento", "parcelamento", "financiamento"],
    tipo_transacao: "taxa_parcelamento",
    tipo_lancamento: "debito",
    categoria_nome: "Taxas Financeiras / Juros",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    prioridade: 80,
  },
  {
    padrao: ["juros"],
    tipo_transacao: "juros",
    tipo_lancamento: "debito",
    categoria_nome: "Taxas Financeiras / Juros",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    prioridade: 75,
  },
  // LOGÍSTICA
  {
    padrao: ["indisponibilidade logística", "multa logística", "penalidade logística"],
    tipo_transacao: "multa_logistica",
    tipo_lancamento: "debito",
    categoria_nome: "Multas / Penalidades",
    categoria_tipo: "Despesas Operacionais",
    centro_custo_nome: "Operação / Logística",
    prioridade: 70,
  },
  {
    padrao: ["tarifa de envio", "tarifas do full", "full", "envio full", "frete"],
    tipo_transacao: "frete",
    tipo_lancamento: "debito",
    categoria_nome: "Frete / Logística",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação / Logística",
    prioridade: 65,
  },
  {
    padrao: ["envio"],
    tipo_transacao: "frete",
    tipo_lancamento: "debito",
    categoria_nome: "Frete / Logística",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação / Logística",
    prioridade: 60,
  },
  // ESTORNOS E DEVOLUÇÕES
  {
    padrao: ["cancelamento", "cancelado", "cancel"],
    tipo_transacao: "cancelamento",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Devoluções",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 70,
  },
  {
    padrao: ["devolução", "devolvido", "devolucao"],
    tipo_transacao: "devolucao",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Devoluções",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 70,
  },
  {
    padrao: ["estorno", "refund", "reversão", "reembolso"],
    tipo_transacao: "estorno",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Devoluções",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 70,
  },
  // ANTECIPAÇÃO
  {
    padrao: ["antecipação", "antecipacao", "custo de antecipação"],
    tipo_transacao: "antecipacao",
    tipo_lancamento: "debito",
    categoria_nome: "Taxas de Antecipação",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    prioridade: 75,
  },
  // VENDAS (CRÉDITO) - Última prioridade
  {
    padrao: ["venda", "pagamento", "liberação", "repasse", "liquidação", "liberado", "transferido"],
    tipo_transacao: "venda",
    tipo_lancamento: "credito",
    categoria_nome: "Receita de Vendas – Mercado Livre",
    categoria_tipo: "Receitas",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 10,
  },
];

const REGRAS_MERCADO_PAGO: RegraAutomatica[] = [
  // TARIFAS
  {
    padrao: ["fee", "tarifa", "mercadopago_fee", "mp_fee", "taxa mercado pago"],
    tipo_transacao: "tarifa_financeira",
    tipo_lancamento: "debito",
    categoria_nome: "Tarifas Financeiras – Mercado Pago",
    categoria_tipo: "Despesas Financeiras",
    centro_custo_nome: "Financeiro",
    prioridade: 90,
  },
  // CHARGEBACKS
  {
    padrao: ["chargeback", "mediação", "disputa", "contestação"],
    tipo_transacao: "chargeback",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Chargeback",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 85,
  },
  // ESTORNOS
  {
    padrao: ["estorno", "refund", "devolução", "devolvido"],
    tipo_transacao: "estorno",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Devoluções",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 80,
  },
  // TRANSFERÊNCIAS
  {
    padrao: ["transferência", "transfer", "saque", "withdrawal", "pix enviado"],
    tipo_transacao: "transferencia",
    tipo_lancamento: "debito",
    categoria_nome: "Transferências Internas",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    prioridade: 75,
  },
  {
    padrao: ["depósito", "deposit", "pix recebido"],
    tipo_transacao: "deposito",
    tipo_lancamento: "credito",
    categoria_nome: "Transferências Internas",
    categoria_tipo: "Outras Receitas / Despesas",
    centro_custo_nome: "Financeiro",
    prioridade: 75,
  },
  // VENDAS (CRÉDITO) - Última prioridade
  {
    padrao: ["payment", "pagamento", "venda", "approved", "accredited"],
    tipo_transacao: "venda",
    tipo_lancamento: "credito",
    categoria_nome: "Receita de Vendas – Mercado Pago",
    categoria_tipo: "Receitas",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 10,
  },
];

const REGRAS_SHOPEE: RegraAutomatica[] = [
  {
    padrao: ["comissão", "commission", "taxa de serviço"],
    tipo_transacao: "comissao",
    tipo_lancamento: "debito",
    categoria_nome: "Comissões de Marketplace",
    categoria_tipo: "Custos",
    centro_custo_nome: "Marketplace – Shopee",
    prioridade: 90,
  },
  {
    padrao: ["frete", "envio", "shipping"],
    tipo_transacao: "frete",
    tipo_lancamento: "debito",
    categoria_nome: "Frete / Logística",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação / Logística",
    prioridade: 85,
  },
  {
    padrao: ["voucher", "cupom", "desconto"],
    tipo_transacao: "desconto",
    tipo_lancamento: "debito",
    categoria_nome: "Descontos Promocionais",
    categoria_tipo: "Custos",
    centro_custo_nome: "Marketing",
    prioridade: 80,
  },
  {
    padrao: ["ads", "anúncio", "publicidade"],
    tipo_transacao: "ads",
    tipo_lancamento: "debito",
    categoria_nome: "Marketing / Anúncios",
    categoria_tipo: "Despesas Comercial / Marketing",
    centro_custo_nome: "Marketing",
    prioridade: 80,
  },
  {
    padrao: ["estorno", "devolução", "refund", "cancelamento"],
    tipo_transacao: "estorno",
    tipo_lancamento: "debito",
    categoria_nome: "Estornos / Devoluções",
    categoria_tipo: "Custos",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 75,
  },
  {
    padrao: ["venda", "pedido", "order", "pagamento"],
    tipo_transacao: "venda",
    tipo_lancamento: "credito",
    categoria_nome: "Receita de Vendas – Shopee",
    categoria_tipo: "Receitas",
    centro_custo_nome: "Operação – Vendas",
    prioridade: 10,
  },
];

// Mapa de regras por canal
const REGRAS_POR_CANAL: Record<string, RegraAutomatica[]> = {
  mercado_livre: REGRAS_MERCADO_LIVRE,
  mercado_pago: REGRAS_MERCADO_PAGO,
  shopee: REGRAS_SHOPEE,
};

// ============= FUNÇÃO PRINCIPAL DE CATEGORIZAÇÃO =============

export async function aplicarCategorizacaoAutomatica(
  transacao: TransacaoParaCategorizacao
): Promise<CategorizacaoAutomatica | null> {
  // Normalizar canal: "Mercado Livre" -> "mercado_livre", "Mercado Pago" -> "mercado_pago"
  const canalRaw = transacao.canal.toLowerCase().trim();
  const canalNormalizado = canalRaw.replace(/\s+/g, '_'); // Substitui espaços por underscore
  const descricaoNormalizada = transacao.descricao.toLowerCase().trim();

  // Obter regras do canal
  const regras = REGRAS_POR_CANAL[canalNormalizado];
  
  if (!regras || regras.length === 0) {
    console.log(`[Auto-Cat] Nenhuma regra definida para canal: ${canalNormalizado}`);
    return null;
  }

  // Determinar tipo de lançamento baseado no valor se não fornecido
  let tipoLancamentoInferido: 'credito' | 'debito' = 
    transacao.tipo_lancamento || 
    (transacao.valor_liquido >= 0 ? 'credito' : 'debito');

  // Ordenar regras por prioridade (maior primeiro)
  const regrasOrdenadas = [...regras].sort((a, b) => b.prioridade - a.prioridade);

  // Encontrar regra que faz match
  for (const regra of regrasOrdenadas) {
    // Verificar se o tipo de lançamento é compatível
    if (regra.tipo_lancamento !== tipoLancamentoInferido) {
      // Se o valor é positivo e a regra é de débito, pode ser um ajuste
      // Se o valor é negativo e a regra é de crédito, não faz match
      continue;
    }

    // Verificar se algum padrão faz match
    const match = regra.padrao.some(p => descricaoNormalizada.includes(p.toLowerCase()));
    
    if (match) {
      // Buscar ou criar categoria e centro de custo
      const categoriaId = await buscarOuCriarCategoria(regra.categoria_nome, regra.categoria_tipo);
      const centroCustoId = await buscarOuCriarCentroCusto(regra.centro_custo_nome);

      return {
        categoria_id: categoriaId,
        centro_custo_id: centroCustoId,
        tipo_transacao: regra.tipo_transacao,
        tipo_lancamento: regra.tipo_lancamento,
        conciliado: categoriaId !== null, // Só concilia se conseguiu categorizar
        regra_aplicada: regra.padrao[0],
      };
    }
  }

  // Se não encontrou regra específica mas é um valor positivo, classificar como venda genérica
  if (tipoLancamentoInferido === 'credito' && transacao.valor_liquido > 0) {
    const categoriaNome = canalNormalizado.includes('mercado_pago') 
      ? "Receita de Vendas – Mercado Pago" 
      : canalNormalizado.includes('shopee')
        ? "Receita de Vendas – Shopee"
        : "Receita de Vendas – Mercado Livre";
    
    const categoriaId = await buscarOuCriarCategoria(categoriaNome, "Receitas");
    const centroCustoId = await buscarOuCriarCentroCusto("Operação – Vendas");

    return {
      categoria_id: categoriaId,
      centro_custo_id: centroCustoId,
      tipo_transacao: "venda",
      tipo_lancamento: "credito",
      conciliado: categoriaId !== null,
      regra_aplicada: "valor_positivo_generico",
    };
  }

  return null;
}

// ============= FUNÇÃO PARA CATEGORIZAÇÃO EM LOTE =============

export async function aplicarCategorizacaoEmLote(
  transacoes: TransacaoParaCategorizacao[],
  onProgress?: (processadas: number, total: number) => void
): Promise<Map<string, CategorizacaoAutomatica>> {
  const resultados = new Map<string, CategorizacaoAutomatica>();
  const total = transacoes.length;
  let processadas = 0;

  // Pré-carregar caches
  await carregarCaches();

  for (const transacao of transacoes) {
    if (!transacao.id) continue;

    try {
      const categorizacao = await aplicarCategorizacaoAutomatica(transacao);
      if (categorizacao) {
        resultados.set(transacao.id, categorizacao);
      }
    } catch (err) {
      console.warn(`[Auto-Cat] Erro ao categorizar transação ${transacao.id}:`, err);
    }

    processadas++;
    if (onProgress && processadas % 100 === 0) {
      onProgress(processadas, total);
    }
  }

  if (onProgress) {
    onProgress(total, total);
  }

  return resultados;
}

// ============= FUNÇÃO PARA ATUALIZAR TRANSAÇÕES NO BANCO =============

export async function atualizarTransacoesComCategorizacao(
  categorizacoes: Map<string, CategorizacaoAutomatica>,
  onProgress?: (atualizadas: number, total: number) => void
): Promise<{ atualizadas: number; erros: number }> {
  let atualizadas = 0;
  let erros = 0;
  const total = categorizacoes.size;
  const BATCH_SIZE = 100;

  const entries = Array.from(categorizacoes.entries());

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    for (const [id, cat] of batch) {
      try {
        const updateData: Record<string, any> = {
          categoria_id: cat.categoria_id,
          centro_custo_id: cat.centro_custo_id,
          tipo_transacao: cat.tipo_transacao,
          tipo_lancamento: cat.tipo_lancamento,
          atualizado_em: new Date().toISOString(),
        };

        // Só marca como conciliado se foi categorizado com sucesso
        if (cat.conciliado && cat.categoria_id) {
          updateData.status = "conciliado";
        }

        const { error } = await supabase
          .from("marketplace_transactions")
          .update(updateData)
          .eq("id", id);

        if (error) {
          console.warn(`[Auto-Cat] Erro ao atualizar transação ${id}:`, error.message);
          erros++;
        } else {
          atualizadas++;
        }
      } catch (err) {
        console.warn(`[Auto-Cat] Erro ao atualizar transação ${id}:`, err);
        erros++;
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, total), total);
    }
  }

  return { atualizadas, erros };
}

// ============= FUNÇÃO COMPLETA: CATEGORIZAR E ATUALIZAR =============

export async function processarCategorizacaoAutomatica(
  transacoes: TransacaoParaCategorizacao[],
  onProgress?: (fase: string, processadas: number, total: number) => void
): Promise<{ categorizadas: number; atualizadas: number; erros: number }> {
  if (transacoes.length === 0) {
    return { categorizadas: 0, atualizadas: 0, erros: 0 };
  }

  console.log(`[Auto-Cat] Iniciando processamento de ${transacoes.length} transações`);

  // Fase 1: Categorizar
  if (onProgress) onProgress("categorizando", 0, transacoes.length);
  
  const categorizacoes = await aplicarCategorizacaoEmLote(
    transacoes,
    (p, t) => onProgress?.("categorizando", p, t)
  );

  console.log(`[Auto-Cat] ${categorizacoes.size} transações categorizadas`);

  // Fase 2: Atualizar no banco
  if (onProgress) onProgress("atualizando", 0, categorizacoes.size);
  
  const { atualizadas, erros } = await atualizarTransacoesComCategorizacao(
    categorizacoes,
    (p, t) => onProgress?.("atualizando", p, t)
  );

  console.log(`[Auto-Cat] ${atualizadas} transações atualizadas, ${erros} erros`);

  return {
    categorizadas: categorizacoes.size,
    atualizadas,
    erros,
  };
}

// ============= FUNÇÃO PARA REPROCESSAR TRANSAÇÕES ANTIGAS =============

export async function reprocessarTransacoesAntigas(
  empresaId?: string,
  onProgress?: (fase: string, processadas: number, total: number) => void
): Promise<{ total: number; categorizadas: number; atualizadas: number; erros: number }> {
  // Limpar caches para garantir dados atualizados
  limparCaches();

  // Buscar transações que precisam de categorização
  let query = supabase
    .from("marketplace_transactions")
    .select("id, canal, descricao, valor_liquido, valor_bruto, tipo_transacao, tipo_lancamento")
    .or("status.eq.importado,categoria_id.is.null");

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  const PAGE_SIZE = 1000;
  let allTransacoes: TransacaoParaCategorizacao[] = [];
  let from = 0;
  let hasMore = true;

  // Buscar todas as transações em lotes
  while (hasMore) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[Auto-Cat] Erro ao buscar transações antigas:", error);
      throw error;
    }

    if (data && data.length > 0) {
      // Cast tipo_lancamento para tipo correto
      const dataTyped: TransacaoParaCategorizacao[] = data.map(t => ({
        ...t,
        tipo_lancamento: t.tipo_lancamento as 'credito' | 'debito' | undefined,
      }));
      allTransacoes = [...allTransacoes, ...dataTyped];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }

    // Limite de segurança
    if (allTransacoes.length >= 50000) {
      hasMore = false;
    }
  }

  console.log(`[Auto-Cat] Encontradas ${allTransacoes.length} transações para reprocessar`);

  if (allTransacoes.length === 0) {
    return { total: 0, categorizadas: 0, atualizadas: 0, erros: 0 };
  }

  const resultado = await processarCategorizacaoAutomatica(allTransacoes, onProgress);

  return {
    total: allTransacoes.length,
    ...resultado,
  };
}
