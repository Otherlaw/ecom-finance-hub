import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Upload, FileX, FileCheck, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  parseNFeXML,
  formatCurrency,
  NotaFiscalXML,
  TipoCreditoICMS,
  OrigemCredito,
} from "@/lib/icms-data";
import { REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit } from "@/lib/empresas-data";
import { useEmpresas } from "@/hooks/useEmpresas";
import { CreditoICMSInsert } from "@/hooks/useCreditosICMS";

interface XMLImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (credits: CreditoICMSInsert[]) => void;
  existingKeys: string[];
}

interface ParsedFile {
  fileName: string;
  nfe: NotaFiscalXML | null;
  error?: string;
  isDuplicate?: boolean;
}

interface PreviewCredit {
  empresaId: string;
  tipoCredito: TipoCreditoICMS;
  origemCredito: OrigemCredito;
  chaveAcesso: string;
  numeroNF: string;
  ncm: string;
  cfop: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ufOrigem: string;
  aliquotaIcms: number;
  valorIcmsDestacado: number;
  percentualAproveitamento: number;
  valorCreditoBruto: number;
  valorCredito: number;
  dataCompetencia: string;
  fornecedorNome: string;
}

export function XMLImportModal({
  open,
  onOpenChange,
  onImportSuccess,
  existingKeys,
}: XMLImportModalProps) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [previewCredits, setPreviewCredits] = useState<PreviewCredit[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);

  const { empresas, isLoading: empresasLoading } = useEmpresas();
  
  const selectedEmpresa = empresas.find(e => e.id === empresaId);
  const isSimples = selectedEmpresa?.regime_tributario === 'simples_nacional';
  const canUseCredits = selectedEmpresa ? canUseICMSCredit(selectedEmpresa.regime_tributario as any) : true;

  // Generate credits from NF-e for preview
  const generatePreviewCredits = (
    nfe: NotaFiscalXML,
    empId: string,
    tipoCredito: TipoCreditoICMS
  ): PreviewCredit[] => {
    const credits: PreviewCredit[] = [];
    const hoje = new Date().toISOString().split("T")[0];
    const competencia = `${hoje.substring(0, 7)}`;

    nfe.itens.forEach((item) => {
      if (item.valorIcms > 0) {
        credits.push({
          empresaId: empId,
          tipoCredito,
          origemCredito: 'compra_mercadoria',
          chaveAcesso: nfe.chaveAcesso,
          numeroNF: nfe.numero,
          ncm: item.ncm,
          cfop: item.cfop,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.valorTotal,
          ufOrigem: nfe.emitente.uf,
          aliquotaIcms: item.aliquotaIcms,
          valorIcmsDestacado: item.valorIcms,
          percentualAproveitamento: 100,
          valorCreditoBruto: item.valorIcms,
          valorCredito: item.valorIcms,
          dataCompetencia: competencia,
          fornecedorNome: nfe.emitente.razaoSocial,
        });
      }
    });

    return credits;
  };

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      if (!empresaId) {
        toast.error("Selecione uma empresa antes de importar os arquivos XML.");
        return;
      }

      setIsProcessing(true);
      const results: ParsedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.name.toLowerCase().endsWith(".xml")) {
          results.push({
            fileName: file.name,
            nfe: null,
            error: "Formato inválido. Envie apenas arquivos XML de NF-e.",
          });
          continue;
        }

        try {
          const content = await file.text();
          const nfe = parseNFeXML(content);

          if (!nfe) {
            results.push({
              fileName: file.name,
              nfe: null,
              error: "Não foi possível ler o XML. Verifique se é um arquivo NF-e válido.",
            });
            continue;
          }

          const isDuplicate = existingKeys.includes(nfe.chaveAcesso);

          results.push({
            fileName: file.name,
            nfe,
            isDuplicate,
            error: isDuplicate
              ? "Esta nota fiscal já foi importada anteriormente (chave de acesso duplicada)."
              : undefined,
          });
        } catch (error) {
          results.push({
            fileName: file.name,
            nfe: null,
            error: "Erro ao processar o arquivo XML.",
          });
        }
      }

      setParsedFiles(results);

      // Generate preview credits for valid, non-duplicate files
      const validNFes = results
        .filter((r) => r.nfe && !r.isDuplicate)
        .map((r) => r.nfe!);

      const tipoCredito: TipoCreditoICMS = isSimples ? 'nao_compensavel' : 'compensavel';
      const credits = validNFes.flatMap((nfe) =>
        generatePreviewCredits(nfe, empresaId, tipoCredito)
      );
      setPreviewCredits(credits);

      if (credits.length > 0) {
        setStep("preview");
      }

      setIsProcessing(false);
      event.target.value = "";
    },
    [empresaId, existingKeys, isSimples]
  );

  const handleConfirmImport = () => {
    if (previewCredits.length === 0) {
      toast.error("Nenhum crédito para importar.");
      return;
    }

    // Convert preview credits to insert format
    const creditsToInsert: CreditoICMSInsert[] = previewCredits.map((c) => ({
      empresa_id: c.empresaId,
      tipo_credito: c.tipoCredito,
      origem_credito: c.origemCredito,
      chave_acesso: c.chaveAcesso,
      numero_nf: c.numeroNF,
      ncm: c.ncm,
      cfop: c.cfop,
      descricao: c.descricao,
      quantidade: c.quantidade,
      valor_unitario: c.valorUnitario,
      valor_total: c.valorTotal,
      uf_origem: c.ufOrigem,
      aliquota_icms: c.aliquotaIcms,
      valor_icms_destacado: c.valorIcmsDestacado,
      percentual_aproveitamento: c.percentualAproveitamento,
      valor_credito_bruto: c.valorCreditoBruto,
      valor_ajustes: 0,
      valor_credito: c.valorCredito,
      data_competencia: c.dataCompetencia,
      fornecedor_nome: c.fornecedorNome,
    }));

    onImportSuccess(creditsToInsert);
    handleClose();
  };

  const handleClose = () => {
    setParsedFiles([]);
    setPreviewCredits([]);
    setStep("upload");
    setEmpresaId("");
    onOpenChange(false);
  };

  const validFilesCount = parsedFiles.filter((f) => f.nfe && !f.isDuplicate).length;
  const errorFilesCount = parsedFiles.filter((f) => f.error).length;
  const totalIcmsCredito = previewCredits.reduce((sum, c) => sum + c.valorCredito, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar XML de NF-e para Crédito de ICMS
          </DialogTitle>
          <DialogDescription>
            Selecione arquivos XML de NF-e para gerar créditos de ICMS automaticamente.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Select value={empresaId} onValueChange={setEmpresaId} disabled={empresasLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={empresasLoading ? "Carregando..." : "Selecione a empresa"} />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((emp) => {
                    const regime = REGIME_TRIBUTARIO_CONFIG[emp.regime_tributario as keyof typeof REGIME_TRIBUTARIO_CONFIG];
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          {regime && (
                            <Badge variant="outline" className={`${regime.bgColor} ${regime.color} border text-xs`}>
                              {regime.shortLabel}
                            </Badge>
                          )}
                          {emp.razao_social}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {isSimples && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                  <strong>Simples Nacional:</strong> Este crédito será apenas para controle interno, NÃO será considerado para compensação tributária ou recomendações de compra de notas.
                </AlertDescription>
              </Alert>
            )}

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                empresaId
                  ? "border-primary/50 hover:border-primary cursor-pointer"
                  : "border-muted cursor-not-allowed opacity-50"
              }`}
            >
              <input
                type="file"
                accept=".xml"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="xml-upload"
                disabled={!empresaId || isProcessing}
              />
              <label
                htmlFor="xml-upload"
                className={empresaId ? "cursor-pointer" : "cursor-not-allowed"}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isProcessing
                    ? "Processando arquivos..."
                    : "Clique para selecionar arquivos XML"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Aceita múltiplos arquivos XML de NF-e
                </p>
              </label>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Processando...</p>
                <Progress value={50} className="h-2" />
              </div>
            )}

            {parsedFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="gap-2">
                    <FileCheck className="h-3 w-3 text-success" />
                    {validFilesCount} válido(s)
                  </Badge>
                  {errorFilesCount > 0 && (
                    <Badge variant="outline" className="gap-2 border-destructive text-destructive">
                      <FileX className="h-3 w-3" />
                      {errorFilesCount} com erro(s)
                    </Badge>
                  )}
                </div>

                <ScrollArea className="h-[200px] rounded-lg border">
                  <div className="p-4 space-y-2">
                    {parsedFiles.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          file.error
                            ? "bg-destructive/10 border border-destructive/20"
                            : "bg-success/10 border border-success/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {file.error ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{file.fileName}</p>
                            {file.nfe && (
                              <p className="text-xs text-muted-foreground">
                                NF {file.nfe.numero} - {file.nfe.emitente.razaoSocial}
                              </p>
                            )}
                            {file.error && (
                              <p className="text-xs text-destructive">{file.error}</p>
                            )}
                          </div>
                        </div>
                        {file.nfe && !file.error && (
                          <Badge variant="secondary">
                            ICMS: {formatCurrency(file.nfe.icmsTotal)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Conferência de Créditos</h3>
                <p className="text-sm text-muted-foreground">
                  Revise os créditos que serão gerados antes de confirmar.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total de crédito</p>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(totalIcmsCredito)}
                </p>
              </div>
            </div>

            <ScrollArea className="h-[400px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>NF</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">ICMS Dest.</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewCredits.map((credit, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{credit.numeroNF}</TableCell>
                      <TableCell>{credit.ncm}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {credit.descricao}
                      </TableCell>
                      <TableCell className="text-right">{credit.quantidade}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(credit.valorTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(credit.valorIcmsDestacado)}
                      </TableCell>
                      <TableCell className="text-right text-success font-medium">
                        {formatCurrency(credit.valorCredito)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">
                {previewCredits.length} item(ns) de {validFilesCount} NF(s) serão importados.
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "preview" && (
            <Button onClick={handleConfirmImport} disabled={previewCredits.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar e Salvar Créditos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
