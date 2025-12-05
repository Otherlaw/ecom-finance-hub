import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, Package, Sparkles, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useMarketplaceTransactions, MarketplaceTransactionInsert } from "@/hooks/useMarketplaceTransactions";
import { useMarketplaceAutoCategorizacao } from "@/hooks/useMarketplaceAutoCategorizacao";
import { ScrollArea } from "@/components/ui/scroll-area";
import { detectarGranularidadeItens, extrairItemDeLinhaCSV, type ItemVendaMarketplace } from "@/lib/marketplace-item-parser";
import { detectarTipoArquivo, parseCSVFile, parseXLSXFile, parseXLSXMercadoLivre, parseXLSXMercadoPago, type ParseResult } from "@/lib/parsers/arquivoFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportarMarketplaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type TransacaoPreview = {
  data_transacao: string;
  descricao: string;
  pedido_id: string | null;
  tipo_transacao: string;
  valor_bruto: number;
  tarifas: number;
  taxas: number;
  outros_descontos: number;
  valor_liquido: number;
  tipo_lancamento: 'credito' | 'debito';
  referencia_externa: string;
  // Itens associados (novo)
  itens: ItemVendaMarketplace[];
};

// Interface para estatísticas de importação
interface ImportStats {
  totalLinhasArquivo: number;
  totalTransacoesGeradas: number;
  totalComValorZero: number;
  totalDescartadasPorFormato: number;
  totalLinhasVazias: number;
  totalDuplicadas: number;
  totalInseridas: number;
}

const CANAIS = [
  { value: "mercado_livre", label: "Mercado Livre" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "shopee", label: "Shopee" },
  { value: "amazon", label: "Amazon" },
  { value: "tiktok", label: "TikTok Shop" },
  { value: "shein", label: "Shein" },
  { value: "outro", label: "Outro" },
];

export function ImportarMarketplaceModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarMarketplaceModalProps) {
  const { empresas } = useEmpresas();
  const { importarTransacoes } = useMarketplaceTransactions();
  const { processarTransacoesImportadas } = useMarketplaceAutoCategorizacao();
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [canal, setCanal] = useState<string>("");
  const [contaNome, setContaNome] = useState<string>("");
  const [parsedData, setParsedData] = useState<TransacaoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalItensDetectados, setTotalItensDetectados] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string>("");
  const [duplicatasPrevia, setDuplicatasPrevia] = useState<number>(0);
  const [transacoesNovas, setTransacoesNovas] = useState<number>(0);
  const [hashesDuplicados, setHashesDuplicados] = useState<Set<string>>(new Set());
  
  // Estatísticas de parse
  const [importStats, setImportStats] = useState<ImportStats>({
    totalLinhasArquivo: 0,
    totalTransacoesGeradas: 0,
    totalComValorZero: 0,
    totalDescartadasPorFormato: 0,
    totalLinhasVazias: 0,
    totalDuplicadas: 0,
    totalInseridas: 0,
  });

  const resetForm = useCallback(() => {
    setEmpresaId("");
    setCanal("");
    setContaNome("");
    setParsedData([]);
    setError(null);
    setFileName("");
    setStep("upload");
    setIsProcessing(false);
    setTotalItensDetectados(0);
    setUploadProgress(null);
    setUploadLabel("");
    setDuplicatasPrevia(0);
    setTransacoesNovas(0);
    setHashesDuplicados(new Set());
    setTransacoesDuplicadasIndices(new Set());
    setIsVerificandoDuplicatas(false);
    setImportStats({
      totalLinhasArquivo: 0,
      totalTransacoesGeradas: 0,
      totalComValorZero: 0,
      totalDescartadasPorFormato: 0,
      totalLinhasVazias: 0,
      totalDuplicadas: 0,
      totalInseridas: 0,
    });
  }, []);

  // Função para gerar hash de duplicidade - DEVE SER IDÊNTICA À DO HOOK
  // Formato: empresa_id|canal|data_transacao|descricao(100 chars)|valor_liquido|valor_bruto|referencia_externa
  const gerarHashDuplicidade = useCallback((t: TransacaoPreview, empId: string, canalVal: string): string => {
    // Normalizar valores para evitar problemas de precisão de ponto flutuante
    const valorLiquidoNorm = typeof t.valor_liquido === 'number' 
      ? parseFloat(t.valor_liquido.toFixed(2)).toString()
      : String(t.valor_liquido || 0);
    const valorBrutoNorm = typeof t.valor_bruto === 'number'
      ? parseFloat(t.valor_bruto.toFixed(2)).toString()
      : String(t.valor_bruto || 0);
    
    // Se tiver referencia_externa (ID único do relatório), usar como base
    const baseRef = t.referencia_externa || t.pedido_id || "";
    
    const partes = [
      empId,
      canalVal,
      t.data_transacao,
      t.descricao?.substring(0, 100) || "",
      valorLiquidoNorm,
      valorBrutoNorm,
      baseRef,
    ];
    return partes.map(p => String(p).toLowerCase().trim()).join("|");
  }, []);

  // Estado para armazenar quais transações são duplicadas (por índice)
  const [transacoesDuplicadasIndices, setTransacoesDuplicadasIndices] = useState<Set<number>>(new Set());
  const [isVerificandoDuplicatas, setIsVerificandoDuplicatas] = useState(false);

  // Verificar duplicatas no banco durante prévia - BUSCA REAL NO BANCO
  const verificarDuplicatasPrevia = useCallback(async (transacoes: TransacaoPreview[], empId: string, canalVal: string) => {
    if (transacoes.length === 0) {
      setDuplicatasPrevia(0);
      setTransacoesNovas(0);
      setHashesDuplicados(new Set());
      setTransacoesDuplicadasIndices(new Set());
      return 0;
    }

    setIsVerificandoDuplicatas(true);
    console.log('[Verificação Duplicatas] Iniciando verificação para', transacoes.length, 'transações');

    // Gerar hashes para as transações do arquivo
    const hashesArquivo = transacoes.map(t => gerarHashDuplicidade(t, empId, canalVal));
    
    // Também verificar duplicatas internas (dentro do próprio arquivo)
    const hashesUnicos = new Set<string>();
    const duplicatasInternas = new Set<number>();
    hashesArquivo.forEach((hash, idx) => {
      if (hashesUnicos.has(hash)) {
        duplicatasInternas.add(idx);
      } else {
        hashesUnicos.add(hash);
      }
    });

    console.log('[Verificação Duplicatas] Duplicatas internas no arquivo:', duplicatasInternas.size);

    // Buscar hashes existentes no banco em lotes (Supabase tem limite de IN clause)
    const BATCH_SIZE = 500;
    const hashesExistentesBanco = new Set<string>();
    
    // Buscar apenas hashes únicos para economizar queries
    const hashesParaBuscar = Array.from(hashesUnicos);
    
    for (let i = 0; i < hashesParaBuscar.length; i += BATCH_SIZE) {
      const batch = hashesParaBuscar.slice(i, i + BATCH_SIZE);
      
      const { data: existentes, error } = await supabase
        .from('marketplace_transactions')
        .select('hash_duplicidade')
        .eq('empresa_id', empId)
        .in('hash_duplicidade', batch);
      
      if (error) {
        console.error('[Verificação Duplicatas] Erro ao buscar hashes:', error);
        continue;
      }
      
      (existentes || []).forEach(e => {
        if (e.hash_duplicidade) {
          hashesExistentesBanco.add(e.hash_duplicidade);
        }
      });
      
      // Log de progresso a cada 10 batches
      if ((i / BATCH_SIZE) % 10 === 0) {
        console.log(`[Verificação Duplicatas] Verificando batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(hashesParaBuscar.length / BATCH_SIZE)}`);
      }
    }

    console.log('[Verificação Duplicatas] Hashes encontrados no banco:', hashesExistentesBanco.size);

    // Identificar quais transações são duplicatas (por índice)
    const indicesDuplicados = new Set<number>();
    hashesArquivo.forEach((hash, idx) => {
      if (hashesExistentesBanco.has(hash) || duplicatasInternas.has(idx)) {
        indicesDuplicados.add(idx);
      }
    });

    setHashesDuplicados(hashesExistentesBanco);
    setTransacoesDuplicadasIndices(indicesDuplicados);
    
    const totalDuplicadas = indicesDuplicados.size;
    const totalNovas = transacoes.length - totalDuplicadas;

    setDuplicatasPrevia(totalDuplicadas);
    setTransacoesNovas(totalNovas);
    setIsVerificandoDuplicatas(false);

    console.log('[Verificação Duplicatas] RESULTADO:', {
      totalTransacoes: transacoes.length,
      duplicatasBanco: hashesExistentesBanco.size,
      duplicatasInternas: duplicatasInternas.size,
      totalDuplicadas,
      totalNovas,
    });
    
    return totalDuplicadas;
  }, [gerarHashDuplicidade]);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    try {
      setIsProcessing(true);
      const tipo = detectarTipoArquivo(file);
      let transacoes: TransacaoPreview[] = [];
      let totalItens = 0;
      let stats: ImportStats = {
        totalLinhasArquivo: 0,
        totalTransacoesGeradas: 0,
        totalComValorZero: 0,
        totalDescartadasPorFormato: 0,
        totalLinhasVazias: 0,
        totalDuplicadas: 0,
        totalInseridas: 0,
      };

      // Parser específico para Mercado Pago (CSV ou XLSX)
      if (canal === "mercado_pago") {
        const result: ParseResult = await parseXLSXMercadoPago(file);
        stats = {
          ...stats,
          ...result.estatisticas,
        };
        transacoes = result.transacoes.map(t => {
          // Usar referencia_externa se disponível, senão gerar hash
          const hash = t.referencia_externa || 
            `${t.data_transacao}_${t.pedido_id || ""}_${t.valor_bruto}_${t.valor_liquido}_${t.descricao}`.substring(0, 120);
          return {
            data_transacao: t.data_transacao,
            descricao: t.descricao,
            pedido_id: t.pedido_id,
            tipo_transacao: t.tipo_transacao || "payment",
            valor_bruto: t.valor_bruto,
            tarifas: t.tarifas || 0,
            taxas: 0,
            outros_descontos: 0,
            valor_liquido: t.valor_liquido,
            tipo_lancamento: t.tipo_lancamento as 'credito' | 'debito',
            referencia_externa: t.referencia_externa || hash,
            itens: [],
          };
        });
      } else if (canal === "mercado_livre" && (tipo === "xlsx" || tipo === "csv")) {
        // Parser específico ML retorna objetos já mapeados COM ESTATÍSTICAS
        const result: ParseResult = await parseXLSXMercadoLivre(file);
        stats = {
          ...stats,
          ...result.estatisticas,
        };
        transacoes = result.transacoes.map(t => {
          // Usar referencia_externa se disponível (ID único do relatório), senão gerar hash
          const hash = t.referencia_externa || 
            `${t.data_transacao}_${t.pedido_id || ""}_${t.valor_bruto}_${t.valor_liquido}_${t.descricao}`.substring(0, 120);
          return {
            data_transacao: t.data_transacao,
            descricao: t.descricao,
            pedido_id: t.pedido_id,
            tipo_transacao: t.descricao || "venda",
            valor_bruto: t.valor_bruto,
            tarifas: 0,
            taxas: 0,
            outros_descontos: 0,
            valor_liquido: t.valor_liquido,
            tipo_lancamento: t.valor_liquido >= 0 ? "credito" as const : "debito" as const,
            referencia_externa: t.referencia_externa || hash,
            itens: [],
          };
        });
      } else if (tipo === "csv") {
        const linhas = await parseCSVFile(file);
        stats.totalLinhasArquivo = linhas.length;
        const result = mapLinhasRelatorioParaTransacoes(linhas, canal);
        transacoes = result.transacoes;
        totalItens = result.totalItens;
        stats.totalTransacoesGeradas = transacoes.length;
      } else if (tipo === "xlsx") {
        const linhas = await parseXLSXFile(file);
        stats.totalLinhasArquivo = linhas.length;
        const result = mapLinhasRelatorioParaTransacoes(linhas, canal);
        transacoes = result.transacoes;
        totalItens = result.totalItens;
        stats.totalTransacoesGeradas = transacoes.length;
      } else {
        setError("Formato não suportado. Use CSV ou XLSX.");
        setIsProcessing(false);
        return;
      }

      console.log('[Importação Marketplace] Prévia completa', {
        tipo,
        canal,
        ...stats,
        totalTransacoes: transacoes.length,
        totalItens,
      });

      if (transacoes.length === 0) {
        setError(`Nenhuma transação encontrada no arquivo. Arquivo tinha ${stats.totalLinhasArquivo} linhas, ${stats.totalLinhasVazias} vazias, ${stats.totalDescartadasPorFormato} descartadas por formato.`);
        setIsProcessing(false);
        return;
      }

      setParsedData(transacoes);
      setTotalItensDetectados(totalItens);
      setStep("preview");
      
      // Verificar duplicatas na prévia
      const duplicadas = await verificarDuplicatasPrevia(transacoes, empresaId, canal);
      stats.totalDuplicadas = duplicadas;
      
      setImportStats(stats);
      setIsProcessing(false);
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setError("Erro ao processar o arquivo. Verifique o formato.");
      setIsProcessing(false);
    }
  }, [canal, empresaId, verificarDuplicatasPrevia]);

  // Mapeia linhas do relatório (CSV/XLSX) para TransacaoPreview[] (parser genérico)
  const mapLinhasRelatorioParaTransacoes = useCallback((linhas: any[], selectedCanal: string): { transacoes: TransacaoPreview[]; totalItens: number } => {
    if (linhas.length === 0) return { transacoes: [], totalItens: 0 };

    const transactions: TransacaoPreview[] = [];
    let totalItens = 0;

    // Obter headers (chaves do primeiro objeto)
    const headers = Object.keys(linhas[0]).map(h => h.toLowerCase().trim());

    // Mapeamento de colunas por canal
    const columnMappings: Record<string, {
      data: string[];
      pedido: string[];
      tipo: string[];
      descricao: string[];
      valorBruto: string[];
      valorLiquido: string[];
      tarifas: string[];
      taxas: string[];
      outrosDescontos: string[];
      idUnico: string[];
    }> = {
      mercado_livre: {
        data: ["data da tarifa", "date", "data", "fecha"],
        pedido: ["número da venda", "order", "pedido", "pack_id", "order_id"],
        tipo: ["tipo de tarifa", "type", "tipo", "reason"],
        descricao: ["description", "descricao", "description_detail", "tipo de tarifa"],
        valorBruto: ["valor da transação", "amount", "valor_bruto", "gross_amount"],
        valorLiquido: ["valor líquido da transação", "net_amount", "valor_liquido", "total"],
        tarifas: ["tarifa", "comissao", "commission", "fee"],
        taxas: ["taxa", "imposto", "tax"],
        outrosDescontos: ["desconto", "discount", "outros"],
        idUnico: ["id da tarifa", "id tarifa", "id da transação", "id transacao", "id"],
      },
      mercado_pago: {
        data: ["date_created", "data de criação", "data", "money_release_date", "date_approved"],
        pedido: ["order_id", "external_reference", "referência externa", "merchant_order_id", "id"],
        tipo: ["operation_type", "tipo de operação", "tipo", "payment_type", "transaction_type"],
        descricao: ["description", "descrição", "reason", "item_title", "motivo"],
        valorBruto: ["transaction_amount", "valor da transação", "valor bruto", "amount", "total_paid_amount"],
        valorLiquido: ["net_received_amount", "valor líquido", "net_amount", "valor_liquido"],
        tarifas: ["fee_amount", "marketplace_fee", "tarifa", "mercadopago_fee", "mp_fee"],
        taxas: ["taxes_amount", "imposto", "tax"],
        outrosDescontos: ["financing_fee_amount", "desconto", "coupon_amount"],
        idUnico: ["id", "operation_id", "id da operação"],
      },
      shopee: {
        data: ["data do pedido", "order date", "data"],
        pedido: ["nº do pedido", "order id", "pedido"],
        tipo: ["tipo de transação", "transaction type", "tipo"],
        descricao: ["descrição", "description", "observação"],
        valorBruto: ["valor bruto", "gross value", "total do pedido"],
        valorLiquido: ["valor líquido", "net value", "valor final"],
        tarifas: ["comissão", "taxa de serviço", "fee"],
        taxas: ["imposto", "tax"],
        outrosDescontos: ["voucher", "desconto", "cupom"],
        idUnico: ["id", "order id"],
      },
      default: {
        data: ["data", "date", "data_transacao"],
        pedido: ["pedido", "order", "pedido_id"],
        tipo: ["tipo", "type", "tipo_transacao"],
        descricao: ["descricao", "description", "observacao"],
        valorBruto: ["valor_bruto", "gross", "bruto"],
        valorLiquido: ["valor_liquido", "net", "liquido", "valor"],
        tarifas: ["tarifa", "comissao", "fee"],
        taxas: ["taxa", "imposto", "tax"],
        outrosDescontos: ["desconto", "outros", "discount"],
        idUnico: ["id", "id_transacao"],
      },
    };

    const mapping = columnMappings[selectedCanal] || columnMappings.default;

    const findColumn = (possibleNames: string[]): string | null => {
      for (const name of possibleNames) {
        const found = headers.find(h => h.includes(name));
        if (found) return found;
      }
      return null;
    };

    const dataCol = findColumn(mapping.data);
    const pedidoCol = findColumn(mapping.pedido);
    const tipoCol = findColumn(mapping.tipo);
    const descricaoCol = findColumn(mapping.descricao);
    const valorBrutoCol = findColumn(mapping.valorBruto);
    const valorLiquidoCol = findColumn(mapping.valorLiquido);
    const tarifasCol = findColumn(mapping.tarifas);
    const taxasCol = findColumn(mapping.taxas);
    const outrosDescontosCol = findColumn(mapping.outrosDescontos);
    const idUnicoCol = findColumn(mapping.idUnico);

    // Detectar se tem granularidade de itens
    const temItens = detectarGranularidadeItens(headers);

    for (const linha of linhas) {
      const keys = Object.keys(linha);
      const getValue = (col: string | null): any => {
        if (!col) return null;
        // Buscar por correspondência exata ou parcial
        const matchKey = keys.find(k => k.toLowerCase().trim() === col || k.toLowerCase().trim().includes(col));
        return matchKey ? linha[matchKey] : null;
      };

      const parseDate = (dateStr: string): string => {
        if (!dateStr) return "";
        // Tentar formatos comuns
        const parts = String(dateStr).split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          }
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
        return "";
      };

      const parseValue = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const cleaned = String(val).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      };

      const valorLiquido = parseValue(getValue(valorLiquidoCol));
      const valorBruto = parseValue(getValue(valorBrutoCol)) || valorLiquido;
      const tarifas = parseValue(getValue(tarifasCol));
      const taxas = parseValue(getValue(taxasCol));
      const outrosDescontos = parseValue(getValue(outrosDescontosCol));
      const tipoTransacao = getValue(tipoCol) || "venda";
      const dataTransacao = parseDate(getValue(dataCol));
      const descricao = getValue(descricaoCol) || tipoTransacao;
      const pedidoId = getValue(pedidoCol)?.toString().trim() || null;
      const idUnico = getValue(idUnicoCol)?.toString().trim() || null;

      // Verificar se linha é válida (novo filtro menos restritivo)
      const temData = !!dataTransacao;
      const temDescricao = !!descricao && descricao !== "venda";
      const temValor = valorLiquido !== 0 || valorBruto !== 0;

      // Só descartar se não tiver NADA
      if (!temData && !temDescricao && !temValor) continue;

      // Se não tem data, pular (necessário para ordenação)
      if (!temData) continue;

      // Determinar se é crédito ou débito baseado no tipo e valor
      let tipoLancamento: 'credito' | 'debito' = "credito";
      const tipoLower = String(tipoTransacao).toLowerCase();
      if (
        tipoLower.includes("comiss") ||
        tipoLower.includes("tarifa") ||
        tipoLower.includes("taxa") ||
        tipoLower.includes("frete") ||
        tipoLower.includes("desconto") ||
        valorLiquido < 0
      ) {
        tipoLancamento = "debito";
      }

      // Gerar hash para referencia_externa usando ID único se disponível
      const baseRef = idUnico || pedidoId || "";
      const hashStr = `${dataTransacao}|${baseRef}|${tipoTransacao}|${valorBruto}|${valorLiquido}`;
      let hash = 0;
      for (let j = 0; j < hashStr.length; j++) {
        const char = hashStr.charCodeAt(j);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const referenciaExterna = idUnico || Math.abs(hash).toString(16);

      // Extrair item se houver granularidade
      const itens: ItemVendaMarketplace[] = [];
      if (temItens) {
        const item = extrairItemDeLinhaCSV(selectedCanal, headers, Object.values(linha).map(String), pedidoId);
        if (item) {
          itens.push(item);
          totalItens++;
        }
      }

      transactions.push({
        data_transacao: dataTransacao,
        pedido_id: pedidoId,
        tipo_transacao: tipoTransacao,
        descricao: descricao,
        valor_bruto: Math.abs(valorBruto),
        tarifas: Math.abs(tarifas),
        taxas: Math.abs(taxas),
        outros_descontos: Math.abs(outrosDescontos),
        valor_liquido: Math.abs(valorLiquido),
        tipo_lancamento: tipoLancamento,
        referencia_externa: referenciaExterna,
        itens,
      });
    }

    return { transacoes: transactions, totalItens };
  }, []);

  const handleImport = useCallback(async () => {
    if (!empresaId || !canal || parsedData.length === 0) return;

    // Determinar origem do arquivo (csv ou xlsx)
    const origemExtrato = fileName.toLowerCase().endsWith('.xlsx') ? 'arquivo_xlsx' : 'arquivo_csv';

    // FILTRAR APENAS TRANSAÇÕES NOVAS (não duplicadas)
    // Isso evita enviar duplicatas para o banco novamente
    const transacoesParaImportar = parsedData
      .filter((_, idx) => !transacoesDuplicadasIndices.has(idx))
      .map(row => ({
        empresa_id: empresaId,
        canal,
        conta_nome: contaNome || canal,
        pedido_id: row.pedido_id,
        referencia_externa: row.referencia_externa,
        data_transacao: row.data_transacao,
        data_repasse: null,
        tipo_transacao: row.tipo_transacao,
        descricao: row.descricao,
        valor_bruto: row.valor_bruto,
        valor_liquido: row.valor_liquido,
        tipo_lancamento: row.tipo_lancamento,
        status: 'importado',
        categoria_id: null,
        centro_custo_id: null,
        responsavel_id: null,
        origem_extrato: origemExtrato,
      } as MarketplaceTransactionInsert));

    console.log('[Importação] Transações filtradas:', {
      total: parsedData.length,
      duplicadas: transacoesDuplicadasIndices.size,
      paraImportar: transacoesParaImportar.length,
    });

    if (transacoesParaImportar.length === 0) {
      toast.info("Todas as transações já existem no banco. Nenhuma importação necessária.");
      setUploadLabel("");
      setUploadProgress(null);
      handleClose();
      return;
    }

    // seta info pra UI
    setUploadLabel(`Importando ${transacoesParaImportar.length} transações novas...`);
    setUploadProgress(0);

    const result = await importarTransacoes.mutateAsync({
      transacoes: transacoesParaImportar,
      onProgress: (percent) => {
        setUploadProgress(percent * 0.6); // 60% para importação
      },
    });

    // Atualizar estatísticas finais
    const finalStats = {
      ...importStats,
      totalDuplicadas: result.duplicadas,
      totalInseridas: result.importadas,
    };
    setImportStats(finalStats);

    // Log completo para debug
    console.log('[Importação Marketplace] RESULTADO FINAL:', {
      arquivo: fileName,
      ...finalStats,
    });

    // Auto-categorização e conciliação automática após importação
    if (result.insertedIds && result.insertedIds.length > 0) {
      setUploadLabel("Categorizando e conciliando automaticamente...");
      setUploadProgress(65);
      
      try {
        await processarTransacoesImportadas.mutateAsync({
          transactionIds: result.insertedIds,
          empresaId,
        });
        setUploadProgress(100);
      } catch (err) {
        console.error("[Importação] Erro na auto-categorização:", err);
        // Continua mesmo se a auto-categorização falhar
      }
    }

    // Toast com resumo detalhado
    toast.success(
      `Importação concluída! Arquivo: ${finalStats.totalLinhasArquivo} linhas | ` +
      `Geradas: ${finalStats.totalTransacoesGeradas} | ` +
      `Inseridas: ${finalStats.totalInseridas} | ` +
      `Duplicadas: ${finalStats.totalDuplicadas} | ` +
      `Ignoradas: ${finalStats.totalDescartadasPorFormato + finalStats.totalLinhasVazias}`,
      { duration: 8000 }
    );

    setUploadLabel("");
    setUploadProgress(null);
    onSuccess?.();
    handleClose();
  }, [empresaId, canal, contaNome, parsedData, fileName, transacoesDuplicadasIndices, importStats, importarTransacoes, processarTransacoesImportadas, onSuccess, handleClose]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Relatório do Marketplace
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Empresa e Canal */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome_fantasia || empresa.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canal *</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome da Conta (opcional)</Label>
              <Input
                placeholder="Ex: ML Principal"
                value={contaNome}
                onChange={(e) => setContaNome(e.target.value)}
              />
            </div>
          </div>

          {/* Upload de Arquivo */}
          {empresaId && canal && (
            <div className="space-y-2">
              <Label>Arquivo CSV ou XLSX</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {fileName && (
                  <span className="text-sm text-muted-foreground">
                    {fileName}
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview das transações */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Preview ({parsedData.length} transações encontradas)
                </Label>
                {totalItensDetectados > 0 && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Package className="h-4 w-4" />
                    {totalItensDetectados} itens de produto detectados
                  </span>
                )}
              </div>

              {/* Estatísticas detalhadas de parse */}
              {importStats.totalLinhasArquivo > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  <span>
                    Arquivo: <strong>{importStats.totalLinhasArquivo.toLocaleString()}</strong> linhas | 
                    Geradas: <strong>{importStats.totalTransacoesGeradas.toLocaleString()}</strong> | 
                    {importStats.totalComValorZero > 0 && (
                      <>Valor zero: <strong>{importStats.totalComValorZero.toLocaleString()}</strong> | </>
                    )}
                    {importStats.totalDescartadasPorFormato > 0 && (
                      <>Formato inválido: <strong>{importStats.totalDescartadasPorFormato.toLocaleString()}</strong> | </>
                    )}
                    {importStats.totalLinhasVazias > 0 && (
                      <>Vazias: <strong>{importStats.totalLinhasVazias.toLocaleString()}</strong></>
                    )}
                  </span>
                </div>
              )}

              {/* Aviso de duplicatas na prévia */}
              {isVerificandoDuplicatas && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Verificando duplicatas no banco de dados...
                </div>
              )}
              
              {!isVerificandoDuplicatas && (duplicatasPrevia > 0 || transacoesNovas > 0) && (
                <div className="flex gap-3 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-md">
                    <Sparkles className="h-4 w-4" />
                    {transacoesNovas.toLocaleString()} novas (serão importadas)
                  </span>
                  {duplicatasPrevia > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-md">
                      <AlertTriangle className="h-4 w-4" />
                      {duplicatasPrevia.toLocaleString()} duplicadas (já existem no banco)
                    </span>
                  )}
                </div>
              )}

              <div className="h-[300px] border rounded-md overflow-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead className="w-28">Pedido</TableHead>
                      <TableHead className="w-24">Tipo</TableHead>
                      <TableHead className="min-w-[180px]">Descrição</TableHead>
                      <TableHead className="w-28 text-right">Valor Bruto</TableHead>
                      <TableHead className="w-28 text-right">Valor Líquido</TableHead>
                      <TableHead className="w-24">Lançamento</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, idx) => {
                      // Usar o índice para verificar se é duplicada (mais eficiente)
                      const isDuplicada = transacoesDuplicadasIndices.has(idx);
                      return (
                        <TableRow key={idx} className={isDuplicada ? "bg-amber-50 dark:bg-amber-950/30" : ""}>
                          <TableCell className={isDuplicada ? "text-muted-foreground" : ""}>{row.data_transacao}</TableCell>
                          <TableCell className={`font-mono text-xs ${isDuplicada ? "text-muted-foreground" : ""}`}>
                            {row.pedido_id || "-"}
                          </TableCell>
                          <TableCell className={isDuplicada ? "text-muted-foreground" : ""}>{row.tipo_transacao}</TableCell>
                          <TableCell className={`max-w-[200px] truncate ${isDuplicada ? "text-muted-foreground" : ""}`}>
                            {row.descricao}
                          </TableCell>
                          <TableCell className={`text-right ${isDuplicada ? "text-muted-foreground" : ""}`}>
                            {formatCurrency(row.valor_bruto)}
                          </TableCell>
                          <TableCell className={`text-right ${isDuplicada ? "text-muted-foreground" : ""}`}>
                            {formatCurrency(row.valor_liquido)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                row.tipo_lancamento === "credito"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {row.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isDuplicada ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium whitespace-nowrap">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                Duplicada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium whitespace-nowrap">
                                <Sparkles className="h-3 w-3 flex-shrink-0" />
                                Nova
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {parsedData.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Mostrando 50 de {parsedData.length.toLocaleString()} transações
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {uploadProgress !== null && (
          <div className="mt-4 mb-2">
            <p className="text-xs text-muted-foreground mb-1">
              {uploadLabel || "Processando arquivo..."}
            </p>
            <Progress value={uploadProgress} className="h-1.5" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!empresaId || !canal || parsedData.length === 0 || transacoesNovas === 0 || importarTransacoes.isPending || isVerificandoDuplicatas}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isVerificandoDuplicatas
              ? "Verificando duplicatas..."
              : importarTransacoes.isPending 
                ? "Importando..." 
                : transacoesNovas > 0 
                  ? `Importar ${transacoesNovas.toLocaleString()} transações novas`
                  : parsedData.length > 0 
                    ? "Todas duplicadas"
                    : `Importar ${parsedData.length.toLocaleString()} transações`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
