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

  // Encontra a linha do cabeçalho buscando "data da tarifa"
  const headerIndex = rows.findIndex((row) =>
    row.some(
      (cell) =>
        typeof cell === "string" &&
        cell.toLowerCase().includes("data da tarifa")
    )
  );

  if (headerIndex === -1) {
    throw new Error("Cabeçalho não encontrado no XLSX do Mercado Livre. Procurando por 'Data da tarifa'.");
  }

  const header = rows[headerIndex] as string[];
  const dataRows = rows.slice(headerIndex + 1);

  // Índices das colunas obrigatórias do relatório ML
  const col = {
    dataTarifa: header.findIndex(h => h === "Data da tarifa"),
    tipoTarifa: header.findIndex(h => h === "Tipo de tarifa"),
    numeroVenda: header.findIndex(h => h === "Número da venda"),
    canalVendas: header.findIndex(h => h === "Canal de vendas"),
    valorTransacao: header.findIndex(h => h === "Valor da transação"),
    valorLiquido: header.findIndex(h => h === "Valor líquido da transação"),
  };

  if (col.dataTarifa === -1 || col.tipoTarifa === -1 || col.valorLiquido === -1) {
    throw new Error(
      "Formato inesperado do relatório de faturamento do Mercado Livre. " +
      "Colunas obrigatórias: 'Data da tarifa', 'Tipo de tarifa', 'Valor líquido da transação'."
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

  // Mapear linhas para objetos estruturados
  const transacoes = dataRows
    .filter(r => r && r[col.dataTarifa]) // ignora rodapés/linhas vazias
    .map(r => {
      const bruto = parseNumber(r[col.valorTransacao]);
      const liquido = parseNumber(r[col.valorLiquido]);

      return {
        "Data da tarifa": normalizeDate(r[col.dataTarifa]),
        "Tipo de tarifa": String(r[col.tipoTarifa] || "").trim(),
        "Número da venda": r[col.numeroVenda]?.toString().trim() || null,
        "Canal de vendas": r[col.canalVendas]?.toString().trim() || null,
        "Valor da transação": bruto,
        "Valor líquido da transação": liquido || bruto,
      };
    })
    .filter(t => !isNaN(t["Valor líquido da transação"]) && t["Valor líquido da transação"] !== 0);

  return transacoes;
}
