import { useState, useCallback, useMemo, useEffect } from "react";
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
import { Upload, FileX, FileCheck, AlertTriangle, CheckCircle2, Package, CreditCard, Calendar } from "lucide-react";
import { toast } from "sonner";
import { parseNFeXML, NotaFiscalXML, formatCurrency } from "@/lib/icms-data";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCompras, ParcelaConfig } from "@/hooks/useCompras";

interface ImportarNFeXMLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
  existingKeys?: string[];
}

const OPCOES_PARCELAS = [
  { value: 1, label: "À vista (1x)" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x" },
  { value: 5, label: "5x" },
  { value: 6, label: "6x" },
  { value: 10, label: "10x" },
  { value: 12, label: "12x" },
];

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
  const [numeroParcelas, setNumeroParcelas] = useState<number>(1);
  const [parcelasConfig, setParcelasConfig] = useState<ParcelaConfig[]>([]);
  const [empresaAutoDetectada, setEmpresaAutoDetectada] = useState<boolean>(false);
  const [empresaNaoEncontrada, setEmpresaNaoEncontrada] = useState<boolean>(false);

  const { empresas = [] } = useEmpresas();
  const { criarCompra } = useCompras();

  // Total da(s) compra(s) para calcular valor das parcelas
  const totalValor = useMemo(() => 
    parsedFiles
      .filter((f) => f.nfe && !f.isDuplicate)
      .reduce((sum, f) => sum + (f.nfe?.valorTotal || 0), 0),
    [parsedFiles]
  );

  // Gerar/atualizar config de parcelas quando mudar quantidade ou prazo
  useEffect(() => {
    if (condicaoPagamento !== "a_prazo" || numeroParcelas <= 1) {
      setParcelasConfig([]);
      return;
    }

    const valorParcela = totalValor / numeroParcelas;
    const baseDate = parsedFiles.find(f => f.nfe)?.nfe?.dataEmissao 
      ? new Date(parsedFiles.find(f => f.nfe)?.nfe?.dataEmissao || new Date())
      : new Date();
    
    const novaConfig: ParcelaConfig[] = Array.from({ length: numeroParcelas }, (_, i) => {
      const dataVenc = new Date(baseDate);
      dataVenc.setDate(dataVenc.getDate() + prazoDias * (i + 1));
      
      // Manter valores anteriores se existirem
      const anterior = parcelasConfig[i];
      return {
        numero: i + 1,
        valor: anterior?.valor ?? Math.round(valorParcela * 100) / 100,
        dataVencimento: anterior?.dataVencimento ?? dataVenc.toISOString().split('T')[0],
      };
    });
    
    setParcelasConfig(novaConfig);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroParcelas, prazoDias, totalValor, condicaoPagamento]);

  // Auto-detectar empresa pelo CNPJ do destinatário
  const autoDetectEmpresa = useCallback((cnpjDestinatario: string | undefined) => {
    if (!cnpjDestinatario) {
      setEmpresaNaoEncontrada(true);
      return false;
    }
    
    const cnpjLimpo = cnpjDestinatario.replace(/\D/g, '');
    const empresaEncontrada = empresas.find(emp => 
      emp.cnpj?.replace(/\D/g, '') === cnpjLimpo
    );
    
    if (empresaEncontrada) {
      setEmpresaId(empresaEncontrada.id);
      setEmpresaAutoDetectada(true);
      setEmpresaNaoEncontrada(false);
      toast.success(`Empresa "${empresaEncontrada.nome_fantasia || empresaEncontrada.razao_social}" detectada pelo CNPJ.`);
      return true;
    } else {
      setEmpresaNaoEncontrada(true);
      toast.error("Empresa não encontrada pelo CNPJ do destinatário. Cadastre a empresa primeiro.");
      return false;
    }
  }, [empresas]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsProcessing(true);
      setEmpresaNaoEncontrada(false);
      const results: ParsedFile[] = [];
      let primeiroDestinatarioCnpj: string | undefined;

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

          if (!primeiroDestinatarioCnpj && nfe.destinatario?.cnpj) {
            primeiroDestinatarioCnpj = nfe.destinatario.cnpj;
          }

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
      if (validFiles.length > 0 && primeiroDestinatarioCnpj) {
        const detectou = autoDetectEmpresa(primeiroDestinatarioCnpj);
        if (detectou) {
          setStep("preview");
        }
      } else if (validFiles.length > 0 && !primeiroDestinatarioCnpj) {
        toast.error("Nenhum CNPJ de destinatário encontrado nos XMLs.");
        setEmpresaNaoEncontrada(true);
      }

      setIsProcessing(false);
      event.target.value = "";
    },
    [existingKeys, autoDetectEmpresa]
  );

  const handleConfirmImport = async () => {
    const validFiles = parsedFiles.filter((f) => f.nfe && !f.isDuplicate);
    if (validFiles.length === 0) {
      toast.error("Nenhuma nota fiscal válida para importar.");
      return;
    }

    if (!empresaId) {
      toast.error("Empresa não identificada. Verifique o CNPJ do destinatário.");
      return;
    }

    setIsImporting(true);

    try {
      for (const file of validFiles) {
        const nfe = file.nfe!;

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
          aliquota_ipi: item.aliquotaIPI || 0,
          valor_ipi: item.valorIPI || 0,
          valor_icms_st: item.icmsST || 0,
          mapeado: false,
        }));

        const valorProdutos = nfe.itens.reduce((sum, item) => sum + item.valorTotal, 0);
        
        await criarCompra.mutateAsync({
          empresa_id: empresaId,
          fornecedor_nome: nfe.emitente.razaoSocial,
          fornecedor_cnpj: nfe.emitente.cnpj,
          data_pedido: nfe.dataEmissao,
          data_nf: nfe.dataEmissao,
          numero_nf: nfe.numero,
          chave_acesso: nfe.chaveAcesso,
          valor_total: nfe.valorTotal,
          valor_produtos: valorProdutos,
          valor_frete: nfe.freteTotal || 0,
          valor_desconto: nfe.descontoTotal || 0,
          valor_icms_st: nfe.stTotal || 0,
          outras_despesas: nfe.outrasDepesas || 0,
          uf_emitente: nfe.emitente.uf || null,
          status: 'emitido',
          forma_pagamento: formaPagamento || undefined,
          condicao_pagamento: condicaoPagamento === 'a_prazo' ? 'a_prazo' : 'a_vista',
          prazo_dias: condicaoPagamento === 'a_prazo' ? prazoDias : undefined,
          gerar_conta_pagar: gerarContaPagar,
          numero_parcelas: numeroParcelas,
          parcelas_config: parcelasConfig.length > 0 ? parcelasConfig : undefined,
          itens,
        });
      }

      toast.success(`${validFiles.length} compra(s) importada(s) com sucesso.`);
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
    setNumeroParcelas(1);
    setParcelasConfig([]);
    setEmpresaAutoDetectada(false);
    setEmpresaNaoEncontrada(false);
    onOpenChange(false);
  };

  const handleParcelaValorChange = (index: number, valor: number) => {
    setParcelasConfig(prev => prev.map((p, i) => 
      i === index ? { ...p, valor } : p
    ));
  };

  const handleParcelaDataChange = (index: number, data: string) => {
    setParcelasConfig(prev => prev.map((p, i) => 
      i === index ? { ...p, dataVencimento: data } : p
    ));
  };

  const validFilesCount = parsedFiles.filter((f) => f.nfe && !f.isDuplicate).length;
  const errorFilesCount = parsedFiles.filter((f) => f.error).length;
  const totalItens = parsedFiles
    .filter((f) => f.nfe && !f.isDuplicate)
    .reduce((sum, f) => sum + (f.nfe?.itens.length || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Importar NF-e XML para Compras
          </DialogTitle>
          <DialogDescription>
            Faça upload de arquivos XML de NF-e. A empresa será detectada automaticamente pelo CNPJ do destinatário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {step === "upload" && (
            <div className="space-y-6 py-4">
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center transition-colors border-primary/50 hover:border-primary cursor-pointer"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isProcessing && e.dataTransfer.files) {
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
                  disabled={isProcessing}
                />
                <label htmlFor="xml-upload-compras" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">
                    {isProcessing ? "Processando arquivos..." : "Clique ou arraste arquivos XML aqui"}
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

              {empresaNaoEncontrada && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                  <p className="font-medium">Empresa não encontrada</p>
                  <p className="text-sm">O CNPJ do destinatário não corresponde a nenhuma empresa cadastrada. Cadastre a empresa primeiro.</p>
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
                  <p className="text-sm text-muted-foreground">Revise as compras antes de confirmar.</p>
                  {empresaAutoDetectada && (
                    <Badge variant="outline" className="mt-1 text-success border-success">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Empresa detectada automaticamente
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor total</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(totalValor)}</p>
                </div>
              </div>

              <ScrollArea className="h-[150px] rounded-lg border">
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
                          <TableCell className="font-mono font-medium">{file.nfe!.numero}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{file.nfe!.emitente.razaoSocial}</TableCell>
                          <TableCell>{file.nfe!.dataEmissao}</TableCell>
                          <TableCell className="text-center">{file.nfe!.itens.length}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(file.nfe!.valorTotal)}</TableCell>
                          <TableCell className="text-right text-success">{formatCurrency(file.nfe!.icmsTotal)}</TableCell>
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Forma de Pagamento</Label>
                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
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
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm">Intervalo (dias)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={prazoDias}
                          onChange={(e) => setPrazoDias(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Nº de Parcelas</Label>
                        <Select value={String(numeroParcelas)} onValueChange={(val) => setNumeroParcelas(Number(val))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPCOES_PARCELAS.map((op) => (
                              <SelectItem key={op.value} value={String(op.value)}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* Configuração individual de parcelas */}
                {condicaoPagamento === "a_prazo" && numeroParcelas > 1 && gerarContaPagar && (
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Configuração das Parcelas</Label>
                    </div>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-20">Parcela</TableHead>
                            <TableHead>Valor (R$)</TableHead>
                            <TableHead>Data Vencimento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parcelasConfig.map((parcela, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{parcela.numero}ª</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={parcela.valor}
                                  onChange={(e) => handleParcelaValorChange(index, Number(e.target.value))}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={parcela.dataVencimento}
                                  onChange={(e) => handleParcelaDataChange(index, e.target.value)}
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total das parcelas: {formatCurrency(parcelasConfig.reduce((s, p) => s + p.valor, 0))}
                      {Math.abs(parcelasConfig.reduce((s, p) => s + p.valor, 0) - totalValor) > 0.01 && (
                        <span className="text-orange-500 ml-2">
                          (Diferença de {formatCurrency(Math.abs(parcelasConfig.reduce((s, p) => s + p.valor, 0) - totalValor))})
                        </span>
                      )}
                    </p>
                  </div>
                )}

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
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
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
              disabled={validFilesCount === 0 || isImporting || !empresaId}
            >
              {isImporting ? "Importando..." : (
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
