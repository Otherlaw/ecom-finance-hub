import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { parseOFX, isValidOFX } from "@/lib/ofx-parser";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useBankTransactions, BankTransaction } from "@/hooks/useBankTransactions";
import { formatCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  detectarTipoArquivo,
  parseCSVFile,
  parseXLSXFile,
} from "@/lib/parsers/arquivoFinanceiro";

interface ImportarExtratoBancarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface TransacaoPreview {
  data_transacao: string;
  descricao: string;
  documento: string | null;
  valor: number;
  tipo_lancamento: "debito" | "credito";
  referencia_externa: string;
}

export function ImportarExtratoBancarioModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarExtratoBancarioModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaDetectada, setEmpresaDetectada] = useState<{ id: string; nome: string } | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipoArquivo, setTipoArquivo] = useState<"ofx" | "csv" | "xlsx" | null>(null);
  const [transacoesPreview, setTransacoesPreview] = useState<TransacaoPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [progressoImportacao, setProgressoImportacao] = useState<{ percent: number; mensagem: string } | null>(null);
  const [cnpjNaoEncontrado, setCnpjNaoEncontrado] = useState<string | null>(null);

  const { empresas } = useEmpresas();
  const { importarTransacoes } = useBankTransactions();

  const resetModal = () => {
    setArquivo(null);
    setTipoArquivo(null);
    setTransacoesPreview([]);
    setStep("upload");
    setEmpresaId("");
    setEmpresaDetectada(null);
    setCnpjNaoEncontrado(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Identifica empresa pelo CNPJ extraído do OFX
  const identificarEmpresaPorCnpj = (cnpj: string | null): { id: string; nome: string } | null => {
    if (!cnpj || !empresas) return null;
    
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length < 11) return null;
    
    const empresa = empresas.find(e => {
      const empresaCnpj = e.cnpj?.replace(/\D/g, '') || '';
      return empresaCnpj === cnpjLimpo;
    });
    
    if (empresa) {
      return { 
        id: empresa.id, 
        nome: empresa.nome_fantasia || empresa.razao_social 
      };
    }
    
    return null;
  };

  // Infere tipo de transação para CSV/XLSX considerando coluna de tipo e sinal do valor
  const inferirTipoCSV = (valor: number, tipoRaw: string): 'debito' | 'credito' => {
    // Se valor negativo, é definitivamente débito
    if (valor < 0) return 'debito';
    
    const tipo = (tipoRaw || '').toUpperCase().trim();
    
    // Padrões brasileiros para débito
    const padroesDebito = ['D', 'DEB', 'DEBITO', 'DÉBITO', 'SAIDA', 'SAÍDA', '-', 'PAGAMENTO', 'SAQUE'];
    if (padroesDebito.includes(tipo)) return 'debito';
    
    // Padrões brasileiros para crédito  
    const padroesCredito = ['C', 'CRED', 'CREDITO', 'CRÉDITO', 'ENTRADA', '+', 'DEPOSITO', 'DEPÓSITO', 'RECEBIMENTO'];
    if (padroesCredito.includes(tipo)) return 'credito';
    
    // Fallback pelo sinal do valor
    return valor > 0 ? 'credito' : 'debito';
  };

  // Mapeia linhas do CSV/XLSX para TransacaoPreview[]
  const mapLinhasParaTransacoesPreview = (linhas: any[]): TransacaoPreview[] => {
    const transacoes: TransacaoPreview[] = [];

    for (const linha of linhas) {
      // Tenta detectar colunas comuns: data, descricao, valor, documento
      const data = linha.data || linha.Data || linha.DATA || linha["Data Transação"] || linha.date || "";
      const descricao = linha.descricao || linha.Descricao || linha.DESCRICAO || linha["Descrição"] || linha.description || "";
      const valorStr = String(linha.valor || linha.Valor || linha.VALOR || linha.amount || linha.Amount || "0");
      const documento = linha.documento || linha.Documento || linha.DOCUMENTO || linha.doc || null;
      
      // Detectar coluna de tipo para inferência inteligente
      const tipoRaw = linha.tipo || linha.Tipo || linha.TIPO || 
                      linha.natureza || linha.Natureza || linha.NATUREZA ||
                      linha["Crédito/Débito"] || linha["C/D"] || linha["Tipo Transação"] || "";

      const valor = parseFloat(valorStr.replace(",", ".").replace(/[^\d.-]/g, ""));

      if (!isNaN(valor) && data && descricao) {
        // Normaliza data para YYYY-MM-DD
        let dataFormatada = String(data);
        if (dataFormatada.includes("/")) {
          const parts = dataFormatada.split("/");
          if (parts.length === 3) {
            const ano = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            dataFormatada = `${ano}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }

        const hash = `${dataFormatada}_${valor}_${descricao}_${documento || ""}`;
        
        // Usa inferência inteligente considerando coluna de tipo
        const tipoInferido = inferirTipoCSV(valor, tipoRaw);

        transacoes.push({
          data_transacao: dataFormatada,
          descricao: String(descricao),
          documento: documento ? String(documento) : null,
          valor: Math.abs(valor),
          tipo_lancamento: tipoInferido,
          referencia_externa: hash,
        });
      }
    }

    return transacoes;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tipo = detectarTipoArquivo(file);
      setArquivo(file);
      setTipoArquivo(tipo);

      setIsProcessing(true);
      const contentText = tipo === "csv" || tipo === "ofx" ? await file.text() : null;

      if (tipo === "ofx") {
        if (!isValidOFX(contentText!)) {
          toast.error("Arquivo OFX inválido");
          return;
        }

        const result = parseOFX(contentText!);
        
        // Tentar identificar empresa pelo CNPJ do OFX
        const empresaEncontrada = identificarEmpresaPorCnpj(result.account.holderCpfCnpj);
        if (empresaEncontrada) {
          setEmpresaDetectada(empresaEncontrada);
          setEmpresaId(empresaEncontrada.id);
          setCnpjNaoEncontrado(null);
        } else if (result.account.holderCpfCnpj) {
          // CNPJ presente mas não encontrado no cadastro
          setCnpjNaoEncontrado(result.account.holderCpfCnpj);
          setEmpresaDetectada(null);
        }
        
        const transacoes: TransacaoPreview[] = result.transactions.map((t) => {
          const hash = `${t.date}_${t.amount}_${t.description}_${t.fitid || ""}`;
          return {
            data_transacao: t.date,
            descricao: t.description,
            documento: t.fitid || t.checkNum || null,
            valor: t.amount,
            tipo_lancamento: t.type,
            referencia_externa: hash,
          };
        });

        setTransacoesPreview(transacoes);
        setStep("preview");
      }

      if (tipo === "csv") {
        const linhas = await parseCSVFile(file);
        const transacoes = mapLinhasParaTransacoesPreview(linhas);
        if (!transacoes.length) {
          toast.error("Nenhuma transação encontrada no arquivo CSV");
          return;
        }
        setTransacoesPreview(transacoes);
        setStep("preview");
      }

      if (tipo === "xlsx") {
        const linhas = await parseXLSXFile(file);
        const transacoes = mapLinhasParaTransacoesPreview(linhas);
        if (!transacoes.length) {
          toast.error("Nenhuma transação encontrada no arquivo XLSX");
          return;
        }
        setTransacoesPreview(transacoes);
        setStep("preview");
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportar = async () => {
    if (!empresaId) {
      toast.error("Selecione uma empresa");
      return;
    }

    if (transacoesPreview.length === 0) {
      toast.error("Nenhuma transação para importar");
      return;
    }

    setProgressoImportacao({ percent: 0, mensagem: "Iniciando importação..." });

    const transacoesParaImportar = transacoesPreview.map((t) => ({
      empresa_id: empresaId,
      conta_id: null,
      data_transacao: t.data_transacao,
      data_competencia: null,
      descricao: t.descricao,
      documento: t.documento,
      valor: t.valor,
      tipo_lancamento: t.tipo_lancamento,
      status: "importado" as const,
      categoria_id: null,
      centro_custo_id: null,
      responsavel_id: null,
      origem_extrato: (tipoArquivo === "ofx" ? "arquivo_ofx" : tipoArquivo === "csv" ? "arquivo_csv" : "arquivo_xlsx") as "arquivo_ofx" | "arquivo_csv" | "arquivo_xlsx",
      referencia_externa: t.referencia_externa,
    }));

    importarTransacoes.mutate(
      {
        transacoes: transacoesParaImportar,
        onProgress: (percent, mensagem) => {
          setProgressoImportacao({ percent, mensagem });
        },
      },
      {
        onSuccess: () => {
          setProgressoImportacao(null);
          resetModal();
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error: any) => {
          setProgressoImportacao(null);
          const msg = error?.message || "Erro ao importar transações";
          // Sempre mostrar erro, com duração maior para erros de permissão
          const isPermissionError = msg.includes("permissão") || msg.includes("permission");
          toast.error(msg, { duration: isPermissionError ? 8000 : 5000 });
        },
      }
    );
  };

  const removerTransacao = (index: number) => {
    setTransacoesPreview((atual) => atual.filter((_, i) => i !== index));
  };

  const totalCreditos = transacoesPreview
    .filter((t) => t.tipo_lancamento === "credito")
    .reduce((acc, t) => acc + t.valor, 0);

  const totalDebitos = transacoesPreview
    .filter((t) => t.tipo_lancamento === "debito")
    .reduce((acc, t) => acc + t.valor, 0);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetModal();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
          <DialogDescription>
            {step === "upload" 
              ? "Selecione um arquivo OFX ou CSV com as transações bancárias"
              : `${transacoesPreview.length} transações encontradas para importação`
            }
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Arquivo de Extrato *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.csv,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Clique ou arraste um arquivo OFX, CSV ou XLSX
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A empresa será identificada automaticamente pelo CNPJ do extrato
                  </p>
                </label>
                {arquivo && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{arquivo.name}</span>
                    <Badge variant="outline">{tipoArquivo?.toUpperCase()}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {/* Empresa detectada ou erro */}
            {empresaDetectada && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm">
                  Empresa identificada: <strong>{empresaDetectada.nome}</strong>
                </span>
              </div>
            )}
            
            {cnpjNaoEncontrado && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm">
                    CNPJ {cnpjNaoEncontrado.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')} não encontrado. Selecione a empresa:
                  </span>
                </div>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {!empresaDetectada && !cnpjNaoEncontrado && (
              <div className="space-y-2">
                {tipoArquivo === 'ofx' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm text-amber-700">
                      O arquivo OFX não contém o CNPJ do titular. Selecione a empresa manualmente:
                    </span>
                  </div>
                )}
                <Label>Empresa *</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="text-xs text-muted-foreground">Total Transações</p>
                <p className="text-lg font-bold">{transacoesPreview.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10">
                <p className="text-xs text-muted-foreground">Total Créditos</p>
                <p className="text-lg font-bold text-success">{formatCurrency(totalCreditos)}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Total Débitos</p>
                <p className="text-lg font-bold text-destructive">{formatCurrency(totalDebitos)}</p>
              </div>
            </div>

            <ScrollArea className="h-[300px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoesPreview.map((t, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {new Date(t.data_transacao).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.descricao}</TableCell>
                      <TableCell>{t.documento || "-"}</TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setTransacoesPreview((atual) =>
                              atual.map((item, i) =>
                                i === index
                                  ? { ...item, tipo_lancamento: item.tipo_lancamento === 'credito' ? 'debito' : 'credito' }
                                  : item
                              )
                            );
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                            t.tipo_lancamento === "credito"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {t.tipo_lancamento === "credito" ? "↑ Crédito" : "↓ Débito"}
                        </button>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        t.tipo_lancamento === "credito" ? "text-success" : "text-destructive"
                      }`}>
                        {t.tipo_lancamento === "credito" ? "+" : "-"}{formatCurrency(t.valor)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerTransacao(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Remover transação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Duplicadas serão ignoradas. 💡 <strong>Clique no tipo</strong> para alternar Crédito/Débito, ou <strong>exclua</strong> transações indesejadas (como transferências entre contas).
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="outline" onClick={() => setStep("upload")}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {step === "preview" && progressoImportacao && (
            <div className="flex-1 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1 space-y-1">
                <Progress value={progressoImportacao.percent} className="h-2" />
                <p className="text-xs text-muted-foreground">{progressoImportacao.mensagem}</p>
              </div>
            </div>
          )}
          {step === "preview" && (
            <Button 
              onClick={handleImportar} 
              disabled={importarTransacoes.isPending || !empresaId || !!progressoImportacao}
              className="gap-2"
            >
              {progressoImportacao ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressoImportacao.percent}%
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Importar {transacoesPreview.length} transações
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
