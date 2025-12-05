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
// Detecta cabeçalho dinamicamente buscando "data da tarifa"
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

  // Validar colunas obrigatórias do relatório ML
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

  // Converte para array de objetos usando o header detectado
  return dataRows
    .filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined))
    .map((row) => {
      const obj: Record<string, any> = {};
      header.forEach((colName, i) => {
        if (colName) {
          obj[colName.trim()] = row[i] ?? "";
        }
      });
      return obj;
    });
}
