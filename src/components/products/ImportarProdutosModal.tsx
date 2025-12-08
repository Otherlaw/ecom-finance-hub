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
import { Upload, Download, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { 
  criarJobImportacaoProduto, 
  atualizarProgressoJobProduto, 
  finalizarJobProduto 
} from "@/hooks/useProdutoImportJobs";
import { toast } from "sonner";
import {
  processarArquivoProdutos,
  mapearLinhasParaProdutos,
  gerarPlanilhaModelo,
  type ImportPreview,
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
  const { produtos = [], criarProduto, atualizarProduto, refetch } = useProdutos({ empresaId });

  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setStep("upload");
    setFileName("");
    setPreview(null);
    setError(null);
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
    a.download = `modelo_produtos_upseller.${formato}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Planilha modelo ${formato.toUpperCase()} baixada (Formato Upseller)`);
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
      
      // Usar sku em vez de codigo_interno
      const produtosExistentes = produtos.map(p => ({
        codigo_interno: p.sku,
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

  const handleImportarBackground = async () => {
    if (!preview || !empresaId) return;

    const totalLinhas = preview.linhas.length;
    
    let jobId: string;
    try {
      jobId = await criarJobImportacaoProduto({
        empresa_id: empresaId,
        arquivo_nome: fileName,
        total_linhas: totalLinhas,
      });
    } catch (err) {
      toast.error("Erro ao iniciar importação");
      return;
    }

    toast.success(`Importação de ${totalLinhas} produtos iniciada em segundo plano`);
    handleClose();

    processarImportacaoBackground(jobId, preview, empresaId);
  };

  const processarImportacaoBackground = async (
    jobId: string, 
    previewData: ImportPreview, 
    empresaIdParam: string
  ) => {
    let criados = 0;
    let atualizados = 0;
    let erros = 0;
    let processados = 0;

    // Usar sku em vez de codigo_interno
    const produtosMap = new Map(produtos.map(p => [p.sku.toLowerCase(), p]));

    const BATCH_SIZE = 50;
    const UPDATE_INTERVAL = 10;

    try {
      for (let i = 0; i < previewData.linhas.length; i++) {
        const linha = previewData.linhas[i];
        
        try {
          const existente = produtosMap.get(linha.sku_interno.toLowerCase());

          if (existente) {
            // Usar campos corretos do ProdutoUpdate
            await atualizarProduto.mutateAsync({
              id: existente.id,
              nome: linha.nome || linha.sku_interno,
              descricao: linha.descricao,
              categoria: linha.categoria,
              custo_medio: linha.preco_custo || 0,
              preco_venda: linha.preco_venda || 0,
              unidade_medida: linha.unidade || 'un',
              ncm: linha.ncm,
              status: linha.ativo !== false ? 'ativo' : 'inativo',
            });
            atualizados++;
          } else {
            // Usar campos corretos do ProdutoInsert
            await criarProduto.mutateAsync({
              empresa_id: empresaIdParam,
              sku: linha.sku_interno,
              nome: linha.nome || linha.sku_interno,
              descricao: linha.descricao,
              categoria: linha.categoria,
              custo_medio: linha.preco_custo || 0,
              preco_venda: linha.preco_venda || 0,
              unidade_medida: linha.unidade || 'un',
              ncm: linha.ncm,
              status: linha.ativo !== false ? 'ativo' : 'inativo',
            });
            criados++;
          }
        } catch (err) {
          console.error("Erro ao importar produto:", linha.sku_interno, err);
          erros++;
        }

        processados++;

        if (processados % UPDATE_INTERVAL === 0 || processados === previewData.linhas.length) {
          await atualizarProgressoJobProduto(jobId, {
            linhas_processadas: processados,
            linhas_importadas: criados,
            linhas_atualizadas: atualizados,
            linhas_com_erro: erros,
          });
        }

        if (processados % BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      await finalizarJobProduto(jobId, {
        status: 'concluido',
        linhas_importadas: criados,
        linhas_atualizadas: atualizados,
        linhas_com_erro: erros,
        mapeamentos_criados: 0,
      });

      refetch();

      if (onSuccess) onSuccess();

      toast.success(`Importação concluída: ${criados} novos, ${atualizados} atualizados`);
    } catch (err: any) {
      console.error("Erro durante importação:", err);
      
      await finalizarJobProduto(jobId, {
        status: 'erro',
        linhas_importadas: criados,
        linhas_atualizadas: atualizados,
        linhas_com_erro: erros,
        mapeamentos_criados: 0,
        mensagem_erro: err.message || 'Erro desconhecido durante importação',
      });

      toast.error("Erro durante a importação");
    }
  };

  const mapeamentosNoPreview = preview?.linhas.filter(l => l.anuncio_id || l.nome_loja).length || 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Produtos (Formato Upseller)
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
              <Button variant="outline" size="sm" onClick={() => handleBaixarModelo('xlsx')}>
                <Download className="h-4 w-4 mr-2" />
                Modelo XLSX (Upseller)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBaixarModelo('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Modelo CSV
              </Button>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Formato compatível com Upseller:</strong> SKU, Mapeado SKU do Anúncio, Variante, ID do Anúncio, ID da Variante, Nome da Loja, Nome, Categoria, Custo, Preço Venda, Unidade, NCM
              </AlertDescription>
            </Alert>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Arraste um arquivo CSV ou XLSX (formato Upseller) ou clique para selecionar
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
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">{preview.total} linhas</Badge>
                <Badge variant="default">{preview.novos} novos</Badge>
                <Badge variant="outline">{preview.existentes} atualizações</Badge>
                {mapeamentosNoPreview > 0 && (
                  <Badge className="bg-blue-500">{mapeamentosNoPreview} mapeamentos</Badge>
                )}
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
                    <TableHead>ID Anúncio</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.linhas.slice(0, 100).map((linha, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{linha.sku_interno}</TableCell>
                      <TableCell className="max-w-40 truncate">{linha.nome || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {linha.anuncio_id || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {linha.variante && linha.variante !== '-' ? linha.variante : '-'}
                      </TableCell>
                      <TableCell className="text-xs max-w-32 truncate">
                        {linha.nome_loja || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(linha.preco_custo || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-right">
                        {(linha.preco_venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.linhas.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... e mais {preview.linhas.length - 100} produtos
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

            <Alert>
              <AlertDescription>
                A importação será processada em segundo plano. Você pode continuar navegando no sistema.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetForm}>Voltar</Button>
              <Button onClick={handleImportarBackground} disabled={isProcessing || preview?.linhas.length === 0}>
                Iniciar Importação ({preview?.linhas.length || 0} produtos)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
