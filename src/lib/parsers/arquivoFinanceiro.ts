// src/lib/parsers/arquivoFinanceiro.ts
import * as XLSX from "xlsx";
import Papa from "papaparse";

export type TipoArquivoFinanceiro = "csv" | "xlsx" | "ofx";

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
  if (!dateStr) return new Date().toISOString().split("T")[0];
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
  return new Date().toISOString().split("T")[0];
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

// ============= PARSER MERCADO LIVRE XLSX =============

export async function parseXLSXMercadoLivre(file: File): Promise<any[]> {
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

  // Índices das colunas do relatório ML (busca flexível com múltiplas variações)
  const col = {
    dataTarifa: findColumnIndex(header, ["data da tarifa", "data tarifa", "fecha", "data"]),
    tipoTarifa: findColumnIndex(header, ["tipo de tarifa", "tipo tarifa", "detalhe", "descrição", "descricao", "type"]),
    numeroVenda: findColumnIndex(header, ["número da venda", "numero da venda", "order", "pedido", "n° pedido"]),
    canalVendas: findColumnIndex(header, ["canal de vendas", "canal vendas", "channel", "marketplace"]),
    valorTransacao: findColumnIndex(header, ["valor da transação", "valor transação", "valor transacao", "valor bruto", "gross"]),
    valorLiquido: findColumnIndex(header, ["valor líquido", "valor liquido", "subtotal", "net", "total", "valor da tarifa"]),
  };

  // Log para debug
  console.log("Colunas detectadas ML:", col, "Headers:", header.slice(0, 15));

  // Apenas data e valor são realmente obrigatórios
  if (col.dataTarifa === -1 || col.valorLiquido === -1) {
    throw new Error(
      `Formato inesperado do relatório ML. Colunas encontradas: data=${col.dataTarifa}, liquido=${col.valorLiquido}. ` +
      `Headers: ${header.slice(0, 10).join(", ")}`
    );
  }

  // Mapear linhas para objetos estruturados prontos para importação
  const transacoes = dataRows
    .filter(r => r && r[col.dataTarifa]) // ignora rodapés/linhas vazias
    .map(r => {
      const bruto = parseNumber(r[col.valorTransacao]);
      const liquido = parseNumber(r[col.valorLiquido]);
      
      // Descrição: usa tipoTarifa se disponível, senão tenta outras colunas
      let descricao = "Transação ML";
      if (col.tipoTarifa >= 0 && r[col.tipoTarifa]) {
        descricao = String(r[col.tipoTarifa]).trim();
      } else if (col.valorTransacao >= 0 && r[col.valorTransacao]) {
        descricao = `Tarifa: R$ ${bruto.toFixed(2)}`;
      }

      return {
        origem: "marketplace" as const,
        canal: "mercado_livre" as const,
        data_transacao: normalizeDate(r[col.dataTarifa]),
        descricao,
        pedido_id: col.numeroVenda >= 0 ? r[col.numeroVenda]?.toString().trim() || null : null,
        canal_venda: col.canalVendas >= 0 ? r[col.canalVendas]?.toString().trim() || null : null,
        valor_bruto: bruto || liquido,
        valor_liquido: liquido || bruto,
      };
    })
    .filter(t => !isNaN(t.valor_liquido) && t.valor_liquido !== 0);

  return transacoes;
}

// ============= PARSER MERCADO PAGO XLSX/CSV =============

export async function parseXLSXMercadoPago(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // Mercado Pago pode usar diferentes abas
  const sheet = workbook.Sheets["Relatório"] || 
                workbook.Sheets["Report"] || 
                workbook.Sheets["Movimentos"] ||
                workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error("Nenhuma aba encontrada no arquivo XLSX");
  }

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  // Encontra header buscando termos típicos de MP
  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" &&
        (cell.toLowerCase().includes("data de criação") ||
         cell.toLowerCase().includes("date_created") ||
         cell.toLowerCase().includes("transaction_amount") ||
         cell.toLowerCase().includes("valor da transação") ||
         cell.toLowerCase().includes("net_received_amount") ||
         cell.toLowerCase().includes("valor líquido"))
    )
  );

  const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]) as string[];
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);

  console.log("Headers MP detectados:", header.slice(0, 20));

  // Colunas típicas do Mercado Pago (API e exportação manual)
  const col = {
    // Data
    data: findColumnIndex(header, [
      "date_created", "data de criação", "data", "fecha", "date",
      "data de liberação", "date_approved", "money_release_date"
    ]),
    // ID da transação/referência
    referencia: findColumnIndex(header, [
      "id", "operation_id", "id da operação", "reference", "external_reference",
      "referência externa", "source_id"
    ]),
    // Tipo de operação
    tipo: findColumnIndex(header, [
      "operation_type", "tipo de operação", "tipo", "type", "reason",
      "transaction_type", "tipo de transação", "payment_type"
    ]),
    // Descrição
    descricao: findColumnIndex(header, [
      "description", "descrição", "descricao", "reason", "motivo",
      "detail", "detalhe", "item_title", "título"
    ]),
    // Valor bruto
    valorBruto: findColumnIndex(header, [
      "transaction_amount", "valor da transação", "valor bruto", "gross_amount",
      "total_paid_amount", "valor total", "amount"
    ]),
    // Tarifa/Comissão
    tarifa: findColumnIndex(header, [
      "fee_amount", "marketplace_fee", "tarifa", "comissão", "commission",
      "mercadopago_fee", "mp_fee", "taxa mercadopago"
    ]),
    // Valor líquido
    valorLiquido: findColumnIndex(header, [
      "net_received_amount", "valor líquido recebido", "valor líquido", "net_amount",
      "valor_liquido", "net", "total received"
    ]),
    // Status
    status: findColumnIndex(header, [
      "status", "status_detail", "situação", "state"
    ]),
    // Pedido/Order
    pedido: findColumnIndex(header, [
      "order_id", "id do pedido", "pedido", "external_reference", 
      "referência externa", "merchant_order_id"
    ]),
    // Financiamento/Parcelas
    parcelas: findColumnIndex(header, [
      "installments", "parcelas", "financing_fee_amount"
    ]),
  };

  console.log("Colunas MP mapeadas:", col);

  // Validar colunas mínimas
  if (col.data === -1 && col.valorBruto === -1 && col.valorLiquido === -1) {
    throw new Error(
      `Formato não reconhecido do relatório Mercado Pago. ` +
      `Headers encontrados: ${header.slice(0, 15).join(", ")}`
    );
  }

  const transacoes = dataRows
    .filter(r => r && (r[col.data] || r[col.valorBruto] || r[col.valorLiquido]))
    .map(r => {
      const bruto = parseNumber(r[col.valorBruto]);
      const tarifa = Math.abs(parseNumber(r[col.tarifa]));
      let liquido = parseNumber(r[col.valorLiquido]);
      
      // Se não tem valor líquido, calcula
      if (!liquido && bruto) {
        liquido = bruto - tarifa;
      }

      // Descrição composta
      let descricao = "Transação MP";
      if (col.descricao >= 0 && r[col.descricao]) {
        descricao = String(r[col.descricao]).trim();
      } else if (col.tipo >= 0 && r[col.tipo]) {
        descricao = String(r[col.tipo]).trim();
      }

      // Status para filtrar
      const status = col.status >= 0 ? String(r[col.status] || "").toLowerCase() : "";
      
      // Determinar tipo de lançamento baseado no tipo de operação
      const tipoOp = col.tipo >= 0 ? String(r[col.tipo] || "").toLowerCase() : "";
      const isDebito = tipoOp.includes("refund") || 
                       tipoOp.includes("chargeback") || 
                       tipoOp.includes("estorno") ||
                       tipoOp.includes("devolução") ||
                       liquido < 0;

      return {
        origem: "marketplace" as const,
        canal: "mercado_pago" as const,
        data_transacao: normalizeDate(r[col.data]),
        descricao,
        pedido_id: col.pedido >= 0 ? r[col.pedido]?.toString().trim() || null : 
                   col.referencia >= 0 ? r[col.referencia]?.toString().trim() || null : null,
        referencia_externa: col.referencia >= 0 ? r[col.referencia]?.toString().trim() || null : null,
        valor_bruto: Math.abs(bruto) || Math.abs(liquido),
        valor_liquido: Math.abs(liquido) || Math.abs(bruto),
        tarifas: tarifa,
        status_original: status,
        tipo_transacao: tipoOp || "payment",
        tipo_lancamento: isDebito ? "debito" : "credito",
      };
    })
    .filter(t => {
      // Filtrar transações com valor e ignorar pendentes/cancelados
      const hasValue = !isNaN(t.valor_liquido) && t.valor_liquido !== 0;
      const isValid = !t.status_original.includes("pending") && 
                      !t.status_original.includes("cancelled") &&
                      !t.status_original.includes("rejected");
      return hasValue && isValid;
    })
    .map(t => {
      // Remove campo auxiliar
      const { status_original, ...rest } = t;
      return rest;
    });

  return transacoes;
}
