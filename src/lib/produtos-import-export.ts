/**
 * Utilitários para importação e exportação de produtos
 * Formato compatível com Upseller para facilitar migração
 */

import * as XLSX from 'xlsx';

// ============= TIPOS =============

export interface ProdutoImportRow {
  sku_interno: string;
  mapeado_sku_anuncio?: string;
  variante?: string;
  anuncio_id?: string;
  variante_id?: string;
  nome_loja?: string;
  // Campos adicionais para cadastro de produto
  nome?: string;
  descricao?: string;
  categoria?: string;
  preco_custo?: number;
  preco_venda?: number;
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

// ============= MAPEAMENTO DE COLUNAS (FORMATO UPSELLER) =============

// Aceita variações de nomes de colunas (baseado no Upseller)
const COLUMN_MAPPINGS: Record<string, string[]> = {
  // Formato Upseller
  sku_interno: ['sku', 'sku_interno', 'codigo', 'codigo_interno', 'cod', 'id_produto', 'product_id'],
  mapeado_sku_anuncio: ['mapeado', 'mapeado sku do anúncio', 'mapeado_sku_anuncio', 'sku_marketplace', 'mlb', 'sku_ml', 'sku_shopee'],
  variante: ['variante', 'variacao', 'variation', 'variação'],
  anuncio_id: ['id do anúncio', 'id_anuncio', 'anuncio_id', 'id anuncio', 'announcement_id'],
  variante_id: ['id da variante', 'id_variante', 'variante_id', 'id variante', 'variation_id'],
  nome_loja: ['nome da loja', 'nome_loja', 'loja', 'store', 'canal'],
  // Campos adicionais para cadastro
  nome: ['nome', 'titulo', 'title', 'name', 'produto', 'descricao_produto'],
  descricao: ['descricao', 'description', 'desc', 'detalhes'],
  categoria: ['categoria', 'category', 'cat', 'grupo'],
  preco_custo: ['preco_custo', 'custo', 'cost', 'preco_compra', 'valor_custo', 'custo_unitario'],
  preco_venda: ['preco_venda', 'preco', 'price', 'valor', 'valor_venda', 'preco_unitario'],
  unidade: ['unidade', 'un', 'unit', 'unidade_medida'],
  ncm: ['ncm', 'codigo_ncm', 'ncm_code'],
  ativo: ['ativo', 'active', 'status', 'situacao', 'atualizado'],
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
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return 0;
  
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

// ============= DETECTAR CANAL A PARTIR DO NOME DA LOJA =============

function detectarCanal(nomeLoja: string | null | undefined): string {
  if (!nomeLoja) return '';
  const loja = nomeLoja.toLowerCase().trim();
  
  if (loja.startsWith('mercado') || loja.includes('meli') || loja.includes('mlb')) {
    return 'mercado_livre';
  }
  if (loja.startsWith('shopee') || loja.includes('shopee')) {
    return 'shopee';
  }
  if (loja.startsWith('shein') || loja.includes('shein')) {
    return 'shein';
  }
  if (loja.startsWith('tiktok') || loja.includes('tiktok')) {
    return 'tiktok';
  }
  if (loja.startsWith('amazon') || loja.includes('amazon')) {
    return 'amazon';
  }
  
  return '';
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

// ============= MAPEAR LINHAS PARA PRODUTOS (FORMATO UPSELLER) =============

export function mapearLinhasParaProdutos(
  headers: string[],
  rows: Record<string, any>[],
  produtosExistentes: { codigo_interno: string; id: string }[]
): ImportPreview {
  // Colunas formato Upseller
  const skuCol = findColumn(headers, 'sku_interno');
  const mapeadoCol = findColumn(headers, 'mapeado_sku_anuncio');
  const varianteCol = findColumn(headers, 'variante');
  const anuncioIdCol = findColumn(headers, 'anuncio_id');
  const varianteIdCol = findColumn(headers, 'variante_id');
  const lojaCol = findColumn(headers, 'nome_loja');
  
  // Colunas adicionais para cadastro de produto
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
      erros: [{ linha: 0, motivo: 'Coluna SKU não encontrada. Esperado: "SKU" ou "sku_interno"' }],
    };
  }

  const existentesMap = new Map(produtosExistentes.map(p => [p.codigo_interno.toLowerCase(), p.id]));
  const linhas: ProdutoImportRow[] = [];
  const erros: { linha: number; motivo: string }[] = [];
  let novos = 0;
  let existentes = 0;
  let invalidos = 0;

  rows.forEach((row, index) => {
    const sku = String(row[skuCol] || '').trim().toUpperCase();

    // Validações
    if (!sku) {
      erros.push({ linha: index + 2, motivo: 'SKU vazio' });
      invalidos++;
      return;
    }

    // Valores formato Upseller
    const mapeado = mapeadoCol ? String(row[mapeadoCol] || '').trim() : undefined;
    const variante = varianteCol ? String(row[varianteCol] || '').trim() : undefined;
    const anuncioId = anuncioIdCol ? String(row[anuncioIdCol] || '').trim() : undefined;
    const varianteId = varianteIdCol ? String(row[varianteIdCol] || '').trim() : undefined;
    const nomeLoja = lojaCol ? String(row[lojaCol] || '').trim() : undefined;

    // Valores adicionais para cadastro
    const custoRaw = custoCol ? row[custoCol] : 0;
    const vendaRaw = vendaCol ? row[vendaCol] : 0;
    const preco_custo = parseNumber(custoRaw);
    const preco_venda = parseNumber(vendaRaw);

    const produto: ProdutoImportRow = {
      sku_interno: sku,
      mapeado_sku_anuncio: mapeado || undefined,
      variante: variante && variante !== '-' ? variante : undefined,
      anuncio_id: anuncioId || undefined,
      variante_id: varianteId || undefined,
      nome_loja: nomeLoja || undefined,
      // Campos de cadastro (usa SKU como nome se não tiver coluna nome)
      nome: nomeCol ? String(row[nomeCol] || sku).trim() : sku,
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

// ============= GERAR PLANILHA MODELO (FORMATO UPSELLER) =============

export function gerarPlanilhaModelo(formato: 'csv' | 'xlsx'): Blob {
  // Headers no formato Upseller
  const headers = [
    'SKU',
    'Mapeado SKU do Anúncio',
    'Variante',
    'ID do Anúncio',
    'ID da Variante',
    'Nome da Loja',
    'Nome',
    'Categoria',
    'Custo',
    'Preço Venda',
    'Unidade',
    'NCM',
  ];

  const exemploLinhas = [
    ['GU-CH-IN-ROS', '23897313367', 'ROSA', '23897313367', '267208618919', 'shopee-SHOPEE EXCHANGE', 'Guirlanda Chamas Rosa', 'Decoração', '15.50', '39.90', 'un', ''],
    ['02-FL-NE-10-DO', 'MLB4116616322_191814572833', 'Dourado,Floco', 'MLB4116616322', '191814572833', 'mercado-MELI EX KIDS', 'Floco Neon 10cm Dourado', 'Natal', '8.00', '19.90', 'un', ''],
    ['FL-10M-USB-BQ', 'MLB4338857361', '-', 'MLB4338857361', 'MLB4338857361', 'mercado-MELI EX KIDS', 'Fio LED USB 10m', 'Iluminação', '12.00', '34.90', 'un', ''],
    ['AR-90-100-PL-VE-SH', 'AR-90-100-PL-VE-SH', 'Verde', 'h24110971270', 'I34ca93eke3b', 'shein-SHEIN EXCHANGE', 'Árvore Natal 90cm Verde', 'Natal', '45.00', '129.90', 'un', ''],
  ];

  if (formato === 'csv') {
    const linhas = [headers.join(';'), ...exemploLinhas.map(l => l.join(';'))];
    return new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemploLinhas]);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 20 }, // SKU
      { wch: 30 }, // Mapeado
      { wch: 15 }, // Variante
      { wch: 18 }, // ID Anúncio
      { wch: 18 }, // ID Variante
      { wch: 25 }, // Nome Loja
      { wch: 30 }, // Nome
      { wch: 15 }, // Categoria
      { wch: 10 }, // Custo
      { wch: 12 }, // Preço
      { wch: 8 },  // Unidade
      { wch: 12 }, // NCM
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

// ============= EXPORTAR PRODUTOS (FORMATO UPSELLER) =============

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
  formato: 'csv' | 'xlsx',
  mapeamentos?: {
    sku_interno: string;
    canal: string;
    loja?: string | null;
    anuncio_id?: string | null;
    variante_id?: string | null;
    variante_nome?: string | null;
  }[]
): Blob {
  // Headers no formato Upseller
  const headers = [
    'SKU',
    'Mapeado SKU do Anúncio',
    'Variante',
    'ID do Anúncio',
    'ID da Variante',
    'Nome da Loja',
    'Nome',
    'Categoria',
    'Custo',
    'Preço Venda',
    'Unidade',
    'NCM',
  ];

  // Criar mapa de mapeamentos por SKU
  const mapeamentosMap = new Map<string, typeof mapeamentos>();
  if (mapeamentos) {
    mapeamentos.forEach(m => {
      const key = m.sku_interno.toUpperCase();
      if (!mapeamentosMap.has(key)) {
        mapeamentosMap.set(key, []);
      }
      mapeamentosMap.get(key)!.push(m);
    });
  }

  const linhas: string[][] = [];

  produtos.forEach(p => {
    const skuMaps = mapeamentosMap.get(p.codigo_interno.toUpperCase()) || [];
    
    if (skuMaps.length === 0) {
      // Produto sem mapeamento - exportar uma linha simples
      linhas.push([
        p.codigo_interno,
        '',
        '-',
        '',
        '',
        '',
        p.nome,
        p.categoria || '',
        p.custo_medio_atual.toFixed(2).replace('.', ','),
        (p.preco_venda_sugerido || 0).toFixed(2).replace('.', ','),
        p.unidade_medida,
        p.ncm || '',
      ]);
    } else {
      // Produto com mapeamentos - uma linha por mapeamento
      skuMaps.forEach(m => {
        const mapeadoSku = m.anuncio_id 
          ? (m.variante_id && m.variante_id !== m.anuncio_id ? `${m.anuncio_id}_${m.variante_id}` : m.anuncio_id)
          : '';
        
        linhas.push([
          p.codigo_interno,
          mapeadoSku,
          m.variante_nome || '-',
          m.anuncio_id || '',
          m.variante_id || '',
          m.loja || '',
          p.nome,
          p.categoria || '',
          p.custo_medio_atual.toFixed(2).replace('.', ','),
          (p.preco_venda_sugerido || 0).toFixed(2).replace('.', ','),
          p.unidade_medida,
          p.ncm || '',
        ]);
      });
    }
  });

  if (formato === 'csv') {
    const csv = [headers.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 20 }, // SKU
      { wch: 30 }, // Mapeado
      { wch: 15 }, // Variante
      { wch: 18 }, // ID Anúncio
      { wch: 18 }, // ID Variante
      { wch: 25 }, // Nome Loja
      { wch: 30 }, // Nome
      { wch: 15 }, // Categoria
      { wch: 10 }, // Custo
      { wch: 12 }, // Preço
      { wch: 8 },  // Unidade
      { wch: 12 }, // NCM
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

// ============= EXPORTAR MAPEAMENTOS PARA UPSELLER =============

export function exportarMapeamentosUpseller(
  mapeamentos: {
    sku_interno: string;
    canal: string;
    loja?: string | null;
    anuncio_id?: string | null;
    variante_id?: string | null;
    variante_nome?: string | null;
    updated_at?: string;
  }[],
  formato: 'csv' | 'xlsx'
): Blob {
  // Headers exatamente como no Upseller
  const headers = [
    'SKU',
    'Mapeado SKU do Anúncio',
    'Variante',
    'ID do Anúncio',
    'ID da Variante',
    'Nome da Loja',
    'Atualizado',
  ];

  const linhas = mapeamentos.map(m => {
    const mapeadoSku = m.anuncio_id 
      ? (m.variante_id && m.variante_id !== m.anuncio_id ? `${m.anuncio_id}_${m.variante_id}` : m.anuncio_id)
      : m.sku_interno;
    
    return [
      m.sku_interno,
      mapeadoSku,
      m.variante_nome || '-',
      m.anuncio_id || '',
      m.variante_id || '',
      m.loja || '',
      m.updated_at || new Date().toISOString().replace('T', ' ').slice(0, 19),
    ];
  });

  if (formato === 'csv') {
    const csv = [headers.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 20 }, // SKU
      { wch: 30 }, // Mapeado
      { wch: 15 }, // Variante
      { wch: 18 }, // ID Anúncio
      { wch: 18 }, // ID Variante
      { wch: 25 }, // Nome Loja
      { wch: 20 }, // Atualizado
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU_Map_Relationship');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
