/**
 * Sistema de Importação/Exportação de Produtos V2
 * Suporta: single, variation_parent, variation_child, kit
 * Validações robustas e relatório de erros
 */

import * as XLSX from 'xlsx';

// ============= TIPOS =============

export type TipoProdutoImport = 'single' | 'variation_parent' | 'variation_child' | 'kit';

export interface ProdutoImportRowV2 {
  linha: number;
  sku: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  subcategoria?: string;
  tipo: TipoProdutoImport;
  parent_sku?: string;
  atributos_variacao?: Record<string, string>; // { cor: "Vermelho", tamanho: "M" }
  kit_components?: { sku: string; quantidade: number }[];
  custo: number;
  preco_venda: number;
  unidade_medida: string;
  ncm?: string;
  peso_kg?: number;
  altura_cm?: number;
  largura_cm?: number;
  profundidade_cm?: number;
  fornecedor_nome?: string;
  // Estoque inicial
  armazem_codigo?: string;
  estoque_inicial?: number;
  // Mapeamento marketplace
  canal?: string;
  anuncio_id?: string;
  variante_id?: string;
  nome_loja?: string;
  ativo: boolean;
}

export interface ErroImportacao {
  linha: number;
  sku: string;
  tipo: 'erro' | 'aviso';
  mensagem: string;
  campo?: string;
}

export interface ValidacaoImportResult {
  valido: boolean;
  linhasValidas: ProdutoImportRowV2[];
  erros: ErroImportacao[];
  resumo: {
    total: number;
    singles: number;
    variationParents: number;
    variationChildren: number;
    kits: number;
    novos: number;
    atualizacoes: number;
    duplicadosPlanilha: number;
    duplicadosBanco: number;
    erros: number;
    avisos: number;
  };
}

export interface ImportResultV2 {
  sucesso: boolean;
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: ErroImportacao[];
}

// ============= MAPEAMENTO DE COLUNAS =============

const COLUMN_MAPPINGS: Record<string, string[]> = {
  sku: ['sku', 'sku_interno', 'codigo', 'codigo_interno', 'cod', 'id_produto'],
  nome: ['nome', 'titulo', 'title', 'name', 'produto', 'descricao_produto'],
  descricao: ['descricao', 'description', 'desc', 'detalhes'],
  categoria: ['categoria', 'category', 'cat', 'grupo'],
  subcategoria: ['subcategoria', 'subcategory', 'subcat'],
  tipo: ['tipo', 'type', 'tipo_produto', 'product_type'],
  parent_sku: ['parent_sku', 'sku_pai', 'pai', 'parent', 'sku_parent'],
  atributos: ['atributos', 'atributos_variacao', 'attributes', 'variacao', 'variação'],
  kit_components: ['kit_components', 'componentes', 'components', 'kit_itens', 'itens_kit'],
  custo: ['custo', 'preco_custo', 'cost', 'preco_compra', 'valor_custo', 'custo_unitario'],
  preco_venda: ['preco_venda', 'preco', 'price', 'valor', 'valor_venda', 'preco_unitario'],
  unidade: ['unidade', 'un', 'unit', 'unidade_medida'],
  ncm: ['ncm', 'codigo_ncm', 'ncm_code'],
  peso_kg: ['peso', 'peso_kg', 'weight', 'kg'],
  altura_cm: ['altura', 'altura_cm', 'height'],
  largura_cm: ['largura', 'largura_cm', 'width'],
  profundidade_cm: ['profundidade', 'profundidade_cm', 'depth', 'comprimento'],
  fornecedor: ['fornecedor', 'fornecedor_nome', 'supplier', 'vendor'],
  armazem: ['armazem', 'armazem_codigo', 'warehouse', 'deposito'],
  estoque_inicial: ['estoque', 'estoque_inicial', 'quantidade', 'qty', 'stock'],
  canal: ['canal', 'channel', 'marketplace'],
  anuncio_id: ['anuncio_id', 'id_anuncio', 'id do anúncio', 'mlb', 'announcement_id'],
  variante_id: ['variante_id', 'id_variante', 'id da variante', 'variation_id'],
  nome_loja: ['nome_loja', 'loja', 'store', 'nome da loja'],
  ativo: ['ativo', 'active', 'status', 'situacao'],
  // Atributos comuns de variação
  cor: ['cor', 'color', 'colour'],
  tamanho: ['tamanho', 'size', 'tam'],
  voltagem: ['voltagem', 'voltage', 'volts'],
  material: ['material', 'mat'],
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

// ============= PARSERS =============

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str)) return 0;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return 0;
  
  const cleaned = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) return true;
  
  const str = String(value).toLowerCase().trim();
  return !['nao', 'não', 'no', 'false', '0', 'inativo', 'inactive'].includes(str);
}

function parseTipo(value: any): TipoProdutoImport {
  if (!value) return 'single';
  const str = String(value).toLowerCase().trim();
  
  if (str.includes('variation_parent') || str.includes('pai') || str === 'parent') return 'variation_parent';
  if (str.includes('variation_child') || str.includes('filho') || str === 'child') return 'variation_child';
  if (str.includes('kit')) return 'kit';
  return 'single';
}

function parseKitComponents(value: any): { sku: string; quantidade: number }[] | undefined {
  if (!value) return undefined;
  
  try {
    // Tentar parse JSON
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          sku: String(item.sku || item.SKU || '').toUpperCase(),
          quantidade: Number(item.quantidade || item.qty || item.qtd || 1)
        })).filter(item => item.sku);
      }
    }
    
    // Formato: SKU1:2,SKU2:3
    if (typeof value === 'string' && value.includes(':')) {
      return value.split(',').map(item => {
        const [sku, qtd] = item.trim().split(':');
        return { sku: sku.toUpperCase(), quantidade: Number(qtd) || 1 };
      }).filter(item => item.sku);
    }
  } catch (e) {
    console.error('Erro ao parsear kit_components:', e);
  }
  
  return undefined;
}

function parseAtributosVariacao(value: any, row: Record<string, any>, headers: string[]): Record<string, string> | undefined {
  const atributos: Record<string, string> = {};
  
  // Tentar parse JSON
  if (value) {
    try {
      if (typeof value === 'string' && value.startsWith('{')) {
        return JSON.parse(value);
      }
    } catch (e) {}
  }
  
  // Buscar colunas de atributos comuns
  const corCol = findColumn(headers, 'cor');
  const tamanhoCol = findColumn(headers, 'tamanho');
  const voltagemCol = findColumn(headers, 'voltagem');
  const materialCol = findColumn(headers, 'material');
  
  if (corCol && row[corCol]) atributos.cor = String(row[corCol]).trim();
  if (tamanhoCol && row[tamanhoCol]) atributos.tamanho = String(row[tamanhoCol]).trim();
  if (voltagemCol && row[voltagemCol]) atributos.voltagem = String(row[voltagemCol]).trim();
  if (materialCol && row[materialCol]) atributos.material = String(row[materialCol]).trim();
  
  return Object.keys(atributos).length > 0 ? atributos : undefined;
}

// ============= PARSE ARQUIVOS =============

export async function parseCSVProdutosV2(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
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

export async function parseXLSXProdutosV2(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
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

export async function processarArquivoProdutosV2(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.csv')) {
    return parseCSVProdutosV2(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXProdutosV2(file);
  } else {
    throw new Error('Formato não suportado. Use CSV ou XLSX.');
  }
}

// ============= VALIDAÇÃO COMPLETA =============

export function validarImportacaoProdutos(
  headers: string[],
  rows: Record<string, any>[],
  produtosExistentes: { sku: string; id: string; tipo: string }[]
): ValidacaoImportResult {
  const erros: ErroImportacao[] = [];
  const linhasValidas: ProdutoImportRowV2[] = [];
  const skusNaPlanilha = new Map<string, number>(); // SKU -> linha
  const skusExistentes = new Map(produtosExistentes.map(p => [p.sku.toUpperCase(), p]));
  
  // Encontrar colunas
  const skuCol = findColumn(headers, 'sku');
  const nomeCol = findColumn(headers, 'nome');
  const descCol = findColumn(headers, 'descricao');
  const catCol = findColumn(headers, 'categoria');
  const subcatCol = findColumn(headers, 'subcategoria');
  const tipoCol = findColumn(headers, 'tipo');
  const parentSkuCol = findColumn(headers, 'parent_sku');
  const atributosCol = findColumn(headers, 'atributos');
  const kitComponentsCol = findColumn(headers, 'kit_components');
  const custoCol = findColumn(headers, 'custo');
  const precoCol = findColumn(headers, 'preco_venda');
  const unidadeCol = findColumn(headers, 'unidade');
  const ncmCol = findColumn(headers, 'ncm');
  const pesoCol = findColumn(headers, 'peso_kg');
  const alturaCol = findColumn(headers, 'altura_cm');
  const larguraCol = findColumn(headers, 'largura_cm');
  const profundidadeCol = findColumn(headers, 'profundidade_cm');
  const fornecedorCol = findColumn(headers, 'fornecedor');
  const armazemCol = findColumn(headers, 'armazem');
  const estoqueCol = findColumn(headers, 'estoque_inicial');
  const canalCol = findColumn(headers, 'canal');
  const anuncioIdCol = findColumn(headers, 'anuncio_id');
  const varianteIdCol = findColumn(headers, 'variante_id');
  const lojaCol = findColumn(headers, 'nome_loja');
  const ativoCol = findColumn(headers, 'ativo');
  
  // Validação: coluna SKU é obrigatória
  if (!skuCol) {
    return {
      valido: false,
      linhasValidas: [],
      erros: [{ linha: 0, sku: '', tipo: 'erro', mensagem: 'Coluna SKU não encontrada', campo: 'sku' }],
      resumo: { total: 0, singles: 0, variationParents: 0, variationChildren: 0, kits: 0, novos: 0, atualizacoes: 0, duplicadosPlanilha: 0, duplicadosBanco: 0, erros: 1, avisos: 0 }
    };
  }
  
  let singles = 0, variationParents = 0, variationChildren = 0, kits = 0;
  let novos = 0, atualizacoes = 0, duplicadosPlanilha = 0, duplicadosBanco = 0;
  
  // Primeira passagem: coletar todos os SKUs e parent_skus
  const parentSkusReferenciados = new Set<string>();
  const kitSkusReferenciados = new Set<string>();
  
  rows.forEach((row, index) => {
    const sku = String(row[skuCol!] || '').trim().toUpperCase();
    const tipo = tipoCol ? parseTipo(row[tipoCol]) : 'single';
    const parentSku = parentSkuCol ? String(row[parentSkuCol] || '').trim().toUpperCase() : '';
    const kitComponents = kitComponentsCol ? parseKitComponents(row[kitComponentsCol]) : undefined;
    
    if (tipo === 'variation_child' && parentSku) {
      parentSkusReferenciados.add(parentSku);
    }
    
    if (tipo === 'kit' && kitComponents) {
      kitComponents.forEach(comp => kitSkusReferenciados.add(comp.sku));
    }
    
    if (sku) skusNaPlanilha.set(sku, index + 2);
  });
  
  // Segunda passagem: validar cada linha
  rows.forEach((row, index) => {
    const linhaNum = index + 2; // +2 porque linha 1 é header
    const sku = String(row[skuCol!] || '').trim().toUpperCase();
    
    // Validação: SKU vazio
    if (!sku) {
      erros.push({ linha: linhaNum, sku: '', tipo: 'erro', mensagem: 'SKU vazio', campo: 'sku' });
      return;
    }
    
    // Validação: SKU duplicado na planilha
    const linhaExistente = skusNaPlanilha.get(sku);
    if (linhaExistente && linhaExistente < linhaNum) {
      erros.push({ linha: linhaNum, sku, tipo: 'erro', mensagem: `SKU duplicado na planilha (primeira ocorrência: linha ${linhaExistente})`, campo: 'sku' });
      duplicadosPlanilha++;
      return;
    }
    
    const tipo = tipoCol ? parseTipo(row[tipoCol]) : 'single';
    const parentSku = parentSkuCol ? String(row[parentSkuCol] || '').trim().toUpperCase() : '';
    const kitComponents = kitComponentsCol ? parseKitComponents(row[kitComponentsCol]) : undefined;
    const atributos = parseAtributosVariacao(atributosCol ? row[atributosCol] : null, row, headers);
    const estoque = estoqueCol ? parseNumber(row[estoqueCol]) : undefined;
    
    // Validação: variation_child sem parent_sku
    if (tipo === 'variation_child' && !parentSku) {
      erros.push({ linha: linhaNum, sku, tipo: 'erro', mensagem: 'Variação filho sem parent_sku definido', campo: 'parent_sku' });
      return;
    }
    
    // Validação: variation_child com parent_sku inexistente
    if (tipo === 'variation_child' && parentSku) {
      if (!skusNaPlanilha.has(parentSku) && !skusExistentes.has(parentSku)) {
        erros.push({ linha: linhaNum, sku, tipo: 'erro', mensagem: `parent_sku "${parentSku}" não existe na planilha nem no banco`, campo: 'parent_sku' });
        return;
      }
    }
    
    // Validação: variation_parent não pode ter estoque
    if (tipo === 'variation_parent' && estoque && estoque > 0) {
      erros.push({ linha: linhaNum, sku, tipo: 'aviso', mensagem: 'SKU pai (variation_parent) não deve ter estoque - estoque será ignorado', campo: 'estoque_inicial' });
    }
    
    // Validação: kit com componentes inexistentes
    if (tipo === 'kit') {
      if (!kitComponents || kitComponents.length === 0) {
        erros.push({ linha: linhaNum, sku, tipo: 'erro', mensagem: 'Kit sem componentes definidos (kit_components)', campo: 'kit_components' });
        return;
      }
      
      for (const comp of kitComponents) {
        if (!skusNaPlanilha.has(comp.sku) && !skusExistentes.has(comp.sku)) {
          erros.push({ linha: linhaNum, sku, tipo: 'erro', mensagem: `Componente do kit "${comp.sku}" não existe`, campo: 'kit_components' });
          return;
        }
      }
    }
    
    // Validação: kit não pode ter estoque manual
    if (tipo === 'kit' && estoque && estoque > 0) {
      erros.push({ linha: linhaNum, sku, tipo: 'aviso', mensagem: 'Kit não pode ter estoque manual - estoque será calculado automaticamente', campo: 'estoque_inicial' });
    }
    
    // Verificar se é atualização ou novo
    const existente = skusExistentes.get(sku);
    if (existente) {
      atualizacoes++;
      duplicadosBanco++;
    } else {
      novos++;
    }
    
    // Contar por tipo
    switch (tipo) {
      case 'single': singles++; break;
      case 'variation_parent': variationParents++; break;
      case 'variation_child': variationChildren++; break;
      case 'kit': kits++; break;
    }
    
    // Montar linha válida
    const linhaValida: ProdutoImportRowV2 = {
      linha: linhaNum,
      sku,
      nome: nomeCol ? String(row[nomeCol] || sku).trim() : sku,
      descricao: descCol ? String(row[descCol] || '').trim() || undefined : undefined,
      categoria: catCol ? String(row[catCol] || '').trim() || undefined : undefined,
      subcategoria: subcatCol ? String(row[subcatCol] || '').trim() || undefined : undefined,
      tipo,
      parent_sku: parentSku || undefined,
      atributos_variacao: atributos,
      kit_components: kitComponents,
      custo: custoCol ? parseNumber(row[custoCol]) : 0,
      preco_venda: precoCol ? parseNumber(row[precoCol]) : 0,
      unidade_medida: unidadeCol ? String(row[unidadeCol] || 'un').trim() : 'un',
      ncm: ncmCol ? String(row[ncmCol] || '').trim() || undefined : undefined,
      peso_kg: pesoCol ? parseNumber(row[pesoCol]) || undefined : undefined,
      altura_cm: alturaCol ? parseNumber(row[alturaCol]) || undefined : undefined,
      largura_cm: larguraCol ? parseNumber(row[larguraCol]) || undefined : undefined,
      profundidade_cm: profundidadeCol ? parseNumber(row[profundidadeCol]) || undefined : undefined,
      fornecedor_nome: fornecedorCol ? String(row[fornecedorCol] || '').trim() || undefined : undefined,
      armazem_codigo: armazemCol ? String(row[armazemCol] || '').trim() || undefined : undefined,
      estoque_inicial: (tipo !== 'variation_parent' && tipo !== 'kit') ? estoque : undefined,
      canal: canalCol ? String(row[canalCol] || '').trim() || undefined : undefined,
      anuncio_id: anuncioIdCol ? String(row[anuncioIdCol] || '').trim() || undefined : undefined,
      variante_id: varianteIdCol ? String(row[varianteIdCol] || '').trim() || undefined : undefined,
      nome_loja: lojaCol ? String(row[lojaCol] || '').trim() || undefined : undefined,
      ativo: ativoCol ? parseBoolean(row[ativoCol]) : true,
    };
    
    linhasValidas.push(linhaValida);
  });
  
  const totalErros = erros.filter(e => e.tipo === 'erro').length;
  const totalAvisos = erros.filter(e => e.tipo === 'aviso').length;
  
  return {
    valido: totalErros === 0,
    linhasValidas,
    erros,
    resumo: {
      total: rows.length,
      singles,
      variationParents,
      variationChildren,
      kits,
      novos,
      atualizacoes,
      duplicadosPlanilha,
      duplicadosBanco,
      erros: totalErros,
      avisos: totalAvisos,
    }
  };
}

// ============= GERAR PLANILHA MODELO V2 =============

export function gerarPlanilhaModeloV2(formato: 'csv' | 'xlsx'): Blob {
  const headers = [
    'SKU',
    'Nome',
    'Descrição',
    'Categoria',
    'Subcategoria',
    'Tipo', // single, variation_parent, variation_child, kit
    'Parent SKU', // Para variation_child
    'Cor', // Atributo de variação
    'Tamanho', // Atributo de variação
    'Kit Components', // JSON: [{"sku":"X","quantidade":2}]
    'Custo',
    'Preço Venda',
    'Unidade',
    'NCM',
    'Peso (kg)',
    'Altura (cm)',
    'Largura (cm)',
    'Profundidade (cm)',
    'Fornecedor',
    'Armazém',
    'Estoque Inicial',
    'Canal',
    'Anúncio ID',
    'Variante ID',
    'Nome Loja',
    'Ativo',
  ];

  const exemploLinhas = [
    // Produto único
    ['PROD-001', 'Camiseta Básica', 'Camiseta algodão', 'Vestuário', 'Camisetas', 'single', '', '', '', '', '25,00', '79,90', 'un', '61091000', '0.2', '2', '30', '40', 'Fornecedor A', 'PRINCIPAL', '100', 'mercado_livre', 'MLB123456', '', 'Loja ML', 'sim'],
    // Variation parent (SKU agrupador)
    ['CAM-PAI', 'Camiseta Colorida', 'Camiseta em várias cores', 'Vestuário', 'Camisetas', 'variation_parent', '', '', '', '', '25,00', '79,90', 'un', '61091000', '', '', '', '', '', '', '', '', '', '', '', 'sim'],
    // Variation children
    ['CAM-VM', 'Camiseta Colorida - Vermelho', '', '', '', 'variation_child', 'CAM-PAI', 'Vermelho', '', '', '25,00', '79,90', 'un', '', '', '', '', '', '', 'PRINCIPAL', '50', '', '', '', '', 'sim'],
    ['CAM-AZ', 'Camiseta Colorida - Azul', '', '', '', 'variation_child', 'CAM-PAI', 'Azul', '', '', '25,00', '79,90', 'un', '', '', '', '', '', '', 'PRINCIPAL', '30', '', '', '', '', 'sim'],
    // Kit
    ['KIT-DUO', 'Kit Duo Camisetas', 'Kit com 2 camisetas', 'Vestuário', 'Kits', 'kit', '', '', '', '[{"sku":"CAM-VM","quantidade":1},{"sku":"CAM-AZ","quantidade":1}]', '50,00', '139,90', 'un', '', '', '', '', '', '', '', '', '', '', '', '', 'sim'],
  ];

  if (formato === 'csv') {
    const linhas = [headers.join(';'), ...exemploLinhas.map(l => l.join(';'))];
    return new Blob(['\ufeff' + linhas.join('\n')], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exemploLinhas]);
    
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}

// ============= EXPORTAR PRODUTOS V2 =============

export function exportarProdutosV2(
  produtos: any[],
  formato: 'csv' | 'xlsx',
  estoques?: { produto_id: string; armazem_codigo: string; quantidade: number }[],
  mapeamentos?: { produto_id: string; canal: string; anuncio_id?: string; variante_id?: string; nome_loja?: string }[]
): Blob {
  const headers = [
    'SKU',
    'Nome',
    'Descrição',
    'Categoria',
    'Subcategoria',
    'Tipo',
    'Parent SKU',
    'Atributos Variação',
    'Kit Components',
    'Custo',
    'Preço Venda',
    'Unidade',
    'NCM',
    'Peso (kg)',
    'Altura (cm)',
    'Largura (cm)',
    'Profundidade (cm)',
    'Fornecedor',
    'Armazém',
    'Estoque',
    'Canal',
    'Anúncio ID',
    'Variante ID',
    'Nome Loja',
    'Ativo',
  ];

  const estoqueMap = new Map<string, { armazem: string; quantidade: number }>();
  estoques?.forEach(e => {
    estoqueMap.set(e.produto_id, { armazem: e.armazem_codigo, quantidade: e.quantidade });
  });

  const mapeamentoMap = new Map<string, any>();
  mapeamentos?.forEach(m => {
    mapeamentoMap.set(m.produto_id, m);
  });

  const linhas: string[][] = produtos.map(p => {
    const estoque = estoqueMap.get(p.id);
    const mapeamento = mapeamentoMap.get(p.id);
    
    return [
      p.sku || '',
      p.nome || '',
      p.descricao || '',
      p.categoria || '',
      p.subcategoria || '',
      p.tipo || 'single',
      p.parent_id ? (produtos.find(pp => pp.id === p.parent_id)?.sku || '') : '',
      p.atributos_variacao ? JSON.stringify(p.atributos_variacao) : '',
      p.kit_componentes ? JSON.stringify(p.kit_componentes) : '',
      (p.custo_medio || 0).toFixed(2).replace('.', ','),
      (p.preco_venda || 0).toFixed(2).replace('.', ','),
      p.unidade_medida || 'un',
      p.ncm || '',
      (p.peso_kg || '').toString(),
      (p.altura_cm || '').toString(),
      (p.largura_cm || '').toString(),
      (p.profundidade_cm || '').toString(),
      p.fornecedor_nome || '',
      estoque?.armazem || '',
      (estoque?.quantidade || '').toString(),
      mapeamento?.canal || '',
      mapeamento?.anuncio_id || '',
      mapeamento?.variante_id || '',
      mapeamento?.nome_loja || '',
      p.status === 'ativo' ? 'sim' : 'não',
    ];
  });

  if (formato === 'csv') {
    const csv = [headers.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
    return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  } else {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...linhas]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
