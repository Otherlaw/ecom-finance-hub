// src/lib/validar-periodo-arquivo.ts
// Função para validar se o período do arquivo corresponde ao checklist

import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface ValidacaoPeriodo {
  valido: boolean;
  periodoDetectado: { mes: number; ano: number } | null;
  periodoEsperado: { mes: number; ano: number };
  mensagemErro?: string;
  alertaIncompatibilidade?: boolean;
  detalhes?: {
    datasEncontradas: number;
    dataMinima: string;
    dataMaxima: string;
    mesFrequente: number;
    anoFrequente: number;
  };
}

// Função utilitária para extrair mês/ano de uma string de data
function extrairMesAno(dataStr: string): { mes: number; ano: number } | null {
  if (!dataStr) return null;
  
  const str = String(dataStr).trim();
  
  // Padrões suportados: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
  let parts: string[] = [];
  let dia = 0, mes = 0, ano = 0;
  
  if (str.includes("/")) {
    parts = str.split(/[\/\s]/)[0].split("/");
  } else if (str.includes("-")) {
    parts = str.split(/[\-\s]/)[0].split("-");
  } else if (str.includes(".")) {
    parts = str.split(/[\.\s]/)[0].split(".");
  }
  
  if (parts.length < 3) return null;
  
  // Detectar formato
  const part0 = parseInt(parts[0]);
  const part1 = parseInt(parts[1]);
  const part2 = parseInt(parts[2]);
  
  if (isNaN(part0) || isNaN(part1) || isNaN(part2)) return null;
  
  if (parts[0].length === 4) {
    // Formato YYYY-MM-DD
    ano = part0;
    mes = part1;
    dia = part2;
  } else if (parts[2].length === 4) {
    // Formato DD/MM/YYYY ou DD-MM-YYYY
    dia = part0;
    mes = part1;
    ano = part2;
  } else if (parts[2].length === 2) {
    // Formato DD/MM/YY
    dia = part0;
    mes = part1;
    ano = 2000 + part2;
  } else {
    return null;
  }
  
  // Validação básica
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
  
  return { mes, ano };
}

// Encontra a coluna de data nas headers
function encontrarColunaData(headers: string[]): number {
  const possiveisNomes = [
    "data", "date", "fecha", "data da tarifa", "data transação",
    "data do movimento", "data da venda", "data de criação", 
    "created", "data pedido", "data_transacao"
  ];
  
  for (const nome of possiveisNomes) {
    const idx = headers.findIndex(h => 
      h && typeof h === "string" && h.toLowerCase().includes(nome.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  
  return -1;
}

// Parse rápido do arquivo para extrair datas (apenas primeiras N linhas)
async function extrairDatasDoArquivo(file: File, maxLinhas: number = 100): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  
  let rows: any[] = [];
  
  if (ext === "csv") {
    // Parse CSV
    const text = await file.text();
    const result = Papa.parse(text, { 
      header: true, 
      skipEmptyLines: true,
      preview: maxLinhas + 1 // +1 para incluir header
    });
    rows = result.data as any[];
  } else if (ext === "xlsx" || ext === "xls") {
    // Parse XLSX
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    
    // Tenta achar aba correta
    const sheetName = workbook.SheetNames.find(name => 
      ["REPORT", "Relatório", "Report", "Movimentos", "Vendas"].includes(name)
    ) || workbook.SheetNames[0];
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    
    // Converte para array de objetos
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    rows = rows.slice(0, maxLinhas);
  } else {
    // Formato não suportado para validação
    return [];
  }
  
  if (rows.length === 0) return [];
  
  // Encontra coluna de data
  const headers = Object.keys(rows[0]);
  const idxData = encontrarColunaData(headers);
  
  if (idxData === -1) {
    // Tenta usar primeira coluna que pareça ter data
    for (const key of headers) {
      const amostra = rows[0][key];
      if (amostra && extrairMesAno(String(amostra))) {
        return rows.map(r => String(r[key] || "")).filter(Boolean);
      }
    }
    return [];
  }
  
  const colunaData = headers[idxData];
  return rows.map(r => String(r[colunaData] || "")).filter(Boolean);
}

// Calcula mês/ano mais frequente de uma lista de datas
function calcularPeriodoPredominante(datas: string[]): { mes: number; ano: number } | null {
  const contagem: Record<string, number> = {};
  
  for (const dataStr of datas) {
    const resultado = extrairMesAno(dataStr);
    if (resultado) {
      const chave = `${resultado.mes}-${resultado.ano}`;
      contagem[chave] = (contagem[chave] || 0) + 1;
    }
  }
  
  const entries = Object.entries(contagem);
  if (entries.length === 0) return null;
  
  // Ordena por frequência (maior primeiro)
  entries.sort((a, b) => b[1] - a[1]);
  
  const [chaveMaisFrequente] = entries[0];
  const [mes, ano] = chaveMaisFrequente.split("-").map(Number);
  
  return { mes, ano };
}

// Função principal de validação
export async function validarPeriodoArquivo(
  file: File,
  mesEsperado: number,
  anoEsperado: number
): Promise<ValidacaoPeriodo> {
  const periodoEsperado = { mes: mesEsperado, ano: anoEsperado };
  
  try {
    // Extrair datas do arquivo (primeiras 100 linhas)
    const datas = await extrairDatasDoArquivo(file, 100);
    
    if (datas.length === 0) {
      return {
        valido: true, // Não podemos validar, então permitir
        periodoDetectado: null,
        periodoEsperado,
        mensagemErro: "Não foi possível detectar datas no arquivo",
      };
    }
    
    // Calcular período predominante
    const periodoDetectado = calcularPeriodoPredominante(datas);
    
    if (!periodoDetectado) {
      return {
        valido: true, // Não podemos validar, então permitir
        periodoDetectado: null,
        periodoEsperado,
        mensagemErro: "Não foi possível determinar o período das transações",
      };
    }
    
    // Encontrar data mínima e máxima
    const datasValidas = datas
      .map(d => extrairMesAno(d))
      .filter((d): d is { mes: number; ano: number } => d !== null);
    
    const dataMinima = datasValidas.length > 0 
      ? `${String(datasValidas[0].mes).padStart(2, "0")}/${datasValidas[0].ano}`
      : "N/A";
    
    const dataMaxima = datasValidas.length > 0 
      ? `${String(datasValidas[datasValidas.length - 1].mes).padStart(2, "0")}/${datasValidas[datasValidas.length - 1].ano}`
      : "N/A";
    
    // Comparar com período esperado
    const valido = periodoDetectado.mes === mesEsperado && periodoDetectado.ano === anoEsperado;
    
    return {
      valido,
      periodoDetectado,
      periodoEsperado,
      alertaIncompatibilidade: !valido,
      detalhes: {
        datasEncontradas: datasValidas.length,
        dataMinima,
        dataMaxima,
        mesFrequente: periodoDetectado.mes,
        anoFrequente: periodoDetectado.ano,
      },
    };
  } catch (error) {
    console.error("[validarPeriodoArquivo] Erro:", error);
    return {
      valido: true, // Em caso de erro, permitir upload (validação não é bloqueante)
      periodoDetectado: null,
      periodoEsperado,
      mensagemErro: `Erro ao validar período: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
    };
  }
}

// Função auxiliar para formatar nome do mês
export function getNomeMes(mes: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses[mes - 1] || `Mês ${mes}`;
}
