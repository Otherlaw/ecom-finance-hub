/**
 * CHECKLIST - IMPORTAÇÃO DE RELATÓRIOS DE MARKETPLACE
 * 
 * Motor de fechamento: gera eventos financeiros (marketplace_financial_events)
 * com origem='report' para complementar/sobrescrever dados da API.
 * 
 * REGRAS DE ARQUITETURA:
 * 1. Relatórios geram APENAS eventos financeiros (comissao, tarifa, frete, ads, etc.)
 * 2. NUNCA criar transações de venda aqui (vendas vêm do sync de pedidos)
 * 3. NUNCA criar movimentos de caixa aqui (caixa vem de OFX/repasses)
 * 4. Eventos do relatório têm PRIORIDADE sobre eventos da API
 * 5. UPSERT idempotente por event_id determinístico
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TIPOS =============

export interface EventoFinanceiroImportado {
  pedido_id: string;
  data_evento: string;
  tipo_evento: 'comissao' | 'tarifa_fixa' | 'tarifa_financeira' | 'frete_vendedor' | 'ads' | 'estorno' | 'cancelamento' | 'ajuste' | 'outros';
  valor: number;
  descricao?: string;
  conta_nome?: string;
}

export interface LinhaRelatorio {
  pedido_id?: string;
  data?: string;
  comissao?: number;
  tarifa_fixa?: number;
  tarifa_financeira?: number;
  frete_vendedor?: number;
  ads?: number;
  estorno?: number;
  ajuste?: number;
  outros?: number;
  conta_nome?: string;
  descricao?: string;
  referencia?: string;
}

export interface ResultadoImportacao {
  totalLinhasProcessadas: number;
  eventosGerados: number;
  eventosAtualizados: number;
  linhasSemPedidoId: number;
  linhasIgnoradas: number;
  erros: string[];
  resumoPorTipo: Record<string, { qtd: number; valor: number }>;
}

// ============= GERADOR DE EVENT_ID DETERMINÍSTICO =============

/**
 * Gera um event_id único e determinístico baseado nos dados do evento.
 * Permite UPSERT idempotente (rodar múltiplas vezes sem duplicar).
 */
function gerarEventId(
  pedidoId: string,
  tipoEvento: string,
  canal: string,
  origem: string = 'report'
): string {
  // Formato: report_{canal}_{pedido_id}_{tipo_evento}
  const base = `${origem}_${canal}_${pedidoId}_${tipoEvento}`;
  // Limpar caracteres especiais
  return base.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 100);
}

// ============= PARSER DE LINHAS PARA EVENTOS =============

/**
 * Transforma uma linha do relatório em múltiplos eventos financeiros.
 * Cada tipo de custo vira um evento separado para granularidade.
 */
function linhaParaEventos(
  linha: LinhaRelatorio,
  empresaId: string,
  canal: string,
  contaNome?: string
): EventoFinanceiroImportado[] {
  const eventos: EventoFinanceiroImportado[] = [];
  
  if (!linha.pedido_id || !linha.pedido_id.trim()) {
    return eventos; // Ignorar linhas sem pedido_id
  }

  const pedidoId = linha.pedido_id.trim();
  const dataEvento = linha.data || new Date().toISOString();
  const conta = linha.conta_nome || contaNome;

  // Mapear cada tipo de custo para um evento
  const tiposValores: Array<{ tipo: EventoFinanceiroImportado['tipo_evento']; valor?: number }> = [
    { tipo: 'comissao', valor: linha.comissao },
    { tipo: 'tarifa_fixa', valor: linha.tarifa_fixa },
    { tipo: 'tarifa_financeira', valor: linha.tarifa_financeira },
    { tipo: 'frete_vendedor', valor: linha.frete_vendedor },
    { tipo: 'ads', valor: linha.ads },
    { tipo: 'estorno', valor: linha.estorno },
    { tipo: 'ajuste', valor: linha.ajuste },
    { tipo: 'outros', valor: linha.outros },
  ];

  for (const { tipo, valor } of tiposValores) {
    if (valor !== undefined && valor !== null && valor !== 0) {
      eventos.push({
        pedido_id: pedidoId,
        data_evento: dataEvento,
        tipo_evento: tipo,
        valor: Math.abs(valor), // Sempre positivo, o tipo indica se é custo
        descricao: linha.descricao || `${tipo} - Relatório`,
        conta_nome: conta,
      });
    }
  }

  return eventos;
}

// ============= FUNÇÃO PRINCIPAL DE IMPORTAÇÃO =============

/**
 * Importa eventos financeiros de um relatório de marketplace.
 * 
 * COMPORTAMENTO:
 * 1. Parseia linhas do relatório
 * 2. Gera eventos por tipo (comissao, tarifa, etc.)
 * 3. UPSERT em marketplace_financial_events com origem='report'
 * 4. Eventos do relatório sobrescrevem eventos da API (mesma constraint)
 */
export async function importarRelatorioParaEventos(
  linhas: LinhaRelatorio[],
  empresaId: string,
  canal: string,
  contaNomePadrao?: string,
  batchId?: string
): Promise<ResultadoImportacao> {
  const resultado: ResultadoImportacao = {
    totalLinhasProcessadas: 0,
    eventosGerados: 0,
    eventosAtualizados: 0,
    linhasSemPedidoId: 0,
    linhasIgnoradas: 0,
    erros: [],
    resumoPorTipo: {},
  };

  // Normalizar nome do canal
  const canalNormalizado = normalizarCanal(canal);
  
  // Converter linhas em eventos
  const todosEventos: Array<{
    empresa_id: string;
    canal: string;
    conta_nome: string | null;
    event_id: string;
    pedido_id: string;
    tipo_evento: string;
    data_evento: string;
    valor: number;
    descricao: string | null;
    origem: string;
    batch_id: string | null;
    metadados: { fonte: string; importado_em: string };
  }> = [];

  for (const linha of linhas) {
    resultado.totalLinhasProcessadas++;

    if (!linha.pedido_id || !linha.pedido_id.trim()) {
      resultado.linhasSemPedidoId++;
      continue;
    }

    const eventosLinha = linhaParaEventos(linha, empresaId, canalNormalizado, contaNomePadrao);
    
    if (eventosLinha.length === 0) {
      resultado.linhasIgnoradas++;
      continue;
    }

    for (const evento of eventosLinha) {
      const eventId = gerarEventId(evento.pedido_id, evento.tipo_evento, canalNormalizado);
      
      todosEventos.push({
        empresa_id: empresaId,
        canal: canalNormalizado,
        conta_nome: evento.conta_nome || null,
        event_id: eventId,
        pedido_id: evento.pedido_id,
        tipo_evento: evento.tipo_evento,
        data_evento: evento.data_evento,
        valor: evento.valor,
        descricao: evento.descricao || null,
        origem: 'report',
        batch_id: batchId || null,
        metadados: {
          fonte: 'checklist_importacao',
          importado_em: new Date().toISOString(),
        },
      });

      // Contabilizar resumo
      if (!resultado.resumoPorTipo[evento.tipo_evento]) {
        resultado.resumoPorTipo[evento.tipo_evento] = { qtd: 0, valor: 0 };
      }
      resultado.resumoPorTipo[evento.tipo_evento].qtd++;
      resultado.resumoPorTipo[evento.tipo_evento].valor += evento.valor;
    }
  }

  // Inserir em lotes de 500 (limite Supabase)
  const BATCH_SIZE = 500;
  for (let i = 0; i < todosEventos.length; i += BATCH_SIZE) {
    const lote = todosEventos.slice(i, i + BATCH_SIZE);
    
    const { error, count } = await supabase
      .from("marketplace_financial_events")
      .upsert(lote, {
        onConflict: "empresa_id,canal,event_id",
        ignoreDuplicates: false, // Atualizar se existir
      });

    if (error) {
      resultado.erros.push(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      resultado.eventosGerados += lote.length;
    }
  }

  return resultado;
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Normaliza o nome do canal para formato padrão
 */
export function normalizarCanal(canal: string): string {
  const mapa: Record<string, string> = {
    'mercado livre': 'mercado_livre',
    'mercadolivre': 'mercado_livre',
    'ml': 'mercado_livre',
    'shopee': 'shopee',
    'shein': 'shein',
    'tiktok': 'tiktok',
    'tiktok shop': 'tiktok',
    'amazon': 'amazon',
    'magalu': 'magalu',
    'magazine luiza': 'magalu',
  };
  
  const canalLower = canal.toLowerCase().trim();
  return mapa[canalLower] || canalLower.replace(/\s+/g, '_');
}

/**
 * Valida se o período do arquivo corresponde ao checklist
 */
export function validarPeriodoArquivo(
  datasArquivo: string[],
  mesChecklist: number,
  anoChecklist: number
): { valido: boolean; mensagem: string; percentualDentro: number } {
  if (datasArquivo.length === 0) {
    return { valido: false, mensagem: "Nenhuma data encontrada no arquivo", percentualDentro: 0 };
  }

  let dentroPeríodo = 0;
  let foraPeríodo = 0;

  for (const dataStr of datasArquivo) {
    if (!dataStr) continue;
    
    const data = new Date(dataStr);
    if (isNaN(data.getTime())) continue;

    const mesArquivo = data.getMonth() + 1;
    const anoArquivo = data.getFullYear();

    if (mesArquivo === mesChecklist && anoArquivo === anoChecklist) {
      dentroPeríodo++;
    } else {
      foraPeríodo++;
    }
  }

  const total = dentroPeríodo + foraPeríodo;
  if (total === 0) {
    return { valido: false, mensagem: "Nenhuma data válida encontrada", percentualDentro: 0 };
  }

  const percentualDentro = (dentroPeríodo / total) * 100;

  if (percentualDentro >= 80) {
    return { 
      valido: true, 
      mensagem: `${percentualDentro.toFixed(0)}% das transações são do período`,
      percentualDentro 
    };
  }

  const mesNome = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ][mesChecklist - 1];

  return {
    valido: false,
    mensagem: `Atenção: Apenas ${percentualDentro.toFixed(0)}% das transações são de ${mesNome}/${anoChecklist}. ` +
              `O arquivo pode ser de outro período.`,
    percentualDentro
  };
}

/**
 * Busca resumo de completude do mês para um canal
 */
export async function buscarCompletudeMes(
  empresaId: string,
  canal: string,
  mes: number,
  ano: number
): Promise<{
  totalPedidos: number;
  pedidosComEventosReport: number;
  pedidosApenasApi: number;
  percentualCompleto: number;
  tiposEventosFaltando: string[];
}> {
  const canalNormalizado = normalizarCanal(canal);
  
  // Data range do mês
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0); // Último dia do mês

  // Buscar pedidos do período
  const { data: transacoes, error: errTransacoes } = await supabase
    .from("marketplace_transactions")
    .select("pedido_id")
    .eq("empresa_id", empresaId)
    .eq("canal", canalNormalizado)
    .eq("tipo_transacao", "venda")
    .gte("data_transacao", dataInicio.toISOString())
    .lte("data_transacao", dataFim.toISOString());

  if (errTransacoes) {
    console.error("Erro ao buscar transações:", errTransacoes);
    return {
      totalPedidos: 0,
      pedidosComEventosReport: 0,
      pedidosApenasApi: 0,
      percentualCompleto: 0,
      tiposEventosFaltando: [],
    };
  }

  const pedidoIds = [...new Set((transacoes || []).map(t => t.pedido_id).filter(Boolean))];
  const totalPedidos = pedidoIds.length;

  if (totalPedidos === 0) {
    return {
      totalPedidos: 0,
      pedidosComEventosReport: 0,
      pedidosApenasApi: 0,
      percentualCompleto: 100,
      tiposEventosFaltando: [],
    };
  }

  // Buscar eventos financeiros dos pedidos
  const { data: eventos, error: errEventos } = await supabase
    .from("marketplace_financial_events")
    .select("pedido_id, origem, tipo_evento")
    .eq("empresa_id", empresaId)
    .eq("canal", canalNormalizado)
    .in("pedido_id", pedidoIds);

  if (errEventos) {
    console.error("Erro ao buscar eventos:", errEventos);
    return {
      totalPedidos,
      pedidosComEventosReport: 0,
      pedidosApenasApi: totalPedidos,
      percentualCompleto: 0,
      tiposEventosFaltando: ['comissao', 'tarifa_fixa'],
    };
  }

  // Agrupar por pedido_id
  const eventosPorPedido = new Map<string, { temReport: boolean; tipos: Set<string> }>();
  for (const evento of eventos || []) {
    if (!evento.pedido_id) continue;
    
    if (!eventosPorPedido.has(evento.pedido_id)) {
      eventosPorPedido.set(evento.pedido_id, { temReport: false, tipos: new Set() });
    }
    
    const info = eventosPorPedido.get(evento.pedido_id)!;
    if (evento.origem === 'report') {
      info.temReport = true;
    }
    info.tipos.add(evento.tipo_evento);
  }

  let pedidosComReport = 0;
  let pedidosApenasApi = 0;
  const todosTipos = new Set<string>();

  for (const pedidoId of pedidoIds) {
    const info = eventosPorPedido.get(pedidoId);
    if (info?.temReport) {
      pedidosComReport++;
    } else if (info) {
      pedidosApenasApi++;
    }
    info?.tipos.forEach(t => todosTipos.add(t));
  }

  // Tipos esperados vs encontrados
  const tiposEsperados = ['comissao', 'tarifa_fixa'];
  const tiposFaltando = tiposEsperados.filter(t => !todosTipos.has(t));

  const percentualCompleto = totalPedidos > 0 
    ? Math.round((pedidosComReport / totalPedidos) * 100) 
    : 0;

  return {
    totalPedidos,
    pedidosComEventosReport: pedidosComReport,
    pedidosApenasApi,
    percentualCompleto,
    tiposEventosFaltando: tiposFaltando,
  };
}

// ============= PARSER DE CSV GENÉRICO =============

export interface ColunasMapeamento {
  pedido_id: string;
  data?: string;
  comissao?: string;
  tarifa_fixa?: string;
  tarifa_financeira?: string;
  frete_vendedor?: string;
  ads?: string;
  estorno?: string;
  conta_nome?: string;
}

/**
 * Parseia um CSV com mapeamento de colunas flexível
 */
export function parsearCSVParaLinhas(
  csvData: string[][],
  mapeamento: ColunasMapeamento,
  headerRow: number = 0
): LinhaRelatorio[] {
  const linhas: LinhaRelatorio[] = [];
  const headers = csvData[headerRow].map(h => h.toLowerCase().trim());
  
  const getColIndex = (colName?: string): number => {
    if (!colName) return -1;
    return headers.findIndex(h => h.includes(colName.toLowerCase()));
  };

  const indices = {
    pedido_id: getColIndex(mapeamento.pedido_id),
    data: getColIndex(mapeamento.data),
    comissao: getColIndex(mapeamento.comissao),
    tarifa_fixa: getColIndex(mapeamento.tarifa_fixa),
    tarifa_financeira: getColIndex(mapeamento.tarifa_financeira),
    frete_vendedor: getColIndex(mapeamento.frete_vendedor),
    ads: getColIndex(mapeamento.ads),
    estorno: getColIndex(mapeamento.estorno),
    conta_nome: getColIndex(mapeamento.conta_nome),
  };

  const parseNumero = (val: string | undefined): number | undefined => {
    if (!val) return undefined;
    const num = parseFloat(val.replace(',', '.').replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? undefined : num;
  };

  for (let i = headerRow + 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (!row || row.length === 0) continue;

    const linha: LinhaRelatorio = {
      pedido_id: indices.pedido_id >= 0 ? row[indices.pedido_id]?.trim() : undefined,
      data: indices.data >= 0 ? row[indices.data] : undefined,
      comissao: parseNumero(indices.comissao >= 0 ? row[indices.comissao] : undefined),
      tarifa_fixa: parseNumero(indices.tarifa_fixa >= 0 ? row[indices.tarifa_fixa] : undefined),
      tarifa_financeira: parseNumero(indices.tarifa_financeira >= 0 ? row[indices.tarifa_financeira] : undefined),
      frete_vendedor: parseNumero(indices.frete_vendedor >= 0 ? row[indices.frete_vendedor] : undefined),
      ads: parseNumero(indices.ads >= 0 ? row[indices.ads] : undefined),
      estorno: parseNumero(indices.estorno >= 0 ? row[indices.estorno] : undefined),
      conta_nome: indices.conta_nome >= 0 ? row[indices.conta_nome]?.trim() : undefined,
    };

    linhas.push(linha);
  }

  return linhas;
}

// ============= MAPEAMENTOS PRÉ-DEFINIDOS POR CANAL =============

export const MAPEAMENTOS_CANAIS: Record<string, ColunasMapeamento> = {
  mercado_livre: {
    pedido_id: 'id da venda',
    data: 'data da tarifa',
    comissao: 'comissão',
    tarifa_fixa: 'tarifa fixa',
    tarifa_financeira: 'custo de envio',
    frete_vendedor: 'frete pago pelo vendedor',
    ads: 'product ads',
  },
  shopee: {
    pedido_id: 'no. do pedido',
    data: 'data do pedido',
    comissao: 'taxa de comissão',
    tarifa_fixa: 'taxa de serviço',
    frete_vendedor: 'frete pago pelo vendedor',
    ads: 'taxa de anúncio',
  },
  shein: {
    pedido_id: 'order id',
    data: 'order date',
    comissao: 'commission',
    tarifa_fixa: 'service fee',
  },
};
