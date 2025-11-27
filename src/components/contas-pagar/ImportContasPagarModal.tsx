import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  ContaPagarFormData,
  ImportRow,
  ImportResult,
  validateImportRow,
  mockEmpresas,
  mockCategorias,
  formatCurrency,
} from "@/lib/contas-pagar-data";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";

interface ImportContasPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (contas: ContaPagarFormData[]) => void;
}

const TEMPLATE_CSV = `empresa,fornecedor,descricao,documento,tipoLancamento,dataEmissao,dataVencimento,valor,categoria,centroCusto,formaPagamento
Exchange Comercial,Fornecedor Exemplo,Compra de Mercadoria XYZ,NF-12345,Compra de Mercadoria,2024-10-01,2024-11-01,5000.00,Compra de Mercadorias,E-commerce,Boleto
Inpari Distribuição,Imobiliária ABC,Aluguel Outubro,ALQ-10,Despesa Operacional,2024-10-01,2024-10-10,3500.00,Aluguel e IPTU,Administrativo,PIX`;

export function ImportContasPagarModal({ open, onOpenChange, onImport }: ImportContasPagarModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo CSV ou XLSX",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo não contém dados para importar",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Skip header
      const dataLines = lines.slice(1);
      const importResults: ImportResult[] = [];

      dataLines.forEach((line, index) => {
        const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
        
        if (columns.length < 9) {
          importResults.push({
            success: false,
            row: index + 2,
            errors: ["Linha com colunas insuficientes"],
          });
          return;
        }

        const [empresa, fornecedor, descricao, documento, tipoLancamento, dataEmissao, dataVencimento, valorStr, categoria, centroCusto, formaPagamento] = columns;

        const importRow: ImportRow = {
          empresa,
          fornecedor,
          descricao,
          documento,
          tipoLancamento,
          dataEmissao,
          dataVencimento,
          valor: parseFloat(valorStr.replace(',', '.')) || 0,
          categoria,
          centroCusto,
          formaPagamento,
        };

        const result = validateImportRow(importRow, index + 2, mockEmpresas);
        importResults.push(result);
      });

      setResults(importResults);
      setStep("preview");
    } catch (error) {
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível ler o arquivo. Verifique o formato.",
        variant: "destructive",
      });
    }
    setImporting(false);
  };

  const handleImport = () => {
    const validResults = results.filter(r => r.success && r.data);
    
    if (validResults.length === 0) {
      toast({
        title: "Nenhum registro válido",
        description: "Corrija os erros e tente novamente",
        variant: "destructive",
      });
      return;
    }

    const contasToImport = validResults.map(r => r.data!);
    onImport(contasToImport);
    setStep("result");

    toast({
      title: "Importação concluída",
      description: `${validResults.length} conta(s) importada(s) com sucesso`,
    });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_contas_pagar.csv';
    link.click();
  };

  const handleClose = () => {
    setFile(null);
    setResults([]);
    setStep("upload");
    onOpenChange(false);
  };

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contas a Pagar
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Selecione um arquivo CSV ou XLSX</h3>
              <p className="text-sm text-muted-foreground mb-4">
                O arquivo deve conter as colunas: empresa, fornecedor, descrição, documento, tipo, dataEmissão, dataVencimento, valor, categoria
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
              {importing && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Processando arquivo...</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Precisa de um modelo?</p>
                <p className="text-sm text-muted-foreground">Baixe o template com o formato correto</p>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Campos disponíveis:</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-muted rounded">empresa*</div>
                <div className="p-2 bg-muted rounded">fornecedor*</div>
                <div className="p-2 bg-muted rounded">descricao*</div>
                <div className="p-2 bg-muted rounded">documento</div>
                <div className="p-2 bg-muted rounded">tipoLancamento</div>
                <div className="p-2 bg-muted rounded">dataEmissao*</div>
                <div className="p-2 bg-muted rounded">dataVencimento*</div>
                <div className="p-2 bg-muted rounded">valor*</div>
                <div className="p-2 bg-muted rounded">categoria*</div>
                <div className="p-2 bg-muted rounded">centroCusto</div>
                <div className="p-2 bg-muted rounded">formaPagamento</div>
              </div>
              <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="font-medium">{successCount} válidos</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium">{errorCount} com erro</span>
              </div>
            </div>

            {/* Results Table */}
            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Linha</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index} className={!result.success ? "bg-destructive/5" : ""}>
                      <TableCell>{result.row}</TableCell>
                      <TableCell>
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        {result.data 
                          ? mockEmpresas.find(e => e.id === result.data?.empresaId)?.nome 
                          : "-"
                        }
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {result.data?.descricao || "-"}
                      </TableCell>
                      <TableCell>{result.data?.dataVencimento || "-"}</TableCell>
                      <TableCell className="text-right">
                        {result.data ? formatCurrency(result.data.valorOriginal) : "-"}
                      </TableCell>
                      <TableCell>
                        {result.errors?.map((err, i) => (
                          <p key={i} className="text-xs text-destructive">{err}</p>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "result" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-success" />
            <h3 className="text-xl font-bold mb-2">Importação Concluída!</h3>
            <p className="text-muted-foreground mb-4">
              {successCount} conta(s) a pagar importada(s) com sucesso
            </p>
            {errorCount > 0 && (
              <p className="text-sm text-amber-600">
                {errorCount} registro(s) não puderam ser importados devido a erros
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={successCount === 0}
                className="bg-success hover:bg-success/90"
              >
                Importar {successCount} Registro(s)
              </Button>
            </>
          )}
          
          {step === "result" && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
