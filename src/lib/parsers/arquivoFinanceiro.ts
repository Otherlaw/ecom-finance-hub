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

/**
 * PARSE NUMBER - Converte valores monetários brasileiros para número
 * 
 * REGRAS CRÍTICAS:
 * 1. Detecta e REJEITA datas (dd/mm/yyyy, yyyy-mm-dd, etc.) → retorna 0
 * 2. Detecta formato brasileiro (1.234,56) vs americano (1,234.56)
 * 3. Nunca deve gerar números gigantes de datas mal interpretadas
 * 4. Valores > R$ 50.000 em linha única são suspeitos e logados para debug
 * 
 * Exemplos de conversão:
 * - "R$ 27.072,05" → 27072.05
 * - "27.072.025,00" (INVÁLIDO, > 50k) → 0 + log
 * - "1.234,56" → 1234.56
 * - "1,234.56" → 1234.56
 */
const parseNumber = (val: any): number => {
  // Se já é número, retorna direto
  if (typeof val === "number") return val;
  
  // Nulo/undefined → 0
  if (val === null || val === undefined) return 0;
  
  // Converte para string e faz trim
  let str = String(val).trim();
  
  // Se string vazia → 0
  if (!str) return 0;
  
  // REGRA CRÍTICA: Detectar e rejeitar DATAS
  // Padrões de data: dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy, dd.mm.yyyy
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,           // dd/mm/yyyy ou d/m/yy
    /^\d{4}-\d{1,2}-\d{1,2}$/,               // yyyy-mm-dd
    /^\d{1,2}-\d{1,2}-\d{2,4}$/,             // dd-mm-yyyy
    /^\d{1,2}\.\d{1,2}\.\d{2,4}$/,           // dd.mm.yyyy
    /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d/,       // dd/mm/yyyy HH:mm (com horário)
  ];
  
  for (const pattern of datePatterns) {
    if (pattern.test(str)) {
      // É uma data, não um número! Retorna 0
      return 0;
    }
  }
  
  // Se contém barra "/" é provavelmente data mal formatada → rejeitar
  if (str.includes("/") && /\d+\/\d+/.test(str)) {
    return 0;
  }
  
  // Remove símbolos de moeda, espaços e caracteres não numéricos
  // Mantém apenas: dígitos, vírgula, ponto, e sinal de menos
  str = str.replace(/[R$€£¥\s]/gi, "");
  
  // Conta quantos pontos e vírgulas existem
  const numPontos = (str.match(/\./g) || []).length;
  const numVirgulas = (str.match(/,/g) || []).length;
  
  // LÓGICA DE FORMATO BRASILEIRO vs AMERICANO:
  // Formato brasileiro: 1.234,56 (ponto como milhar, vírgula como decimal)
  // Formato americano: 1,234.56 (vírgula como milhar, ponto como decimal)
  
  if (numPontos > 1) {
    // Múltiplos pontos = separador de milhar brasileiro (1.234.567,89)
    // Remove todos os pontos (milhares)
    str = str.replace(/\./g, "");
    // Substitui vírgula por ponto decimal
    str = str.replace(",", ".");
  } else if (numVirgulas > 1) {
    // Múltiplas vírgulas = separador de milhar americano (1,234,567.89)
    // Remove todas as vírgulas
    str = str.replace(/,/g, "");
  } else if (numVirgulas === 1 && numPontos === 1) {
    // Tem ambos: verifica qual vem por último (esse é o decimal)
    const posVirgula = str.lastIndexOf(",");
    const posPonto = str.lastIndexOf(".");
    
    if (posVirgula > posPonto) {
      // Formato brasileiro: 1.234,56
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato americano: 1,234.56
      str = str.replace(/,/g, "");
    }
  } else if (numVirgulas === 1 && numPontos === 0) {
    // Apenas vírgula = decimal brasileiro (123,45)
    str = str.replace(",", ".");
  }
  // Se tem apenas ponto, mantém como está (formato americano ou decimal simples)
  
  // Remove qualquer caractere restante que não seja número, ponto ou menos
  str = str.replace(/[^\d.\-]/g, "");
  
  // Tenta converter
  const num = parseFloat(str);
  
  // Se NaN, retorna 0
  if (isNaN(num)) return 0;
  
  // Validação de sanidade: valores > R$ 50.000 por linha são suspeitos
  // Em relatórios de marketplace, tarifas individuais raramente excedem isso
  if (Math.abs(num) > 50000) {
    console.warn(`[parseNumber] Valor muito alto (possível erro de parsing): "${val}" → ${num}`);
    // Não retornar 0, mas logar para debug. O valor pode ser legítimo em vendas de alto valor.
  }
  
  // Validação extra: se o número é absurdamente grande (> 100 milhões), 
  // provavelmente é uma data mal interpretada ou erro de formato
  if (Math.abs(num) > 100000000) {
    console.error(`[parseNumber] Valor rejeitado (possível data ou erro): "${val}" → ${num}`);
    return 0;
  }
  
  return num;
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

/**
 * Busca coluna de tarifa/taxa com VALIDAÇÃO EXTRA
 * Não deve retornar colunas de data ou texto
 */
const findTarifaColumnIndex = (
  header: string[], 
  possibleNames: string[], 
  sampleRow?: any[]
): number => {
  // Termos que indicam que NÃO é coluna de tarifa
  const termosExcluir = ["data", "fecha", "date", "período", "periodo", "vencimento"];
  
  for (const name of possibleNames) {
    const idx = header.findIndex(h => {
      if (!h || typeof h !== "string") return false;
      const hLower = h.toLowerCase();
      
      // Verifica se contém o termo buscado
      if (!hLower.includes(name.toLowerCase())) return false;
      
      // EXCLUI se contém termos de data
      for (const excluir of termosExcluir) {
        if (hLower.includes(excluir)) return false;
      }
      
      return true;
    });
    
    if (idx >= 0) {
      // Se temos uma linha de amostra, validar se o valor parece numérico
      if (sampleRow && sampleRow[idx]) {
        const amostra = String(sampleRow[idx]).trim();
        // Se parece data (contém /) ou é texto longo, rejeitar
        if (amostra.includes("/") && /\d+\/\d+\/\d+/.test(amostra)) {
          console.warn(`[findTarifaColumnIndex] Coluna "${header[idx]}" rejeitada - valor parece data: ${amostra}`);
          continue;
        }
        if (amostra.length > 20 && !/^[\d,.\-\s]+$/.test(amostra)) {
          console.warn(`[findTarifaColumnIndex] Coluna "${header[idx]}" rejeitada - texto longo: ${amostra}`);
          continue;
        }
      }
      return idx;
    }
  }
  return -1;
};

// ============= INTERFACE PARA ITEM DE VENDA =============
export interface ItemVendaParser {
  sku_marketplace: string | null;
  descricao_item: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
}

// ============= PARSER MERCADO LIVRE XLSX COM ESTATÍSTICAS E EXTRAÇÃO DE ITENS =============

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
    console.warn("Cabeçalho ML não detectado, usando primeira linha");
  }

  const header = (headerIndex >= 0 ? rows[headerIndex] : rows[0]) as string[];
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);
  const totalLinhasArquivo = dataRows.length;

  // Pegar primeira linha de dados para validação de colunas numéricas
  const primeiraLinhaAmostra = dataRows[0] || [];

  // Índices das colunas do relatório ML (busca flexível com múltiplas variações)
  const col = {
    // Colunas básicas
    dataTarifa: findColumnIndex(header, ["data da tarifa", "data tarifa", "fecha", "data"]),
    tipoTarifa: findColumnIndex(header, ["tipo de tarifa", "tipo tarifa", "detalhe", "descrição", "descricao", "type"]),
    numeroVenda: findColumnIndex(header, ["número da venda", "numero da venda", "order", "pedido", "n° pedido", "pack id"]),
    canalVendas: findColumnIndex(header, ["canal de vendas", "canal vendas", "channel", "marketplace"]),
    valorTransacao: findColumnIndex(header, ["valor da transação", "valor transação", "valor transacao", "valor bruto", "gross"]),
    valorLiquido: findColumnIndex(header, ["valor líquido", "valor liquido", "subtotal", "net", "total", "valor da tarifa"]),
    // Colunas de ID único para evitar duplicatas
    idTarifa: findColumnIndex(header, ["id da tarifa", "id tarifa", "tarifa id", "id"]),
    idTransacao: findColumnIndex(header, ["id da transação", "id transação", "transaction id", "id transacao"]),
    idInterno: findColumnIndex(header, ["id interno", "id único", "id operação", "operation id"]),
    // NOVAS COLUNAS: Dados do item/produto (MLB)
    mlb: findColumnIndex(header, ["mlb", "id do anúncio", "id anúncio", "listing id", "item id", "id do item", "item_id", "publicação"]),
    nomeItem: findColumnIndex(header, ["título do anúncio", "titulo do anuncio", "título", "titulo", "nome do item", "item name", "descrição do produto", "produto"]),
    quantidade: findColumnIndex(header, ["quantidade", "qty", "quantity", "unidades", "qtd"]),
    precoUnitario: findColumnIndex(header, ["preço unitário", "preco unitario", "unit price", "valor unitário", "valor unitario"]),
    precoTotal: findColumnIndex(header, ["preço total", "preco total", "total price", "valor total item", "subtotal item"]),
    // Colunas de taxas/tarifas detalhadas - usa função com validação extra
    comissao: findTarifaColumnIndex(header, ["comissão", "comissao", "commission", "tarifa de venda"], primeiraLinhaAmostra),
    tarifa: findTarifaColumnIndex(header, ["valor da tarifa", "tarifa", "fee", "taxa"], primeiraLinhaAmostra),
    frete: findTarifaColumnIndex(header, ["frete", "envio", "shipping", "custo de envio"], primeiraLinhaAmostra),
    desconto: findTarifaColumnIndex(header, ["desconto", "discount", "cupom"], primeiraLinhaAmostra),
  };

  console.log("[parseXLSXMercadoLivre] Colunas detectadas:", col, "Headers:", header.slice(0, 25));
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

    // Extrair taxas/tarifas detalhadas do relatório
    const comissao = col.comissao >= 0 ? Math.abs(parseNumber(r[col.comissao])) : 0;
    const tarifa = col.tarifa >= 0 ? Math.abs(parseNumber(r[col.tarifa])) : 0;
    const frete = col.frete >= 0 ? Math.abs(parseNumber(r[col.frete])) : 0;
    const desconto = col.desconto >= 0 ? Math.abs(parseNumber(r[col.desconto])) : 0;

    // Calcular total de taxas se não fornecido diretamente
    const totalTaxas = comissao + tarifa;
    const outrosDescontos = desconto;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: pedidoId,
      valor: liquido || bruto,
      descricao,
      idUnico: idUnico || null,
    });

    // Determinar tipo de transação e lançamento automaticamente
    const descNormalizada = descricao.toLowerCase();
    let tipoTransacao = "outro";
    let tipoLancamento: 'credito' | 'debito' = liquido >= 0 ? "credito" : "debito";

    // Regras de classificação automática baseadas na descrição
    if (descNormalizada.includes("venda") || descNormalizada.includes("pagamento") || descNormalizada.includes("liberação") || descNormalizada.includes("repasse")) {
      tipoTransacao = "venda";
      tipoLancamento = "credito";
    } else if (descNormalizada.includes("tarifa") || descNormalizada.includes("comissão") || descNormalizada.includes("custo por vender")) {
      tipoTransacao = "tarifa_marketplace";
      tipoLancamento = "debito";
    } else if (descNormalizada.includes("envio") || descNormalizada.includes("frete") || descNormalizada.includes("full")) {
      tipoTransacao = "frete_marketplace";
      tipoLancamento = "debito";
    } else if (descNormalizada.includes("publicidade") || descNormalizada.includes("ads") || descNormalizada.includes("anúncio")) {
      tipoTransacao = "ads";
      tipoLancamento = "debito";
    } else if (descNormalizada.includes("estorno") || descNormalizada.includes("devolução") || descNormalizada.includes("cancelamento")) {
      tipoTransacao = "estorno";
      tipoLancamento = "debito";
    } else if (descNormalizada.includes("antecipação")) {
      tipoTransacao = "antecipacao";
      tipoLancamento = "debito";
    } else if (descNormalizada.includes("juros") || descNormalizada.includes("parcelamento")) {
      tipoTransacao = "taxa_parcelamento";
      tipoLancamento = "debito";
    }

    // EXTRAIR DADOS DO ITEM (se existirem no relatório)
    const itens: ItemVendaParser[] = [];
    
    // Verificar se existe MLB/ID do anúncio nesta linha
    const mlbStr = col.mlb >= 0 ? r[col.mlb]?.toString().trim() : null;
    const nomeItemStr = col.nomeItem >= 0 ? r[col.nomeItem]?.toString().trim() : null;
    const qtd = col.quantidade >= 0 ? parseInt(r[col.quantidade]) || 1 : 1;
    const precoUnit = col.precoUnitario >= 0 ? parseNumber(r[col.precoUnitario]) : null;
    const precoTot = col.precoTotal >= 0 ? parseNumber(r[col.precoTotal]) : null;

    // Se tem MLB ou nome do item e é uma transação de venda, criar item
    if ((mlbStr || nomeItemStr) && (tipoTransacao === "venda" || descNormalizada.includes("venda"))) {
      itens.push({
        sku_marketplace: mlbStr || null,
        descricao_item: nomeItemStr || descricao,
        quantidade: qtd,
        preco_unitario: precoUnit,
        preco_total: precoTot || (precoUnit ? precoUnit * qtd : null),
      });
    }

    transacoes.push({
      origem: "marketplace" as const,
      canal: "mercado_livre" as const,
      data_transacao: dataValida,
      descricao,
      pedido_id: pedidoId,
      canal_venda: canalVenda,
      valor_bruto: bruto || liquido,
      valor_liquido: liquido || bruto,
      tarifas: totalTaxas || 0,
      taxas: frete,
      outros_descontos: outrosDescontos,
      tipo_transacao: tipoTransacao,
      tipo_lancamento: tipoLancamento,
      referencia_externa: referenciaExterna,
      // Array de itens (vazio se não for venda com item identificável)
      itens,
    });
  }

  const totalTransacoesGeradas = transacoes.length;
  const totalComItens = transacoes.filter(t => t.itens && t.itens.length > 0).length;

  console.log("[parseXLSXMercadoLivre] Estatísticas:", {
    totalLinhasArquivo,
    totalTransacoesGeradas,
    totalComValorZero,
    totalDescartadasPorFormato,
    totalLinhasVazias,
    totalComItens,
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

// ============= PARSER SHOPEE CSV/XLSX COM ESTATÍSTICAS =============

export async function parseShopee(file: File): Promise<ParseResult> {
  const fileExt = file.name.split(".").pop()?.toLowerCase();
  
  // Parse arquivo (CSV ou XLSX)
  let rows: any[];
  if (fileExt === "csv") {
    rows = await parseCSVFile(file);
  } else {
    rows = await parseXLSXFile(file);
  }

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
  console.log("[parseShopee] Headers detectados:", keys.slice(0, 20));

  // Colunas do relatório Shopee (múltiplas variações de nome)
  const col = {
    // Data
    data: findColumnIndex(keys, [
      "data do pedido", "data pedido", "order date", "created date", 
      "data de criação", "data da transação", "transaction date",
      "data de conclusão", "completion date", "data"
    ]),
    dataRepasse: findColumnIndex(keys, [
      "data de liberação", "release date", "data do repasse", 
      "settlement date", "payout date"
    ]),
    // Identificadores
    pedidoId: findColumnIndex(keys, [
      "n° do pedido", "numero do pedido", "order id", "order no", 
      "nº pedido", "id do pedido", "order number", "pedido"
    ]),
    idTransacao: findColumnIndex(keys, [
      "id da transação", "transaction id", "id transação", "transaction no",
      "nº transação", "id"
    ]),
    // Descrição/Tipo
    tipoTransacao: findColumnIndex(keys, [
      "tipo de transação", "transaction type", "tipo transação", "type",
      "tipo", "descrição da transação", "transaction description"
    ]),
    descricao: findColumnIndex(keys, [
      "descrição", "descricao", "description", "motivo", "reason",
      "detalhes", "details", "observação"
    ]),
    nomeProduto: findColumnIndex(keys, [
      "nome do produto", "product name", "produto", "item name",
      "nome produto", "título", "title"
    ]),
    // Valores
    valorTotal: findColumnIndex(keys, [
      "valor total do pedido", "order total", "total do pedido", 
      "total amount", "valor bruto", "gross amount", "total"
    ]),
    valorProduto: findColumnIndex(keys, [
      "preço do produto", "product price", "valor do produto",
      "unit price", "preço unitário"
    ]),
    taxaComissao: findColumnIndex(keys, [
      "taxa de comissão", "commission fee", "comissão", "commission",
      "taxa comissão", "taxa marketplace", "marketplace fee"
    ]),
    taxaTransacao: findColumnIndex(keys, [
      "taxa de transação", "transaction fee", "taxa transação",
      "payment fee", "taxa pagamento"
    ]),
    taxaServico: findColumnIndex(keys, [
      "taxa de serviço", "service fee", "taxa serviço"
    ]),
    frete: findColumnIndex(keys, [
      "taxa de envio", "shipping fee", "frete", "envio",
      "custo de envio", "shipping cost", "taxa frete"
    ]),
    descontos: findColumnIndex(keys, [
      "desconto", "discount", "cupom", "voucher", "promoção",
      "desconto vendedor", "seller discount", "desconto plataforma"
    ]),
    valorLiquido: findColumnIndex(keys, [
      "receita do vendedor", "seller earnings", "valor líquido", 
      "net amount", "valor a receber", "payout amount", "earnings",
      "receita líquida", "net earnings", "ganhos", "seller income"
    ]),
    // Status
    status: findColumnIndex(keys, [
      "status do pedido", "order status", "status", "situação",
      "status da transação", "transaction status"
    ]),
    // SKU
    sku: findColumnIndex(keys, [
      "sku", "sku do produto", "product sku", "variação", "variation",
      "código sku", "sku code"
    ]),
    quantidade: findColumnIndex(keys, [
      "quantidade", "qty", "quantity", "qtd", "unidades"
    ]),
  };

  console.log("[parseShopee] Colunas mapeadas:", col);

  // Valida colunas mínimas necessárias
  if (col.data === -1 && col.dataRepasse === -1) {
    throw new Error(
      `Formato não reconhecido do relatório Shopee. Nenhuma coluna de data encontrada. ` +
      `Headers: ${keys.slice(0, 15).join(", ")}`
    );
  }

  const transacoes: any[] = [];

  for (const r of rows) {
    // Data: prioriza data do pedido, depois data de repasse
    const dataStr = r[keys[col.data]] || r[keys[col.dataRepasse]] || "";
    const dataValida = normalizeDate(dataStr);
    const dataRepasseStr = col.dataRepasse >= 0 ? normalizeDate(r[keys[col.dataRepasse]]) : null;
    
    // Valores
    const valorTotal = parseNumber(r[keys[col.valorTotal]]);
    const valorProduto = parseNumber(r[keys[col.valorProduto]]);
    const taxaComissao = Math.abs(parseNumber(r[keys[col.taxaComissao]]));
    const taxaTransacao = Math.abs(parseNumber(r[keys[col.taxaTransacao]]));
    const taxaServico = Math.abs(parseNumber(r[keys[col.taxaServico]]));
    const frete = Math.abs(parseNumber(r[keys[col.frete]]));
    const descontos = Math.abs(parseNumber(r[keys[col.descontos]]));
    let valorLiquido = parseNumber(r[keys[col.valorLiquido]]);
    
    // Se não tiver valor líquido, calcular
    if (!valorLiquido && (valorTotal || valorProduto)) {
      const totalTaxas = taxaComissao + taxaTransacao + taxaServico;
      valorLiquido = (valorTotal || valorProduto) - totalTaxas - frete + descontos;
    }

    // Validações
    const temData = !!dataValida;
    const temValor = valorTotal !== 0 || valorLiquido !== 0 || valorProduto !== 0;

    // Descrição: monta baseado nos dados disponíveis
    let descricao = "Transação Shopee";
    if (col.tipoTransacao >= 0 && r[keys[col.tipoTransacao]]) {
      descricao = String(r[keys[col.tipoTransacao]]).trim();
    } else if (col.descricao >= 0 && r[keys[col.descricao]]) {
      descricao = String(r[keys[col.descricao]]).trim();
    } else if (col.nomeProduto >= 0 && r[keys[col.nomeProduto]]) {
      descricao = String(r[keys[col.nomeProduto]]).trim();
    }

    const temDescricao = descricao !== "Transação Shopee";

    // Linha completamente vazia
    if (!temData && !temDescricao && !temValor) {
      totalLinhasVazias++;
      continue;
    }

    // Contabiliza valores zero
    if (valorLiquido === 0 && valorTotal === 0 && valorProduto === 0) {
      totalComValorZero++;
    }

    // Status inválidos
    const status = col.status >= 0 ? String(r[keys[col.status]] || "").toLowerCase() : "";
    if (status.includes("cancel") || status.includes("return") || 
        status.includes("refund") || status.includes("devol")) {
      // Não descartamos devoluções, mas marcamos como débito
    }

    // Sem data válida
    if (!temData) {
      totalDescartadasPorFormato++;
      continue;
    }

    // Identificadores
    const pedidoId = col.pedidoId >= 0 ? r[keys[col.pedidoId]]?.toString().trim() || null : null;
    const idTransacao = col.idTransacao >= 0 ? r[keys[col.idTransacao]]?.toString().trim() || null : null;
    const sku = col.sku >= 0 ? r[keys[col.sku]]?.toString().trim() || null : null;
    const quantidade = col.quantidade >= 0 ? parseInt(r[keys[col.quantidade]]) || 1 : 1;

    // Determinar tipo de lançamento
    const tipoTransacao = col.tipoTransacao >= 0 ? String(r[keys[col.tipoTransacao]] || "").toLowerCase() : "";
    const isDebito = tipoTransacao.includes("refund") || 
                     tipoTransacao.includes("cancel") || 
                     tipoTransacao.includes("estorno") ||
                     tipoTransacao.includes("devolução") ||
                     tipoTransacao.includes("return") ||
                     tipoTransacao.includes("taxa") ||
                     tipoTransacao.includes("fee") ||
                     valorLiquido < 0;

    // Gerar referência externa usando função centralizada
    const referenciaExterna = gerarReferenciaExterna({
      data: dataValida,
      pedido: pedidoId,
      valor: Math.abs(valorLiquido) || Math.abs(valorTotal) || Math.abs(valorProduto),
      descricao,
      idUnico: idTransacao || pedidoId || null,
    });

    // Total de taxas para breakdown
    const totalTaxas = taxaComissao + taxaTransacao + taxaServico;

    transacoes.push({
      origem: "marketplace" as const,
      canal: "shopee" as const,
      data_transacao: dataValida,
      data_repasse: dataRepasseStr || null,
      descricao,
      pedido_id: pedidoId,
      referencia_externa: referenciaExterna,
      valor_bruto: Math.abs(valorTotal) || Math.abs(valorProduto) || Math.abs(valorLiquido),
      valor_liquido: Math.abs(valorLiquido) || Math.abs(valorTotal) || Math.abs(valorProduto),
      taxas: totalTaxas,
      tarifas: taxaComissao,
      outros_descontos: descontos,
      tipo_transacao: tipoTransacao || "venda",
      tipo_lancamento: isDebito ? "debito" : "credito",
      // Dados extras para items
      sku_marketplace: sku,
      quantidade,
    });
  }

  console.log("[parseShopee] Estatísticas:", {
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
