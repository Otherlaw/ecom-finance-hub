/**
 * Utilitários para importação e exportação de produtos
 * Baseado na estrutura exportada do Upseller
 */

import * as XLSX from 'xlsx';

// ============= TIPOS =============

export interface ProdutoImportRow {
  sku_interno: string;
  sku_marketplace?: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  preco_custo: number;
  preco_venda: number;
  unidade?: string;
  ncm?: string;
  ativo?: boolean;
}

export interface ImportResult {
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: { linha: number; motivo: string }[];
}

export interface ImportPreview {
  total: number;
  novos: number;
  existentes: number;
  invalidos: number;
  linhas: ProdutoImportRow[];
  erros: { linha: number; motivo: string }[];
}

// ============= MAPEAMENTO DE COLUNAS =============

// Aceita variações de nomes de colunas (baseado no Upseller)
const COLUMN_MAPPINGS: Record<string, string[]> = {
  sku_interno: ['sku_interno', 'sku', 'codigo', 'codigo_interno', 'cod', 'id_produto', 'product_id'],
  sku_marketplace: ['sku_marketplace', 'mlb', 'sku_ml', 'sku_shopee', 'anuncio_id', 'marketplace_sku'],
  nome: ['nome', 'titulo', 'title', 'name', 'produto', 'descricao_produto'],
  descricao: ['descricao', 'description', 'desc', 'detalhes'],
  categoria: ['categoria', 'category', 'cat', 'grupo'],
  preco_custo: ['preco_custo', 'custo', 'cost', 'preco_compra', 'valor_custo', 'custo_unitario'],
  preco_venda: ['preco_venda', 'preco', 'price', 'valor', 'valor_venda', 'preco_unitario'],
  unidade: ['unidade', 'un', 'unit', 'unidade_medida'],
  ncm: ['ncm', 'codigo_ncm', 'ncm_code'],
  ativo: ['ativo', 'active', 'status', 'situacao'],
};

function findColumn(headers: string[], fieldName: string): string | null {
  const possibleNames = COLUMN_MAPPINGS[fieldName] || [fieldName];
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[_\s-]/g, ''));
  
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[_\s-]/g, '');
    const index = normalizedHeaders.findIndex(h => h === normalizedName || h.includes(normalizedName));
    if (index >= 0) return headers[index];
  }
  return null;
}

// ============= PARSE NUMBER =============

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  
  // Detectar formato de data e rejeitar
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str)) return 0;
  
  // Limpar formatação brasileira
  const cleaned = str
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return true; // Default: ativo
  
  const str = String(value).toLowerCase().trim();
  return !['nao', 'não', 'no', 'false', '0', 'inativo', 'inactive'].includes(str);
}

// ============= PARSE CSV =============

export async function parseCSVProdutos(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error('Arquivo vazio ou sem dados'));
          return;
        }
        
        // Detectar delimitador
        const firstLine = lines[0];
        const delimiter = firstLine.includes(';') ? ';' : ',';
        
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
        const rows: Record<string, any>[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
          const row: Record<string, any> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          rows.push(row);
        }
        
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ============= PARSE XLSX =============

export async function parseXLSXProdutos(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (json.length < 2) {
          reject(new Error('Arquivo vazio ou sem dados'));
          return;
        }
        
        const headers = json[0].map((h: any) => String(h || '').trim());
        const rows: Record<string, any>[] = [];
        
        for (let i = 1; i < json.length; i++) {
          const values = json[i];
          if (!values || values.length === 0) continue;
          
          const row: Record<string, any> = {};
          headers.forEach((header, index) => {
            row[header] = values[index] ?? '';
          });
          rows.push(row);
        }
        
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}

// ============= PROCESSAR ARQUIVO =============

export async function processarArquivoProdutos(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSVProdutos(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXProdutos(file);
  } else {
    throw new Error('Formato não suportado. Use CSV ou XLSX.');
  }
}

// ============= MAPEAR LINHAS PARA PRODUTOS =============

export function mapearLinhasParaProdutos(
  headers: string[],
  rows: Record<string, any>[],
  produtosExistentes: { codigo_interno: string; id: string }[]
): ImportPreview {
  const skuCol = findColumn(headers, 'sku_interno');
  const skuMktCol = findColumn(headers, 'sku_marketplace');
  const nomeCol = findColumn(headers, 'nome');
  const descCol = findColumn(headers, 'descricao');
  const catCol = findColumn(headers, 'categoria');
  const custoCol = findColumn(headers, 'preco_custo');
  const vendaCol = findColumn(headers, 'preco_venda');
  const unidadeCol = findColumn(headers, 'unidade');
  const ncmCol = findColumn(headers, 'ncm');
  const ativoCol = findColumn(headers, 'ativo');

  if (!skuCol) {
    return {
      total: 0,
      novos: 0,
      existentes: 0,
      invalidos: rows.length,
      linhas: [],
      erros: [{ linha: 0, motivo: 'Coluna SKU/código interno não encontrada' }],
    };
  }

  if (!nomeCol) {
    return {
      total: 0,
      novos: 0,
      existentes: 0,
      invalidos: rows.length,
      linhas: [],
      erros: [{ linha: 0, motivo: 'Coluna nome/título não encontrada' }],
    };
  }

  const existentesMap = new Map(produtosExistentes.map(p => [p.codigo_interno.toLowerCase(), p.id]));
  const linhas: ProdutoImportRow[] = [];
  const erros: { linha: number; motivo: string }[] = [];
  let novos = 0;
  let existentes = 0;
  let invalidos = 0;

  rows.forEach((row, index) => {
    const sku = String(row[skuCol] || '').trim();
    const nome = String(row[nomeCol] || '').trim();

    // Validações
    if (!sku) {
      erros.push({ linha: index + 2, motivo: 'SKU vazio' });
      invalidos++;
      return;
    }

    if (!nome) {
      erros.push({ linha: index + 2, motivo: 'Nome vazio' });
      invalidos++;
      return;
    }

    const custoRaw = custoCol ? row[custoCol] : 0;
    const vendaRaw = vendaCol ? row[vendaCol] : 0;
    const preco_custo = parseNumber(custoRaw);
    const preco_venda = parseNumber(vendaRaw);

    if (preco_custo < 0 || preco_venda < 0) {
      erros.push({ linha: index + 2, motivo: 'Preço negativo' });
      invalidos++;
      return;
    }

    const produto: ProdutoImportRow = {
      sku_interno: sku,
      sku_marketplace: skuMktCol ? String(row[skuMktCol] || '').trim() || undefined : undefined,
      nome,
      descricao: descCol ? String(row[descCol] || '').trim() || undefined : undefined,
      categoria: catCol ? String(row[catCol] || '').trim() || undefined : undefined,
      preco_custo,
      preco_venda,
      unidade: unidadeCol ? String(row[unidadeCol] || 'un').trim() : 'un',
      ncm: ncmCol ? String(row[ncmCol] || '').trim() || undefined : undefined,
      ativo: ativoCol ? parseBoolean(row[ativoCol]) : true,
    };

    linhas.push(produto);

    if (existentesMap.has(sku.toLowerCase())) {
      existentes++;
    } else {
      novos++;
    }
  });

  return {
    total: rows.length,
    novos,
    existentes,
    invalidos,
    linhas,
    erros,
  };
}

// ============= GERAR PLANILHA MODELO =============

export function gerarPlanilhaModelo(formato: 'csv' | 'xlsx'): Blob {
  const headers = [
    'sku_interno',
    'sku_marketplace',
    'nome',
    'descricao',
    'categoria',
    'preco_custo',
    'preco_venda',
    'unidade',
    'ncm',
    'ativo',
  ];

  const exemploLinhas = [
    ['SKU-001', 'MLB1234567890', 'Produto Exemplo 1', 'Descrição do produto', 'Eletrônicos', '100.00', '199.90', 'un', '85171231', 'sim'],
    ['SKU-002', '', 'Produto Exemplo 2', '', 'Informática', '50.50', '99.00', 'un', '', 'sim'],
  ];

  if (formato === 'csv') {
    const linhas = [headers.join(';'), ...exemploLinhas.map(l => l.join(';'))];
    return new Blob([linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemploLinhas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

// ============= EXPORTAR PRODUTOS =============

export function exportarProdutos(
  produtos: {
    codigo_interno: string;
    nome: string;
    descricao?: string | null;
    categoria?: string | null;
    custo_medio_atual: number;
    preco_venda_sugerido?: number | null;
    unidade_medida: string;
    ncm?: string | null;
    status: string;
    canais?: any[];
  }[],
  formato: 'csv' | 'xlsx'
): Blob {
  const headers = [
    'sku_interno',
    'sku_marketplace',
    'nome',
    'descricao',
    'categoria',
    'preco_custo',
    'preco_venda',
    'unidade',
    'ncm',
    'ativo',
  ];

  const linhas = produtos.map(p => {
    // Extrair primeiro SKU de marketplace se existir
    const skuMkt = Array.isArray(p.canais) && p.canais.length > 0 
      ? (p.canais[0]?.sku || p.canais[0]?.anuncioId || '') 
      : '';

    return [
      p.codigo_interno,
      skuMkt,
      p.nome,
      p.descricao || '',
      p.categoria || '',
      p.custo_medio_atual.toFixed(2).replace('.', ','),
      (p.preco_venda_sugerido || 0).toFixed(2).replace('.', ','),
      p.unidade_medida,
      p.ncm || '',
      p.status === 'ativo' ? 'sim' : 'nao',
    ];
  });

  if (formato === 'csv') {
    const csv = [headers.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
