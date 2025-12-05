import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Store,
  Link2,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useEmpresas } from "@/hooks/useEmpresas";
import { 
  parseUpsellerXLSX, 
  converterParaInsert, 
  isUpsellerFile,
  type UpsellerRow 
} from "@/lib/upseller-parser";
import { importarMapeamentosEmLote } from "@/hooks/useProdutoSkuMap";

interface ImportarMapeamentoUpsellerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CANAIS_LABELS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  shein: "Shein",
  tiktok_shop: "TikTok Shop",
  magalu: "Magalu",
  outro: "Outro",
};

export function ImportarMapeamentoUpsellerModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarMapeamentoUpsellerModalProps) {
  const { empresas = [] } = useEmpresas();
  
  const [empresaId, setEmpresaId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const [parsedData, setParsedData] = useState<UpsellerRow[]>([]);
  const [estatisticas, setEstatisticas] = useState<{
    totalLinhas: number;
    linhasValidas: number;
    linhasInvalidas: number;
    porCanal: Record<string, number>;
    duplicatasDetectadas: number;
  } | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setEmpresaId("");
    setFileName("");
    setStep("upload");
    setIsProcessing(false);
    setIsImporting(false);
    setImportProgress(0);
    setParsedData([]);
    setEstatisticas(null);
    setErros([]);
  }, []);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      resetForm();
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange, resetForm]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!empresaId) {
      toast.error("Selecione uma empresa antes de importar o arquivo.");
      return;
    }

    if (!isUpsellerFile(file.name)) {
      toast.error("Formato de arquivo não suportado. Use XLSX ou CSV.");
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    setErros([]);

    try {
      const result = await parseUpsellerXLSX(file);
      
      console.log('[Upseller Import] Resultado do parse:', result);
      
      if (result.erros.length > 0) {
        setErros(result.erros);
      }

      if (result.mapeamentos.length === 0) {
        toast.error("Nenhum mapeamento válido encontrado no arquivo.");
        setIsProcessing(false);
        return;
      }

      setParsedData(result.mapeamentos);
      setEstatisticas(result.estatisticas);
      setStep("preview");
      
    } catch (error) {
      console.error("[Upseller Import] Erro:", error);
      toast.error("Erro ao processar o arquivo.");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  }, [empresaId]);

  const handleImport = useCallback(async () => {
    if (!empresaId || parsedData.length === 0) return;

    setStep("importing");
    setIsImporting(true);
    setImportProgress(10);

    try {
      const mapeamentosParaInserir = converterParaInsert(parsedData, empresaId);
      
      setImportProgress(30);
      
      const resultado = await importarMapeamentosEmLote(mapeamentosParaInserir);
      
      setImportProgress(100);
      
      if (resultado.erros > 0) {
        toast.warning(`Importação concluída com ${resultado.erros} erros. ${resultado.inseridos} registros salvos.`);
      } else {
        toast.success(`${resultado.inseridos} mapeamentos importados com sucesso!`);
      }
      
      onSuccess?.();
      handleClose();
      
    } catch (error) {
      console.error("[Upseller Import] Erro na importação:", error);
      toast.error("Erro ao importar mapeamentos.");
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  }, [empresaId, parsedData, onSuccess, handleClose]);

  // Preview: agrupar por canal para exibição
  const previewPorCanal = parsedData.reduce((acc, row) => {
    if (!acc[row.canal]) acc[row.canal] = [];
    acc[row.canal].push(row);
    return acc;
  }, {} as Record<string, UpsellerRow[]>);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Importar Mapeamento de SKUs (Upseller)
          </DialogTitle>
          <DialogDescription>
            Importe o arquivo XLSX exportado do Upseller para mapear SKUs internos aos anúncios de marketplace.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome_fantasia || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Colunas esperadas no arquivo:</strong>
                <ul className="list-disc ml-4 mt-2 text-sm">
                  <li><code>SKU</code> - Código interno do produto (obrigatório)</li>
                  <li><code>ID do Anúncio</code> - MLBxxxxxxxx ou ID numérico Shopee</li>
                  <li><code>ID da Variante</code> - ID da variação (opcional)</li>
                  <li><code>Variante</code> - Nome da variação (ex: "Dourado,Floco")</li>
                  <li><code>Nome da Loja</code> - Identifica o canal automaticamente</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                empresaId
                  ? "border-primary/50 hover:border-primary cursor-pointer"
                  : "border-muted cursor-not-allowed opacity-50"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
                id="upseller-upload"
                disabled={!empresaId || isProcessing}
              />
              <label
                htmlFor="upseller-upload"
                className={empresaId ? "cursor-pointer" : "cursor-not-allowed"}
              >
                {isProcessing ? (
                  <>
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-primary animate-pulse mb-4" />
                    <p className="text-lg font-medium">Processando arquivo...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">
                      Clique para selecionar arquivo XLSX
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Arquivo exportado do Upseller
                    </p>
                  </>
                )}
              </label>
            </div>

            {erros.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {erros.map((erro, i) => (
                    <p key={i}>{erro}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && estatisticas && (
          <div className="space-y-4 py-4">
            {/* Resumo */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{estatisticas.linhasValidas}</div>
                <div className="text-xs text-muted-foreground">Mapeamentos</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-success">
                  {Object.keys(estatisticas.porCanal).length}
                </div>
                <div className="text-xs text-muted-foreground">Canais</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-warning">
                  {estatisticas.duplicatasDetectadas}
                </div>
                <div className="text-xs text-muted-foreground">Duplicatas</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-destructive">
                  {estatisticas.linhasInvalidas}
                </div>
                <div className="text-xs text-muted-foreground">Inválidas</div>
              </div>
            </div>

            {/* Por canal */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(estatisticas.porCanal).map(([canal, qtd]) => (
                <Badge key={canal} variant="outline" className="gap-1">
                  <Store className="h-3 w-3" />
                  {CANAIS_LABELS[canal] || canal}: {qtd}
                </Badge>
              ))}
            </div>

            {/* Preview da tabela */}
            <ScrollArea className="h-[350px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>SKU Interno</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>ID Anúncio</TableHead>
                    <TableHead>Variante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 100).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono font-medium">
                        {row.sku_interno}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CANAIS_LABELS[row.canal] || row.canal}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                        {row.loja || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.anuncio_id || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.variante_id && (
                          <Badge variant="secondary" className="text-xs mr-1">
                            {row.variante_id}
                          </Badge>
                        )}
                        {row.variante_nome || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedData.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        ... e mais {parsedData.length - 100} linhas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {estatisticas.duplicatasDetectadas > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {estatisticas.duplicatasDetectadas} registros duplicados detectados. 
                  Eles serão atualizados com os dados mais recentes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto text-primary animate-pulse mb-4" />
              <h3 className="text-lg font-semibold">Importando mapeamentos...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Aguarde enquanto os dados são salvos no banco de dados.
              </p>
            </div>
            <Progress value={importProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {importProgress}% concluído
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancelar
          </Button>
          {step === "preview" && (
            <Button onClick={handleImport} disabled={isImporting || parsedData.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Importar {parsedData.length} Mapeamentos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
