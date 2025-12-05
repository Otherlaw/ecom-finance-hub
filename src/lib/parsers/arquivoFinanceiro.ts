// src/lib/parsers/arquivoFinanceiro.ts
import * as XLSX from "xlsx";
import Papa from "papaparse";

export type TipoArquivoFinanceiro = "csv" | "xlsx" | "ofx";

// ============= INTERFACE DE RESULTADO DE PARSE COM ESTATÍSTICAS =============
export interface ParseResult {
  transacoes: any[];
  estatisticas: {
    totalLinhasArquivo: number;
    totalTransacoesGeradas: number;
    totalComValorZero: number;
    totalDescartadasPorFormato: number;
    totalLinhasVazias: number;
  };
}

// ============= FUNÇÃO CENTRALIZADA PARA GERAR REFERÊNCIA EXTERNA =============
// Regra "A": referência_externa = ${data}_${pedido}_${valor}_${descricao}
// - Sempre string
// - Sem espaços extras
// - Máximo 150 caracteres
export function gerarReferenciaExterna(params: {
  data: string;
  pedido?: string | null;
  valor: number;
  descricao?: string | null;
  idUnico?: string | null; // Se existir ID único do relatório, usar como prioridade
}): string {
  // Se tiver ID único do relatório, priorizar
  if (params.idUnico && String(params.idUnico).trim()) {
    return String(params.idUnico).trim().substring(0, 150);
  }
  
  // Caso contrário, gerar hash no formato padrão
  const partes = [
    String(params.data || "").trim(),
    String(params.pedido || "").trim(),
    String(params.valor || 0),
    String(params.descricao || "").trim().substring(0, 80),
  ];
  
  return partes
    .map(p => p.replace(/\s+/g, " ").trim())
    .join("_")
    .substring(0, 150);
}

export function detectarTipoArquivo(file: File): TipoArquivoFinanceiro {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "ofx") return "ofx";

  throw new Error("Formato não suportado. Use arquivos CSV, XLSX ou OFX.");
}

// Parser CSV → array de objetos
export async function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => resolve(result.data as any[]),
      error: reject,
    });
  });
}

// Parser XLSX genérico → array de objetos
export async function parseXLSXFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("Nenhuma aba encontrada no arquivo XLSX");
  }

  const json = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return json as any[];
}

// ============= UTILITÁRIOS COMPARTILHADOS =============

const parseNumber = (val: any): number => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val).replace(/[^\d,.\-]/g, "").replace(",", ".");
  return parseFloat(str) || 0;
};

const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const str = String(dateStr).trim();
  // Formato DD/MM/YYYY ou DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    // DD/MM/YYYY → YYYY-MM-DD
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return "";
};

// Função para buscar coluna de forma flexível (case-insensitive, busca parcial)
const findColumnIndex = (header: string[], possibleNames: string[]): number => {
  for (const name of possibleNames) {
    const idx = header.findIndex(h => 
      h && typeof h === "string" && h.toLowerCase().includes(name.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
};

// ============= PARSER MERCADO LIVRE XLSX COM ESTATÍSTICAS =============

export async function parseXLSXMercadoLivre(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // Mercado Livre usa aba 'REPORT'
  const sheet = workbook.Sheets["REPORT"] || workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("Nenhuma aba encontrada no arquivo XLSX");
  }

  // Converte para array de arrays (sem header)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  // Encontra a linha do cabeçalho buscando termos comuns de relatórios ML
  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" &&
        (cell.toLowerCase().includes("data da tarifa") ||
         cell.toLowerCase().includes("tipo de tarifa") ||
         cell.toLowerCase().includes("valor líquido") ||
         cell.toLowerCase().includes("valor liquido"))
    )
  );

  if (headerIndex === -1) {
    // Fallback: usa primeira linha como header
    console.warn("Cabeçalho ML não detectado, usando primeira linha");
  }

  const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]) as string[];
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);

  // Total de linhas do arquivo (sem cabeçalho)
  const totalLinhasArquivo = dataRows.length;

  // Índices das colunas do relatório ML (busca flexível com múltiplas variações)
  const col = {
    dataTarifa: findColumnIndex(header, ["data da tarifa", "data tarifa", "fecha", "data"]),
    tipoTarifa: findColumnIndex(header, ["tipo de tarifa", "tipo tarifa", "detalhe", "descrição", "descricao", "type"]),
    numeroVenda: findColumnIndex(header, ["número da venda", "numero da venda", "order", "pedido", "n° pedido"]),
    canalVendas: findColumnIndex(header, ["canal de vendas", "canal vendas", "channel", "marketplace"]),
    valorTransacao: findColumnIndex(header, ["valor da transação", "valor transação", "valor transacao", "valor bruto", "gross"]),
    valorLiquido: findColumnIndex(header, ["valor líquido", "valor liquido", "subtotal", "net", "total", "valor da tarifa"]),
    // Colunas de ID único para evitar duplicatas
    idTarifa: findColumnIndex(header, ["id da tarifa", "id tarifa", "tarifa id", "id"]),
    idTransacao: findColumnIndex(header, ["id da transação", "id transação", "transaction id", "id transacao"]),
    idInterno: findColumnIndex(header, ["id interno", "id único", "id operação", "operation id"]),
  };

  // Log para debug
  console.log("[parseXLSXMercadoLivre] Colunas detectadas:", col, "Headers:", header.slice(0, 15));
  console.log("[parseXLSXMercadoLivre] Total linhas no arquivo (sem cabeçalho):", totalLinhasArquivo);

  // Apenas data e valor são realmente obrigatórios
  if (col.dataTarifa === -1 || col.valorLiquido === -1) {
    throw new Error(
      `Formato inesperado do relatório ML. Colunas encontradas: data=${col.dataTarifa}, liquido=${col.valorLiquido}. ` +
      `Headers: ${header.slice(0, 10).join(", ")}`
    );
  }

  // Contadores para estatísticas
  let totalComValorZero = 0;
  let totalDescartadasPorFormato = 0;
  let totalLinhasVazias = 0;

  // Mapear linhas para objetos estruturados prontos para importação
  const transacoes: any[] = [];

  for (const r of dataRows) {
    // Verificar se linha está vazia (sem data E sem descrição E sem valores)
    const dataStr = r[col.dataTarifa];
    const descricaoStr = col.tipoTarifa >= 0 ? r[col.tipoTarifa] : "";
    const bruto = parseNumber(r[col.valorTransacao]);
    const liquido = parseNumber(r[col.valorLiquido]);

    const dataValida = normalizeDate(dataStr);
    const temData = !!dataValida;
    const temDescricao = !!descricaoStr && String(descricaoStr).trim().length > 0;
    const temValor = !isNaN(bruto) && bruto !== 0 || !isNaN(liquido) && liquido !== 0;

    // Só descartar se não tem NADA (sem data E sem descrição E sem valor)
    if (!temData && !temDescricao && !temValor) {
      totalLinhasVazias++;
      continue;
    }

    // Contar linhas com valor zero (mas que serão importadas se tiverem outros dados)
    if (liquido === 0 && bruto === 0) {
      totalComValorZero++;
    }

    // Se não tem data válida, descartar (necessário para ordenação/agrupamento)
    if (!temData) {
      totalDescartadasPorFormato++;
      continue;
    }

    // Descrição: usa tipoTarifa se disponível, senão tenta outras colunas
    let descricao = "Transação ML";
    if (col.tipoTarifa >= 0 && r[col.tipoTarifa]) {
      descricao = String(r[col.tipoTarifa]).trim();
    } else if (col.valorTransacao >= 0 && r[col.valorTransacao]) {
      descricao = `Tarifa: R$ ${bruto.toFixed(2)}`;
    }

    // Obter ID único para referencia_externa (prevenir duplicatas)
    let idUnico = "";
    if (col.idTarifa >= 0 && r[col.idTarifa]) {
      idUnico = String(r[col.idTarifa]).trim();
    } else if (col.idTransacao >= 0 && r[col.idTransacao]) {
      idUnico = String(r[col.idTransacao]).trim();
    } else if (col.idInterno >= 0 && r[col.idInterno]) {
      idUnico = String(r[col.idInterno]).trim();
    }

    const pedidoId = col.numeroVenda >= 0 ? r[col.numeroVenda]?.toString().trim() || null : null;
    const canalVenda = col.canalVendas >= 0 ? r[col.canalVendas]?.toString().trim() || null : null;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: pedidoId,
      valor: liquido || bruto,
      descricao,
      idUnico: idUnico || null,
    });

    transacoes.push({
      origem: "marketplace" as const,
      canal: "mercado_livre" as const,
      data_transacao: dataValida,
      descricao,
      pedido_id: pedidoId,
      canal_venda: canalVenda,
      valor_bruto: bruto || liquido,
      valor_liquido: liquido || bruto,
      referencia_externa: referenciaExterna,
    });
  }

  const totalTransacoesGeradas = transacoes.length;

  console.log("[parseXLSXMercadoLivre] Estatísticas:", {
    totalLinhasArquivo,
    totalTransacoesGeradas,
    totalComValorZero,
    totalDescartadasPorFormato,
    totalLinhasVazias,
  });

  return {
    transacoes,
    estatisticas: {
      totalLinhasArquivo,
      totalTransacoesGeradas,
      totalComValorZero,
      totalDescartadasPorFormato,
      totalLinhasVazias,
    },
  };
}

// ============= PARSER MERCADO PAGO XLSX/CSV COM ESTATÍSTICAS =============

// Parser para Relatório de Faturamento/Tarifas do Mercado Pago (formato CSV brasileiro)
export async function parseCSVMercadoPagoFaturamento(rows: any[]): Promise<ParseResult> {
  if (!rows || rows.length === 0) {
    return {
      transacoes: [],
      estatisticas: {
        totalLinhasArquivo: 0,
        totalTransacoesGeradas: 0,
        totalComValorZero: 0,
        totalDescartadasPorFormato: 0,
        totalLinhasVazias: 0,
      },
    };
  }

  const totalLinhasArquivo = rows.length;
  let totalComValorZero = 0;
  let totalDescartadasPorFormato = 0;
  let totalLinhasVazias = 0;

  // Colunas do Relatório de Faturamento MP
  const col = {
    data: findColumnIndex(Object.keys(rows[0]), [
      "data do movimento", "data movimento", "data", "fecha"
    ]),
    detalhe: findColumnIndex(Object.keys(rows[0]), [
      "detalhe", "descrição", "descricao", "detail"
    ]),
    valorTarifa: findColumnIndex(Object.keys(rows[0]), [
      "valor da tarifa", "valor tarifa", "tarifa"
    ]),
    valorOperacao: findColumnIndex(Object.keys(rows[0]), [
      "valor da operação", "valor operação", "valor operacao"
    ]),
    tipoOperacao: findColumnIndex(Object.keys(rows[0]), [
      "tipo de operação", "tipo operação", "tipo operacao", "tipo"
    ]),
    numeroMovimento: findColumnIndex(Object.keys(rows[0]), [
      "número do movimento", "numero do movimento", "numero movimento"
    ]),
    nfe: findColumnIndex(Object.keys(rows[0]), [
      "n° nf-e", "nf-e", "nota fiscal", "nfe"
    ]),
    statusTarifa: findColumnIndex(Object.keys(rows[0]), [
      "status da tarifa", "status tarifa", "status"
    ]),
    tarifaEstornada: findColumnIndex(Object.keys(rows[0]), [
      "tarifa estornada", "estornada"
    ]),
  };

  const keys = Object.keys(rows[0]);
  console.log("[parseCSVMercadoPagoFaturamento] Colunas:", col, "Keys:", keys);

  const transacoes: any[] = [];

  for (const r of rows) {
    const data = r[keys[col.data]] || r["Data do movimento"] || "";
    const detalhe = r[keys[col.detalhe]] || r["Detalhe"] || "Tarifa MP";
    const valorTarifa = parseNumber(r[keys[col.valorTarifa]] || r["Valor da tarifa"]);
    const valorOperacao = parseNumber(r[keys[col.valorOperacao]] || r["Valor da operação"]);
    const tipoOp = r[keys[col.tipoOperacao]] || r["Tipo de operação"] || "";
    const numMov = r[keys[col.numeroMovimento]] || r["Número do movimento"] || "";
    const estornada = r[keys[col.tarifaEstornada]] || r["Tarifa estornada"] || "";

    const dataValida = normalizeDate(data);
    const temData = !!dataValida;
    const temDescricao = !!detalhe && String(detalhe).trim().length > 0;
    const temValor = valorTarifa !== 0 || valorOperacao !== 0;

    if (!temData && !temDescricao && !temValor) {
      totalLinhasVazias++;
      continue;
    }

    if (valorTarifa === 0 && valorOperacao === 0) {
      totalComValorZero++;
    }

    if (!temData) {
      totalDescartadasPorFormato++;
      continue;
    }

    const isEstorno = estornada && estornada.trim().length > 0;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: numMov?.toString().trim() || null,
      valor: valorTarifa,
      descricao: detalhe,
      idUnico: numMov?.toString().trim() || null,
    });

    transacoes.push({
      origem: "marketplace" as const,
      canal: "mercado_pago" as const,
      data_transacao: dataValida,
      descricao: detalhe,
      pedido_id: numMov?.toString().trim() || null,
      referencia_externa: referenciaExterna,
      valor_bruto: valorOperacao || valorTarifa,
      valor_liquido: valorTarifa,
      tarifas: isEstorno ? 0 : valorTarifa,
      tipo_transacao: tipoOp.toLowerCase() || "tarifa",
      tipo_lancamento: isEstorno ? "credito" : "debito",
    });
  }

  console.log("[parseCSVMercadoPagoFaturamento] Estatísticas:", {
    totalLinhasArquivo,
    totalTransacoesGeradas: transacoes.length,
    totalComValorZero,
    totalDescartadasPorFormato,
    totalLinhasVazias,
  });

  return {
    transacoes,
    estatisticas: {
      totalLinhasArquivo,
      totalTransacoesGeradas: transacoes.length,
      totalComValorZero,
      totalDescartadasPorFormato,
      totalLinhasVazias,
    },
  };
}

export async function parseXLSXMercadoPago(file: File): Promise<ParseResult> {
  const fileExt = file.name.split(".").pop()?.toLowerCase();
  
  // Se é CSV, parse com PapaParse primeiro
  if (fileExt === "csv") {
    const rows = await parseCSVFile(file);
    
    // Verifica se é formato de Faturamento/Tarifas
    if (rows[0] && (
      Object.keys(rows[0]).some(k => k.toLowerCase().includes("valor da tarifa")) ||
      Object.keys(rows[0]).some(k => k.toLowerCase().includes("data do movimento"))
    )) {
      console.log("Detectado formato Relatório de Faturamento MP");
      return parseCSVMercadoPagoFaturamento(rows);
    }
    
    // Senão, tenta formato de extrato de vendas
    return parseCSVMercadoPagoVendas(rows);
  }

  // XLSX
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheet = workbook.Sheets["Relatório"] || 
                workbook.Sheets["Report"] || 
                workbook.Sheets["Movimentos"] ||
                workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("Nenhuma aba encontrada no arquivo XLSX");
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  // Encontra header
  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" &&
        (cell.toLowerCase().includes("data de criação") ||
         cell.toLowerCase().includes("date_created") ||
         cell.toLowerCase().includes("transaction_amount") ||
         cell.toLowerCase().includes("valor da transação") ||
         cell.toLowerCase().includes("valor da tarifa") ||
         cell.toLowerCase().includes("data do movimento"))
    )
  );

  const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]) as string[];
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);

  console.log("Headers MP detectados:", header.slice(0, 20));

  // Verifica se é formato de Faturamento
  if (header.some(h => h && typeof h === "string" && h.toLowerCase().includes("valor da tarifa"))) {
    const rowObjs = dataRows.map(r => {
      const obj: any = {};
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    return parseCSVMercadoPagoFaturamento(rowObjs);
  }

  // Formato de extrato de vendas
  return parseXLSXMercadoPagoVendas(header, dataRows);
}

// Parser para extrato de VENDAS do Mercado Pago (API export)
function parseCSVMercadoPagoVendas(rows: any[]): ParseResult {
  if (!rows || rows.length === 0) {
    return {
      transacoes: [],
      estatisticas: {
        totalLinhasArquivo: 0,
        totalTransacoesGeradas: 0,
        totalComValorZero: 0,
        totalDescartadasPorFormato: 0,
        totalLinhasVazias: 0,
      },
    };
  }

  const totalLinhasArquivo = rows.length;
  let totalComValorZero = 0;
  let totalDescartadasPorFormato = 0;
  let totalLinhasVazias = 0;
  
  const keys = Object.keys(rows[0]);
  
  const col = {
    data: findColumnIndex(keys, [
      "date_created", "data de criação", "data", "fecha", "date",
      "data de liberação", "date_approved", "money_release_date"
    ]),
    referencia: findColumnIndex(keys, [
      "id", "operation_id", "id da operação", "reference", "external_reference",
      "referência externa", "source_id"
    ]),
    tipo: findColumnIndex(keys, [
      "operation_type", "tipo de operação", "tipo", "type", "reason",
      "transaction_type", "tipo de transação", "payment_type"
    ]),
    descricao: findColumnIndex(keys, [
      "description", "descrição", "descricao", "reason", "motivo",
      "detail", "detalhe", "item_title", "título"
    ]),
    valorBruto: findColumnIndex(keys, [
      "transaction_amount", "valor da transação", "valor bruto", "gross_amount",
      "total_paid_amount", "valor total", "amount"
    ]),
    tarifa: findColumnIndex(keys, [
      "fee_amount", "marketplace_fee", "tarifa", "comissão", "commission",
      "mercadopago_fee", "mp_fee", "taxa mercadopago"
    ]),
    valorLiquido: findColumnIndex(keys, [
      "net_received_amount", "valor líquido recebido", "valor líquido", "net_amount",
      "valor_liquido", "net", "total received"
    ]),
    status: findColumnIndex(keys, ["status", "status_detail", "situação", "state"]),
    pedido: findColumnIndex(keys, [
      "order_id", "id do pedido", "pedido", "external_reference", 
      "referência externa", "merchant_order_id"
    ]),
  };

  const transacoes: any[] = [];

  for (const r of rows) {
    const bruto = parseNumber(r[keys[col.valorBruto]]);
    const tarifa = Math.abs(parseNumber(r[keys[col.tarifa]]));
    let liquido = parseNumber(r[keys[col.valorLiquido]]);
    
    if (!liquido && bruto) liquido = bruto - tarifa;

    const dataStr = r[keys[col.data]];
    const dataValida = normalizeDate(dataStr);
    const temData = !!dataValida;
    const temValor = bruto !== 0 || liquido !== 0;

    let descricao = "Transação MP";
    if (col.descricao >= 0 && r[keys[col.descricao]]) {
      descricao = String(r[keys[col.descricao]]).trim();
    } else if (col.tipo >= 0 && r[keys[col.tipo]]) {
      descricao = String(r[keys[col.tipo]]).trim();
    }

    const temDescricao = descricao !== "Transação MP";

    if (!temData && !temDescricao && !temValor) {
      totalLinhasVazias++;
      continue;
    }

    if (liquido === 0 && bruto === 0) {
      totalComValorZero++;
    }

    const status = col.status >= 0 ? String(r[keys[col.status]] || "").toLowerCase() : "";
    
    // Filtrar status inválidos
    if (status.includes("pending") || status.includes("cancelled") || status.includes("rejected")) {
      totalDescartadasPorFormato++;
      continue;
    }

    if (!temData) {
      totalDescartadasPorFormato++;
      continue;
    }

    const tipoOp = col.tipo >= 0 ? String(r[keys[col.tipo]] || "").toLowerCase() : "";
    const isDebito = tipoOp.includes("refund") || 
                     tipoOp.includes("chargeback") || 
                     tipoOp.includes("estorno") ||
                     tipoOp.includes("devolução") ||
                     liquido < 0;

    const pedidoId = col.pedido >= 0 ? r[keys[col.pedido]]?.toString().trim() || null : 
                     col.referencia >= 0 ? r[keys[col.referencia]]?.toString().trim() || null : null;
    const idUnico = col.referencia >= 0 ? r[keys[col.referencia]]?.toString().trim() || null : null;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: pedidoId,
      valor: Math.abs(liquido) || Math.abs(bruto),
      descricao,
      idUnico,
    });

    transacoes.push({
      origem: "marketplace" as const,
      canal: "mercado_pago" as const,
      data_transacao: dataValida,
      descricao,
      pedido_id: pedidoId,
      referencia_externa: referenciaExterna,
      valor_bruto: Math.abs(bruto) || Math.abs(liquido),
      valor_liquido: Math.abs(liquido) || Math.abs(bruto),
      tarifas: tarifa,
      tipo_transacao: tipoOp || "payment",
      tipo_lancamento: isDebito ? "debito" : "credito",
    });
  }

  console.log("[parseCSVMercadoPagoVendas] Estatísticas:", {
    totalLinhasArquivo,
    totalTransacoesGeradas: transacoes.length,
    totalComValorZero,
    totalDescartadasPorFormato,
    totalLinhasVazias,
  });

  return {
    transacoes,
    estatisticas: {
      totalLinhasArquivo,
      totalTransacoesGeradas: transacoes.length,
      totalComValorZero,
      totalDescartadasPorFormato,
      totalLinhasVazias,
    },
  };
}

// Parser XLSX para extrato de vendas MP
function parseXLSXMercadoPagoVendas(header: string[], dataRows: any[][]): ParseResult {
  const totalLinhasArquivo = dataRows.length;
  let totalComValorZero = 0;
  let totalDescartadasPorFormato = 0;
  let totalLinhasVazias = 0;

  const col = {
    data: findColumnIndex(header, [
      "date_created", "data de criação", "data", "fecha", "date",
      "data de liberação", "date_approved", "money_release_date"
    ]),
    referencia: findColumnIndex(header, [
      "id", "operation_id", "id da operação", "reference", "external_reference"
    ]),
    tipo: findColumnIndex(header, [
      "operation_type", "tipo de operação", "tipo", "type", "reason"
    ]),
    descricao: findColumnIndex(header, [
      "description", "descrição", "descricao", "reason", "motivo", "detalhe"
    ]),
    valorBruto: findColumnIndex(header, [
      "transaction_amount", "valor da transação", "valor bruto", "gross_amount"
    ]),
    tarifa: findColumnIndex(header, [
      "fee_amount", "marketplace_fee", "tarifa", "comissão"
    ]),
    valorLiquido: findColumnIndex(header, [
      "net_received_amount", "valor líquido recebido", "valor líquido", "net_amount"
    ]),
    status: findColumnIndex(header, ["status", "status_detail", "situação"]),
    pedido: findColumnIndex(header, ["order_id", "id do pedido", "pedido", "external_reference"]),
  };

  if (col.data === -1 && col.valorBruto === -1 && col.valorLiquido === -1) {
    throw new Error(
      `Formato não reconhecido do relatório Mercado Pago. ` +
      `Headers encontrados: ${header.slice(0, 15).join(", ")}`
    );
  }

  const transacoes: any[] = [];

  for (const r of dataRows) {
    const bruto = parseNumber(r[col.valorBruto]);
    const tarifa = Math.abs(parseNumber(r[col.tarifa]));
    let liquido = parseNumber(r[col.valorLiquido]);
    
    if (!liquido && bruto) liquido = bruto - tarifa;

    const dataStr = r[col.data];
    const dataValida = normalizeDate(dataStr);
    const temData = !!dataValida;
    const temValor = bruto !== 0 || liquido !== 0;

    let descricao = "Transação MP";
    if (col.descricao >= 0 && r[col.descricao]) {
      descricao = String(r[col.descricao]).trim();
    } else if (col.tipo >= 0 && r[col.tipo]) {
      descricao = String(r[col.tipo]).trim();
    }

    const temDescricao = descricao !== "Transação MP";

    if (!temData && !temDescricao && !temValor) {
      totalLinhasVazias++;
      continue;
    }

    if (liquido === 0 && bruto === 0) {
      totalComValorZero++;
    }

    const status = col.status >= 0 ? String(r[col.status] || "").toLowerCase() : "";
    
    if (status.includes("pending") || status.includes("cancelled") || status.includes("rejected")) {
      totalDescartadasPorFormato++;
      continue;
    }

    if (!temData) {
      totalDescartadasPorFormato++;
      continue;
    }

    const tipoOp = col.tipo >= 0 ? String(r[col.tipo] || "").toLowerCase() : "";
    const isDebito = tipoOp.includes("refund") || 
                     tipoOp.includes("chargeback") || 
                     tipoOp.includes("estorno") ||
                     tipoOp.includes("devolução") ||
                     liquido < 0;

    const pedidoId = col.pedido >= 0 ? r[col.pedido]?.toString().trim() || null : 
                     col.referencia >= 0 ? r[col.referencia]?.toString().trim() || null : null;
    const idUnico = col.referencia >= 0 ? r[col.referencia]?.toString().trim() || null : null;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: pedidoId,
      valor: Math.abs(liquido) || Math.abs(bruto),
      descricao,
      idUnico,
    });

    transacoes.push({
      origem: "marketplace" as const,
      canal: "mercado_pago" as const,
      data_transacao: dataValida,
      descricao,
      pedido_id: pedidoId,
      referencia_externa: referenciaExterna,
      valor_bruto: Math.abs(bruto) || Math.abs(liquido),
      valor_liquido: Math.abs(liquido) || Math.abs(bruto),
      tarifas: tarifa,
      tipo_transacao: tipoOp || "payment",
      tipo_lancamento: isDebito ? "debito" : "credito",
    });
  }

  console.log("[parseXLSXMercadoPagoVendas] Estatísticas:", {
    totalLinhasArquivo,
    totalTransacoesGeradas: transacoes.length,
    totalComValorZero,
    totalDescartadasPorFormato,
    totalLinhasVazias,
  });

  return {
    transacoes,
    estatisticas: {
      totalLinhasArquivo,
      totalTransacoesGeradas: transacoes.length,
      totalComValorZero,
      totalDescartadasPorFormato,
      totalLinhasVazias,
    },
  };
}
