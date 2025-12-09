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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Upload, FileX, FileCheck, AlertTriangle, CheckCircle2, Package, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { parseNFeXML, NotaFiscalXML, formatCurrency } from "@/lib/icms-data";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCompras } from "@/hooks/useCompras";

interface ImportarNFeXMLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
  existingKeys?: string[];
}

interface ParsedFile {
  fileName: string;
  nfe: NotaFiscalXML | null;
  error?: string;
  isDuplicate?: boolean;
}

const FORMAS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

export function ImportarNFeXMLModal({
  open,
  onOpenChange,
  onImportSuccess,
  existingKeys = [],
}: ImportarNFeXMLModalProps) {
  const [empresaId, setEmpresaId] = useState<string>("");
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Campos de pagamento
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("a_vista");
  const [prazoDias, setPrazoDias] = useState<number>(30);
  const [gerarContaPagar, setGerarContaPagar] = useState<boolean>(true);

  const { empresas = [] } = useEmpresas();
  const { criarCompra } = useCompras();

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

      const validFiles = results.filter((r) => r.nfe && !r.isDuplicate);
      if (validFiles.length > 0) {
        setStep("preview");
      }

      setIsProcessing(false);
      event.target.value = "";
    },
    [empresaId, existingKeys]
  );

  const handleConfirmImport = async () => {
    const validFiles = parsedFiles.filter((f) => f.nfe && !f.isDuplicate);
    if (validFiles.length === 0) {
      toast.error("Nenhuma nota fiscal válida para importar.");
      return;
    }

    setIsImporting(true);

    try {
      for (const file of validFiles) {
        const nfe = file.nfe!;

        // Converter itens da NF para formato do sistema
        const itens = nfe.itens.map((item) => ({
          produto_id: null,
          codigo_nf: item.codigo,
          descricao_nf: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          quantidade: item.quantidade,
          quantidade_recebida: 0,
          valor_unitario: item.valorUnitario,
          valor_total: item.valorTotal,
          aliquota_icms: item.aliquotaIcms,
          valor_icms: item.valorIcms,
          aliquota_ipi: 0,
          valor_ipi: 0,
          mapeado: false,
        }));

        await criarCompra.mutateAsync({
          empresa_id: empresaId,
          fornecedor_nome: nfe.emitente.razaoSocial,
          fornecedor_cnpj: nfe.emitente.cnpj,
          data_pedido: nfe.dataEmissao,
          data_nf: nfe.dataEmissao,
          numero_nf: nfe.numero,
          chave_acesso: nfe.chaveAcesso,
          valor_total: nfe.valorTotal,
          status: 'emitido',
          forma_pagamento: formaPagamento || undefined,
          condicao_pagamento: condicaoPagamento,
          prazo_dias: condicaoPagamento === 'a_prazo' ? prazoDias : undefined,
          gerar_conta_pagar: gerarContaPagar,
          itens,
        });
      }

      toast.success(
        `${validFiles.length} compra(s) importada(s) com sucesso a partir de NF-e XML.`
      );
      onImportSuccess();
      handleClose();
    } catch (error) {
      console.error("Erro ao importar compras:", error);
      toast.error("Erro ao importar compras. Verifique os logs.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setParsedFiles([]);
    setStep("upload");
    setEmpresaId("");
    setFormaPagamento("");
    setCondicaoPagamento("a_vista");
    setPrazoDias(30);
    setGerarContaPagar(true);
    onOpenChange(false);
  };

  const validFilesCount = parsedFiles.filter((f) => f.nfe && !f.isDuplicate).length;
  const errorFilesCount = parsedFiles.filter((f) => f.error).length;
  const totalItens = parsedFiles
    .filter((f) => f.nfe && !f.isDuplicate)
    .reduce((sum, f) => sum + (f.nfe?.itens.length || 0), 0);
  const totalValor = parsedFiles
    .filter((f) => f.nfe && !f.isDuplicate)
    .reduce((sum, f) => sum + (f.nfe?.valorTotal || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Importar NF-e XML para Compras
          </DialogTitle>
          <DialogDescription>
            Selecione arquivos XML de NF-e para criar compras automaticamente.
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

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                empresaId
                  ? "border-primary/50 hover:border-primary cursor-pointer"
                  : "border-muted cursor-not-allowed opacity-50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (empresaId && !isProcessing && e.dataTransfer.files) {
                  const input = document.getElementById("xml-upload-compras") as HTMLInputElement;
                  if (input) {
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }
              }}
            >
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="xml-upload-compras"
                disabled={!empresaId || isProcessing}
              />
              <label
                htmlFor="xml-upload-compras"
                className={empresaId ? "cursor-pointer" : "cursor-not-allowed"}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {isProcessing
                    ? "Processando arquivos..."
                    : "Clique ou arraste arquivos XML aqui"}
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
                            {formatCurrency(file.nfe.valorTotal)}
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
                <h3 className="font-semibold">Conferência das Compras</h3>
                <p className="text-sm text-muted-foreground">
                  Revise as compras que serão criadas antes de confirmar.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valor total</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(totalValor)}
                </p>
              </div>
            </div>

            <ScrollArea className="h-[250px] rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>NF</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">ICMS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedFiles
                    .filter((f) => f.nfe && !f.isDuplicate)
                    .map((file, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono font-medium">
                          {file.nfe!.numero}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {file.nfe!.emitente.razaoSocial}
                        </TableCell>
                        <TableCell>{file.nfe!.dataEmissao}</TableCell>
                        <TableCell className="text-center">
                          {file.nfe!.itens.length}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(file.nfe!.valorTotal)}
                        </TableCell>
                        <TableCell className="text-right text-success">
                          {formatCurrency(file.nfe!.icmsTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Condições de Pagamento */}
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Label className="font-semibold">Condições de Pagamento</Label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Condição</Label>
                  <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_vista">À Vista</SelectItem>
                      <SelectItem value="a_prazo">A Prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {condicaoPagamento === "a_prazo" && (
                  <div className="space-y-2">
                    <Label className="text-sm">Prazo (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={prazoDias}
                      onChange={(e) => setPrazoDias(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch
                  id="gerar-conta-pagar"
                  checked={gerarContaPagar}
                  onCheckedChange={setGerarContaPagar}
                />
                <Label htmlFor="gerar-conta-pagar" className="text-sm cursor-pointer">
                  Gerar Conta a Pagar automaticamente
                </Label>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">
                {validFilesCount} compra(s) com {totalItens} item(ns) serão criadas.
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
            <Button 
              onClick={handleConfirmImport} 
              disabled={validFilesCount === 0 || isImporting}
            >
              {isImporting ? (
                "Importando..."
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar e Criar Compras
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}