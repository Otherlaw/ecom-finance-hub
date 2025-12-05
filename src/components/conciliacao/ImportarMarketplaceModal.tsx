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
import { Upload, FileSpreadsheet, AlertCircle, Package, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEmpresas } from "@/hooks/useEmpresas";
import { MarketplaceTransactionInsert } from "@/hooks/useMarketplaceTransactions";
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

// Função para gerar referência única
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
  
  const [importStats, setImportStats] = useState<ImportStats>({
    totalLinhasArquivo: 0,
    totalTransacoesGeradas: 0,
    totalComValorZero: 0,
    totalDescartadasPorFormato: 0,
    totalLinhasVazias: 0,
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
    setImportStats({
      totalLinhasArquivo: 0,
      totalTransacoesGeradas: 0,
      totalComValorZero: 0,
      totalDescartadasPorFormato: 0,
      totalLinhasVazias: 0,
    });
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  // Preview RÁPIDO - Apenas parse local do arquivo, SEM verificação de duplicatas no banco
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

      console.log('[Importação Marketplace] Preview completo', {
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
      setImportStats(stats);
      setStep("preview");
      setIsProcessing(false);
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setError("Erro ao processar o arquivo. Verifique o formato.");
      setIsProcessing(false);
    }
  }, [canal]);

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

  // IMPORTAÇÃO EM SEGUNDO PLANO - A verificação de duplicatas ocorre AQUI no backend
  const handleImport = useCallback(async () => {
    if (!empresaId || !canal || parsedData.length === 0) return;

    // Preparar todas as transações (duplicatas serão filtradas no backend)
    const transacoesParaImportar = parsedData.map(row => ({
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
    });

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
    
    handleClose();
    onSuccess?.();
    
    // Invalidar queries para mostrar job em andamento
    queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });

    // Processar em background (não bloqueia UI) - A deduplicação ocorre AQUI
    processarImportacaoBackground(
      jobId,
      transacoesParaImportar,
      savedParsedData,
      savedEmpresaId,
      savedCanal,
      processarTransacoesImportadas,
      queryClient
    );

  }, [empresaId, canal, contaNome, parsedData, fileName, processarTransacoesImportadas, handleClose, onSuccess, queryClient]);

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

          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Processando arquivo...
            </div>
          )}

          {/* Preview das transações - RÁPIDO, sem verificação de duplicatas */}
          {parsedData.length > 0 && !isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Preview ({parsedData.length.toLocaleString()} transações encontradas)
                </Label>
                {totalItensDetectados > 0 && (
                  <span className="flex items-center gap-1 text-sm text-emerald-600">
                    <Package className="h-4 w-4" />
                    {totalItensDetectados.toLocaleString()} itens de produto detectados
                  </span>
                )}
              </div>

              {/* Estatísticas do arquivo */}
              {importStats.totalLinhasArquivo > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  <span>
                    Arquivo: <strong>{importStats.totalLinhasArquivo.toLocaleString()}</strong> linhas | 
                    Transações válidas: <strong>{importStats.totalTransacoesGeradas.toLocaleString()}</strong>
                    {importStats.totalDescartadasPorFormato > 0 && (
                      <> | Formato inválido: <strong>{importStats.totalDescartadasPorFormato.toLocaleString()}</strong></>
                    )}
                  </span>
                </div>
              )}

              {/* Informação sobre duplicatas */}
              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-md flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-400">
                  A verificação de duplicatas será feita automaticamente durante a importação em segundo plano.
                </span>
              </div>

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 100).map((t, idx) => (
                      <TableRow key={idx}>
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
                            {t.tipo_lancamento === 'credito' ? 'Crédito' : 'Débito'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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
            disabled={parsedData.length === 0 || isProcessing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Iniciar Importação ({parsedData.length.toLocaleString()} transações)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Função que processa em background - A VERIFICAÇÃO DE DUPLICATAS OCORRE AQUI
// Função para gerar hash SHA256 composto para duplicidade
// Hash = SHA256(data_transacao + descricao + pedido_id + valor_liquido + tipo_transacao)
async function gerarHashDuplicidade(params: {
  data_transacao: string;
  descricao: string;
  pedido_id: string | null;
  valor_liquido: number;
  tipo_transacao: string;
}): Promise<string> {
  const texto = [
    params.data_transacao || '',
    params.descricao || '',
    params.pedido_id || '',
    Number(params.valor_liquido || 0).toFixed(2),
    params.tipo_transacao || '',
  ].join('|');
  
  // Usar SubtleCrypto para gerar SHA256
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.substring(0, 64); // Retornar hash completo (64 chars)
}

async function processarImportacaoBackground(
  jobId: string,
  transacoesParaImportar: MarketplaceTransactionInsert[],
  parsedData: TransacaoPreview[],
  empresaId: string,
  canal: string,
  processarTransacoesImportadas: any,
  queryClient: any
) {
  const BATCH_SIZE = 1000; // Aumentado para 1000 conforme solicitado
  const TOTAL = transacoesParaImportar.length;
  let processadas = 0;
  let importadas = 0;
  let duplicadas = 0;
  let erros = 0;
  const insertedIds: string[] = [];

  try {
    console.log('[Background Import] Iniciando processamento de', TOTAL, 'transações');
    
    // PASSO 1: Gerar hashes SHA256 para todas as transações
    console.log('[Background Import] Gerando hashes SHA256...');
    
    const transacoesComHash: (MarketplaceTransactionInsert & { hash_duplicidade: string })[] = [];
    
    for (let i = 0; i < transacoesParaImportar.length; i++) {
      const t = transacoesParaImportar[i];
      const hash = await gerarHashDuplicidade({
        data_transacao: t.data_transacao,
        descricao: t.descricao,
        pedido_id: t.pedido_id || null,
        valor_liquido: t.valor_liquido,
        tipo_transacao: t.tipo_transacao,
      });
      
      transacoesComHash.push({
        ...t,
        hash_duplicidade: hash,
      });
      
      // Atualizar progresso a cada 1000 hashes (10% do progresso total)
      if (i % 1000 === 0) {
        const progressoHash = Math.floor((i / TOTAL) * 0.1 * TOTAL);
        await atualizarProgressoJob(jobId, {
          linhas_processadas: progressoHash,
        });
      }
    }
    
    // PASSO 2: Verificar duplicatas no banco usando hash_duplicidade
    console.log('[Background Import] Verificando duplicatas no banco...');
    
    const hashesParaVerificar = transacoesComHash.map(t => t.hash_duplicidade);
    const hashesExistentes = new Set<string>();
    
    // Buscar hashes existentes no banco em lotes de 10k
    for (let i = 0; i < hashesParaVerificar.length; i += 10000) {
      const batch = hashesParaVerificar.slice(i, i + 10000);
      if (batch.length === 0) continue;
      
      const { data: existentes } = await supabase
        .from('marketplace_transactions')
        .select('hash_duplicidade')
        .eq('empresa_id', empresaId)
        .in('hash_duplicidade', batch);
      
      (existentes || []).forEach(e => {
        if (e.hash_duplicidade) hashesExistentes.add(e.hash_duplicidade);
      });
      
      // Atualizar progresso (20% do total para verificação)
      processadas = Math.min(i + batch.length, hashesParaVerificar.length);
      const progressoVerificacao = Math.floor(TOTAL * 0.1) + Math.floor((processadas / TOTAL) * 0.2 * TOTAL);
      await atualizarProgressoJob(jobId, {
        linhas_processadas: progressoVerificacao,
      });
    }
    
    console.log('[Background Import] Hashes existentes no banco:', hashesExistentes.size);
    
    // PASSO 3: Filtrar transações novas (não existem no banco)
    const transacoesNovas = transacoesComHash.filter(t => !hashesExistentes.has(t.hash_duplicidade));
    
    // Também filtrar duplicatas internas do arquivo
    const hashesVistas = new Set<string>();
    const transacoesUnicas: (MarketplaceTransactionInsert & { hash_duplicidade: string })[] = [];
    
    for (const t of transacoesNovas) {
      if (hashesVistas.has(t.hash_duplicidade)) {
        duplicadas++;
        continue;
      }
      hashesVistas.add(t.hash_duplicidade);
      transacoesUnicas.push(t);
    }
    
    // Contar duplicatas do banco
    duplicadas += (transacoesComHash.length - transacoesNovas.length);
    
    console.log('[Background Import] Após deduplicação:', {
      total: transacoesParaImportar.length,
      duplicadasBanco: transacoesComHash.length - transacoesNovas.length,
      duplicadasInternas: transacoesNovas.length - transacoesUnicas.length,
      paraInserir: transacoesUnicas.length,
    });

    // Atualizar progresso com contagem de duplicadas
    await atualizarProgressoJob(jobId, {
      linhas_processadas: Math.floor(TOTAL * 0.3),
      linhas_duplicadas: duplicadas,
    });

    // PASSO 4: Inserir transações únicas em batches de 1000 (70% restante do progresso)
    const totalUnicas = transacoesUnicas.length;
    
    for (let i = 0; i < transacoesUnicas.length; i += BATCH_SIZE) {
      const batch = transacoesUnicas.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase
          .from("marketplace_transactions")
          .insert(batch)
          .select("id");

        if (error) {
          if (error.code === "23505") {
            // Duplicidade no banco (edge case) - contar e continuar
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

      // Calcular progresso: 30% verificação + 70% da inserção
      const progressoInsercao = totalUnicas > 0 
        ? Math.floor(((i + batch.length) / totalUnicas) * 0.7 * TOTAL)
        : Math.floor(0.7 * TOTAL);
      const progressoTotal = Math.floor(TOTAL * 0.3) + progressoInsercao;
      
      // Atualizar progresso no banco após cada batch
      await atualizarProgressoJob(jobId, {
        linhas_processadas: Math.min(progressoTotal, TOTAL),
        linhas_importadas: importadas,
        linhas_duplicadas: duplicadas,
        linhas_com_erro: erros,
      });
    }

    // Se não há transações para inserir (todas duplicadas), marcar como 100%
    if (transacoesUnicas.length === 0) {
      await atualizarProgressoJob(jobId, {
        linhas_processadas: TOTAL,
        linhas_importadas: 0,
        linhas_duplicadas: duplicadas,
        linhas_com_erro: 0,
      });
    }

    // PASSO 5: Auto-categorização
    if (insertedIds.length > 0) {
      try {
        await processarTransacoesImportadas.mutateAsync({
          transactionIds: insertedIds,
          empresaId,
        });
      } catch (err) {
        console.error("[Background Import] Erro na auto-categorização:", err);
      }

      // PASSO 6: Criar itens de venda
      // Mapear transações inseridas para os dados originais via hash
      const hashToId = new Map<string, string>();
      transacoesUnicas.slice(0, insertedIds.length).forEach((t, idx) => {
        hashToId.set(t.hash_duplicidade, insertedIds[idx]);
      });
      
      const transacoesComItens = parsedData
        .filter(t => t.itens && t.itens.length > 0)
        .map(async (t) => {
          const hash = await gerarHashDuplicidade({
            data_transacao: t.data_transacao,
            descricao: t.descricao,
            pedido_id: t.pedido_id,
            valor_liquido: t.valor_liquido,
            tipo_transacao: t.tipo_transacao,
          });
          const transactionId = hashToId.get(hash);
          if (!transactionId) return null;
          return {
            transactionId,
            itens: t.itens || [],
          };
        });

      const itensResolvidos = (await Promise.all(transacoesComItens)).filter(Boolean);
      
      if (itensResolvidos.length > 0) {
        try {
          limparCacheMapeamentos();
          await criarItensEmLote(itensResolvidos as any[], empresaId, canal);
        } catch (err) {
          console.error("[Background Import] Erro ao criar itens:", err);
        }
      }
    }

    // PASSO 7: Finalizar job com sucesso
    await finalizarJob(jobId, {
      status: 'concluido',
      linhas_importadas: importadas,
      linhas_duplicadas: duplicadas,
      linhas_com_erro: erros,
    });

    // Invalidar queries
    queryClient.invalidateQueries({ queryKey: ["marketplace_transactions"] });
    queryClient.invalidateQueries({ queryKey: ["marketplace_import_jobs"] });

    toast.success(`Importação concluída!`, {
      description: `${importadas.toLocaleString()} novas · ${duplicadas.toLocaleString()} duplicadas · ${TOTAL.toLocaleString()} processadas`,
      duration: 8000,
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
