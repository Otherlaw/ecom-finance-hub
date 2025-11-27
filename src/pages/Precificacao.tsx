import { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  FileText,
  Upload,
  Building2,
  Package,
  Store,
  Truck,
  Receipt,
  PlusCircle,
  Trash2,
  Info,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Percent,
  Target,
  Lightbulb,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  SimulacaoPrecificacao,
  ResultadoPrecificacao,
  GastoExtra,
  TaxaMarketplace,
  DadosCustoNF,
  MARKETPLACE_CONFIG,
  MARKETPLACES_LIST,
  ALIQUOTAS_REGIME,
  GASTOS_EXTRAS_SUGESTOES,
  formatCurrency,
  formatPercent,
  calcularResultadoPrecificacao,
  criarSimulacaoInicial,
  isFreteGratisML,
  MarketplaceId,
  TipoGastoExtra,
  BaseCalculo,
} from '@/lib/precificacao-data';
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG, Empresa } from '@/lib/empresas-data';
import { mockProducts, Product } from '@/lib/products-data';
import { mockPurchases, Purchase, formatDate as formatPurchaseDate } from '@/lib/purchases-data';

export default function Precificacao() {
  const { toast } = useToast();
  
  // Estado da simulação
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Product | null>(null);
  const [marketplaceSelecionado, setMarketplaceSelecionado] = useState<MarketplaceId>('mercadolivre');
  
  // Estado da simulação completa
  const [simulacao, setSimulacao] = useState<SimulacaoPrecificacao | null>(null);
  
  // Modal de seleção de NF
  const [nfModalOpen, setNfModalOpen] = useState(false);
  const [nfSearchTerm, setNfSearchTerm] = useState('');
  const [selectedNFItem, setSelectedNFItem] = useState<{ purchase: Purchase; itemIndex: number } | null>(null);
  
  // Modal de gastos extras
  const [gastoExtraModalOpen, setGastoExtraModalOpen] = useState(false);
  const [novoGastoExtra, setNovoGastoExtra] = useState<Partial<GastoExtra>>({
    descricao: '',
    tipo: 'percentual',
    valor: 0,
    baseCalculo: 'preco_venda',
  });
  
  // Resultado calculado
  const resultado = useMemo<ResultadoPrecificacao | null>(() => {
    if (!simulacao || simulacao.precoVenda <= 0) return null;
    return calcularResultadoPrecificacao(simulacao);
  }, [simulacao]);
  
  // Inicializar simulação quando selecionar empresa e marketplace
  useEffect(() => {
    if (empresaSelecionada) {
      const novaSimulacao = criarSimulacaoInicial(
        empresaSelecionada.id,
        empresaSelecionada.nome,
        empresaSelecionada.regimeTributario,
        marketplaceSelecionado
      );
      
      // Se tinha produto selecionado, manter custo base
      if (produtoSelecionado && simulacao?.custoBase) {
        novaSimulacao.custoBase = simulacao.custoBase;
        novaSimulacao.produtoId = produtoSelecionado.id;
        novaSimulacao.produtoNome = produtoSelecionado.nome;
      }
      
      setSimulacao(novaSimulacao);
    }
  }, [empresaSelecionada, marketplaceSelecionado]);
  
  // Atualizar frete grátis ML automaticamente
  useEffect(() => {
    if (simulacao && simulacao.marketplace === 'mercadolivre') {
      const freteGratis = isFreteGratisML(simulacao.precoVenda);
      if (freteGratis !== simulacao.freteGratisML) {
        setSimulacao(prev => prev ? { ...prev, freteGratisML: freteGratis } : null);
      }
    }
  }, [simulacao?.precoVenda, simulacao?.marketplace]);
  
  // Handlers
  const handleEmpresaChange = (empresaId: string) => {
    const empresa = mockEmpresas.find(e => e.id === empresaId);
    setEmpresaSelecionada(empresa || null);
  };
  
  const handleProdutoChange = (produtoId: string) => {
    if (produtoId === 'none') {
      setProdutoSelecionado(null);
      return;
    }
    const produto = mockProducts.find(p => p.id === produtoId);
    setProdutoSelecionado(produto || null);
    
    // Preencher custo base com custo médio do produto
    if (produto && simulacao) {
      setSimulacao(prev => prev ? {
        ...prev,
        custoBase: produto.custoMedio,
        produtoId: produto.id,
        produtoNome: produto.nome,
      } : null);
    }
  };
  
  const handleMarketplaceChange = (marketplace: MarketplaceId) => {
    setMarketplaceSelecionado(marketplace);
  };
  
  const handleSimulacaoChange = (field: keyof SimulacaoPrecificacao, value: any) => {
    setSimulacao(prev => prev ? { ...prev, [field]: value } : null);
  };
  
  const handleTributacaoChange = (field: string, value: number) => {
    setSimulacao(prev => prev ? {
      ...prev,
      tributacao: { ...prev.tributacao, [field]: value },
    } : null);
  };
  
  const handleTaxaExtraToggle = (taxaId: string) => {
    setSimulacao(prev => {
      if (!prev) return null;
      const taxasAtualizadas = prev.taxasExtras.map(t =>
        t.id === taxaId ? { ...t, ativo: !t.ativo } : t
      );
      return { ...prev, taxasExtras: taxasAtualizadas };
    });
  };
  
  const handleAdicionarGastoExtra = () => {
    if (!novoGastoExtra.descricao || novoGastoExtra.valor === undefined) {
      toast({ title: 'Erro', description: 'Preencha descrição e valor', variant: 'destructive' });
      return;
    }
    
    const gasto: GastoExtra = {
      id: `gasto-${Date.now()}`,
      descricao: novoGastoExtra.descricao!,
      tipo: novoGastoExtra.tipo as TipoGastoExtra,
      valor: novoGastoExtra.valor!,
      baseCalculo: novoGastoExtra.baseCalculo as BaseCalculo,
    };
    
    setSimulacao(prev => prev ? {
      ...prev,
      gastosExtras: [...prev.gastosExtras, gasto],
    } : null);
    
    setNovoGastoExtra({ descricao: '', tipo: 'percentual', valor: 0, baseCalculo: 'preco_venda' });
    setGastoExtraModalOpen(false);
    toast({ title: 'Gasto adicionado', description: gasto.descricao });
  };
  
  const handleRemoverGastoExtra = (gastoId: string) => {
    setSimulacao(prev => prev ? {
      ...prev,
      gastosExtras: prev.gastosExtras.filter(g => g.id !== gastoId),
    } : null);
  };
  
  const handleSelecionarSugestaoGasto = (sugestao: typeof GASTOS_EXTRAS_SUGESTOES[0]) => {
    setNovoGastoExtra({
      descricao: sugestao.descricao,
      tipo: sugestao.tipo,
      valor: sugestao.valor,
      baseCalculo: sugestao.baseCalculo,
    });
  };
  
  // Selecionar NF e item para custo
  const handleSelecionarNFItem = () => {
    if (!selectedNFItem) return;
    
    const { purchase, itemIndex } = selectedNFItem;
    const item = purchase.itens[itemIndex];
    
    // Calcular rateio de frete (simplificado)
    const proporcao = item.valorTotal / purchase.valorTotal;
    
    const dadosCusto: DadosCustoNF = {
      nfNumero: purchase.numeroNF || '',
      nfChave: purchase.chaveAcesso,
      fornecedor: purchase.fornecedor,
      dataEmissao: purchase.dataCompra,
      itemDescricao: item.descricaoNF,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotalItem: item.valorTotal,
      freteRateado: 0, // Simplificado - pode ser expandido
      despesasAcessorias: 0,
      descontos: 0,
      custoEfetivo: item.valorTotal,
      custoEfetivoPorUnidade: item.valorUnitario,
      icmsDestacado: item.valorIcms || 0,
      icmsAliquota: item.aliquotaIcms || 0,
      stDestacado: 0,
      ipiDestacado: 0,
      ipiAliquota: 0,
    };
    
    // Atualizar simulação
    setSimulacao(prev => {
      if (!prev) return null;
      return {
        ...prev,
        custoBase: dadosCusto.custoEfetivoPorUnidade,
        custoNF: dadosCusto,
        tributacao: {
          ...prev.tributacao,
          icmsAliquota: dadosCusto.icmsAliquota || prev.tributacao.icmsAliquota,
          icmsCredito: dadosCusto.icmsDestacado,
        },
      };
    });
    
    setNfModalOpen(false);
    setSelectedNFItem(null);
    toast({ title: 'Custo atualizado', description: `Custo por unidade: ${formatCurrency(dadosCusto.custoEfetivoPorUnidade)}` });
  };
  
  // Filtrar compras para seleção
  const comprasFiltradas = useMemo(() => {
    if (!empresaSelecionada) return [];
    return mockPurchases.filter(p => {
      if (p.empresa !== empresaSelecionada.nome.split(' ')[0].toUpperCase()) return false;
      if (nfSearchTerm) {
        const search = nfSearchTerm.toLowerCase();
        return p.fornecedor.toLowerCase().includes(search) ||
               p.numeroNF?.includes(search) ||
               p.itens.some(i => i.descricaoNF.toLowerCase().includes(search));
      }
      return true;
    });
  }, [empresaSelecionada, nfSearchTerm]);
  
  const marketplaceConfig = MARKETPLACE_CONFIG[marketplaceSelecionado];
  const regimeConfig = empresaSelecionada ? REGIME_TRIBUTARIO_CONFIG[empresaSelecionada.regimeTributario] : null;
  const isML = marketplaceSelecionado === 'mercadolivre';
  const isFreteGratis = simulacao && isML && isFreteGratisML(simulacao.precoVenda);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="h-6 w-6 text-primary" />
                Precificação
              </h1>
              <p className="text-muted-foreground">
                Simulador completo de formação de preço por marketplace
              </p>
            </div>
          </div>

          {/* Bloco 1 - Contexto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Contexto da Simulação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Empresa *</Label>
                  <Select
                    value={empresaSelecionada?.id || ''}
                    onValueChange={handleEmpresaChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockEmpresas.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex items-center gap-2">
                            <span>{emp.nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {REGIME_TRIBUTARIO_CONFIG[emp.regimeTributario].shortLabel}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {regimeConfig && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Regime: {regimeConfig.label}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label>Produto (opcional)</Label>
                  <Select
                    value={produtoSelecionado?.id || 'none'}
                    onValueChange={handleProdutoChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum produto</SelectItem>
                      {mockProducts.map(prod => (
                        <SelectItem key={prod.id} value={prod.id}>
                          {prod.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {produtoSelecionado && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Custo médio: {formatCurrency(produtoSelecionado.custoMedio)}
                    </p>
                  )}
                </div>
                
                <div>
                  <Label>Marketplace *</Label>
                  <Select
                    value={marketplaceSelecionado}
                    onValueChange={(v) => handleMarketplaceChange(v as MarketplaceId)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACES_LIST.map(mp => (
                        <SelectItem key={mp.id} value={mp.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: mp.cor }} />
                            {mp.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comissão padrão: {marketplaceConfig.comissaoPadrao}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!empresaSelecionada ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Selecione uma empresa</AlertTitle>
              <AlertDescription>
                Para iniciar a simulação de precificação, selecione uma empresa acima.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {/* Coluna Esquerda - Entradas */}
              <div className="col-span-2 space-y-4">
                {/* Bloco 2 - Custo Efetivo via NF */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Custo Efetivo do Produto
                    </CardTitle>
                    <CardDescription>
                      Calcule o custo por unidade a partir de uma NF ou informe manualmente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setNfModalOpen(true)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Selecionar NF da Base
                      </Button>
                      <Button variant="outline" disabled>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload XML/PDF
                      </Button>
                    </div>
                    
                    {simulacao?.custoNF && (
                      <Alert className="bg-emerald-50 border-emerald-200">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <AlertTitle className="text-emerald-800">Custo calculado via NF</AlertTitle>
                        <AlertDescription className="text-emerald-700">
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                            <div>NF: {simulacao.custoNF.nfNumero}</div>
                            <div>Fornecedor: {simulacao.custoNF.fornecedor}</div>
                            <div>Item: {simulacao.custoNF.itemDescricao}</div>
                            <div>Quantidade: {simulacao.custoNF.quantidade}</div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Custo Base por Unidade (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={simulacao?.custoBase || ''}
                          onChange={(e) => handleSimulacaoChange('custoBase', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <Label>Preço de Venda (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={simulacao?.precoVenda || ''}
                          onChange={(e) => handleSimulacaoChange('precoVenda', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="text-lg font-semibold"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bloco 3 - Tributação */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Tributação
                      {simulacao?.custoNF && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Dados preenchidos via NF
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Tributos incidentes conforme regime {regimeConfig?.label}. Valores editáveis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {empresaSelecionada?.regimeTributario === 'simples_nacional' ? (
                      <div className="space-y-4">
                        <Alert className="bg-blue-50 border-blue-200">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            Simples Nacional: alíquota única sobre o faturamento
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Alíquota Simples (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={simulacao?.tributacao.simplesAliquota || ''}
                              onChange={(e) => handleTributacaoChange('simplesAliquota', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label>ICMS (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.icmsAliquota || ''}
                            onChange={(e) => handleTributacaoChange('icmsAliquota', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Crédito ICMS (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.icmsCredito || ''}
                            onChange={(e) => handleTributacaoChange('icmsCredito', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>ST (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.stValor || ''}
                            onChange={(e) => handleTributacaoChange('stValor', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>IPI (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.ipiAliquota || ''}
                            onChange={(e) => handleTributacaoChange('ipiAliquota', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>DIFAL (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.difalAliquota || ''}
                            onChange={(e) => handleTributacaoChange('difalAliquota', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Fundo Fiscal DIFAL (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.fundoFiscalDifal || ''}
                            onChange={(e) => handleTributacaoChange('fundoFiscalDifal', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>PIS (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.pisAliquota || ''}
                            onChange={(e) => handleTributacaoChange('pisAliquota', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>COFINS (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={simulacao?.tributacao.cofinsAliquota || ''}
                            onChange={(e) => handleTributacaoChange('cofinsAliquota', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bloco 4 - Taxas do Marketplace */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Taxas do Marketplace
                      <div className="w-3 h-3 rounded-full ml-2" style={{ backgroundColor: marketplaceConfig.cor }} />
                      <span className="text-sm font-normal text-muted-foreground">{marketplaceConfig.nome}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Comissão (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={simulacao?.comissao || ''}
                          onChange={(e) => handleSimulacaoChange('comissao', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Tarifa Fixa (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={simulacao?.tarifaFixa || ''}
                          onChange={(e) => handleSimulacaoChange('tarifaFixa', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    
                    {simulacao && simulacao.taxasExtras.length > 0 && (
                      <div>
                        <Label className="text-sm text-muted-foreground">Taxas Extras (ativar se aplicável)</Label>
                        <div className="space-y-2 mt-2">
                          {simulacao.taxasExtras.map(taxa => (
                            <div key={taxa.id} className="flex items-center justify-between p-2 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={taxa.ativo}
                                  onCheckedChange={() => handleTaxaExtraToggle(taxa.id)}
                                />
                                <span className="text-sm">{taxa.descricao}</span>
                              </div>
                              <Badge variant="outline">
                                {taxa.tipo === 'fixo' ? formatCurrency(taxa.valor) : `${taxa.valor}%`}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bloco 5 - Frete de Venda */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Frete de Venda
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isML && (
                      <Alert className={isFreteGratis ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
                        {isFreteGratis ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <AlertTitle className="text-emerald-800">Frete Grátis para o Comprador</AlertTitle>
                            <AlertDescription className="text-emerald-700">
                              Para anúncios até R$ 79,00, o frete é grátis para o comprador conforme as regras do Mercado Livre.
                            </AlertDescription>
                          </>
                        ) : (
                          <>
                            <Info className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">Preço acima de R$ 79,00</AlertTitle>
                            <AlertDescription className="text-amber-700">
                              Configure o custo de frete esperado para este anúncio.
                            </AlertDescription>
                          </>
                        )}
                      </Alert>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Custo de Frete por Unidade (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={simulacao?.freteVenda || ''}
                          onChange={(e) => handleSimulacaoChange('freteVenda', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          disabled={isML && isFreteGratis}
                        />
                        {isML && isFreteGratis && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Frete não configurável para produtos até R$ 79,00
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bloco 6 - Gastos Extras */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <PlusCircle className="h-5 w-5" />
                          Gastos Extras / Ajustes Variáveis
                        </CardTitle>
                        <CardDescription>
                          Custos adicionais por venda: campanhas, cupons, taxas especiais, etc.
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setGastoExtraModalOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {simulacao && simulacao.gastosExtras.length > 0 ? (
                      <div className="space-y-2">
                        {simulacao.gastosExtras.map(gasto => (
                          <div key={gasto.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <span className="font-medium">{gasto.descricao}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({gasto.tipo === 'fixo' ? 'Valor fixo' : `Sobre ${gasto.baseCalculo.replace('_', ' ')}`})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {gasto.tipo === 'fixo' ? formatCurrency(gasto.valor) : `${gasto.valor}%`}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleRemoverGastoExtra(gasto.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum gasto extra adicionado. Clique em "Adicionar" para incluir custos como cupons, campanhas ou taxas especiais.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Direita - Resultado */}
              <div className="space-y-4">
                <Card className="sticky top-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Resultado da Simulação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Margem Desejada (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={simulacao?.margemDesejada || ''}
                        onChange={(e) => handleSimulacaoChange('margemDesejada', parseFloat(e.target.value) || 0)}
                        className="text-center font-semibold"
                      />
                    </div>
                    
                    <Separator />
                    
                    {resultado ? (
                      <div className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Custo Base:</span>
                            <span>{formatCurrency(resultado.custoBase)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tributos:</span>
                            <span className="text-destructive">-{formatCurrency(resultado.tributosTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Comissão:</span>
                            <span className="text-destructive">-{formatCurrency(resultado.comissaoTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tarifas:</span>
                            <span className="text-destructive">-{formatCurrency(resultado.tarifasTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frete:</span>
                            <span className="text-destructive">-{formatCurrency(resultado.freteTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Gastos Extras:</span>
                            <span className="text-destructive">-{formatCurrency(resultado.gastosExtrasTotal)}</span>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="flex justify-between font-medium">
                          <span>Custo Total Variável:</span>
                          <span>{formatCurrency(resultado.custoTotalVariavel)}</span>
                        </div>
                        
                        <Separator />
                        
                        <div className="p-4 rounded-lg bg-secondary/50 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Preço de Venda:</span>
                            <span className="text-xl font-bold">{formatCurrency(resultado.receitaBruta)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Margem (R$):</span>
                            <span className={`text-lg font-bold ${resultado.margemContribuicao >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatCurrency(resultado.margemContribuicao)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Margem (%):</span>
                            <span className={`text-lg font-bold ${resultado.margemContribuicaoPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {formatPercent(resultado.margemContribuicaoPercent)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Preço Mínimo Recomendado</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            Para atingir margem de {simulacao?.margemDesejada}%:
                          </p>
                          <span className="text-2xl font-bold text-primary">
                            {formatCurrency(resultado.precoMinimoRecomendado)}
                          </span>
                        </div>
                        
                        {resultado.margemContribuicaoPercent < (simulacao?.margemDesejada || 0) && (
                          <Alert className="bg-amber-50 border-amber-200">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-700 text-xs">
                              A margem atual ({formatPercent(resultado.margemContribuicaoPercent)}) está abaixo da desejada ({simulacao?.margemDesejada}%).
                              Considere aumentar o preço para {formatCurrency(resultado.precoMinimoRecomendado)}.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calculator className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Informe o custo base e o preço de venda para ver o resultado.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Seleção de NF */}
      <Dialog open={nfModalOpen} onOpenChange={setNfModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Selecionar NF e Item para Custo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor, número da NF ou item..."
                value={nfSearchTerm}
                onChange={(e) => setNfSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-[400px]">
              {comprasFiltradas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma NF encontrada para a empresa selecionada.
                </p>
              ) : (
                <div className="space-y-4">
                  {comprasFiltradas.map(purchase => (
                    <Card key={purchase.id}>
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm">NF {purchase.numeroNF || 'S/N'}</CardTitle>
                            <CardDescription>{purchase.fornecedor}</CardDescription>
                          </div>
                          <div className="text-right text-sm">
                            <div>{formatPurchaseDate(purchase.dataCompra)}</div>
                            <div className="font-medium">{formatCurrency(purchase.valorTotal)}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-0 pb-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-center">Qtd</TableHead>
                              <TableHead className="text-right">Vl. Unit.</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="w-20"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {purchase.itens.map((item, index) => (
                              <TableRow 
                                key={item.id}
                                className={selectedNFItem?.purchase.id === purchase.id && selectedNFItem.itemIndex === index ? 'bg-primary/10' : ''}
                              >
                                <TableCell className="max-w-48 truncate text-sm">{item.descricaoNF}</TableCell>
                                <TableCell className="text-center">{item.quantidade}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(item.valorTotal)}</TableCell>
                                <TableCell>
                                  <Button
                                    variant={selectedNFItem?.purchase.id === purchase.id && selectedNFItem.itemIndex === index ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedNFItem({ purchase, itemIndex: index })}
                                  >
                                    {selectedNFItem?.purchase.id === purchase.id && selectedNFItem.itemIndex === index ? 'Selecionado' : 'Selecionar'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSelecionarNFItem} disabled={!selectedNFItem}>
              Usar Este Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Gasto Extra */}
      <Dialog open={gastoExtraModalOpen} onOpenChange={setGastoExtraModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Gasto Extra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sugestões</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {GASTOS_EXTRAS_SUGESTOES.map((sugestao, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary"
                    onClick={() => handleSelecionarSugestaoGasto(sugestao)}
                  >
                    {sugestao.descricao}
                  </Badge>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <Label>Descrição</Label>
              <Input
                value={novoGastoExtra.descricao || ''}
                onChange={(e) => setNovoGastoExtra(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Cupom de desconto, Taxa campanha..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={novoGastoExtra.tipo}
                  onValueChange={(v) => setNovoGastoExtra(prev => ({ ...prev, tipo: v as TipoGastoExtra }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novoGastoExtra.valor || ''}
                  onChange={(e) => setNovoGastoExtra(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            {novoGastoExtra.tipo === 'percentual' && (
              <div>
                <Label>Base de Cálculo</Label>
                <Select
                  value={novoGastoExtra.baseCalculo}
                  onValueChange={(v) => setNovoGastoExtra(prev => ({ ...prev, baseCalculo: v as BaseCalculo }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preco_venda">Sobre o Preço de Venda</SelectItem>
                    <SelectItem value="receita_liquida">Sobre a Receita Líquida</SelectItem>
                    <SelectItem value="comissao">Sobre a Comissão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGastoExtraModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdicionarGastoExtra}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
