import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  mockFornecedores, 
  mockCategorias,
  validateImportRow,
  ImportResult,
} from '@/lib/contas-pagar-data';
import { mockEmpresas } from '@/lib/empresas-data';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  X,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ImportContasPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: any[]) => void;
}

interface PreviewRow {
  linha: number;
  dados: Record<string, string>;
  valido: boolean;
  erros: string[];
}

export function ImportContasPagarModal({ open, onOpenChange, onImport }: ImportContasPagarModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Simular parsing do arquivo CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          title: 'Arquivo inválido',
          description: 'O arquivo deve conter pelo menos o cabeçalho e uma linha de dados.',
          variant: 'destructive',
        });
        return;
      }

      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      const preview: PreviewRow[] = [];

      for (let i = 1; i < lines.length && i <= 10; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        const dados: Record<string, string> = {};
        headers.forEach((header, index) => {
          dados[header] = values[index] || '';
        });

        const validation = validateImportRow(dados, mockEmpresas, mockFornecedores, mockCategorias);
        
        preview.push({
          linha: i + 1,
          dados,
          valido: validation.valid,
          erros: validation.errors,
        });
      }

      setPreviewData(preview);
      setStep('preview');
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImport = () => {
    const validRows = previewData.filter(r => r.valido);
    const invalidRows = previewData.filter(r => !r.valido);

    // Simular importação
    const result: ImportResult = {
      sucesso: validRows.length,
      erros: invalidRows.map(r => ({
        linha: r.linha,
        motivo: r.erros.join('; '),
      })),
    };

    if (validRows.length > 0) {
      onImport(validRows.map(r => r.dados));
    }

    setImportResult(result);
    setStep('result');
  };

  const handleDownloadTemplate = () => {
    const template = 'empresa;fornecedor;descricao;documento;dataVencimento;valor;categoria;centroCusto;formaPagamento;observacoes\n';
    const example = 'Exchange Comercial;Distribuidora ABC;Compra de mercadorias;NF 12345;15/12/2024;1500,00;Compra de Mercadorias;E-commerce Geral;boleto;Primeira parcela';
    
    const blob = new Blob([template + example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_contas_pagar.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Modelo baixado',
      description: 'Use este modelo para preencher suas contas a pagar.',
    });
  };

  const handleClose = () => {
    setStep('upload');
    setPreviewData([]);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Contas a Pagar
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Selecione um arquivo CSV</h3>
                <p className="text-sm text-muted-foreground">
                  O arquivo deve seguir o modelo padrão com colunas separadas por ponto e vírgula (;)
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Selecionar Arquivo
                    </span>
                  </Button>
                </label>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Modelo
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Colunas esperadas:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">empresa</Badge>
                  <span className="text-muted-foreground">Nome da empresa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">fornecedor</Badge>
                  <span className="text-muted-foreground">Nome do fornecedor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">descricao</Badge>
                  <span className="text-muted-foreground">Descrição da despesa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">documento</Badge>
                  <span className="text-muted-foreground">Nº NF/Boleto</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">dataVencimento</Badge>
                  <span className="text-muted-foreground">DD/MM/AAAA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">valor</Badge>
                  <span className="text-muted-foreground">Valor (ex: 1500,00)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">categoria</Badge>
                  <span className="text-muted-foreground">Categoria financeira</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">formaPagamento</Badge>
                  <span className="text-muted-foreground">pix, boleto, etc.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Prévia da Importação</h3>
                <p className="text-sm text-muted-foreground">
                  {previewData.filter(r => r.valido).length} de {previewData.length} linhas válidas
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {previewData.filter(r => r.valido).length} válidas
                </Badge>
                {previewData.filter(r => !r.valido).length > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    <X className="h-3 w-3 mr-1" />
                    {previewData.filter(r => !r.valido).length} com erro
                  </Badge>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row) => (
                    <TableRow key={row.linha} className={!row.valido ? 'bg-red-50' : ''}>
                      <TableCell>{row.linha}</TableCell>
                      <TableCell>{row.dados.empresa}</TableCell>
                      <TableCell>{row.dados.fornecedor}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.dados.descricao}</TableCell>
                      <TableCell>{row.dados.datavencimento || row.dados.dataVencimento}</TableCell>
                      <TableCell className="text-right">{row.dados.valor}</TableCell>
                      <TableCell>
                        {row.valido ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-red-600" title={row.erros.join(', ')}>
                              Erro
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {previewData.some(r => !r.valido) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Linhas com erro:
                </h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {previewData.filter(r => !r.valido).map(r => (
                    <li key={r.linha}>
                      Linha {r.linha}: {r.erros.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport}
                disabled={previewData.filter(r => r.valido).length === 0}
              >
                Importar {previewData.filter(r => r.valido).length} Contas
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div className="space-y-6">
            <div className={`rounded-lg p-6 text-center ${
              importResult.sucesso > 0 ? 'bg-emerald-50' : 'bg-red-50'
            }`}>
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                importResult.sucesso > 0 ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {importResult.sucesso > 0 ? (
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                ) : (
                  <X className="h-8 w-8 text-red-600" />
                )}
              </div>
              <h3 className="mt-4 font-semibold text-lg">
                {importResult.sucesso > 0 
                  ? `${importResult.sucesso} contas importadas com sucesso!`
                  : 'Nenhuma conta foi importada'
                }
              </h3>
              {importResult.erros.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {importResult.erros.length} linha(s) com erro não foram importadas.
                </p>
              )}
            </div>

            {importResult.erros.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-red-700">Erros encontrados:</h4>
                <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                  {importResult.erros.map((erro, idx) => (
                    <li key={idx}>
                      Linha {erro.linha}: {erro.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleClose}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
