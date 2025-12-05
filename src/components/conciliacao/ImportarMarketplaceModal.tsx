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
import { Upload, FileSpreadsheet, AlertCircle, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useMarketplaceTransactions, MarketplaceTransactionInsert } from "@/hooks/useMarketplaceTransactions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { detectarGranularidadeItens, extrairItemDeLinhaCSV, type ItemVendaMarketplace } from "@/lib/marketplace-item-parser";
import { detectarTipoArquivo, parseCSVFile, parseXLSXFile, parseXLSXMercadoLivre, parseXLSXMercadoPago } from "@/lib/parsers/arquivoFinanceiro";

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
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);


  const parseCSV = useCallback((content: string, selectedCanal: string): { transacoes: TransacaoPreview[]; totalItens: number } => {
    const lines = content.split("\n").filter(line => line.trim());
    if (lines.length < 2) return { transacoes: [], totalItens: 0 };

    const header = lines[0].toLowerCase();
    const transactions: TransacaoPreview[] = [];
    let totalItens = 0;

    // Detectar delimitador
    const delimiter = header.includes(";") ? ";" : ",";
    const headers = header.split(delimiter).map(h => h.trim().replace(/"/g, ""));

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
      },
    };

    const mapping = columnMappings[selectedCanal] || columnMappings.default;

    const findColumn = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const idx = headers.findIndex(h => h.includes(name));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const dataIdx = findColumn(mapping.data);
    const pedidoIdx = findColumn(mapping.pedido);
    const tipoIdx = findColumn(mapping.tipo);
    const descricaoIdx = findColumn(mapping.descricao);
    const valorBrutoIdx = findColumn(mapping.valorBruto);
    const valorLiquidoIdx = findColumn(mapping.valorLiquido);
    const tarifasIdx = findColumn(mapping.tarifas);
    const taxasIdx = findColumn(mapping.taxas);
    const outrosDescontosIdx = findColumn(mapping.outrosDescontos);

    // Detectar se tem granularidade de itens
    const temItens = detectarGranularidadeItens(headers);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim().replace(/"/g, ""));
      if (values.length < 3) continue;

      const parseDate = (dateStr: string): string => {
        if (!dateStr) return new Date().toISOString().split("T")[0];
        // Tentar formatos comuns
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
          }
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
        return new Date().toISOString().split("T")[0];
      };

      const parseValue = (val: string): number => {
        if (!val) return 0;
        const cleaned = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
        return parseFloat(cleaned) || 0;
      };

      const valorLiquido = valorLiquidoIdx >= 0 ? parseValue(values[valorLiquidoIdx]) : 0;
      const valorBruto = valorBrutoIdx >= 0 ? parseValue(values[valorBrutoIdx]) : valorLiquido;
      const tarifas = tarifasIdx >= 0 ? parseValue(values[tarifasIdx]) : 0;
      const taxas = taxasIdx >= 0 ? parseValue(values[taxasIdx]) : 0;
      const outrosDescontos = outrosDescontosIdx >= 0 ? parseValue(values[outrosDescontosIdx]) : 0;
      const tipoTransacao = tipoIdx >= 0 ? values[tipoIdx] || "venda" : "venda";

      // Determinar se é crédito ou débito baseado no tipo e valor
      let tipoLancamento: 'credito' | 'debito' = "credito";
      const tipoLower = tipoTransacao.toLowerCase();
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

      const pedidoIdValue = pedidoIdx >= 0 && values[pedidoIdx] ? values[pedidoIdx] : null;
      const dataTransacao = dataIdx >= 0 ? parseDate(values[dataIdx]) : new Date().toISOString().split("T")[0];
      const descricaoValue = descricaoIdx >= 0 ? values[descricaoIdx] || tipoTransacao : tipoTransacao;
      
      // Gerar hash para referencia_externa
      const hashStr = `${dataTransacao}|${pedidoIdValue || ''}|${tipoTransacao}|${valorLiquido}`;
      let hash = 0;
      for (let j = 0; j < hashStr.length; j++) {
        const char = hashStr.charCodeAt(j);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const referenciaExterna = Math.abs(hash).toString(16);

      // Extrair item se houver granularidade
      const itens: ItemVendaMarketplace[] = [];
      if (temItens) {
        const item = extrairItemDeLinhaCSV(selectedCanal, headers, values, pedidoIdValue);
        if (item) {
          itens.push(item);
          totalItens++;
        }
      }

      transactions.push({
        data_transacao: dataTransacao,
        pedido_id: pedidoIdValue,
        tipo_transacao: tipoTransacao,
        descricao: descricaoValue,
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

  // Mapeia linhas do relatório (CSV/XLSX) para TransacaoPreview[]
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

    // Detectar se tem granularidade de itens
    const temItens = detectarGranularidadeItens(headers);

    const parseDate = (dateStr: string): string => {
      if (!dateStr) return new Date().toISOString().split("T")[0];
      const parts = String(dateStr).split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        }
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return new Date().toISOString().split("T")[0];
    };

    const parseValue = (val: any): number => {
      if (typeof val === "number") return val;
      if (!val) return 0;
      const str = String(val).replace(/[^\d,.\-]/g, "").replace(",", ".");
      return parseFloat(str) || 0;
    };

    const getVal = (linha: any, col: string | null): any => {
      if (!col) return null;
      // Procura a chave original (case-insensitive)
      const key = Object.keys(linha).find(k => k.toLowerCase().trim() === col);
      return key ? linha[key] : null;
    };

    for (const linha of linhas) {
      const dataTransacao = parseDate(getVal(linha, dataCol) || "");
      const pedidoId = getVal(linha, pedidoCol) || null;
      const tipoTransacao = getVal(linha, tipoCol) || "venda";
      const descricao = getVal(linha, descricaoCol) || `Transação ${selectedCanal}`;
      const valorBruto = parseValue(getVal(linha, valorBrutoCol));
      const valorLiquido = parseValue(getVal(linha, valorLiquidoCol)) || valorBruto;
      const tarifas = parseValue(getVal(linha, tarifasCol));
      const taxas = parseValue(getVal(linha, taxasCol));
      const outrosDescontos = parseValue(getVal(linha, outrosDescontosCol));

      if (valorLiquido === 0 && valorBruto === 0) continue;

      const hash = `${dataTransacao}_${pedidoId || ""}_${valorLiquido}_${descricao}`.substring(0, 100);

      // Extrair itens se disponível
      let itens: ItemVendaMarketplace[] = [];
      if (temItens) {
        const headersArray = Object.keys(linha);
        const valuesArray = headersArray.map(h => String(linha[h] ?? ""));
        const item = extrairItemDeLinhaCSV(selectedCanal, headersArray, valuesArray, pedidoId);
        if (item) {
          itens = [item];
          totalItens += 1;
        }
      }

      transactions.push({
        data_transacao: dataTransacao,
        descricao: String(descricao),
        pedido_id: pedidoId ? String(pedidoId) : null,
        tipo_transacao: String(tipoTransacao),
        valor_bruto: valorBruto,
        tarifas,
        taxas,
        outros_descontos: outrosDescontos,
        valor_liquido: valorLiquido,
        tipo_lancamento: valorLiquido >= 0 ? "credito" : "debito",
        referencia_externa: hash,
        itens,
      });
    }

    return { transacoes: transactions, totalItens };
  }, []);

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

      // Parser específico para Mercado Pago (CSV ou XLSX)
      if (canal === "mercado_pago") {
        const linhasMP = await parseXLSXMercadoPago(file);
        transacoes = linhasMP.map(t => {
          const hash = `${t.data_transacao}_${t.pedido_id || t.referencia_externa || ""}_${t.valor_liquido}_${t.descricao}`.substring(0, 100);
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
      } else if (tipo === "csv") {
        const linhas = await parseCSVFile(file);
        const result = mapLinhasRelatorioParaTransacoes(linhas, canal);
        transacoes = result.transacoes;
        totalItens = result.totalItens;
      } else if (tipo === "xlsx") {
        // Parser específico ML retorna objetos já mapeados
        if (canal === "mercado_livre") {
          const linhasML = await parseXLSXMercadoLivre(file);
          transacoes = linhasML.map(t => {
            const hash = `${t.data_transacao}_${t.pedido_id || ""}_${t.valor_liquido}_${t.descricao}`.substring(0, 100);
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
              referencia_externa: hash,
              itens: [],
            };
          });
        } else {
          const linhas = await parseXLSXFile(file);
          const result = mapLinhasRelatorioParaTransacoes(linhas, canal);
          transacoes = result.transacoes;
          totalItens = result.totalItens;
        }
      } else {
        setError("Formato não suportado. Use CSV ou XLSX.");
        setIsProcessing(false);
        return;
      }

      console.log('[Importação Marketplace] Prévia', {
        tipo,
        canal,
        totalTransacoes: transacoes.length,
        totalItens,
      });

      if (transacoes.length === 0) {
        setError("Nenhuma transação encontrada no arquivo. Verifique o formato.");
        setIsProcessing(false);
        return;
      }

      setParsedData(transacoes);
      setTotalItensDetectados(totalItens);
      setStep("preview");
      setIsProcessing(false);
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      setError("Erro ao processar o arquivo. Verifique o formato.");
      setIsProcessing(false);
    }
  }, [canal, mapLinhasRelatorioParaTransacoes]);

  const handleImport = useCallback(async () => {
    if (!empresaId || !canal || parsedData.length === 0) return;

    // Determinar origem do arquivo (csv ou xlsx)
    const origemExtrato = fileName.toLowerCase().endsWith('.xlsx') ? 'arquivo_xlsx' : 'arquivo_csv';

    // Preparar transações para importação
    const transacoes = parsedData.map(row => ({
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

    await importarTransacoes.mutateAsync({ transacoes });
    onSuccess?.();
    handleClose();
  }, [empresaId, canal, contaNome, parsedData, fileName, importarTransacoes, onSuccess, handleClose]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
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
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor Bruto</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead>Lançamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row.data_transacao}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.pedido_id || "-"}
                        </TableCell>
                        <TableCell>{row.tipo_transacao}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {row.descricao}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.valor_bruto)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.valor_liquido)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              row.tipo_lancamento === "credito"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {row.tipo_lancamento === "credito" ? "Crédito" : "Débito"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Mostrando 50 de {parsedData.length} transações
                  </p>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!empresaId || !canal || parsedData.length === 0 || importarTransacoes.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importarTransacoes.isPending ? "Importando..." : `Importar ${parsedData.length} transações`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
