import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { AskAssistantButton } from '@/components/assistant/AskAssistantButton';
import { useAssistantChatContext } from '@/contexts/AssistantChatContext';
import { Calculator, FileText, Upload, Building2, Package, Store, Truck, Receipt, PlusCircle, Trash2, Info, TrendingUp, AlertTriangle, CheckCircle, DollarSign, Percent, Target, Lightbulb, ChevronRight, Search, ChevronDown, Eye, FileCode, AlertCircle } from 'lucide-react';
import { SimulacaoPrecificacao, ResultadoPrecificacao, GastoExtra, DadosCustoNF, NotaBaixaConfig, NotaBaixaVendaConfig, MARKETPLACE_CONFIG, MARKETPLACES_LIST, GASTOS_EXTRAS_SUGESTOES, NOTA_BAIXA_OPCOES, formatCurrency, formatPercent, calcularResultadoPrecificacao, criarSimulacaoInicial, isFreteGratisML, deveHabilitarFreteML, MarketplaceId, TipoGastoExtra, BaseCalculo, calcularCustoEfetivoNF, NotaBaixaOpcao, getFatorNotaBaixa, FalsoDescontoConfig, calcularTaxaFixaML, getDescricaoTaxaFixaML, FAIXAS_TAXA_FIXA_ML } from '@/lib/precificacao-data';
import { REGIME_TRIBUTARIO_CONFIG } from '@/lib/empresas-data';
import { useEmpresas } from '@/hooks/useEmpresas';
import { useProdutos, Produto } from '@/hooks/useProdutos';
import { useCompras, Compra, CompraItem } from '@/hooks/useCompras';
import { parseNFeXML, NotaFiscalXML, NotaFiscalItem } from '@/lib/icms-data';

// Tipo local para empresa da precificação
interface EmpresaPrecificacao {
  id: string;
  nome: string;
  regimeTributario: 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
}
export default function Precificacao() {
  const {
    toast
  } = useToast();

  // Hooks reais para buscar dados do banco
  const {
    empresas,
    isLoading: loadingEmpresas
  } = useEmpresas();
  const [empresaIdParaProdutos, setEmpresaIdParaProdutos] = useState<string | undefined>();
  const {
    produtos,
    isLoading: loadingProdutos
  } = useProdutos({
    empresaId: empresaIdParaProdutos,
    status: 'ativo'
  });

  // Constantes para localStorage
  const TRIBUTACAO_STORAGE_KEY = 'ecom-finance-tributacao-config';

  // Função para carregar configurações de tributação salvas
  const loadSavedTributacaoConfig = useCallback(() => {
    try {
      const saved = localStorage.getItem(TRIBUTACAO_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Erro ao carregar configurações de tributação:', e);
    }
    return null;
  }, []);

  // Função para salvar configurações de tributação
  const saveTributacaoConfig = useCallback((tributacao: SimulacaoPrecificacao['tributacao']) => {
    try {
      // Salvar apenas campos configuráveis (não valores calculados da NF)
      const configToSave = {
        usarImpostoEstimado: tributacao.usarImpostoEstimado,
        icmsEstimado: tributacao.icmsEstimado,
        pisCofinsEstimado: tributacao.pisCofinsEstimado,
        simularReformaTributaria: tributacao.simularReformaTributaria,
        cbsAliquota: tributacao.cbsAliquota,
        ibsAliquota: tributacao.ibsAliquota,
        difalAtivo: tributacao.difalAtivo,
        difalAliquota: tributacao.difalAliquota
      };
      localStorage.setItem(TRIBUTACAO_STORAGE_KEY, JSON.stringify(configToSave));
    } catch (e) {
      console.error('Erro ao salvar configurações de tributação:', e);
    }
  }, []);

  // Estado da simulação
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaPrecificacao | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [marketplaceSelecionado, setMarketplaceSelecionado] = useState<MarketplaceId>('mercadolivre');

  // Estado da simulação completa
  const [simulacao, setSimulacao] = useState<SimulacaoPrecificacao | null>(null);

  // Modal de seleção de NF da base
  const [nfModalOpen, setNfModalOpen] = useState(false);
  const [nfSearchTerm, setNfSearchTerm] = useState('');
  const [selectedNFItem, setSelectedNFItem] = useState<{
    compra: Compra;
    itemIndex: number;
  } | null>(null);

  // Buscar compras reais da empresa selecionada
  const { compras: comprasReais, isLoading: loadingCompras } = useCompras({
    empresaId: empresaSelecionada?.id,
  });

  // Modal de upload XML
  const [xmlUploadModalOpen, setXmlUploadModalOpen] = useState(false);
  const [xmlParsed, setXmlParsed] = useState<NotaFiscalXML | null>(null);
  const [selectedXmlItemIndex, setSelectedXmlItemIndex] = useState<number | null>(null);

  // Modal de gastos extras
  const [gastoExtraModalOpen, setGastoExtraModalOpen] = useState(false);
  const [novoGastoExtra, setNovoGastoExtra] = useState<Partial<GastoExtra>>({
    descricao: '',
    tipo: 'percentual',
    valor: 0,
    baseCalculo: 'preco_venda'
  });

  // Detalhes do custo expandido
  const [custoDetalhesOpen, setCustoDetalhesOpen] = useState(false);

  // Resultado calculado
  const resultado = useMemo<ResultadoPrecificacao | null>(() => {
    if (!simulacao || simulacao.custoBase <= 0) return null;
    return calcularResultadoPrecificacao(simulacao);
  }, [simulacao]);

  // Verificar se deve habilitar frete ML em tempo real
  const isML = marketplaceSelecionado === 'mercadolivre';
  const habilitarFreteML = useMemo(() => {
    if (!isML || !simulacao) return false;
    // Verificar se preço manual > 79
    if (simulacao.precoVendaManual && simulacao.precoVendaManual > 79) return true;
    // Verificar se preço sugerido > 79
    if (resultado?.precoSugerido && resultado.precoSugerido > 79) return true;
    // Verificar baseado nos dados já preenchidos
    return deveHabilitarFreteML(simulacao);
  }, [isML, simulacao, resultado]);
  const precoParaFrete = resultado?.precoSugerido || simulacao?.precoVendaManual || 0;
  const isFreteGratis = isML && isFreteGratisML(precoParaFrete) && !habilitarFreteML;

  // Inicializar simulação quando selecionar empresa e marketplace
  useEffect(() => {
    if (empresaSelecionada) {
      const novaSimulacao = criarSimulacaoInicial(empresaSelecionada.id, empresaSelecionada.nome, empresaSelecionada.regimeTributario, marketplaceSelecionado);
      if (produtoSelecionado && simulacao?.custoBase) {
        novaSimulacao.custoBase = simulacao.custoBase;
        novaSimulacao.produtoId = produtoSelecionado.id;
        novaSimulacao.produtoNome = produtoSelecionado.nome;
      }

      // Carregar configurações de tributação salvas do localStorage
      const savedTributacao = loadSavedTributacaoConfig();
      if (savedTributacao) {
        novaSimulacao.tributacao = {
          ...novaSimulacao.tributacao,
          usarImpostoEstimado: savedTributacao.usarImpostoEstimado ?? novaSimulacao.tributacao.usarImpostoEstimado,
          icmsEstimado: savedTributacao.icmsEstimado ?? novaSimulacao.tributacao.icmsEstimado,
          pisCofinsEstimado: savedTributacao.pisCofinsEstimado ?? novaSimulacao.tributacao.pisCofinsEstimado,
          simularReformaTributaria: savedTributacao.simularReformaTributaria ?? novaSimulacao.tributacao.simularReformaTributaria,
          cbsAliquota: savedTributacao.cbsAliquota ?? novaSimulacao.tributacao.cbsAliquota,
          ibsAliquota: savedTributacao.ibsAliquota ?? novaSimulacao.tributacao.ibsAliquota,
          difalAtivo: savedTributacao.difalAtivo ?? novaSimulacao.tributacao.difalAtivo,
          difalAliquota: savedTributacao.difalAliquota ?? novaSimulacao.tributacao.difalAliquota
        };
      }
      setSimulacao(novaSimulacao);
    }
  }, [empresaSelecionada, marketplaceSelecionado, loadSavedTributacaoConfig]);

  // Salvar configurações de tributação quando mudarem
  useEffect(() => {
    if (simulacao?.tributacao) {
      saveTributacaoConfig(simulacao.tributacao);
    }
  }, [simulacao?.tributacao, saveTributacaoConfig]);

  // Handlers
  const handleEmpresaChange = (empresaId: string) => {
    const empresa = empresas?.find(e => e.id === empresaId);
    if (empresa) {
      setEmpresaSelecionada({
        id: empresa.id,
        nome: empresa.nome_fantasia || empresa.razao_social,
        regimeTributario: empresa.regime_tributario as 'simples_nacional' | 'lucro_presumido' | 'lucro_real'
      });
      setEmpresaIdParaProdutos(empresa.id);
    } else {
      setEmpresaSelecionada(null);
      setEmpresaIdParaProdutos(undefined);
    }
  };
  const handleProdutoChange = (produtoId: string) => {
    if (produtoId === 'none') {
      setProdutoSelecionado(null);
      return;
    }
    const produto = produtos?.find(p => p.id === produtoId);
    setProdutoSelecionado(produto || null);
    if (produto && simulacao) {
      setSimulacao(prev => prev ? {
        ...prev,
        custoBase: produto.custo_medio,
        produtoId: produto.id,
        produtoNome: produto.nome
      } : null);
    }
  };
  const handleMarketplaceChange = (marketplace: MarketplaceId) => {
    setMarketplaceSelecionado(marketplace);
  };
  const handleSimulacaoChange = (field: keyof SimulacaoPrecificacao, value: any) => {
    setSimulacao(prev => prev ? {
      ...prev,
      [field]: value
    } : null);
  };
  const handleTributacaoChange = (field: string, value: number | boolean) => {
    setSimulacao(prev => prev ? {
      ...prev,
      tributacao: {
        ...prev.tributacao,
        [field]: value
      }
    } : null);
  };
  const handleNotaBaixaChange = (field: keyof NotaBaixaConfig, value: any) => {
    setSimulacao(prev => {
      if (!prev) return null;
      const novaNotaBaixa = {
        ...prev.notaBaixa,
        [field]: value
      };

      // Recalcular custo se houver NF
      if (prev.custoNF) {
        const fator = getFatorNotaBaixa(novaNotaBaixa);
        const custoBaseReal = prev.custoNF.custoEfetivoPorUnidade * fator;
        const stReal = (prev.custoNF.stRateado || 0) * fator;
        const ipiReal = (prev.custoNF.ipiRateado || 0) * fator;
        return {
          ...prev,
          notaBaixa: novaNotaBaixa,
          custoBase: custoBaseReal,
          custoNF: {
            ...prev.custoNF,
            notaBaixa: novaNotaBaixa,
            fatorMultiplicador: fator,
            custoEfetivoReal: prev.custoNF.custoEfetivo * fator,
            custoEfetivoPorUnidadeReal: custoBaseReal,
            stReal,
            ipiReal
          },
          tributacao: {
            ...prev.tributacao,
            stValor: stReal,
            ipiValor: ipiReal
          }
        };
      }
      return {
        ...prev,
        notaBaixa: novaNotaBaixa
      };
    });
  };
  const handleFalsoDescontoChange = (field: keyof FalsoDescontoConfig, value: any) => {
    setSimulacao(prev => prev ? {
      ...prev,
      falsoDesconto: {
        ...prev.falsoDesconto,
        [field]: value
      }
    } : null);
  };
  const handleNotaBaixaVendaChange = (field: keyof NotaBaixaVendaConfig, value: any) => {
    setSimulacao(prev => prev ? {
      ...prev,
      notaBaixaVenda: {
        ...prev.notaBaixaVenda,
        [field]: value
      }
    } : null);
  };
  const handleTaxaExtraToggle = (taxaId: string) => {
    setSimulacao(prev => {
      if (!prev) return null;
      const taxasAtualizadas = prev.taxasExtras.map(t => t.id === taxaId ? {
        ...t,
        ativo: !t.ativo
      } : t);
      return {
        ...prev,
        taxasExtras: taxasAtualizadas
      };
    });
  };
  const handleAdicionarGastoExtra = () => {
    if (!novoGastoExtra.descricao || novoGastoExtra.valor === undefined) {
      toast({
        title: 'Erro',
        description: 'Preencha descrição e valor',
        variant: 'destructive'
      });
      return;
    }
    const gasto: GastoExtra = {
      id: `gasto-${Date.now()}`,
      descricao: novoGastoExtra.descricao!,
      tipo: novoGastoExtra.tipo as TipoGastoExtra,
      valor: novoGastoExtra.valor!,
      baseCalculo: novoGastoExtra.baseCalculo as BaseCalculo
    };
    setSimulacao(prev => prev ? {
      ...prev,
      gastosExtras: [...prev.gastosExtras, gasto]
    } : null);
    setNovoGastoExtra({
      descricao: '',
      tipo: 'percentual',
      valor: 0,
      baseCalculo: 'preco_venda'
    });
    setGastoExtraModalOpen(false);
    toast({
      title: 'Gasto adicionado',
      description: gasto.descricao
    });
  };
  const handleRemoverGastoExtra = (gastoId: string) => {
    setSimulacao(prev => prev ? {
      ...prev,
      gastosExtras: prev.gastosExtras.filter(g => g.id !== gastoId)
    } : null);
  };
  const handleSelecionarSugestaoGasto = (sugestao: typeof GASTOS_EXTRAS_SUGESTOES[0]) => {
    setNovoGastoExtra({
      descricao: sugestao.descricao,
      tipo: sugestao.tipo,
      valor: sugestao.valor,
      baseCalculo: sugestao.baseCalculo
    });
  };

  // Selecionar NF da base
  const handleSelecionarNFItem = () => {
    if (!selectedNFItem) return;
    const { compra, itemIndex } = selectedNFItem;
    const item = compra.itens![itemIndex];
    const custoCalculado = calcularCustoEfetivoNF({
      valorTotalItem: item.valor_total,
      quantidade: item.quantidade,
      freteNF: compra.valor_frete || 0,
      despesasAcessorias: 0,
      descontos: compra.valor_desconto || 0,
      valorTotalNF: compra.valor_total,
      stItem: item.valor_icms || 0,
      ipiItem: item.valor_ipi || 0
    }, simulacao?.notaBaixa);
    const dadosCusto: DadosCustoNF = {
      ...custoCalculado,
      nfNumero: compra.numero_nf || '',
      nfChave: compra.chave_acesso || undefined,
      fornecedor: compra.fornecedor_nome,
      dataEmissao: compra.data_nf || compra.data_pedido,
      itemDescricao: item.descricao_nf,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      valorTotalItem: item.valor_total,
      valorTotalNF: compra.valor_total,
      icmsDestacado: item.valor_icms || 0,
      icmsAliquota: item.aliquota_icms || 0
    };
    const fator = simulacao?.notaBaixa ? getFatorNotaBaixa(simulacao.notaBaixa) : 1;
    const custoBaseReal = dadosCusto.custoEfetivoPorUnidade * fator;
    setSimulacao(prev => {
      if (!prev) return null;
      return {
        ...prev,
        custoBase: custoBaseReal,
        custoNF: {
          ...dadosCusto,
          custoEfetivoPorUnidadeReal: custoBaseReal,
          custoEfetivoReal: dadosCusto.custoEfetivo * fator,
          fatorMultiplicador: fator
        },
        tributacao: {
          ...prev.tributacao,
          icmsAliquota: dadosCusto.icmsAliquota || prev.tributacao.icmsAliquota,
          icmsCredito: dadosCusto.icmsDestacado * fator
        }
      };
    });
    setNfModalOpen(false);
    setSelectedNFItem(null);
    setCustoDetalhesOpen(true);
    toast({
      title: 'Custo calculado via NF',
      description: `Custo efetivo: ${formatCurrency(custoBaseReal)}/un`
    });
  };

  // Upload de XML
  const handleXmlUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast({
        title: 'Erro',
        description: 'Envie apenas arquivos XML de NF-e',
        variant: 'destructive'
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      const nfe = parseNFeXML(content);
      if (!nfe) {
        toast({
          title: 'Erro',
          description: 'Não foi possível ler o XML. Verifique se é uma NF-e válida.',
          variant: 'destructive'
        });
        return;
      }
      setXmlParsed(nfe);
      setSelectedXmlItemIndex(null);
      toast({
        title: 'XML carregado',
        description: `NF ${nfe.numero} - ${nfe.itens.length} itens encontrados`
      });
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [toast]);
  const handleConfirmarItemXml = () => {
    if (!xmlParsed || selectedXmlItemIndex === null) return;
    const item = xmlParsed.itens[selectedXmlItemIndex];

    // IPI do item extraído do XML
    const ipiDoItem = item.valorIPI || 0;
    const ipiAliquotaItem = item.aliquotaIPI || 0;
    const custoCalculado = calcularCustoEfetivoNF({
      valorTotalItem: item.valorTotal,
      quantidade: item.quantidade,
      freteNF: xmlParsed.freteTotal || 0,
      despesasAcessorias: xmlParsed.outrasDepesas || 0,
      descontos: xmlParsed.descontoTotal || 0,
      valorTotalNF: xmlParsed.valorTotal,
      stItem: item.icmsST || 0,
      ipiItem: ipiDoItem
    }, simulacao?.notaBaixa);
    const dadosCusto: DadosCustoNF = {
      ...custoCalculado,
      nfNumero: xmlParsed.numero,
      nfChave: xmlParsed.chaveAcesso,
      fornecedor: xmlParsed.emitente.razaoSocial,
      dataEmissao: xmlParsed.dataEmissao,
      itemDescricao: item.descricao,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotalItem: item.valorTotal,
      valorTotalNF: xmlParsed.valorTotal,
      freteNF: xmlParsed.freteTotal || 0,
      despesasAcessorias: xmlParsed.outrasDepesas || 0,
      descontosNF: xmlParsed.descontoTotal || 0,
      icmsDestacado: item.valorIcms,
      icmsAliquota: item.aliquotaIcms,
      stDestacado: item.icmsST || 0,
      stRateado: item.icmsST || 0,
      ipiDestacado: ipiDoItem,
      ipiRateado: ipiDoItem,
      ipiAliquota: ipiAliquotaItem
    };
    const fator = simulacao?.notaBaixa ? getFatorNotaBaixa(simulacao.notaBaixa) : 1;
    const custoBaseReal = dadosCusto.custoEfetivoPorUnidade * fator;
    const stReal = (dadosCusto.stRateado || 0) * fator;
    const ipiReal = (dadosCusto.ipiRateado || 0) * fator;
    setSimulacao(prev => {
      if (!prev) return null;
      return {
        ...prev,
        custoBase: custoBaseReal,
        custoNF: {
          ...dadosCusto,
          custoEfetivoPorUnidadeReal: custoBaseReal,
          custoEfetivoReal: dadosCusto.custoEfetivo * fator,
          fatorMultiplicador: fator,
          stReal,
          ipiReal
        },
        tributacao: {
          ...prev.tributacao,
          icmsAliquota: dadosCusto.icmsAliquota || prev.tributacao.icmsAliquota,
          icmsCredito: dadosCusto.icmsDestacado * fator,
          stValor: stReal,
          ipiValor: ipiReal,
          ipiAliquota: ipiAliquotaItem || prev.tributacao.ipiAliquota
        }
      };
    });
    setXmlUploadModalOpen(false);
    setXmlParsed(null);
    setSelectedXmlItemIndex(null);
    setCustoDetalhesOpen(true);
    toast({
      title: 'Custo calculado via XML',
      description: `Custo efetivo: ${formatCurrency(custoBaseReal)}/un`
    });
  };

  // Filtrar compras reais - apenas NFs com dados fiscais
  const comprasFiltradas = useMemo(() => {
    if (!empresaSelecionada || !comprasReais) return [];
    return comprasReais.filter(c => {
      // Filtrar apenas compras com NF emitida (que têm dados fiscais) e itens
      if (!c.numero_nf && !c.chave_acesso) return false;
      if (!c.itens || c.itens.length === 0) return false;
      if (nfSearchTerm) {
        const search = nfSearchTerm.toLowerCase();
        return (
          c.fornecedor_nome.toLowerCase().includes(search) ||
          c.numero_nf?.toLowerCase().includes(search) ||
          c.itens.some(i => i.descricao_nf.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [empresaSelecionada, comprasReais, nfSearchTerm]);
  const marketplaceConfig = MARKETPLACE_CONFIG[marketplaceSelecionado];
  const regimeConfig = empresaSelecionada ? REGIME_TRIBUTARIO_CONFIG[empresaSelecionada.regimeTributario] : null;
  const {
    openChat
  } = useAssistantChatContext();
  const handleAskAssistant = () => {
    openChat('Explique como esta precificação foi calculada', {
      telaAtual: 'Precificação',
      empresa: empresaSelecionada ? {
        nome: empresaSelecionada.nome,
        regime: empresaSelecionada.regimeTributario
      } : undefined,
      dadosAdicionais: {
        produto: produtoSelecionado?.nome || 'Não selecionado',
        marketplace: marketplaceConfig.nome,
        custoBase: simulacao?.custoBase ? formatCurrency(simulacao.custoBase) : 'Não calculado',
        margemDesejada: simulacao?.margemDesejada ? formatPercent(simulacao.margemDesejada) : 'Não definida',
        precoSugerido: resultado?.precoSugerido ? formatCurrency(resultado.precoSugerido) : 'Não calculado'
      }
    });
  };
  return <div className="flex min-h-screen w-full bg-background">
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
                Calcule o preço de venda ideal com base no custo efetivo e margem desejada
              </p>
            </div>
            <AskAssistantButton onClick={handleAskAssistant} label="Perguntar ao Assis.Fin" />
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
                  <Select value={empresaSelecionada?.id || ''} onValueChange={handleEmpresaChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingEmpresas ? "Carregando..." : "Selecione a empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(empresas || []).map(emp => <SelectItem key={emp.id} value={emp.id}>
                          <div className="flex items-center gap-2">
                            <span>{emp.nome_fantasia || emp.razao_social}</span>
                            <Badge variant="outline" className="text-xs">
                              {REGIME_TRIBUTARIO_CONFIG[emp.regime_tributario as keyof typeof REGIME_TRIBUTARIO_CONFIG]?.shortLabel || emp.regime_tributario}
                            </Badge>
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {regimeConfig && <p className="text-xs text-muted-foreground mt-1">Regime: {regimeConfig.label}</p>}
                </div>
                
                <div>
                  <Label>Produto (opcional)</Label>
                  <Select value={produtoSelecionado?.id || 'none'} onValueChange={handleProdutoChange} disabled={!empresaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingProdutos ? "Carregando..." : empresaSelecionada ? "Selecione o produto" : "Selecione empresa primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum produto</SelectItem>
                      {(produtos || []).map(prod => <SelectItem key={prod.id} value={prod.id}>
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[180px]" title={prod.nome}>{prod.nome}</span>
                            {prod.custo_medio > 0 && <Badge variant="secondary" className="text-xs shrink-0">
                                {formatCurrency(prod.custo_medio)}
                              </Badge>}
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {produtoSelecionado && produtoSelecionado.custo_medio > 0 && <p className="text-xs text-emerald-600 mt-1">
                      Custo médio: {formatCurrency(produtoSelecionado.custo_medio)}
                    </p>}
                </div>
                
                <div>
                  <Label>Marketplace *</Label>
                  <Select value={marketplaceSelecionado} onValueChange={v => handleMarketplaceChange(v as MarketplaceId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACES_LIST.map(mp => <SelectItem key={mp.id} value={mp.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{
                          backgroundColor: mp.cor
                        }} />
                            {mp.nome}
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Comissão: {marketplaceConfig.comissaoPadrao}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {!empresaSelecionada ? <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Selecione uma empresa</AlertTitle>
              <AlertDescription>Para iniciar a simulação, selecione uma empresa acima.</AlertDescription>
            </Alert> : <div className="grid grid-cols-3 gap-6">
              {/* Coluna Esquerda - Entradas */}
              <div className="col-span-2 space-y-4">
                {/* Bloco 2 - Custo Efetivo via NF */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Custo Efetivo via NF (XML)
                    </CardTitle>
                    <CardDescription>
                      Calcule o custo por unidade a partir de uma Nota Fiscal XML
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setNfModalOpen(true)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Selecionar NF da Base
                      </Button>
                      <Button variant="outline" onClick={() => setXmlUploadModalOpen(true)}>
                        <FileCode className="h-4 w-4 mr-2" />
                        Upload XML de NF-e
                      </Button>
                    </div>
                    
                    {/* Nota Baixa */}
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <Label className="font-semibold text-amber-800">Nota Baixa / Valor Parcial</Label>
                        </div>
                        <Switch checked={simulacao?.notaBaixa.ativa || false} onCheckedChange={checked => handleNotaBaixaChange('ativa', checked)} />
                      </div>
                      
                      {simulacao?.notaBaixa.ativa && <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm">A NF representa:</Label>
                            <Select value={simulacao.notaBaixa.opcao} onValueChange={v => handleNotaBaixaChange('opcao', v as NotaBaixaOpcao)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {NOTA_BAIXA_OPCOES.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {simulacao.notaBaixa.opcao === 'personalizado' && <div>
                              <Label className="text-sm">% do valor real:</Label>
                              <Input type="number" step="1" min="1" max="100" value={simulacao.notaBaixa.percentualPersonalizado} onChange={e => handleNotaBaixaChange('percentualPersonalizado', parseFloat(e.target.value) || 50)} placeholder="50" />
                            </div>}
                        </div>}
                      
                      {simulacao?.notaBaixa.ativa && <p className="text-xs text-amber-700">
                          O sistema ajustará o custo efetivo, ST, IPI e DIFAL proporcionalmente ao valor real da operação.
                        </p>}
                    </div>
                    
                    {simulacao?.custoNF && <div className="space-y-2">
                        <Alert className="bg-emerald-50 border-emerald-200">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <AlertTitle className="text-emerald-800">Custo Efetivo Calculado</AlertTitle>
                          <AlertDescription className="text-emerald-700">
                            <div className="flex items-center justify-between mt-2">
                              <div>
                                <span className="text-lg font-bold">
                                  {formatCurrency(simulacao.notaBaixa.ativa && simulacao.custoNF.custoEfetivoPorUnidadeReal ? simulacao.custoNF.custoEfetivoPorUnidadeReal : simulacao.custoNF.custoEfetivoPorUnidade)} / unidade
                                </span>
                                {simulacao.notaBaixa.ativa && <span className="text-xs ml-2 text-amber-600">
                                    (ajustado p/ valor real)
                                  </span>}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => setCustoDetalhesOpen(!custoDetalhesOpen)}>
                                <Eye className="h-4 w-4 mr-1" />
                                {custoDetalhesOpen ? 'Ocultar' : 'Ver'} Detalhes
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                        
                        <Collapsible open={custoDetalhesOpen} onOpenChange={setCustoDetalhesOpen}>
                          <CollapsibleContent>
                            <div className="p-4 rounded-lg bg-secondary/30 border space-y-3 text-sm">
                              <h4 className="font-semibold flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                Memória de Cálculo do Custo Efetivo
                              </h4>
                              <Separator />
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-muted-foreground">NF:</div>
                                <div className="font-medium">{simulacao.custoNF.nfNumero}</div>
                                <div className="text-muted-foreground">Fornecedor:</div>
                                <div className="font-medium">{simulacao.custoNF.fornecedor}</div>
                                <div className="text-muted-foreground">Item:</div>
                                <div className="font-medium">{simulacao.custoNF.itemDescricao}</div>
                                <div className="text-muted-foreground">Quantidade:</div>
                                <div className="font-medium">{simulacao.custoNF.quantidade} un</div>
                              </div>
                              <Separator />
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span>Valor do item na NF:</span>
                                  <span className="font-medium">{formatCurrency(simulacao.custoNF.valorTotalItem)}</span>
                                </div>
                                {simulacao.custoNF.freteRateado > 0 && <div className="flex justify-between">
                                    <span>+ Frete rateado ({simulacao.custoNF.proporcaoItem}%):</span>
                                    <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.freteRateado)}</span>
                                  </div>}
                                {simulacao.custoNF.despesasRateadas > 0 && <div className="flex justify-between">
                                    <span>+ Despesas acessórias rateadas:</span>
                                    <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.despesasRateadas)}</span>
                                  </div>}
                                {(simulacao.custoNF.stRateado || 0) > 0 && <div className="flex justify-between">
                                    <span>+ ICMS ST (compõe custo):</span>
                                    <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.stRateado || 0)}</span>
                                  </div>}
                                {(simulacao.custoNF.ipiRateado || 0) > 0 && <div className="flex justify-between">
                                    <span>+ IPI (compõe custo):</span>
                                    <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.ipiRateado || 0)}</span>
                                  </div>}
                                {simulacao.custoNF.descontosRateados > 0 && <div className="flex justify-between">
                                    <span>- Descontos rateados:</span>
                                    <span className="font-medium text-emerald-600">-{formatCurrency(simulacao.custoNF.descontosRateados)}</span>
                                  </div>}
                              </div>
                              <Separator />
                              <div className="flex justify-between text-base font-semibold">
                                <span>Custo Total Atribuído (NF):</span>
                                <span>{formatCurrency(simulacao.custoNF.custoEfetivo)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Custo por Unidade (NF):</span>
                                <span>{formatCurrency(simulacao.custoNF.custoEfetivoPorUnidade)}</span>
                              </div>
                              
                              {simulacao.notaBaixa.ativa && simulacao.custoNF.fatorMultiplicador && simulacao.custoNF.fatorMultiplicador > 1 && <>
                                  <Separator />
                                  <div className="p-2 rounded bg-amber-100 border border-amber-200">
                                    <p className="text-amber-800 font-semibold mb-2">
                                      Ajuste para Valor Real (×{simulacao.custoNF.fatorMultiplicador.toFixed(2)})
                                    </p>
                                    <div className="flex justify-between">
                                      <span>Custo Efetivo Real por Unidade:</span>
                                      <span className="font-bold text-amber-900">
                                        {formatCurrency(simulacao.custoNF.custoEfetivoPorUnidadeReal || 0)}
                                      </span>
                                    </div>
                                    {(simulacao.custoNF.stReal || 0) > 0 && <div className="flex justify-between text-sm">
                                        <span>ST ajustado:</span>
                                        <span>{formatCurrency(simulacao.custoNF.stReal || 0)}</span>
                                      </div>}
                                    {(simulacao.custoNF.ipiReal || 0) > 0 && <div className="flex justify-between text-sm">
                                        <span>IPI ajustado:</span>
                                        <span>{formatCurrency(simulacao.custoNF.ipiReal || 0)}</span>
                                      </div>}
                                  </div>
                                </>}
                              
                              {simulacao.custoNF.icmsDestacado > 0 && <>
                                  <Separator />
                                  <div className="text-muted-foreground">
                                    <div className="flex justify-between">
                                      <span>ICMS destacado na NF:</span>
                                      <span>{formatCurrency(simulacao.custoNF.icmsDestacado)} ({simulacao.custoNF.icmsAliquota}%)</span>
                                    </div>
                                    {simulacao.custoNF.stDestacado > 0 && <div className="flex justify-between">
                                        <span>ICMS ST destacado:</span>
                                        <span>{formatCurrency(simulacao.custoNF.stDestacado)}</span>
                                      </div>}
                                  </div>
                                </>}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Custo Base por Unidade (R$)</Label>
                        <Input type="number" step="0.01" value={simulacao?.custoBase || ''} onChange={e => handleSimulacaoChange('custoBase', parseFloat(e.target.value) || 0)} placeholder="0,00" />
                        {simulacao?.custoBase > 0 && <p className="text-sm font-semibold text-emerald-600 mt-1">
                            = {formatCurrency(simulacao.custoBase)}
                          </p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {simulacao?.custoNF ? 'Preenchido via NF - editável' : produtoSelecionado?.custo_medio ? 'Custo médio do produto' : 'Preencha via NF ou manualmente'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card Proeminente - Custo Efetivo Calculado */}
                {simulacao?.custoNF && <Card className="border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-emerald-800">
                        <DollarSign className="h-5 w-5" />
                        Custo Efetivo Unitário
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-3xl font-bold text-emerald-700">
                            {formatCurrency(simulacao.notaBaixa.ativa && simulacao.custoNF.custoEfetivoPorUnidadeReal ? simulacao.custoNF.custoEfetivoPorUnidadeReal : simulacao.custoNF.custoEfetivoPorUnidade)}
                            <span className="text-lg font-normal text-emerald-600 ml-1">/ unidade</span>
                          </p>
                          {simulacao.notaBaixa.ativa && <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-amber-700">
                              Ajustado para valor real (×{simulacao.custoNF.fatorMultiplicador?.toFixed(2)})
                            </Badge>}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setCustoDetalhesOpen(!custoDetalhesOpen)}>
                          <Eye className="h-4 w-4 mr-1" />
                          {custoDetalhesOpen ? 'Ocultar' : 'Ver'} Detalhes
                        </Button>
                      </div>
                      
                      <Collapsible open={custoDetalhesOpen} onOpenChange={setCustoDetalhesOpen}>
                        <CollapsibleContent>
                          <div className="mt-4 p-4 rounded-lg bg-white border space-y-3 text-sm">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Memória de Cálculo do Custo Efetivo
                            </h4>
                            <Separator />
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-muted-foreground">NF:</div>
                              <div className="font-medium">{simulacao.custoNF.nfNumero}</div>
                              <div className="text-muted-foreground">Fornecedor:</div>
                              <div className="font-medium">{simulacao.custoNF.fornecedor}</div>
                              <div className="text-muted-foreground">Item:</div>
                              <div className="font-medium">{simulacao.custoNF.itemDescricao}</div>
                              <div className="text-muted-foreground">Quantidade:</div>
                              <div className="font-medium">{simulacao.custoNF.quantidade} un</div>
                            </div>
                            <Separator />
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span>Valor do item na NF:</span>
                                <span className="font-medium">{formatCurrency(simulacao.custoNF.valorTotalItem)}</span>
                              </div>
                              {simulacao.custoNF.freteRateado > 0 && <div className="flex justify-between">
                                  <span>+ Frete rateado ({simulacao.custoNF.proporcaoItem}%):</span>
                                  <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.freteRateado)}</span>
                                </div>}
                              {simulacao.custoNF.despesasRateadas > 0 && <div className="flex justify-between">
                                  <span>+ Despesas acessórias rateadas:</span>
                                  <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.despesasRateadas)}</span>
                                </div>}
                              {(simulacao.custoNF.stRateado || 0) > 0 && <div className="flex justify-between">
                                  <span>+ ICMS ST (compõe custo):</span>
                                  <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.stRateado || 0)}</span>
                                </div>}
                              {(simulacao.custoNF.ipiRateado || 0) > 0 && <div className="flex justify-between">
                                  <span>+ IPI (compõe custo):</span>
                                  <span className="font-medium text-orange-600">+{formatCurrency(simulacao.custoNF.ipiRateado || 0)}</span>
                                </div>}
                              {simulacao.custoNF.descontosRateados > 0 && <div className="flex justify-between">
                                  <span>- Descontos rateados:</span>
                                  <span className="font-medium text-emerald-600">-{formatCurrency(simulacao.custoNF.descontosRateados)}</span>
                                </div>}
                            </div>
                            <Separator />
                            <div className="flex justify-between text-base font-semibold">
                              <span>Custo Total Atribuído (NF):</span>
                              <span>{formatCurrency(simulacao.custoNF.custoEfetivo)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>÷ Quantidade ({simulacao.custoNF.quantidade} un):</span>
                              <span className="font-medium">{formatCurrency(simulacao.custoNF.custoEfetivoPorUnidade)}/un</span>
                            </div>
                            
                            {simulacao.notaBaixa.ativa && simulacao.custoNF.fatorMultiplicador && simulacao.custoNF.fatorMultiplicador > 1 && <>
                                <Separator />
                                <div className="p-2 rounded bg-amber-100 border border-amber-200">
                                  <p className="text-amber-800 font-semibold mb-2">
                                    Ajuste para Valor Real (×{simulacao.custoNF.fatorMultiplicador.toFixed(2)})
                                  </p>
                                  <div className="flex justify-between">
                                    <span>Custo Efetivo Real por Unidade:</span>
                                    <span className="font-bold text-amber-900">
                                      {formatCurrency(simulacao.custoNF.custoEfetivoPorUnidadeReal || 0)}
                                    </span>
                                  </div>
                                  {(simulacao.custoNF.stReal || 0) > 0 && <div className="flex justify-between text-sm">
                                      <span>ST ajustado:</span>
                                      <span>{formatCurrency(simulacao.custoNF.stReal || 0)}</span>
                                    </div>}
                                  {(simulacao.custoNF.ipiReal || 0) > 0 && <div className="flex justify-between text-sm">
                                      <span>IPI ajustado:</span>
                                      <span>{formatCurrency(simulacao.custoNF.ipiReal || 0)}</span>
                                    </div>}
                                </div>
                              </>}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>}

                {/* Bloco 3 - Tributação */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Tributação
                      {simulacao?.custoNF && <Badge variant="outline" className="ml-2 text-xs">Dados preenchidos via NF</Badge>}
                      <Badge variant="secondary" className="ml-auto text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Configurações salvas
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Tributos conforme regime {regimeConfig?.label}. Configurações de alíquotas estimadas e Reforma Tributária são salvas automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* BLOCO CBS/IBS - SEMPRE VISÍVEL */}
                    

                    {/* Opção de usar alíquota média estipulada */}
                    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-3 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-primary" />
                          <Label className="font-semibold">Usar imposto estimado (alíquota média)</Label>
                        </div>
                        <Switch checked={simulacao?.tributacao.usarImpostoEstimado || false} onCheckedChange={checked => handleTributacaoChange('usarImpostoEstimado', checked)} />
                      </div>
                      
                      {simulacao?.tributacao.usarImpostoEstimado && <div className="space-y-4">
                          <p className="text-xs text-muted-foreground">
                            Defina alíquotas médias estimadas quando não tiver dados detalhados de cada imposto.
                          </p>
                          
                          {/* Alíquotas do regime atual */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">ICMS Médio (%)</Label>
                              <Input type="number" step="0.1" placeholder="Ex: 18" value={simulacao?.tributacao.icmsEstimado || ''} onChange={e => handleTributacaoChange('icmsEstimado', parseFloat(e.target.value) || 0)} className="bg-background" />
                            </div>
                            <div>
                              <Label className="text-sm">PIS/COFINS Médio (%)</Label>
                              <Input type="number" step="0.1" placeholder="Ex: 9.25" value={simulacao?.tributacao.pisCofinsEstimado || ''} onChange={e => handleTributacaoChange('pisCofinsEstimado', parseFloat(e.target.value) || 0)} className="bg-background" />
                            </div>
                          </div>
                          
                          {/* Simulação Reforma Tributária 2026+ - CBS e IBS */}
                          <Separator />
                          
                          
                          
                        </div>}
                    </div>
                    
                    {empresaSelecionada?.regimeTributario === 'simples_nacional' ? <div className="space-y-4">
                        <Alert className="bg-blue-50 border-blue-200">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            Simples Nacional: alíquota única sobre o faturamento
                          </AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Alíquota Simples (%)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.simplesAliquota || ''} onChange={e => handleTributacaoChange('simplesAliquota', parseFloat(e.target.value) || 0)} disabled={simulacao?.tributacao.usarImpostoEstimado} />
                          </div>
                        </div>
                      </div> : <div className="space-y-4">
                        <div className={`grid grid-cols-4 gap-4 ${simulacao?.tributacao.usarImpostoEstimado ? 'opacity-50' : ''}`}>
                          <div>
                            <Label>ICMS (%)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.icmsAliquota || ''} onChange={e => handleTributacaoChange('icmsAliquota', parseFloat(e.target.value) || 0)} disabled={simulacao?.tributacao.usarImpostoEstimado} />
                          </div>
                          <div>
                            <Label>Crédito ICMS (R$)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.icmsCredito || ''} onChange={e => handleTributacaoChange('icmsCredito', parseFloat(e.target.value) || 0)} disabled={simulacao?.tributacao.usarImpostoEstimado} />
                          </div>
                          <div>
                            <Label>ST (R$)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.stValor || ''} onChange={e => handleTributacaoChange('stValor', parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label>IPI (R$)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.ipiValor || ''} onChange={e => handleTributacaoChange('ipiValor', parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                        
                        {/* DIFAL */}
                        <div className="p-3 rounded-lg border bg-secondary/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="font-semibold">DIFAL (Diferencial de Alíquota)</Label>
                            </div>
                            <Switch checked={simulacao?.tributacao.difalAtivo || false} onCheckedChange={checked => handleTributacaoChange('difalAtivo', checked)} />
                          </div>
                          
                          {simulacao?.tributacao.difalAtivo && <div className="grid grid-cols-3 gap-4">
                              <div>
                                <Label>DIFAL (%)</Label>
                                <Input type="number" step="0.01" value={simulacao?.tributacao.difalAliquota || ''} onChange={e => handleTributacaoChange('difalAliquota', parseFloat(e.target.value) || 0)} />
                              </div>
                              <div>
                                <Label>DIFAL Valor (R$)</Label>
                                <Input type="number" step="0.01" value={simulacao?.tributacao.difalValor || ''} onChange={e => handleTributacaoChange('difalValor', parseFloat(e.target.value) || 0)} />
                              </div>
                              <div>
                                <Label>Fundo Fiscal DIFAL (R$)</Label>
                                <Input type="number" step="0.01" value={simulacao?.tributacao.fundoFiscalDifal || ''} onChange={e => handleTributacaoChange('fundoFiscalDifal', parseFloat(e.target.value) || 0)} />
                              </div>
                            </div>}
                        </div>
                        
                        <div className={`grid grid-cols-2 gap-4 ${simulacao?.tributacao.usarImpostoEstimado ? 'opacity-50' : ''}`}>
                          <div>
                            <Label>PIS (%)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.pisAliquota || ''} onChange={e => handleTributacaoChange('pisAliquota', parseFloat(e.target.value) || 0)} disabled={simulacao?.tributacao.usarImpostoEstimado} />
                          </div>
                          <div>
                            <Label>COFINS (%)</Label>
                            <Input type="number" step="0.01" value={simulacao?.tributacao.cofinsAliquota || ''} onChange={e => handleTributacaoChange('cofinsAliquota', parseFloat(e.target.value) || 0)} disabled={simulacao?.tributacao.usarImpostoEstimado} />
                          </div>
                        </div>
                      </div>}
                    
                    {/* Bloco CBS/IBS - Vigente desde 2025 (fase de transição) */}
                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <Label className="font-semibold text-blue-800">
                            CBS + IBS (Reforma Tributária - Fase Transição 2025)
                          </Label>
                        </div>
                        <Switch checked={simulacao?.tributacao.simularReformaTributaria || false} onCheckedChange={checked => handleTributacaoChange('simularReformaTributaria', checked)} />
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {simulacao?.tributacao.simularReformaTributaria ? 'CBS + IBS será usado no cálculo do preço sugerido' : 'Ative para usar CBS + IBS no cálculo (fase de transição)'}
                      </p>
                      
                      <div className={`grid grid-cols-2 gap-4 ${!simulacao?.tributacao.simularReformaTributaria ? 'opacity-50' : ''}`}>
                        <div>
                          <Label className="text-sm">CBS - IVA Federal (%)</Label>
                          <Input type="number" step="0.1" placeholder="0.9" value={simulacao?.tributacao.cbsAliquota || ''} onChange={e => handleTributacaoChange('cbsAliquota', parseFloat(e.target.value) || 0)} className="bg-background" disabled={!simulacao?.tributacao.simularReformaTributaria} />
                          <p className="text-xs text-muted-foreground mt-1">Transição 2025: 0,9%</p>
                        </div>
                        <div>
                          <Label className="text-sm">IBS - IVA Estadual/Municipal (%)</Label>
                          <Input type="number" step="0.1" placeholder="0.1" value={simulacao?.tributacao.ibsAliquota || ''} onChange={e => handleTributacaoChange('ibsAliquota', parseFloat(e.target.value) || 0)} className="bg-background" disabled={!simulacao?.tributacao.simularReformaTributaria} />
                          <p className="text-xs text-muted-foreground mt-1">Transição 2025: 0,1%</p>
                        </div>
                      </div>
                      
                      {simulacao?.tributacao.simularReformaTributaria && <Alert className="bg-blue-100 border-blue-300">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700 text-sm">
                            Total CBS + IBS: <strong>{formatPercent((simulacao?.tributacao.cbsAliquota || 0) + (simulacao?.tributacao.ibsAliquota || 0))}</strong>
                            {' '}— Este valor será usado no cálculo do preço sugerido
                          </AlertDescription>
                        </Alert>}
                    </div>
                  </CardContent>
                </Card>

                {/* Bloco 3.5 - Nota Baixa na Venda */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      Nota Baixa na Venda
                    </CardTitle>
                    <CardDescription>
                      Simule cenário onde a NF de venda é emitida com valor reduzido
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-amber-600" />
                          <Label className="font-semibold text-amber-800">Emitir NF com valor reduzido</Label>
                        </div>
                        <Switch checked={simulacao?.notaBaixaVenda?.ativa || false} onCheckedChange={checked => handleNotaBaixaVendaChange('ativa', checked)} />
                      </div>
                      
                      {simulacao?.notaBaixaVenda?.ativa && <div className="space-y-3">
                          <p className="text-xs text-amber-700">
                            Informe o % do valor real que será faturado na nota de venda. 
                            <strong> Os impostos incidirão apenas sobre este percentual.</strong>
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">% do valor que será faturado:</Label>
                              <Input type="number" step="1" min="1" max="100" value={simulacao.notaBaixaVenda.percentualNota || ''} onChange={e => handleNotaBaixaVendaChange('percentualNota', parseFloat(e.target.value) || 100)} placeholder="Ex: 10" className="bg-background" />
                              <p className="text-xs text-muted-foreground mt-1">
                                {simulacao.notaBaixaVenda.percentualNota < 100 
                                  ? `Impostos reduzidos em ${(100 - simulacao.notaBaixaVenda.percentualNota).toFixed(0)}%`
                                  : 'Nota integral - sem redução'}
                              </p>
                            </div>
                          </div>
                          <Alert className="bg-amber-100 border-amber-300">
                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                            <AlertDescription className="text-amber-800 text-xs">
                              <strong>Atenção:</strong> Esta funcionalidade é apenas para simulação de cenários. 
                              A emissão de notas com valor inferior ao real pode configurar sonegação fiscal.
                            </AlertDescription>
                          </Alert>
                        </div>}
                    </div>
                  </CardContent>
                </Card>

                {/* Bloco 4 - Taxas do Marketplace */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Taxas do Marketplace
                      <div className="w-3 h-3 rounded-full ml-2" style={{
                    backgroundColor: marketplaceConfig.cor
                  }} />
                      <span className="text-sm font-normal text-muted-foreground">{marketplaceConfig.nome}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Comissão (%)</Label>
                        <Input type="number" step="0.1" value={simulacao?.comissao || ''} onChange={e => handleSimulacaoChange('comissao', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label>Tarifa Fixa (R$)</Label>
                        {isML ? <div className="space-y-1">
                            <Input type="number" step="0.01" value={resultado?.precoSugerido ? calcularTaxaFixaML(resultado.precoSugerido) : simulacao?.tarifaFixa || ''} onChange={e => handleSimulacaoChange('tarifaFixa', parseFloat(e.target.value) || 0)} disabled={!!resultado?.precoSugerido} className={resultado?.precoSugerido ? 'bg-muted' : ''} />
                            <p className="text-xs text-muted-foreground">
                              {resultado?.precoSugerido ? getDescricaoTaxaFixaML(resultado.precoSugerido) : 'Será calculada pelo preço'}
                            </p>
                          </div> : <Input type="number" step="0.01" value={simulacao?.tarifaFixa || ''} onChange={e => handleSimulacaoChange('tarifaFixa', parseFloat(e.target.value) || 0)} />}
                      </div>
                    </div>
                    
                    {/* Alerta Taxa Fixa ML */}
                    {isML && <Alert className="bg-amber-50 border-amber-200">
                        <Info className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800 text-sm">Taxa Fixa Dinâmica do Mercado Livre</AlertTitle>
                        <AlertDescription className="text-amber-700 text-xs">
                          <div className="grid grid-cols-5 gap-2 mt-2">
                            {FAIXAS_TAXA_FIXA_ML.map((faixa, idx) => <div key={idx} className={`p-1.5 rounded text-center ${resultado?.precoSugerido && resultado.precoSugerido >= faixa.faixaInicio && resultado.precoSugerido < faixa.faixaFim ? 'bg-amber-200 font-semibold' : 'bg-amber-100/50'}`}>
                                <p className="text-[10px]">{faixa.label}</p>
                                <p className="font-medium">{faixa.taxa === 0 ? 'R$ 0' : formatCurrency(faixa.taxa)}</p>
                              </div>)}
                          </div>
                        </AlertDescription>
                      </Alert>}
                    
                    {/* Taxas Extras - Toggle para ativar */}
                    {simulacao && simulacao.taxasExtras.length > 0 && <div className="p-3 rounded-lg border bg-secondary/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Taxas Adicionais</Label>
                          <Switch checked={simulacao.taxasExtrasAtivas} onCheckedChange={checked => handleSimulacaoChange('taxasExtrasAtivas', checked)} />
                        </div>
                        
                        {simulacao.taxasExtrasAtivas && <div className="space-y-2">
                            {simulacao.taxasExtras.map(taxa => <div key={taxa.id} className="flex items-center justify-between p-2 border rounded-lg bg-background">
                                <div className="flex items-center gap-3">
                                  <Switch checked={taxa.ativo} onCheckedChange={() => handleTaxaExtraToggle(taxa.id)} />
                                  <span className="text-sm">{taxa.descricao}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input type="number" step="0.1" value={taxa.valor} onChange={e => {
                          const novoValor = parseFloat(e.target.value) || 0;
                          setSimulacao(prev => {
                            if (!prev) return null;
                            const taxasAtualizadas = prev.taxasExtras.map(t => t.id === taxa.id ? {
                              ...t,
                              valor: novoValor
                            } : t);
                            return {
                              ...prev,
                              taxasExtras: taxasAtualizadas
                            };
                          });
                        }} className="w-20 h-8 text-right" disabled={!taxa.ativo} />
                                  <span className="text-xs text-muted-foreground w-6">
                                    {taxa.tipo === 'fixo' ? 'R$' : '%'}
                                  </span>
                                </div>
                              </div>)}
                          </div>}
                      </div>}
                    
                    {/* Falso Desconto - Apenas Shopee */}
                    {marketplaceSelecionado === 'shopee' && <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4 text-orange-600" />
                            <Label className="font-semibold text-orange-800">Falso Desconto (Shopee)</Label>
                          </div>
                          <Switch checked={simulacao?.falsoDesconto?.ativo || false} onCheckedChange={checked => handleFalsoDescontoChange('ativo', checked)} />
                        </div>
                        
                        {simulacao?.falsoDesconto?.ativo && <div className="space-y-3">
                            <p className="text-xs text-orange-700">
                              Estratégia visual: aumenta o preço e aplica desconto para manter a margem real.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm">Acréscimo sobre preço (%)</Label>
                                <Input type="number" step="1" value={simulacao.falsoDesconto.acrescimoPercent} onChange={e => handleFalsoDescontoChange('acrescimoPercent', parseFloat(e.target.value) || 30)} className="bg-white" />
                                <p className="text-xs text-muted-foreground mt-1">Padrão: 30%</p>
                              </div>
                              <div>
                                <Label className="text-sm">Desconto exibido (%)</Label>
                                <Input type="number" step="1" value={simulacao.falsoDesconto.descontoPercent} onChange={e => handleFalsoDescontoChange('descontoPercent', parseFloat(e.target.value) || 30)} className="bg-white" />
                                <p className="text-xs text-muted-foreground mt-1">Padrão: 30%</p>
                              </div>
                            </div>
                          </div>}
                      </div>}
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
                    {isML && <Alert className={isFreteGratis && !habilitarFreteML ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
                        {isFreteGratis && !habilitarFreteML ? <>
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <AlertTitle className="text-emerald-800">Frete Grátis para o Comprador</AlertTitle>
                            <AlertDescription className="text-emerald-700">
                              Para anúncios até R$ 79,00, o frete é grátis conforme regras do Mercado Livre.
                            </AlertDescription>
                          </> : <>
                            <Info className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">Preço estimado acima de R$ 79,00</AlertTitle>
                            <AlertDescription className="text-amber-700">
                              Configure o custo de frete previsto para este anúncio.
                            </AlertDescription>
                          </>}
                      </Alert>}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Custo de Frete por Unidade (R$)</Label>
                        <Input type="number" step="0.01" value={simulacao?.freteVenda || ''} onChange={e => handleSimulacaoChange('freteVenda', parseFloat(e.target.value) || 0)} placeholder="0,00" disabled={isML && isFreteGratis && !habilitarFreteML} />
                        {isML && isFreteGratis && !habilitarFreteML && <p className="text-xs text-muted-foreground mt-1">Frete não configurável para produtos até R$ 79,00</p>}
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
                          Campanhas, cupons, taxas especiais, custo de notas compradas (se aplicável)
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setGastoExtraModalOpen(true)}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Adicionar
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {simulacao && simulacao.gastosExtras.length > 0 ? <div className="space-y-2">
                        {simulacao.gastosExtras.map(gasto => <div key={gasto.id} className="flex items-center justify-between p-3 border rounded-lg">
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoverGastoExtra(gasto.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>)}
                      </div> : <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum gasto extra. Clique em "Adicionar" para incluir custos como cupons ou taxas de campanha.
                      </p>}
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Direita - Resultado */}
              <div className="space-y-4">
                <Card className="sticky top-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Resultado da Precificação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Margem Desejada - Campo Principal */}
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <Label className="text-primary font-semibold">Margem Desejada (%)</Label>
                      <Input type="number" step="1" value={simulacao?.margemDesejada || ''} onChange={e => handleSimulacaoChange('margemDesejada', parseFloat(e.target.value) || 0)} className="text-center text-xl font-bold mt-2" placeholder="20" />
                    </div>
                    
                    <Separator />
                    
                    {resultado && resultado.precoSugerido > 0 ? <div className="space-y-4">
                        {/* Preço Sugerido - Destaque */}
                        <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="h-5 w-5 text-emerald-600" />
                            <span className="font-semibold text-emerald-800">
                              {resultado.falsoDesconto ? 'Preço Final ao Cliente' : 'Preço de Venda Sugerido'}
                            </span>
                          </div>
                          <p className="text-3xl font-bold text-emerald-700">
                            {formatCurrency(resultado.precoSugerido)}
                          </p>
                          <p className="text-sm text-emerald-600 mt-1">
                            Para atingir margem de {simulacao?.margemDesejada}%
                          </p>
                        </div>
                        
                        {/* Falso Desconto - Shopee */}
                        {resultado.falsoDesconto && <div className="p-4 rounded-xl bg-orange-50 border-2 border-orange-200 space-y-3">
                            <div className="flex items-center gap-2">
                              <Percent className="h-5 w-5 text-orange-600" />
                              <span className="font-semibold text-orange-800">Falso Desconto (Shopee)</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="p-2 rounded bg-white border">
                                <p className="text-muted-foreground text-xs">Preço Base (técnico)</p>
                                <p className="font-semibold">{formatCurrency(resultado.falsoDesconto.precoBase)}</p>
                              </div>
                              <div className="p-2 rounded bg-white border">
                                <p className="text-muted-foreground text-xs">Preço Listado (antes desconto)</p>
                                <p className="font-semibold text-orange-700">{formatCurrency(resultado.falsoDesconto.precoListado)}</p>
                              </div>
                              <div className="p-2 rounded bg-white border">
                                <p className="text-muted-foreground text-xs">Desconto Exibido</p>
                                <p className="font-semibold text-red-600">-{resultado.falsoDesconto.descontoPercent}% ({formatCurrency(resultado.falsoDesconto.descontoValor)})</p>
                              </div>
                              <div className="p-2 rounded bg-emerald-100 border border-emerald-300">
                                <p className="text-emerald-700 text-xs font-medium">Preço Final ao Cliente</p>
                                <p className="font-bold text-emerald-700">{formatCurrency(resultado.falsoDesconto.precoFinalCliente)}</p>
                              </div>
                            </div>
                            
                            <p className="text-xs text-orange-700">
                              A margem é calculada sobre o preço final ({formatCurrency(resultado.precoSugerido)}), não sobre o preço listado.
                            </p>
                          </div>}
                        
                        {/* Margens com e sem DIFAL */}
                        {simulacao?.tributacao.difalAtivo && <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
                            <p className="text-sm font-semibold text-blue-800">Margens de Contribuição:</p>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-700">Com DIFAL:</span>
                              <span className={resultado.margemComDifalPercent >= 0 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                                {formatCurrency(resultado.margemComDifal)} ({resultado.margemComDifalPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-blue-700">Sem DIFAL:</span>
                              <span className={resultado.margemSemDifalPercent >= 0 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                                {formatCurrency(resultado.margemSemDifal)} ({resultado.margemSemDifalPercent.toFixed(1)}%)
                              </span>
                            </div>
                          </div>}
                        
                        {/* Comparação removida - CBS/IBS é obrigatório desde 2025 */}
                        
                        {/* Detalhamento de custos */}
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
                          {simulacao?.tributacao.difalAtivo && resultado.difalTotal > 0 && <div className="flex justify-between">
                              <span className="text-muted-foreground">DIFAL:</span>
                              <span className="text-destructive">-{formatCurrency(resultado.difalTotal)}</span>
                            </div>}
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Custo Total Variável:</span>
                            <span>{formatCurrency(resultado.custoTotalVariavel)}</span>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        {/* Simulação Manual (Opcional) */}
                        <div className="p-3 rounded-lg bg-secondary/30 space-y-3">
                          <Label className="text-sm text-muted-foreground">
                            Simular outro preço (opcional)
                          </Label>
                          <Input type="number" step="0.01" value={simulacao?.precoVendaManual || ''} onChange={e => handleSimulacaoChange('precoVendaManual', parseFloat(e.target.value) || undefined)} placeholder="Digite um preço para ver a margem" className="text-center" />
                          {resultado.margemManualComDifal !== undefined && <div className="p-2 rounded bg-background border space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{simulacao?.tributacao.difalAtivo ? 'Margem com DIFAL:' : 'Margem Líquida:'}</span>
                                <span className={(resultado.margemManualComDifalPercent || 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                                  {formatCurrency(resultado.margemManualComDifal)} ({(resultado.margemManualComDifalPercent || 0).toFixed(1)}%)
                                </span>
                              </div>
                              {simulacao?.tributacao.difalAtivo && <div className="flex justify-between text-sm">
                                  <span>Margem sem DIFAL:</span>
                                  <span className={(resultado.margemManualSemDifalPercent || 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-destructive font-semibold'}>
                                    {formatCurrency(resultado.margemManualSemDifal || 0)} ({(resultado.margemManualSemDifalPercent || 0).toFixed(1)}%)
                                  </span>
                                </div>}
                            </div>}
                        </div>
                      </div> : <div className="text-center py-8">
                        <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Preencha o <strong>custo base</strong> e a <strong>margem desejada</strong> para calcular o preço sugerido.
                        </p>
                      </div>}
                  </CardContent>
                </Card>
              </div>
            </div>}
        </div>
      </main>

      {/* Modal Seleção NF da Base */}
      <Dialog open={nfModalOpen} onOpenChange={setNfModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Selecionar NF da Base</DialogTitle>
            <DialogDescription>Escolha uma NF e um item para calcular o custo efetivo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por fornecedor, número ou descrição..." value={nfSearchTerm} onChange={e => setNfSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
              {loadingCompras ? (
                <p className="text-center text-muted-foreground py-8">Carregando NFs...</p>
              ) : comprasFiltradas.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhuma NF encontrada para esta empresa.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/compras">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Ir para módulo de Compras
                    </a>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NF</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprasFiltradas.flatMap(compra => 
                      (compra.itens || []).map((item, idx) => (
                        <TableRow 
                          key={`${compra.id}-${idx}`} 
                          className={selectedNFItem?.compra.id === compra.id && selectedNFItem?.itemIndex === idx ? 'bg-primary/10' : ''}
                        >
                          <TableCell className="font-medium">{compra.numero_nf || '-'}</TableCell>
                          <TableCell>{compra.fornecedor_nome}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.descricao_nf}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valor_total)}</TableCell>
                          <TableCell>
                            <Button 
                              variant={selectedNFItem?.compra.id === compra.id && selectedNFItem?.itemIndex === idx ? 'default' : 'outline'} 
                              size="sm" 
                              onClick={() => setSelectedNFItem({ compra, itemIndex: idx })}
                            >
                              Selecionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSelecionarNFItem} disabled={!selectedNFItem}>Usar Custo desta NF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Upload XML */}
      <Dialog open={xmlUploadModalOpen} onOpenChange={setXmlUploadModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Upload de XML de NF-e
            </DialogTitle>
            <DialogDescription>Envie um arquivo XML de NF-e para calcular o custo efetivo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!xmlParsed ? <div className="border-2 border-dashed rounded-xl p-8 text-center">
                <input type="file" accept=".xml" onChange={handleXmlUpload} className="hidden" id="xml-upload" />
                <label htmlFor="xml-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Clique para selecionar arquivo XML</p>
                  <p className="text-sm text-muted-foreground mt-2">Apenas arquivos XML de NF-e são aceitos</p>
                </label>
              </div> : <div className="space-y-4">
                <Alert className="bg-emerald-50 border-emerald-200">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-800">XML Carregado</AlertTitle>
                  <AlertDescription className="text-emerald-700">
                    NF {xmlParsed.numero} - {xmlParsed.emitente.razaoSocial}
                  </AlertDescription>
                </Alert>
                
                <div className="text-sm text-muted-foreground grid grid-cols-3 gap-2">
                  <span><strong>Frete:</strong> {formatCurrency(xmlParsed.freteTotal || 0)}</span>
                  <span><strong>Despesas:</strong> {formatCurrency(xmlParsed.outrasDepesas || 0)}</span>
                  <span><strong>Descontos:</strong> {formatCurrency(xmlParsed.descontoTotal || 0)}</span>
                  <span><strong>ICMS ST Total:</strong> {formatCurrency(xmlParsed.stTotal || 0)}</span>
                  <span><strong>IPI Total:</strong> {formatCurrency(xmlParsed.ipiTotal || 0)}</span>
                  <span><strong>Valor NF:</strong> {formatCurrency(xmlParsed.valorTotal || 0)}</span>
                </div>
                
                <Label>Selecione o item do produto:</Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>NCM</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">ST</TableHead>
                        <TableHead className="text-right">IPI</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {xmlParsed.itens.map((item, idx) => <TableRow key={idx} className={selectedXmlItemIndex === idx ? 'bg-primary/10' : ''}>
                          <TableCell className="max-w-[180px] truncate">{item.descricao}</TableCell>
                          <TableCell className="font-mono text-xs">{item.ncm}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.icmsST || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valorIPI || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valorTotal)}</TableCell>
                          <TableCell>
                            <Button variant={selectedXmlItemIndex === idx ? 'default' : 'outline'} size="sm" onClick={() => setSelectedXmlItemIndex(idx)}>
                              Selecionar
                            </Button>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setXmlUploadModalOpen(false);
            setXmlParsed(null);
            setSelectedXmlItemIndex(null);
          }}>
              Cancelar
            </Button>
            {xmlParsed && <Button onClick={handleConfirmarItemXml} disabled={selectedXmlItemIndex === null}>
                Calcular Custo Efetivo
              </Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gastos Extras */}
      <Dialog open={gastoExtraModalOpen} onOpenChange={setGastoExtraModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Gasto Extra</DialogTitle>
            <DialogDescription>Custos adicionais por venda como campanhas, cupons ou taxas especiais</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sugestões</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {GASTOS_EXTRAS_SUGESTOES.map((sugestao, idx) => <Button key={idx} variant="outline" size="sm" onClick={() => handleSelecionarSugestaoGasto(sugestao)}>
                    {sugestao.descricao}
                  </Button>)}
              </div>
            </div>
            <Separator />
            <div>
              <Label>Descrição</Label>
              <Input value={novoGastoExtra.descricao || ''} onChange={e => setNovoGastoExtra(prev => ({
              ...prev,
              descricao: e.target.value
            }))} placeholder="Ex.: Cupom de desconto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={novoGastoExtra.tipo} onValueChange={v => setNovoGastoExtra(prev => ({
                ...prev,
                tipo: v as TipoGastoExtra
              }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                    <SelectItem value="percentual">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={novoGastoExtra.valor || ''} onChange={e => setNovoGastoExtra(prev => ({
                ...prev,
                valor: parseFloat(e.target.value) || 0
              }))} placeholder="0" />
              </div>
            </div>
            {novoGastoExtra.tipo === 'percentual' && <div>
                <Label>Base de Cálculo</Label>
                <Select value={novoGastoExtra.baseCalculo} onValueChange={v => setNovoGastoExtra(prev => ({
              ...prev,
              baseCalculo: v as BaseCalculo
            }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preco_venda">Preço de Venda</SelectItem>
                    <SelectItem value="receita_liquida">Receita Líquida</SelectItem>
                    <SelectItem value="comissao">Comissão</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGastoExtraModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdicionarGastoExtra}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}