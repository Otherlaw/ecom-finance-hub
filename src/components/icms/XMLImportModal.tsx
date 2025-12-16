import { useState, useCallback, useEffect } from "react";
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
import { Upload, FileX, FileCheck, AlertTriangle, CheckCircle2, Info, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  parseNFeXML,
  formatCurrency,
  NotaFiscalXML,
  TipoCreditoICMS,
  OrigemCredito,
  ORIGEM_CREDITO_CONFIG,
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
  autoDetectedEmpresa?: string;
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

// Origens disponíveis para seleção (sem nota_adquirida)
const ORIGENS_DISPONIVEIS: OrigemCredito[] = [
  'compra_mercadoria',
  'compra_insumo',
  'frete',
  'energia_eletrica',
  'ativo_imobilizado',
  'outro',
];

export function XMLImportModal({
  open,
  onOpenChange,
  onImportSuccess,
  existingKeys,
}: XMLImportModalProps) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [origemCredito, setOrigemCredito] = useState<OrigemCredito>("compra_mercadoria");
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [previewCredits, setPreviewCredits] = useState<PreviewCredit[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoDetectedEmpresa, setAutoDetectedEmpresa] = useState<string | null>(null);

  const { empresas, isLoading: empresasLoading } = useEmpresas();
  
  const selectedEmpresa = empresas.find(e => e.id === empresaId);
  const isSimples = selectedEmpresa?.regime_tributario === 'simples_nacional';

  // Função para normalizar CNPJ (remover pontuação)
  const normalizeCNPJ = (cnpj: string): string => {
    return cnpj.replace(/[^\d]/g, '');
  };

  // Função para encontrar empresa pelo CNPJ do destinatário
  const findEmpresaByCNPJ = (cnpj: string): string | undefined => {
    const normalizedCNPJ = normalizeCNPJ(cnpj);
    const empresa = empresas.find(e => normalizeCNPJ(e.cnpj) === normalizedCNPJ);
    return empresa?.id;
  };

  // Generate credits from NF-e for preview
  const generatePreviewCredits = (
    nfe: NotaFiscalXML,
    empId: string,
    tipoCredito: TipoCreditoICMS,
    origem: OrigemCredito
  ): PreviewCredit[] => {
    const credits: PreviewCredit[] = [];
    const hoje = new Date().toISOString().split("T")[0];
    const competencia = `${hoje.substring(0, 7)}`;

    nfe.itens.forEach((item) => {
      if (item.valorIcms > 0) {
        credits.push({
          empresaId: empId,
          tipoCredito,
          origemCredito: origem,
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

      setIsProcessing(true);
      const results: ParsedFile[] = [];
      let detectedEmpresaId: string | undefined;

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
          
          // Auto-detectar empresa pelo CNPJ do destinatário
          let autoEmpresa: string | undefined;
          if (nfe.destinatario?.cnpj) {
            autoEmpresa = findEmpresaByCNPJ(nfe.destinatario.cnpj);
            if (autoEmpresa && !detectedEmpresaId) {
              detectedEmpresaId = autoEmpresa;
            }
          }

          results.push({
            fileName: file.name,
            nfe,
            isDuplicate,
            autoDetectedEmpresa: autoEmpresa,
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

      // Auto-selecionar empresa se detectada e não selecionada ainda
      if (detectedEmpresaId && !empresaId) {
        setEmpresaId(detectedEmpresaId);
        setAutoDetectedEmpresa(detectedEmpresaId);
        toast.success("Empresa identificada automaticamente pelo CNPJ do destinatário!");
      }

      setIsProcessing(false);
      event.target.value = "";
    },
    [existingKeys, empresas, empresaId]
  );

  // Regenerate preview when empresa or origem changes
  useEffect(() => {
    if (parsedFiles.length === 0 || !empresaId) return;

    const validNFes = parsedFiles
      .filter((r) => r.nfe && !r.isDuplicate)
      .map((r) => r.nfe!);

    if (validNFes.length === 0) return;

    const empresa = empresas.find(e => e.id === empresaId);
    const tipoCredito: TipoCreditoICMS = 
      empresa?.regime_tributario === 'simples_nacional' ? 'nao_compensavel' : 'compensavel';
    
    const credits = validNFes.flatMap((nfe) =>
      generatePreviewCredits(nfe, empresaId, tipoCredito, origemCredito)
    );
    setPreviewCredits(credits);
  }, [empresaId, origemCredito, parsedFiles, empresas]);

  // Move to preview step when we have credits
  const handleProsseguir = () => {
    if (!empresaId) {
      toast.error("Selecione uma empresa para continuar.");
      return;
    }

    const validNFes = parsedFiles
      .filter((r) => r.nfe && !r.isDuplicate)
      .map((r) => r.nfe!);

    if (validNFes.length === 0) {
      toast.error("Nenhum arquivo XML válido para importar.");
      return;
    }

    // Check if any file has ICMS
    const hasIcms = validNFes.some(nfe => nfe.itens.some(item => item.valorIcms > 0));
    if (!hasIcms) {
      toast.warning("Nenhum item com ICMS destacado foi encontrado nos arquivos XML.");
      return;
    }

    setStep("preview");
  };

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
    setOrigemCredito("compra_mercadoria");
    setAutoDetectedEmpresa(null);
    onOpenChange(false);
  };

  const validFilesCount = parsedFiles.filter((f) => f.nfe && !f.isDuplicate).length;
  const errorFilesCount = parsedFiles.filter((f) => f.error).length;
  const duplicateFilesCount = parsedFiles.filter((f) => f.isDuplicate).length;
  const totalIcmsCredito = previewCredits.reduce((sum, c) => sum + c.valorCredito, 0);
  const noIcmsFiles = parsedFiles.filter(f => f.nfe && !f.isDuplicate && f.nfe.icmsTotal === 0);

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
            {/* Seletor de Origem */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="origem">Origem do Crédito *</Label>
                <Select value={origemCredito} onValueChange={(v) => setOrigemCredito(v as OrigemCredito)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS_DISPONIVEIS.map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {ORIGEM_CREDITO_CONFIG[origem].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="empresa">
                  Empresa *
                  {autoDetectedEmpresa && empresaId === autoDetectedEmpresa && (
                    <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/20">
                      <Building2 className="h-3 w-3 mr-1" />
                      Auto-detectada
                    </Badge>
                  )}
                </Label>
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
              className="border-2 border-dashed rounded-xl p-8 text-center transition-colors border-primary/50 hover:border-primary cursor-pointer"
            >
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="xml-upload"
                disabled={isProcessing}
              />
              <label
                htmlFor="xml-upload"
                className="cursor-pointer"
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isProcessing
                    ? "Processando arquivos..."
                    : "Clique para selecionar arquivos XML"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Aceita múltiplos arquivos XML de NF-e. A empresa será identificada automaticamente pelo CNPJ.
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
                  {duplicateFilesCount > 0 && (
                    <Badge variant="outline" className="gap-2 border-warning text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {duplicateFilesCount} duplicado(s)
                    </Badge>
                  )}
                  {errorFilesCount > 0 && (
                    <Badge variant="outline" className="gap-2 border-destructive text-destructive">
                      <FileX className="h-3 w-3" />
                      {errorFilesCount - duplicateFilesCount} com erro(s)
                    </Badge>
                  )}
                </div>

                {noIcmsFiles.length > 0 && (
                  <Alert className="bg-warning/10 border-warning/30">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription className="text-sm">
                      <strong>{noIcmsFiles.length} arquivo(s)</strong> não possuem ICMS destacado nos itens e não gerarão crédito.
                    </AlertDescription>
                  </Alert>
                )}

                <ScrollArea className="h-[200px] rounded-lg border">
                  <div className="p-4 space-y-2">
                    {parsedFiles.map((file, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          file.error
                            ? file.isDuplicate 
                              ? "bg-warning/10 border border-warning/20"
                              : "bg-destructive/10 border border-destructive/20"
                            : "bg-success/10 border border-success/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {file.error ? (
                            <AlertTriangle className={`h-4 w-4 ${file.isDuplicate ? "text-warning" : "text-destructive"}`} />
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
                              <p className={`text-xs ${file.isDuplicate ? "text-warning" : "text-destructive"}`}>
                                {file.error}
                              </p>
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

            <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
              <div>
                <span className="text-sm text-muted-foreground">Empresa:</span>
                <span className="ml-2 font-medium">{selectedEmpresa?.razao_social}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Origem:</span>
                <span className="ml-2 font-medium">{ORIGEM_CREDITO_CONFIG[origemCredito].label}</span>
              </div>
            </div>

            <ScrollArea className="h-[350px] rounded-lg border">
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

        <DialogFooter className="gap-2">
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {step === "upload" && validFilesCount > 0 && (
            <Button onClick={handleProsseguir} className="bg-primary hover:bg-primary/90">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Prosseguir para Conferência
            </Button>
          )}
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