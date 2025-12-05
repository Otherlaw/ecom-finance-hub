import { useState, useCallback, useRef } from "react";
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
import { detectarTipoArquivo, parseCSVFile, parseXLSXFile, parseXLSXMercadoLivre, parseXLSXMercadoPago, parseShopee, type ParseResult, type ItemVendaParser } from "@/lib/parsers/arquivoFinanceiro";
import { criarItensEmLote, limparCacheMapeamentos } from "@/lib/marketplace-items-service";
import { criarJobImportacao, atualizarProgressoJob, finalizarJob } from "@/hooks/useMarketplaceImportJobs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  itens: ItemVendaParser[];
};

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

// Função para gerar referência única conforme especificado
// Formato: canal_data_pedido_descricao_valor (max 120 chars)
function buildMarketplaceRef(
  canal: string,
  data_transacao: string,
  pedido_id: string | null,
  descricao: string,
  valor_liquido: number
): string {
  const ref = `${canal}_${data_transacao}_${pedido_id || ''}_${descricao}_${Number(valor_liquido || 0).toFixed(2)}`;
  return ref.substring(0, 120);
}

export function ImportarMarketplaceModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarMarketplaceModalProps) {
  const { empresas } = useEmpresas();
  const { importarTransacoes } = useMarketplaceTransactions();
  const { processarTransacoesImportadas } = useMarketplaceAutoCategorizacao();
  const queryClient = useQueryClient();
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [canal, setCanal] = useState<string>("");
  const [contaNome, setContaNome] = useState<string>("");
  const [parsedData, setParsedData] = useState<TransacaoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalItensDetectados, setTotalItensDetectados] = useState(0);
  const [duplicatasPrevia, setDuplicatasPrevia] = useState<number>(0);
  const [transacoesNovas, setTransacoesNovas] = useState<number>(0);
  const [transacoesDuplicadasIndices, setTransacoesDuplicadasIndices] = useState<Set<number>>(new Set());
  const [isVerificandoDuplicatas, setIsVerificandoDuplicatas] = useState(false);
  
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
    setDuplicatasPrevia(0);
    setTransacoesNovas(0);
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

  // Verificar duplicatas no banco usando referencia_externa
  const verificarDuplicatasPrevia = useCallback(async (transacoes: TransacaoPreview[], empId: string, canalVal: string) => {
    if (transacoes.length === 0) {
      setDuplicatasPrevia(0);
      setTransacoesNovas(0);
      setTransacoesDuplicadasIndices(new Set());
      return 0;
    }

    setIsVerificandoDuplicatas(true);
    console.log('[Verificação Duplicatas] Iniciando verificação para', transacoes.length, 'transações');

    // Gerar referências para as transações do arquivo
    const refsArquivo = transacoes.map(t => 
      buildMarketplaceRef(canalVal, t.data_transacao, t.pedido_id, t.descricao, t.valor_liquido)
    );
    
    // Verificar duplicatas internas
    const refsUnicos = new Set<string>();
    const duplicatasInternas = new Set<number>();
    refsArquivo.forEach((ref, idx) => {
      if (refsUnicos.has(ref)) {
        duplicatasInternas.add(idx);
      } else {
        refsUnicos.add(ref);
      }
    });

    console.log('[Verificação Duplicatas] Duplicatas internas no arquivo:', duplicatasInternas.size);

    // Buscar refs existentes no banco em lotes
    const BATCH_SIZE = 10000;
    const refsExistentesBanco = new Set<string>();
    const refsParaBuscar = Array.from(refsUnicos);
    
    for (let i = 0; i < refsParaBuscar.length; i += BATCH_SIZE) {
      const batch = refsParaBuscar.slice(i, i + BATCH_SIZE);
      
      const { data: existentes, error } = await supabase
        .from('marketplace_transactions')
        .select('referencia_externa')
        .eq('empresa_id', empId)
        .eq('canal', canalVal)
        .in('referencia_externa', batch);
      
      if (error) {
        console.error('[Verificação Duplicatas] Erro ao buscar refs:', error);
        continue;
      }
      
      (existentes || []).forEach(e => {
        if (e.referencia_externa) {
          refsExistentesBanco.add(e.referencia_externa);
        }
      });
    }

    console.log('[Verificação Duplicatas] Refs encontrados no banco:', refsExistentesBanco.size);

    // Identificar quais transações são duplicatas
    const indicesDuplicados = new Set<number>();
    refsArquivo.forEach((ref, idx) => {
      if (refsExistentesBanco.has(ref) || duplicatasInternas.has(idx)) {
        indicesDuplicados.add(idx);
      }
    });

    setTransacoesDuplicadasIndices(indicesDuplicados);
    
    const totalDuplicadas = indicesDuplicados.size;
    const totalNovas = transacoes.length - totalDuplicadas;

    setDuplicatasPrevia(totalDuplicadas);
    setTransacoesNovas(totalNovas);
    setIsVerificandoDuplicatas(false);

    console.log('[Verificação Duplicatas] RESULTADO:', {
      totalTransacoes: transacoes.length,
      duplicatasBanco: refsExistentesBanco.size,
      duplicatasInternas: duplicatasInternas.size,
      totalDuplicadas,
      totalNovas,
    });
    
    return totalDuplicadas;
  }, []);

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

      // Parser específico para Mercado Pago
      if (canal === "mercado_pago") {
        const result: ParseResult = await parseXLSXMercadoPago(file);
        stats = { ...stats, ...result.estatisticas };
        transacoes = result.transacoes.map(t => ({
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
          referencia_externa: buildMarketplaceRef(canal, t.data_transacao, t.pedido_id, t.descricao, t.valor_liquido),
          itens: [],
        }));
      } else if (canal === "mercado_livre" && (tipo === "xlsx" || tipo === "csv")) {
        const result: ParseResult = await parseXLSXMercadoLivre(file);
        stats = { ...stats, ...result.estatisticas };
        transacoes = result.transacoes.map(t => ({
          data_transacao: t.data_transacao,
          descricao: t.descricao,
          pedido_id: t.pedido_id,
          tipo_transacao: t.tipo_transacao || t.descricao || "venda",
          valor_bruto: t.valor_bruto,
          tarifas: t.tarifas || 0,
          taxas: t.taxas || 0,
          outros_descontos: t.outros_descontos || 0,
          valor_liquido: t.valor_liquido,
          tipo_lancamento: t.tipo_lancamento || (t.valor_liquido >= 0 ? "credito" as const : "debito" as const),
          referencia_externa: buildMarketplaceRef(canal, t.data_transacao, t.pedido_id, t.descricao, t.valor_liquido),
          itens: t.itens || [],
        }));
        totalItens = transacoes.reduce((sum, t) => sum + (t.itens?.length || 0), 0);
      } else if (canal === "shopee" && (tipo === "xlsx" || tipo === "csv")) {
        const result: ParseResult = await parseShopee(file);
        stats = { ...stats, ...result.estatisticas };
        transacoes = result.transacoes.map(t => ({
          data_transacao: t.data_transacao,
          descricao: t.descricao,
          pedido_id: t.pedido_id,
          tipo_transacao: t.tipo_transacao || "venda",
          valor_bruto: t.valor_bruto,
          tarifas: t.tarifas || 0,
          taxas: t.taxas || 0,
          outros_descontos: t.outros_descontos || 0,
          valor_liquido: t.valor_liquido,
          tipo_lancamento: t.tipo_lancamento as 'credito' | 'debito',
          referencia_externa: buildMarketplaceRef(canal, t.data_transacao, t.pedido_id, t.descricao, t.valor_liquido),
          itens: t.itens || [],
        }));
        totalItens = transacoes.reduce((sum, t) => sum + (t.itens?.length || 0), 0);
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

  // Parser genérico para CSV/XLSX
  const mapLinhasRelatorioParaTransacoes = useCallback((linhas: any[], selectedCanal: string): { transacoes: TransacaoPreview[]; totalItens: number } => {
    if (linhas.length === 0) return { transacoes: [], totalItens: 0 };

    const transactions: TransacaoPreview[] = [];
    let totalItens = 0;

    const headers = Object.keys(linhas[0]).map(h => h.toLowerCase().trim());

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

    const temItens = detectarGranularidadeItens(headers);

    for (const linha of linhas) {
      const keys = Object.keys(linha);
      const getValue = (col: string | null): any => {
        if (!col) return null;
        const matchKey = keys.find(k => k.toLowerCase().trim() === col || k.toLowerCase().trim().includes(col));
        return matchKey ? linha[matchKey] : null;
      };

      const parseDate = (dateStr: string): string => {
        if (!dateStr) return "";
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

      const temData = !!dataTransacao;
      const temDescricao = !!descricao && descricao !== "venda";
      const temValor = valorLiquido !== 0 || valorBruto !== 0;

      if (!temData && !temDescricao && !temValor) continue;
      if (!temData) continue;

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
        referencia_externa: buildMarketplaceRef(selectedCanal, dataTransacao, pedidoId, descricao, valorLiquido),
        itens,
      });
    }

    return { transacoes: transactions, totalItens };
  }, []);

  // IMPORTAÇÃO EM SEGUNDO PLANO
  const handleImport = useCallback(async () => {
    if (!empresaId || !canal || parsedData.length === 0) return;

    // Filtrar apenas transações novas
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
        tarifas: row.tarifas || 0,
        taxas: row.taxas || 0,
        outros_descontos: row.outros_descontos || 0,
        tipo_lancamento: row.tipo_lancamento,
        status: 'importado',
        categoria_id: null,
        centro_custo_id: null,
        responsavel_id: null,
        origem_extrato: fileName.toLowerCase().endsWith('.xlsx') ? 'arquivo_xlsx' : 'arquivo_csv',
      } as MarketplaceTransactionInsert));

    console.log('[Importação Background] Iniciando...', {
      total: parsedData.length,
      duplicadas: transacoesDuplicadasIndices.size,
      paraImportar: transacoesParaImportar.length,
    });

    if (transacoesParaImportar.length === 0) {
      toast.info("Todas as transações já existem no banco. Nenhuma importação necessária.");
      handleClose();
      return;
    }

    // Criar job no banco
    let jobId: string;
    try {
      jobId = await criarJobImportacao({
        empresa_id: empresaId,
        canal,
        arquivo_nome: fileName,
        total_linhas: transacoesParaImportar.length,
      });
    } catch (err) {
      console.error('[Job] Erro ao criar job:', err);
      toast.error("Erro ao iniciar importação");
      return;
    }

    // Fechar modal imediatamente
    toast.success(`Importação iniciada — ${transacoesParaImportar.length.toLocaleString()} transações serão processadas em segundo plano`, {
      description: "Acompanhe o progresso na tela de Conciliação do Marketplace",
      duration: 5000,
    });
    
    // Guardar referências antes de fechar
    const savedEmpresaId = empresaId;
    const savedCanal = canal;
    const savedParsedData = [...parsedData];
    const savedTransacoesDuplicadasIndices = new Set(transacoesDuplicadasIndices);
    
    handleClose();
    onSuccess?.();
    
    // Invalidar queries para mostrar job em andamento
    queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });

    // Processar em background (não bloqueia UI)
    processarImportacaoBackground(
      jobId,
      transacoesParaImportar,
      savedParsedData,
      savedTransacoesDuplicadasIndices,
      savedEmpresaId,
      savedCanal,
      importarTransacoes,
      processarTransacoesImportadas,
      queryClient
    );

  }, [empresaId, canal, contaNome, parsedData, fileName, transacoesDuplicadasIndices, importarTransacoes, processarTransacoesImportadas, handleClose, onSuccess, queryClient]);

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

              {/* Estatísticas */}
              {importStats.totalLinhasArquivo > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  <span>
                    Arquivo: <strong>{importStats.totalLinhasArquivo.toLocaleString()}</strong> linhas | 
                    Geradas: <strong>{importStats.totalTransacoesGeradas.toLocaleString()}</strong>
                    {importStats.totalDescartadasPorFormato > 0 && (
                      <> | Formato inválido: <strong>{importStats.totalDescartadasPorFormato.toLocaleString()}</strong></>
                    )}
                  </span>
                </div>
              )}

              {/* Status de duplicatas */}
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
                      {duplicatasPrevia.toLocaleString()} duplicadas (serão ignoradas)
                    </span>
                  )}
                </div>
              )}

              <ScrollArea className="max-h-64 border rounded-md mt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="w-24">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right">Tarifas</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 100).map((t, idx) => {
                      const isDuplicada = transacoesDuplicadasIndices.has(idx);
                      return (
                        <TableRow 
                          key={idx} 
                          className={isDuplicada ? "opacity-50 bg-amber-50/50 dark:bg-amber-950/20" : ""}
                        >
                          <TableCell className="text-xs">
                            {t.data_transacao ? new Date(t.data_transacao + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={t.descricao}>
                            {t.descricao}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {t.pedido_id || "-"}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {formatCurrency(t.valor_bruto)}
                          </TableCell>
                          <TableCell className="text-xs text-right text-destructive">
                            {t.tarifas > 0 ? formatCurrency(t.tarifas) : "-"}
                          </TableCell>
                          <TableCell className={`text-xs text-right font-medium ${t.tipo_lancamento === 'credito' ? 'text-success' : 'text-destructive'}`}>
                            {t.tipo_lancamento === 'credito' ? '+' : '-'}{formatCurrency(t.valor_liquido)}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.tipo_lancamento === 'credito' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                              {t.tipo_lancamento === 'credito' ? 'C' : 'D'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {isDuplicada ? (
                              <span className="text-[10px] text-amber-600">Duplicada</span>
                            ) : (
                              <span className="text-[10px] text-emerald-600">Nova</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {parsedData.length > 100 && (
                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                    Exibindo 100 de {parsedData.length.toLocaleString()} transações
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedData.length === 0 || isProcessing || isVerificandoDuplicatas || transacoesNovas === 0}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Iniciar Importação ({transacoesNovas.toLocaleString()} transações)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Função que processa em background (fora do componente para não ser afetada pelo unmount)
async function processarImportacaoBackground(
  jobId: string,
  transacoesParaImportar: MarketplaceTransactionInsert[],
  parsedData: TransacaoPreview[],
  transacoesDuplicadasIndices: Set<number>,
  empresaId: string,
  canal: string,
  importarTransacoes: any,
  processarTransacoesImportadas: any,
  queryClient: any
) {
  const BATCH_SIZE = 500;
  let importadas = 0;
  let duplicadas = transacoesDuplicadasIndices.size;
  let erros = 0;
  const insertedIds: string[] = [];

  try {
    // Processar em batches
    for (let i = 0; i < transacoesParaImportar.length; i += BATCH_SIZE) {
      const batch = transacoesParaImportar.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase
          .from("marketplace_transactions")
          .insert(batch)
          .select("id");

        if (error) {
          if (error.code === "23505") {
            // Duplicidade - contar e continuar
            duplicadas += batch.length;
          } else {
            erros += batch.length;
            console.error("[Background Import] Erro no batch:", error);
          }
        } else {
          importadas += data?.length ?? 0;
          if (data) {
            insertedIds.push(...data.map(d => d.id));
          }
        }
      } catch (err) {
        erros += batch.length;
        console.error("[Background Import] Erro no batch:", err);
      }

      // Atualizar progresso no banco após cada batch
      await atualizarProgressoJob(jobId, {
        linhas_processadas: Math.min(i + batch.length, transacoesParaImportar.length),
        linhas_importadas: importadas,
        linhas_duplicadas: duplicadas,
        linhas_com_erro: erros,
      });
    }

    // Auto-categorização
    if (insertedIds.length > 0) {
      try {
        await processarTransacoesImportadas.mutateAsync({
          transactionIds: insertedIds,
          empresaId,
        });
      } catch (err) {
        console.error("[Background Import] Erro na auto-categorização:", err);
      }

      // Criar itens de venda
      const transacoesNovasComIndice = parsedData
        .map((t, idx) => ({ transacao: t, indiceOriginal: idx }))
        .filter(({ indiceOriginal }) => !transacoesDuplicadasIndices.has(indiceOriginal));

      const transacoesComItens = transacoesNovasComIndice
        .map(({ transacao }, idx) => ({
          transactionId: insertedIds[idx],
          itens: transacao.itens || [],
        }))
        .filter(t => t.itens && t.itens.length > 0);

      if (transacoesComItens.length > 0) {
        try {
          limparCacheMapeamentos();
          await criarItensEmLote(transacoesComItens, empresaId, canal);
        } catch (err) {
          console.error("[Background Import] Erro ao criar itens:", err);
        }
      }
    }

    // Finalizar job com sucesso
    await finalizarJob(jobId, {
      status: 'concluido',
      linhas_importadas: importadas,
      linhas_duplicadas: duplicadas,
      linhas_com_erro: erros,
    });

    // Invalidar queries
    queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });

    toast.success(`Importação concluída: ${importadas.toLocaleString()} transações importadas`, {
      description: duplicadas > 0 ? `${duplicadas.toLocaleString()} duplicadas ignoradas` : undefined,
    });

  } catch (err) {
    console.error("[Background Import] Erro fatal:", err);
    
    await finalizarJob(jobId, {
      status: 'erro',
      linhas_importadas: importadas,
      linhas_duplicadas: duplicadas,
      linhas_com_erro: erros,
      mensagem_erro: err instanceof Error ? err.message : "Erro desconhecido",
    });

    queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });
    
    toast.error("Erro na importação", {
      description: err instanceof Error ? err.message : "Erro desconhecido",
    });
  }
}
