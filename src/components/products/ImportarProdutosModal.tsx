import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { toast } from "sonner";
import {
  processarArquivoProdutos,
  mapearLinhasParaProdutos,
  gerarPlanilhaModelo,
  type ImportPreview,
  type ProdutoImportRow,
} from "@/lib/produtos-import-export";

interface ImportarProdutosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportarProdutosModal({
  open,
  onOpenChange,
  onSuccess,
}: ImportarProdutosModalProps) {
  const { empresas = [] } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const { produtos = [], criarProduto, atualizarProduto } = useProdutos({ empresaId });

  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ criados: number; atualizados: number; erros: number } | null>(null);

  const resetForm = useCallback(() => {
    setStep("upload");
    setFileName("");
    setPreview(null);
    setError(null);
    setResult(null);
    setIsProcessing(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [onOpenChange, resetForm]);

  const handleBaixarModelo = (formato: 'csv' | 'xlsx') => {
    const blob = gerarPlanilhaModelo(formato);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo_produtos.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Planilha modelo ${formato.toUpperCase()} baixada`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!empresaId) {
      setError("Selecione uma empresa primeiro");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const { headers, rows } = await processarArquivoProdutos(file);
      
      // Mapear produtos existentes
      const produtosExistentes = produtos.map(p => ({
        codigo_interno: p.codigo_interno,
        id: p.id,
      }));

      const previewData = mapearLinhasParaProdutos(headers, rows, produtosExistentes);
      
      if (previewData.erros.length > 0 && previewData.linhas.length === 0) {
        setError(previewData.erros[0].motivo);
        setIsProcessing(false);
        return;
      }

      setPreview(previewData);
      setStep("preview");
    } catch (err: any) {
      console.error("Erro ao processar arquivo:", err);
      setError(err.message || "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportar = async () => {
    if (!preview || !empresaId) return;

    setIsProcessing(true);
    let criados = 0;
    let atualizados = 0;
    let erros = 0;

    const produtosMap = new Map(produtos.map(p => [p.codigo_interno.toLowerCase(), p]));

    for (const linha of preview.linhas) {
      try {
        const existente = produtosMap.get(linha.sku_interno.toLowerCase());

        if (existente) {
          // Atualizar
          await atualizarProduto.mutateAsync({
            id: existente.id,
            nome: linha.nome,
            descricao: linha.descricao,
            categoria: linha.categoria,
            custo_medio_atual: linha.preco_custo,
            preco_venda_sugerido: linha.preco_venda,
            unidade_medida: linha.unidade || 'un',
            ncm: linha.ncm,
            status: linha.ativo ? 'ativo' : 'inativo',
          });
          atualizados++;
        } else {
          // Criar
          await criarProduto.mutateAsync({
            empresa_id: empresaId,
            codigo_interno: linha.sku_interno,
            nome: linha.nome,
            descricao: linha.descricao,
            categoria: linha.categoria,
            custo_medio_atual: linha.preco_custo,
            preco_venda_sugerido: linha.preco_venda,
            unidade_medida: linha.unidade || 'un',
            ncm: linha.ncm,
            status: linha.ativo ? 'ativo' : 'inativo',
          });
          criados++;
        }
      } catch (err) {
        console.error("Erro ao importar produto:", linha.sku_interno, err);
        erros++;
      }
    }

    setResult({ criados, atualizados, erros });
    setStep("result");
    setIsProcessing(false);

    if (onSuccess) onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Produtos
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleBaixarModelo('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Modelo CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBaixarModelo('xlsx')}>
                <Download className="h-4 w-4 mr-2" />
                Modelo XLSX
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Arraste um arquivo CSV ou XLSX ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={!empresaId || isProcessing}
              />
              <label htmlFor="file-upload">
                <Button variant="secondary" disabled={!empresaId || isProcessing} asChild>
                  <span>{isProcessing ? "Processando..." : "Selecionar Arquivo"}</span>
                </Button>
              </label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Arquivo: {fileName}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{preview.total} linhas</Badge>
                <Badge variant="default">{preview.novos} novos</Badge>
                <Badge variant="outline">{preview.existentes} atualizações</Badge>
                {preview.invalidos > 0 && (
                  <Badge variant="destructive">{preview.invalidos} inválidos</Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.linhas.slice(0, 50).map((linha, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{linha.sku_interno}</TableCell>
                      <TableCell className="max-w-48 truncate">{linha.nome}</TableCell>
                      <TableCell>{linha.categoria || '-'}</TableCell>
                      <TableCell className="text-right">
                        {linha.preco_custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-right">
                        {linha.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={linha.ativo ? "default" : "secondary"}>
                          {linha.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.linhas.length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... e mais {preview.linhas.length - 50} produtos
                </p>
              )}
            </ScrollArea>

            {preview.erros.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {preview.erros.length} linha(s) com erro. Primeira: Linha {preview.erros[0].linha} - {preview.erros[0].motivo}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-success" />
            <h3 className="text-xl font-semibold">Importação Concluída</h3>
            <div className="flex justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{result.criados}</div>
                <div className="text-sm text-muted-foreground">Criados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{result.atualizados}</div>
                <div className="text-sm text-muted-foreground">Atualizados</div>
              </div>
              {result.erros > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-destructive">{result.erros}</div>
                  <div className="text-sm text-muted-foreground">Erros</div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetForm}>Voltar</Button>
              <Button onClick={handleImportar} disabled={isProcessing || preview?.linhas.length === 0}>
                {isProcessing ? "Importando..." : `Importar ${preview?.linhas.length || 0} produtos`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
