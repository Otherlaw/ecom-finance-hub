/**
 * PARSER DE ARQUIVO UPSELLER (XLSX)
 * Extrai mapeamentos de SKU interno → Anúncios/Variações de Marketplace
 */

import * as XLSX from 'xlsx';

export interface UpsellerRow {
  sku_interno: string;
  canal: string;
  loja: string | null;
  anuncio_id: string | null;
  variante_id: string | null;
  variante_nome: string | null;
  linha_original: number;
}

export interface ParseUpsellerResult {
  mapeamentos: UpsellerRow[];
  estatisticas: {
    totalLinhas: number;
    linhasValidas: number;
    linhasInvalidas: number;
    porCanal: Record<string, number>;
    duplicatasDetectadas: number;
  };
  erros: string[];
}

// Mapeamento de nomes de coluna do Upseller para campos internos
const COLUMN_MAPPINGS = {
  sku_interno: ['sku', 'código', 'codigo', 'sku interno', 'sku_interno', 'cod', 'product_sku'],
  anuncio_id: ['id do anúncio', 'id do anuncio', 'id_anuncio', 'anuncio_id', 'mlb', 'id anuncio', 'item_id', 'listing_id'],
  sku_anuncio: ['sku do anúncio', 'sku do anuncio', 'sku_anuncio', 'announcement_sku'],
  variante_id: ['id da variante', 'id da variação', 'id_variante', 'variante_id', 'variation_id', 'id variante'],
  variante_nome: ['variante', 'variação', 'variacao', 'variant', 'variation_name', 'nome variante'],
  loja: ['nome da loja', 'nome loja', 'loja', 'store', 'store_name', 'conta', 'account'],
  mapeado: ['mapeado', 'mapped', 'is_mapped'],
};

/**
 * Detecta o canal a partir do nome da loja
 */
function detectarCanal(nomeLoja: string | null): string {
  if (!nomeLoja) return 'outro';
  
  const lojaLower = nomeLoja.toLowerCase().trim();
  
  if (lojaLower.startsWith('mercado') || lojaLower.includes('meli') || lojaLower.includes('mercadolivre')) {
    return 'mercado_livre';
  }
  if (lojaLower.startsWith('shopee') || lojaLower.includes('shopee')) {
    return 'shopee';
  }
  if (lojaLower.includes('amazon')) {
    return 'amazon';
  }
  if (lojaLower.includes('shein')) {
    return 'shein';
  }
  if (lojaLower.includes('tiktok') || lojaLower.includes('tik tok')) {
    return 'tiktok_shop';
  }
  if (lojaLower.includes('magalu') || lojaLower.includes('magazine')) {
    return 'magalu';
  }
  
  return 'outro';
}

/**
 * Encontra o índice da coluna por nome (busca aproximada)
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const headersLower = headers.map(h => h?.toLowerCase().trim() || '');
  
  for (const name of possibleNames) {
    const nameLower = name.toLowerCase().trim();
    const idx = headersLower.findIndex(h => h === nameLower || h.includes(nameLower));
    if (idx >= 0) return idx;
  }
  
  return -1;
}

/**
 * Extrai ID de anúncio do Mercado Livre (MLBxxxxxxxx)
 */
function extrairMLB(valor: string | null): string | null {
  if (!valor) return null;
  
  const str = String(valor).trim();
  
  // Padrão MLB seguido de números
  const mlbMatch = str.match(/MLB\d+/i);
  if (mlbMatch) return mlbMatch[0].toUpperCase();
  
  // Se é apenas números longos (pode ser ID de anúncio Shopee)
  if (/^\d{10,}$/.test(str)) return str;
  
  return str || null;
}

/**
 * Limpa e normaliza SKU
 */
function normalizarSku(valor: string | null): string | null {
  if (!valor) return null;
  return String(valor).trim().toUpperCase();
}

/**
 * Parse do arquivo XLSX do Upseller
 */
export async function parseUpsellerXLSX(file: File): Promise<ParseUpsellerResult> {
  const erros: string[] = [];
  const mapeamentos: UpsellerRow[] = [];
  const duplicatasSet = new Set<string>();
  let duplicatasDetectadas = 0;
  
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    // Usar primeira planilha
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Converter para array de arrays
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (rawData.length < 2) {
      return {
        mapeamentos: [],
        estatisticas: {
          totalLinhas: 0,
          linhasValidas: 0,
          linhasInvalidas: 0,
          porCanal: {},
          duplicatasDetectadas: 0,
        },
        erros: ['Arquivo vazio ou sem dados válidos'],
      };
    }
    
    // Primeira linha = headers
    const headers: string[] = rawData[0].map(h => String(h || ''));
    
    console.log('[Upseller Parser] Headers detectados:', headers);
    
    // Encontrar índices das colunas
    const skuIdx = findColumnIndex(headers, COLUMN_MAPPINGS.sku_interno);
    const anuncioIdx = findColumnIndex(headers, COLUMN_MAPPINGS.anuncio_id);
    const skuAnuncioIdx = findColumnIndex(headers, COLUMN_MAPPINGS.sku_anuncio);
    const varianteIdIdx = findColumnIndex(headers, COLUMN_MAPPINGS.variante_id);
    const varianteNomeIdx = findColumnIndex(headers, COLUMN_MAPPINGS.variante_nome);
    const lojaIdx = findColumnIndex(headers, COLUMN_MAPPINGS.loja);
    
    console.log('[Upseller Parser] Índices encontrados:', {
      sku: skuIdx,
      anuncio: anuncioIdx,
      skuAnuncio: skuAnuncioIdx,
      varianteId: varianteIdIdx,
      varianteNome: varianteNomeIdx,
      loja: lojaIdx,
    });
    
    if (skuIdx < 0) {
      erros.push('Coluna de SKU não encontrada. Verifique se o arquivo possui uma coluna "SKU" ou "Código".');
      return {
        mapeamentos: [],
        estatisticas: {
          totalLinhas: rawData.length - 1,
          linhasValidas: 0,
          linhasInvalidas: rawData.length - 1,
          porCanal: {},
          duplicatasDetectadas: 0,
        },
        erros,
      };
    }
    
    const porCanal: Record<string, number> = {};
    let linhasInvalidas = 0;
    
    // Processar cada linha de dados
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // SKU é obrigatório
      const skuInterno = normalizarSku(row[skuIdx]);
      if (!skuInterno) {
        linhasInvalidas++;
        continue;
      }
      
      // Extrair campos
      const anuncioRaw = row[anuncioIdx];
      const skuAnuncioRaw = row[skuAnuncioIdx];
      const varianteIdRaw = row[varianteIdIdx];
      const varianteNomeRaw = row[varianteNomeIdx];
      const lojaRaw = row[lojaIdx];
      
      // ID do anúncio pode vir de diferentes colunas
      let anuncioId = extrairMLB(anuncioRaw?.toString() || null);
      
      // Se não encontrou anúncio na coluna principal, tenta no SKU do anúncio
      if (!anuncioId && skuAnuncioRaw) {
        const skuAnuncio = String(skuAnuncioRaw).trim();
        if (skuAnuncio.startsWith('MLB') || /^\d{10,}$/.test(skuAnuncio)) {
          anuncioId = extrairMLB(skuAnuncio);
        }
      }
      
      const loja = lojaRaw?.toString().trim() || null;
      const canal = detectarCanal(loja);
      const varianteId = varianteIdRaw?.toString().trim() || null;
      const varianteNome = varianteNomeRaw?.toString().trim() || null;
      
      // Verificar duplicata
      const chaveUnica = `${canal}|${anuncioId || ''}|${varianteId || ''}`;
      if (duplicatasSet.has(chaveUnica) && anuncioId) {
        duplicatasDetectadas++;
        // Ainda adiciona, mas conta como duplicata (upsert vai atualizar)
      }
      duplicatasSet.add(chaveUnica);
      
      mapeamentos.push({
        sku_interno: skuInterno,
        canal,
        loja,
        anuncio_id: anuncioId,
        variante_id: varianteId,
        variante_nome: varianteNome,
        linha_original: i + 1,
      });
      
      porCanal[canal] = (porCanal[canal] || 0) + 1;
    }
    
    console.log('[Upseller Parser] Resultado:', {
      total: rawData.length - 1,
      validos: mapeamentos.length,
      invalidos: linhasInvalidas,
      duplicatas: duplicatasDetectadas,
      porCanal,
    });
    
    return {
      mapeamentos,
      estatisticas: {
        totalLinhas: rawData.length - 1,
        linhasValidas: mapeamentos.length,
        linhasInvalidas,
        porCanal,
        duplicatasDetectadas,
      },
      erros,
    };
    
  } catch (error) {
    console.error('[Upseller Parser] Erro:', error);
    return {
      mapeamentos: [],
      estatisticas: {
        totalLinhas: 0,
        linhasValidas: 0,
        linhasInvalidas: 0,
        porCanal: {},
        duplicatasDetectadas: 0,
      },
      erros: [`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
    };
  }
}

/**
 * Parse de arquivo CSV do Upseller
 */
export async function parseUpsellerCSV(file: File): Promise<ParseUpsellerResult> {
  // Converter CSV para formato XLSX e usar o mesmo parser
  try {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    
    // Criar um arquivo virtual XLSX a partir do CSV
    const blob = new Blob([text], { type: 'text/csv' });
    const csvFile = new File([blob], file.name, { type: 'text/csv' });
    
    // Usar o parser XLSX (ele também aceita CSV)
    return parseUpsellerXLSX(file);
    
  } catch (error) {
    console.error('[Upseller CSV Parser] Erro:', error);
    return {
      mapeamentos: [],
      estatisticas: {
        totalLinhas: 0,
        linhasValidas: 0,
        linhasInvalidas: 0,
        porCanal: {},
        duplicatasDetectadas: 0,
      },
      erros: [`Erro ao processar CSV: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
    };
  }
}

/**
 * Tipo para inserção de mapeamento de SKU
 */
export interface SkuMapInsert {
  empresa_id: string;
  sku_interno: string;
  canal: string;
  loja: string | null;
  anuncio_id: string | null;
  variante_id: string | null;
  variante_nome: string | null;
}

/**
 * Converte resultado do parser para formato de inserção no banco
 */
export function converterParaInsert(
  rows: UpsellerRow[],
  empresaId: string
): SkuMapInsert[] {
  return rows.map(row => ({
    empresa_id: empresaId,
    sku_interno: row.sku_interno,
    canal: row.canal,
    loja: row.loja,
    anuncio_id: row.anuncio_id,
    variante_id: row.variante_id,
    variante_nome: row.variante_nome,
  }));
}

/**
 * Valida se o arquivo é um arquivo Upseller válido
 */
export function isUpsellerFile(fileName: string): boolean {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'xlsx' || ext === 'xls' || ext === 'csv';
}
