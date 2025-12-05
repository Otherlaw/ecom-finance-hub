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

// Parser XLSX específico para relatórios Mercado Livre
// Retorna objetos estruturados prontos para importação
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

  // Função para buscar coluna de forma flexível (case-insensitive, busca parcial)
  const findColumnIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = header.findIndex(h => 
        h && typeof h === "string" && h.toLowerCase().includes(name.toLowerCase())
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // Índices das colunas obrigatórias do relatório ML (busca flexível)
  const col = {
    dataTarifa: findColumnIndex(["data da tarifa", "data tarifa", "fecha"]),
    tipoTarifa: findColumnIndex(["tipo de tarifa", "tipo tarifa", "type"]),
    numeroVenda: findColumnIndex(["número da venda", "numero da venda", "order", "pedido"]),
    canalVendas: findColumnIndex(["canal de vendas", "canal vendas", "channel"]),
    valorTransacao: findColumnIndex(["valor da transação", "valor transação", "valor transacao", "gross"]),
    valorLiquido: findColumnIndex(["valor líquido", "valor liquido", "net", "total"]),
  };

  // Log para debug
  console.log("Colunas detectadas ML:", col, "Headers:", header.slice(0, 10));

  if (col.dataTarifa === -1 || col.tipoTarifa === -1 || col.valorLiquido === -1) {
    throw new Error(
      `Formato inesperado do relatório ML. Colunas encontradas: data=${col.dataTarifa}, tipo=${col.tipoTarifa}, liquido=${col.valorLiquido}. ` +
      `Headers: ${header.slice(0, 8).join(", ")}`
    );
  }

  // Funções auxiliares de parsing
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

  // Mapear linhas para objetos estruturados prontos para importação
  const transacoes = dataRows
    .filter(r => r && r[col.dataTarifa]) // ignora rodapés/linhas vazias
    .map(r => {
      const bruto = parseNumber(r[col.valorTransacao]);
      const liquido = parseNumber(r[col.valorLiquido]);

      return {
        origem: "marketplace" as const,
        canal: "mercado_livre" as const,
        data_transacao: normalizeDate(r[col.dataTarifa]),
        descricao: String(r[col.tipoTarifa] || "").trim(),
        pedido_id: r[col.numeroVenda]?.toString().trim() || null,
        canal_venda: r[col.canalVendas]?.toString().trim() || null,
        valor_bruto: bruto,
        valor_liquido: liquido || bruto,
      };
    })
    .filter(t => !isNaN(t.valor_liquido) && t.valor_liquido !== 0);

  return transacoes;
}
