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
import { Upload, FileX, FileCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  parseNFeXML,
  generateCreditsFromNFe,
  formatCurrency,
  NotaFiscalXML,
  CreditoICMS,
  EMPRESAS,
} from "@/lib/icms-data";

interface XMLImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: (credits: CreditoICMS[]) => void;
  existingKeys: string[];
}

interface ParsedFile {
  fileName: string;
  nfe: NotaFiscalXML | null;
  error?: string;
  isDuplicate?: boolean;
}

export function XMLImportModal({
  open,
  onOpenChange,
  onImportSuccess,
  existingKeys,
}: XMLImportModalProps) {
  const [empresa, setEmpresa] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [previewCredits, setPreviewCredits] = useState<CreditoICMS[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      if (!empresa) {
        toast.error("Selecione uma empresa antes de importar os arquivos XML.");
        return;
      }

      setIsProcessing(true);
      const results: ParsedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate extension
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

          // Check for duplicate
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

      const credits = validNFes.flatMap((nfe) =>
        generateCreditsFromNFe(nfe, empresa)
      );
      setPreviewCredits(credits);

      if (credits.length > 0) {
        setStep("preview");
      }

      setIsProcessing(false);

      // Reset input
      event.target.value = "";
    },
    [empresa, existingKeys]
  );

  const handleConfirmImport = () => {
    if (previewCredits.length === 0) {
      toast.error("Nenhum crédito para importar.");
      return;
    }

    onImportSuccess(previewCredits);
    toast.success(
      `Créditos de ICMS importados com sucesso a partir de ${parsedFiles.filter((f) => f.nfe && !f.isDuplicate).length} NF(s).`
    );
    handleClose();
  };

  const handleClose = () => {
    setParsedFiles([]);
    setPreviewCredits([]);
    setStep("upload");
    setEmpresa("");
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
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((emp) => (
                    <SelectItem key={emp} value={emp}>
                      {emp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                empresa
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
                disabled={!empresa || isProcessing}
              />
              <label
                htmlFor="xml-upload"
                className={empresa ? "cursor-pointer" : "cursor-not-allowed"}
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
