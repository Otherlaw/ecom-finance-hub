import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, AlertTriangle, Package, Layers, Box } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProdutos } from "@/hooks/useProdutos";
import { criarJobImportacaoProduto, atualizarProgressoJobProduto, finalizarJobProduto } from "@/hooks/useProdutoImportJobs";
import { toast } from "sonner";
import {
  processarArquivoProdutosV2,
  validarImportacaoProdutos,
  gerarPlanilhaModeloV2,
  type ValidacaoImportResult,
  type ProdutoImportRowV2,
} from "@/lib/produtos-import-export-v2";

export function ImportarProdutosV2() {
  const { empresas = [] } = useEmpresas();
  const [empresaId, setEmpresaId] = useState<string>("");
  const { produtos = [], criarProduto, atualizarProduto, refetch } = useProdutos({ empresaId });

  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [validacao, setValidacao] = useState<ValidacaoImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"linhas" | "erros">("linhas");

  const resetForm = useCallback(() => {
    setStep("upload");
    setFileName("");
    setValidacao(null);
    setError(null);
    setIsProcessing(false);
    setPreviewTab("linhas");
  }, []);

  const handleBaixarModelo = (formato: 'csv' | 'xlsx') => {
    const blob = gerarPlanilhaModeloV2(formato);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modelo_produtos_completo.${formato}`;
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
      const { headers, rows } = await processarArquivoProdutosV2(file);
      
      const produtosExistentes = produtos.map(p => ({
        sku: p.sku,
        id: p.id,
        tipo: p.tipo,
      }));

      const result = validarImportacaoProdutos(headers, rows, produtosExistentes);
      setValidacao(result);
      setStep("preview");
      
      if (result.erros.filter(e => e.tipo === 'erro').length > 0) {
        setPreviewTab("erros");
      }
    } catch (err: any) {
      console.error("Erro ao processar arquivo:", err);
      setError(err.message || "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportarBackground = async () => {
    if (!validacao || !empresaId) return;

    const linhasValidas = validacao.linhasValidas;
    if (linhasValidas.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    let jobId: string;
    try {
      jobId = await criarJobImportacaoProduto({
        empresa_id: empresaId,
        arquivo_nome: fileName,
        total_linhas: linhasValidas.length,
      });
    } catch (err) {
      toast.error("Erro ao iniciar importação");
      return;
    }

    toast.success(`Importação de ${linhasValidas.length} produtos iniciada em segundo plano`);
    
    // Processar em background
    processarImportacaoBackground(jobId, linhasValidas, empresaId);
    resetForm();
  };

  const processarImportacaoBackground = async (
    jobId: string, 
    linhas: ProdutoImportRowV2[], 
    empresaIdParam: string
  ) => {
    let criados = 0;
    let atualizados = 0;
    let erros = 0;
    let processados = 0;

    const produtosMap = new Map(produtos.map(p => [p.sku.toUpperCase(), p]));
    const novosSkuIds = new Map<string, string>(); // Para mapear SKU -> ID de produtos criados

    const UPDATE_INTERVAL = 10;
    const BATCH_SIZE = 50;

    // Ordenar: primeiro parents, depois children e kits
    const linhasOrdenadas = [...linhas].sort((a, b) => {
      const ordem = { variation_parent: 0, single: 1, variation_child: 2, kit: 3 };
      return (ordem[a.tipo] || 1) - (ordem[b.tipo] || 1);
    });

    try {
      for (let i = 0; i < linhasOrdenadas.length; i++) {
        const linha = linhasOrdenadas[i];
        
        try {
          const existente = produtosMap.get(linha.sku);

          // Determinar parent_id se for variation_child
          let parentId: string | undefined;
          if (linha.tipo === 'variation_child' && linha.parent_sku) {
            const parentExistente = produtosMap.get(linha.parent_sku);
            if (parentExistente) {
              parentId = parentExistente.id;
            } else {
              parentId = novosSkuIds.get(linha.parent_sku);
            }
          }

          if (existente) {
            await atualizarProduto.mutateAsync({
              id: existente.id,
              nome: linha.nome,
              descricao: linha.descricao,
              categoria: linha.categoria,
              subcategoria: linha.subcategoria,
              tipo: linha.tipo === 'single' ? 'unico' : linha.tipo === 'variation_parent' ? 'variacao' : linha.tipo === 'kit' ? 'kit' : 'unico',
              parent_id: parentId,
              atributos_variacao: linha.atributos_variacao,
              kit_componentes: linha.kit_components,
              custo_medio: linha.custo,
              preco_venda: linha.preco_venda,
              unidade_medida: linha.unidade_medida,
              ncm: linha.ncm,
              peso_kg: linha.peso_kg,
              altura_cm: linha.altura_cm,
              largura_cm: linha.largura_cm,
              profundidade_cm: linha.profundidade_cm,
              fornecedor_nome: linha.fornecedor_nome,
              status: linha.ativo ? 'ativo' : 'inativo',
            });
            atualizados++;
          } else {
            const result = await criarProduto.mutateAsync({
              empresa_id: empresaIdParam,
              sku: linha.sku,
              nome: linha.nome,
              descricao: linha.descricao,
              categoria: linha.categoria,
              subcategoria: linha.subcategoria,
              tipo: linha.tipo === 'single' ? 'unico' : linha.tipo === 'variation_parent' ? 'variacao' : linha.tipo === 'kit' ? 'kit' : 'unico',
              parent_id: parentId,
              atributos_variacao: linha.atributos_variacao,
              kit_componentes: linha.kit_components,
              custo_medio: linha.custo,
              preco_venda: linha.preco_venda,
              unidade_medida: linha.unidade_medida,
              ncm: linha.ncm,
              peso_kg: linha.peso_kg,
              altura_cm: linha.altura_cm,
              largura_cm: linha.largura_cm,
              profundidade_cm: linha.profundidade_cm,
              fornecedor_nome: linha.fornecedor_nome,
              status: linha.ativo ? 'ativo' : 'inativo',
            });
            
            if (result?.id) {
              novosSkuIds.set(linha.sku, result.id);
            }
            criados++;
          }
        } catch (err) {
          console.error("Erro ao importar produto:", linha.sku, err);
          erros++;
        }

        processados++;

        if (processados % UPDATE_INTERVAL === 0 || processados === linhasOrdenadas.length) {
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
      toast.success(`Importação concluída: ${criados} novos, ${atualizados} atualizados, ${erros} erros`);
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

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'single': return <Package className="h-3 w-3" />;
      case 'variation_parent': return <Layers className="h-3 w-3" />;
      case 'variation_child': return <Layers className="h-3 w-3 text-muted-foreground" />;
      case 'kit': return <Box className="h-3 w-3" />;
      default: return <Package className="h-3 w-3" />;
    }
  };

  const getTipoBadgeVariant = (tipo: string) => {
    switch (tipo) {
      case 'single': return 'secondary';
      case 'variation_parent': return 'default';
      case 'variation_child': return 'outline';
      case 'kit': return 'secondary';
      default: return 'secondary';
    }
  };

  const temErrosCriticos = validacao?.erros.filter(e => e.tipo === 'erro').length ?? 0;

  return (
    <div className="space-y-4">
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Suporta todos os tipos de produto: único, variação (pai + filhos) e kit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                Modelo XLSX
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBaixarModelo('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Modelo CSV
              </Button>
            </div>

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <strong>Colunas obrigatórias:</strong> SKU, Nome<br />
                <strong>Tipo:</strong> single | variation_parent | variation_child | kit<br />
                <strong>Variações:</strong> parent_sku (para filhos) + atributos (cor, tamanho)<br />
                <strong>Kits:</strong> kit_components no formato JSON ou SKU1:qtd,SKU2:qtd
              </AlertDescription>
            </Alert>

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
                id="file-upload-v2"
                disabled={!empresaId || isProcessing}
              />
              <label htmlFor="file-upload-v2">
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
          </CardContent>
        </Card>
      )}

      {step === "preview" && validacao && (
        <div className="space-y-4">
          {/* Resumo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Resumo da Validação</CardTitle>
              <CardDescription>Arquivo: {fileName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{validacao.resumo.total}</div>
                  <div className="text-xs text-muted-foreground">Total de Linhas</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{validacao.resumo.novos}</div>
                  <div className="text-xs text-muted-foreground">Novos Produtos</div>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{validacao.resumo.atualizacoes}</div>
                  <div className="text-xs text-muted-foreground">Atualizações</div>
                </div>
                <div className="text-center p-3 bg-destructive/10 rounded-lg">
                  <div className="text-2xl font-bold text-destructive">{validacao.resumo.erros}</div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{validacao.resumo.avisos}</div>
                  <div className="text-xs text-muted-foreground">Avisos</div>
                </div>
              </div>

              {/* Por tipo */}
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {validacao.resumo.singles} únicos
                </Badge>
                <Badge variant="default" className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {validacao.resumo.variationParents} pais
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {validacao.resumo.variationChildren} filhos
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Box className="h-3 w-3" />
                  {validacao.resumo.kits} kits
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes */}
          <Card>
            <CardContent className="pt-6">
              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "linhas" | "erros")}>
                <TabsList>
                  <TabsTrigger value="linhas" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Linhas Válidas ({validacao.linhasValidas.length})
                  </TabsTrigger>
                  <TabsTrigger value="erros" className="flex items-center gap-2">
                    {temErrosCriticos > 0 ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    Erros e Avisos ({validacao.erros.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="linhas" className="mt-4">
                  <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Parent</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Estoque</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validacao.linhasValidas.slice(0, 100).map((linha) => (
                          <TableRow key={linha.linha}>
                            <TableCell className="text-muted-foreground">{linha.linha}</TableCell>
                            <TableCell className="font-mono text-sm">{linha.sku}</TableCell>
                            <TableCell className="max-w-48 truncate">{linha.nome}</TableCell>
                            <TableCell>
                              <Badge variant={getTipoBadgeVariant(linha.tipo) as any} className="flex items-center gap-1 w-fit">
                                {getTipoIcon(linha.tipo)}
                                {linha.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{linha.parent_sku || '-'}</TableCell>
                            <TableCell className="text-right">
                              {linha.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right">
                              {linha.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right">{linha.estoque_inicial ?? '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {validacao.linhasValidas.length > 100 && (
                      <p className="text-center text-sm text-muted-foreground py-2">
                        ... e mais {validacao.linhasValidas.length - 100} linhas
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="erros" className="mt-4">
                  {validacao.erros.length === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertDescription>Nenhum erro ou aviso encontrado!</AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="h-[400px] border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead className="w-16">Tipo</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Campo</TableHead>
                            <TableHead>Mensagem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validacao.erros.map((erro, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-muted-foreground">{erro.linha}</TableCell>
                              <TableCell>
                                {erro.tipo === 'erro' ? (
                                  <Badge variant="destructive">Erro</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-500">Aviso</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{erro.sku || '-'}</TableCell>
                              <TableCell>{erro.campo || '-'}</TableCell>
                              <TableCell>{erro.mensagem}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <div className="flex gap-2">
              {temErrosCriticos > 0 && (
                <Alert variant="destructive" className="py-2 px-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Corrija os {temErrosCriticos} erro(s) antes de importar
                  </AlertDescription>
                </Alert>
              )}
              <Button 
                onClick={handleImportarBackground} 
                disabled={isProcessing || validacao.linhasValidas.length === 0 || temErrosCriticos > 0}
              >
                Iniciar Importação ({validacao.linhasValidas.length} produtos)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
