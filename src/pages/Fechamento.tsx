import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDREData, usePeridosDisponiveis } from "@/hooks/useDREData";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { useMarketplaceTransactions } from "@/hooks/useMarketplaceTransactions";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useContasReceber } from "@/hooks/useContasReceber";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useSincronizacaoMEU } from "@/hooks/useSincronizacaoMEU";
import { 
  useChecklistsCanal, 
  ChecklistCanalComItens, 
  calcularProgressoChecklist, 
  determinarStatusChecklist,
  calcularResumoFechamento,
  determinarStatusFechamento,
  listarPendenciasFechamento,
} from "@/hooks/useChecklistsCanal";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import { useMemo, useState, useEffect } from "react";
import { format, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  Download,
  Upload,
  Check,
  Clock,
  AlertTriangle,
  Store,
  Building2,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function Fechamento() {
  const { openChat } = useAssistantChatContext();
  const navigate = useNavigate();
  
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });

  const [showConfirmacaoFechamento, setShowConfirmacaoFechamento] = useState(false);

  const [ano, mes] = selectedPeriod.split("-");
  const periodoInicio = `${ano}-${mes}-01`;
  const periodoFim = format(endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");

  // Hooks de dados reais
  const { dreData, stats, isLoading: isDRELoading, hasData: hasDREData, transacoesCount } = useDREData(mes, parseInt(ano));
  const { resumo: fluxoResumo, isLoading: isFluxoLoading, hasData: hasFluxoData } = useFluxoCaixa({ periodoInicio, periodoFim });
  const { transacoes: marketplaceTransacoes, resumo: mktResumo, isLoading: isMktLoading } = useMarketplaceTransactions({ periodoInicio, periodoFim });
  const { resumo: contasPagarResumo, contas: contasPagar, isLoading: isCPLoading } = useContasPagar({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { resumo: contasReceberResumo, contas: contasReceber, isLoading: isCRLoading } = useContasReceber({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { empresas } = useEmpresas();
  
  // Primeira empresa para buscar checklists (pode ser expandido para múltiplas)
  const empresaPrincipal = empresas?.[0];
  
  // Buscar checklists do período
  const { checklists, isLoading: isChecklistLoading } = useChecklistsCanal({
    empresaId: empresaPrincipal?.id,
    mes: parseInt(mes),
    ano: parseInt(ano),
  });

  // Buscar itens de cada checklist para calcular progresso
  const [checklistsCompletos, setChecklistsCompletos] = useState<ChecklistCanalComItens[]>([]);
  const { buscarChecklistCompleto } = useChecklistsCanal({ empresaId: empresaPrincipal?.id });
  
  useEffect(() => {
    const carregarChecklistsCompletos = async () => {
      if (checklists.length === 0) {
        setChecklistsCompletos([]);
        return;
      }
      
      const completos = await Promise.all(
        checklists.map(c => buscarChecklistCompleto(c.id))
      );
      
      setChecklistsCompletos(completos.filter(Boolean) as ChecklistCanalComItens[]);
    };
    
    carregarChecklistsCompletos();
  }, [checklists]);

  // Sincronização MEU
  const { temPendencias, totalPendentes, sincronizar, isSincronizando } = useSincronizacaoMEU();

  // Sincronizar automaticamente se houver pendências
  useEffect(() => {
    if (temPendencias && !isSincronizando) {
      sincronizar.mutate();
    }
  }, [temPendencias]);

  const isLoading = isDRELoading || isFluxoLoading || isMktLoading || isCPLoading || isCRLoading || isChecklistLoading;

  // Opções de período
  const periodoOpcoes = useMemo(() => {
    const opcoes = [];
    for (let i = 0; i < 12; i++) {
      const data = subMonths(new Date(), i);
      opcoes.push({
        value: format(data, "yyyy-MM"),
        label: format(data, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      });
    }
    return opcoes;
  }, []);

  // Receita por canal
  const channelData = useMemo(() => {
    const porCanal: Record<string, { receita: number; taxas: number; liquido: number }> = {};
    marketplaceTransacoes.forEach(t => {
      const canal = t.canal_venda || t.canal || "Outros";
      if (!porCanal[canal]) {
        porCanal[canal] = { receita: 0, taxas: 0, liquido: 0 };
      }
      if (t.tipo_lancamento === "credito") {
        porCanal[canal].receita += Math.abs(t.valor_liquido);
        porCanal[canal].liquido += Math.abs(t.valor_liquido);
      } else {
        porCanal[canal].taxas += Math.abs(t.valor_liquido);
        porCanal[canal].liquido -= Math.abs(t.valor_liquido);
      }
    });
    const totalReceita = Object.values(porCanal).reduce((a, b) => a + b.receita, 0);
    return Object.entries(porCanal)
      .map(([channel, dados]) => ({
        channel,
        receitaBruta: dados.receita,
        taxas: dados.taxas,
        receitaLiquida: dados.liquido,
        percentual: totalReceita > 0 ? ((dados.receita / totalReceita) * 100).toFixed(1) : "0",
        color: getChannelColor(channel),
      }))
      .sort((a, b) => b.receitaBruta - a.receitaBruta);
  }, [marketplaceTransacoes]);

  // Resumo por empresa
  const empresaResumo = useMemo(() => {
    const porEmpresa: Record<string, { nome: string; receita: number; despesas: number; liquido: number }> = {};
    
    // Receitas de marketplace
    marketplaceTransacoes.forEach(t => {
      const empresaId = t.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (t.tipo_lancamento === "credito") {
        porEmpresa[empresaId].receita += Math.abs(t.valor_liquido);
      } else {
        porEmpresa[empresaId].despesas += Math.abs(t.valor_liquido);
      }
    });

    // Adicionar contas a pagar como despesas
    contasPagar?.forEach(c => {
      const empresaId = c.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (c.status === "pago") {
        porEmpresa[empresaId].despesas += c.valor_pago;
      }
    });

    // Adicionar contas a receber como receitas
    contasReceber?.forEach(c => {
      const empresaId = c.empresa_id;
      const empresa = empresas?.find(e => e.id === empresaId);
      const nome = empresa?.nome_fantasia || empresa?.razao_social || "Empresa não identificada";
      
      if (!porEmpresa[empresaId]) {
        porEmpresa[empresaId] = { nome, receita: 0, despesas: 0, liquido: 0 };
      }
      
      if (c.status === "recebido" || c.status === "parcialmente_recebido") {
        porEmpresa[empresaId].receita += c.valor_recebido;
      }
    });

    // Calcular líquido
    Object.values(porEmpresa).forEach(e => {
      e.liquido = e.receita - e.despesas;
    });

    return Object.values(porEmpresa).sort((a, b) => b.receita - a.receita);
  }, [marketplaceTransacoes, contasPagar, contasReceber, empresas]);

  // Calcular status do checklist por canal
  const checklistCanalStatus = useMemo(() => {
    if (checklistsCompletos.length === 0) return { status: 'pending', concluidos: 0, total: 0 };
    
    let concluidos = 0;
    checklistsCompletos.forEach(c => {
      const status = determinarStatusChecklist(c.itens);
      if (status === 'concluido' || status === 'nao_aplicavel') {
        concluidos++;
      }
    });
    
    const total = checklistsCompletos.length;
    
    if (concluidos === total && total > 0) return { status: 'done', concluidos, total };
    if (concluidos > 0) return { status: 'partial', concluidos, total };
    return { status: 'pending', concluidos, total };
  }, [checklistsCompletos]);

  // Calcular resumo do fechamento mensal (baseado em etapas críticas)
  const resumoFechamento = useMemo(() => {
    return calcularResumoFechamento(checklistsCompletos);
  }, [checklistsCompletos]);

  const statusFechamentoGeral = useMemo(() => {
    return determinarStatusFechamento(resumoFechamento);
  }, [resumoFechamento]);

  const pendenciasFechamento = useMemo(() => {
    return listarPendenciasFechamento(checklistsCompletos);
  }, [checklistsCompletos]);

  // Status do fechamento (etapas gerais) - Critérios baseados em dados REAIS do banco
  const statusFechamento = useMemo(() => {
    // 1. IMPORTAÇÃO DE DADOS - verificar fontes reais com contagem
    const temImportacoesMarketplace = marketplaceTransacoes.length > 0;
    const temMovimentosFinanceiros = fluxoResumo.totalEntradas > 0 || fluxoResumo.totalSaidas > 0;
    const temContasPagar = contasPagar.length > 0;
    const temContasReceber = contasReceber.length > 0;
    const fontes = [
      { nome: "Marketplace", tem: temImportacoesMarketplace },
      { nome: "Fluxo", tem: temMovimentosFinanceiros },
      { nome: "Contas Pagar", tem: temContasPagar },
      { nome: "Contas Receber", tem: temContasReceber },
    ];
    const fontesComDados = fontes.filter(f => f.tem).length;
    
    // Usar mktResumo.pendentes diretamente (já inclui importado + pendente após correção do hook)
    const mktPendentes = mktResumo.pendentes;
    const mktConciliadas = mktResumo.conciliadas;
    const mktTotal = mktResumo.total;
    const proporcaoNaoConciliada = mktTotal > 0 ? mktPendentes / mktTotal : 0;
    
    // Importação: done se >=3 fontes E mkt >90% conciliado; partial se alguma fonte; pending se nada
    const importacaoStatus = fontesComDados >= 3 && proporcaoNaoConciliada < 0.1 ? "done" 
      : fontesComDados >= 1 ? "partial" 
      : "pending";
    const importacaoDetail = temImportacoesMarketplace
      ? `${marketplaceTransacoes.length} mkt, ${contasPagar.length} CP, ${contasReceber.length} CR`
      : `${fontesComDados}/4 fontes`;

    // 2. CONCILIAÇÃO MARKETPLACE - X/Y transações conciliadas
    const conciliacaoStatus = mktConciliadas > 0 && mktPendentes === 0 ? "done"
      : mktConciliadas > 0 ? "partial" 
      : mktPendentes > 0 ? "attention"
      : "pending";
    const conciliacaoDetail = mktTotal > 0 
      ? `${mktConciliadas}/${mktTotal} conciliadas`
      : undefined;

    // 3. CONTAS A PAGAR - contagem de títulos vencidos
    const qtdContasPagar = contasPagar.length;
    const vencidosPagar = contasPagar.filter(c => 
      c.status !== 'pago' && c.status !== 'cancelado' && new Date(c.data_vencimento) < new Date()
    ).length;
    const pagosPagar = contasPagar.filter(c => c.status === 'pago').length;
    
    const contasPagarStatus = qtdContasPagar === 0 ? "pending"
      : vencidosPagar > 0 ? "attention"
      : pagosPagar === qtdContasPagar ? "done"
      : "partial";
    const contasPagarDetail = qtdContasPagar === 0 
      ? "Nenhum título"
      : vencidosPagar > 0 
        ? `${vencidosPagar} vencidos / ${qtdContasPagar} títulos`
        : `${pagosPagar}/${qtdContasPagar} pagos`;

    // 4. CONTAS A RECEBER - contagem de títulos vencidos
    const qtdContasReceber = contasReceber.length;
    const vencidosReceber = contasReceber.filter(c => 
      c.status !== 'recebido' && c.status !== 'cancelado' && new Date(c.data_vencimento) < new Date()
    ).length;
    const recebidosReceber = contasReceber.filter(c => c.status === 'recebido').length;
    
    const contasReceberStatus = qtdContasReceber === 0 ? "pending"
      : vencidosReceber > 0 ? "attention"
      : recebidosReceber === qtdContasReceber ? "done"
      : "partial";
    const contasReceberDetail = qtdContasReceber === 0 
      ? "Nenhum título"
      : vencidosReceber > 0 
        ? `${vencidosReceber} vencidos / ${qtdContasReceber} títulos`
        : recebidosReceber === qtdContasReceber 
          ? "Todas recebidas"
          : `${recebidosReceber}/${qtdContasReceber} recebidos`;

    // 5. CHECKLIST POR CANAL - usar resumoFechamento para etapas críticas
    const totalEtapasCriticas = resumoFechamento.totalEtapasCriticas;
    const etapasCriticasConcluidas = resumoFechamento.totalEtapasCriticasConcluidas;
    const canaisConcluidos = resumoFechamento.totalCanaisConcluidos;
    const totalCanais = resumoFechamento.totalCanaisComChecklist;
    
    const checklistStatus = totalCanais === 0 ? "pending"
      : canaisConcluidos === totalCanais && totalEtapasCriticas === etapasCriticasConcluidas ? "done"
      : etapasCriticasConcluidas > 0 || canaisConcluidos > 0 ? "partial"
      : "pending";
    const checklistDetail = totalCanais === 0 
      ? "Nenhum checklist criado"
      : `${canaisConcluidos}/${totalCanais} canais (${etapasCriticasConcluidas}/${totalEtapasCriticas} críticas)`;

    // 6. DRE CONSOLIDADO - vinculado ao processamento do marketplace
    const temDadosDRE = hasDREData && transacoesCount > 0;
    const temCategorizacao = (dreData?.receitaBruta ?? 0) > 0 || (dreData?.totalDespesas ?? 0) > 0;
    
    const dreStatus = temDadosDRE && temCategorizacao && proporcaoNaoConciliada < 0.1 ? "done"
      : temDadosDRE && temCategorizacao && proporcaoNaoConciliada < 0.5 ? "partial"
      : mktPendentes > 0 ? "attention"
      : temDadosDRE ? "partial"
      : "pending";
    const dreDetail = mktPendentes > 0 
      ? `${mktPendentes} mkt não conciliadas`
      : temCategorizacao 
        ? `DRE com ${transacoesCount} lançamentos`
        : transacoesCount > 0 ? `${transacoesCount} pendentes de categoria` : undefined;

    return [
      { step: "Importação de dados", status: importacaoStatus, detail: importacaoDetail },
      { step: "Conciliação marketplace", status: conciliacaoStatus, detail: conciliacaoDetail },
      { step: "Contas a pagar", status: contasPagarStatus, detail: contasPagarDetail },
      { step: "Contas a receber", status: contasReceberStatus, detail: contasReceberDetail },
      { step: "Checklist por Canal", status: checklistStatus, detail: checklistDetail },
      { step: "DRE consolidado", status: dreStatus, detail: dreDetail },
    ];
  }, [mktResumo, contasPagar, contasReceber, hasDREData, transacoesCount, marketplaceTransacoes, resumoFechamento, fluxoResumo, dreData]);

  // Handler para encerrar mês
  const handleEncerrarMes = () => {
    // Por enquanto apenas fecha o modal e mostra toast
    // Futuramente pode incluir lógica de persistência do fechamento
    setShowConfirmacaoFechamento(false);
    toast.success(`Fechamento de ${periodoLabel} registrado com sucesso!`);
  };

  const handleAskAssistant = () => {
    openChat('Explique os números deste fechamento mensal', {
      telaAtual: 'Fechamento Mensal',
      dadosAdicionais: {
        receitaBruta: dreData?.receitaBruta || 0,
        lucroBruto: dreData?.lucroBruto || 0,
        lucroLiquido: dreData?.lucroLiquido || 0,
        totalDespesas: dreData?.totalDespesas || 0,
        margemBruta: stats?.margemBruta || 0,
        margemLiquida: stats?.margemLiquida || 0,
        transacoesMarketplace: marketplaceTransacoes.length,
        contasPagarEmAberto: contasPagarResumo.totalEmAberto,
        contasReceberEmAberto: contasReceberResumo.totalEmAberto,
      },
    });
  };

  const periodoLabel = periodoOpcoes.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

  return (
    <MainLayout
      title="Fechamento Mensal"
      subtitle="Consolidação dos resultados por operação"
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          {temPendencias && (
            <Button 
              variant="outline" 
              className="gap-2" 
              onClick={() => sincronizar.mutate()}
              disabled={isSincronizando}
            >
              <RefreshCw className={`h-4 w-4 ${isSincronizando ? 'animate-spin' : ''}`} />
              Sincronizar ({totalPendentes})
            </Button>
          )}
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodoOpcoes.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados do fechamento...</span>
        </div>
      ) : (
        <>
          {/* Card de Status do Fechamento Mensal */}
          <div className="p-6 rounded-xl bg-card border border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Fechamento de {periodoLabel}</h2>
                <p className="text-sm text-muted-foreground">
                  Status consolidado dos checklists por canal
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={
                  statusFechamentoGeral === 'concluido' 
                    ? "bg-success/10 text-success border-success/30" 
                    : statusFechamentoGeral === 'em_andamento'
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-muted text-muted-foreground"
                }>
                  {statusFechamentoGeral === 'concluido' ? 'Concluído' :
                   statusFechamentoGeral === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                </Badge>
                <Button
                  onClick={() => setShowConfirmacaoFechamento(true)}
                  className={statusFechamentoGeral === 'concluido' ? 'bg-success hover:bg-success/90' : ''}
                  variant={statusFechamentoGeral === 'concluido' ? 'default' : 'outline'}
                >
                  <ListChecks className="h-4 w-4 mr-2" />
                  Encerrar Mês
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-secondary/50 border border-border">
                <p className="text-3xl font-bold">{resumoFechamento.totalCanaisConcluidos}/{resumoFechamento.totalCanaisComChecklist}</p>
                <p className="text-xs text-muted-foreground">Canais concluídos</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/50 border border-border">
                <p className="text-3xl font-bold">{resumoFechamento.totalEtapasCriticasConcluidas}/{resumoFechamento.totalEtapasCriticas}</p>
                <p className="text-xs text-muted-foreground">Etapas críticas</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-secondary/50 border border-border">
                <p className="text-3xl font-bold">{resumoFechamento.percentualConclusao}%</p>
                <p className="text-xs text-muted-foreground">Progresso geral</p>
              </div>
              <div className="flex items-center justify-center p-4">
                <Progress value={resumoFechamento.percentualConclusao} className="h-3 w-full" />
              </div>
            </div>
          </div>

          {/* Quadro de Pendências do Fechamento */}
          {pendenciasFechamento.length > 0 && (
            <ModuleCard
              title="Pendências para este mês"
              description={`${pendenciasFechamento.length} etapas críticas pendentes`}
              icon={AlertTriangle}
              className="mb-6"
            >
              <div className="space-y-2">
                {pendenciasFechamento.slice(0, 10).map((p) => (
                  <div key={p.etapaId} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <div>
                        <span className="font-medium">{p.canalNome}</span>
                        <span className="mx-2 text-muted-foreground">–</span>
                        <span>{p.etapaNome}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/checklist-fechamento?checklistId=${p.checklistId}`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ir para checklist
                    </Button>
                  </div>
                ))}
                {pendenciasFechamento.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    + {pendenciasFechamento.length - 10} outras pendências
                  </p>
                )}
              </div>
            </ModuleCard>
          )}

          {/* KPIs principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Receita Bruta Total"
              value={formatCurrency(dreData?.receitaBruta || 0)}
              icon={TrendingUp}
              trend={dreData?.receitaBruta && dreData.receitaBruta > 0 ? "up" : "neutral"}
            />
            <KPICard
              title="Total Despesas"
              value={formatCurrency((dreData?.totalDespesas || 0) + (dreData?.custos?.valor || 0))}
              icon={TrendingDown}
              trend="neutral"
            />
            <KPICard
              title="Lucro Bruto"
              value={formatCurrency(dreData?.lucroBruto || 0)}
              icon={TrendingUp}
              trend={(dreData?.lucroBruto || 0) >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Resultado Final"
              value={formatCurrency(dreData?.lucroLiquido || 0)}
              icon={(dreData?.lucroLiquido || 0) >= 0 ? TrendingUp : TrendingDown}
              trend={(dreData?.lucroLiquido || 0) >= 0 ? "up" : "down"}
            />
          </div>

          {/* Tabs por Operação */}
          <Tabs defaultValue="consolidado" className="space-y-6">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
              <TabsTrigger value="canais">Por Canal</TabsTrigger>
              <TabsTrigger value="empresas">Por Empresa</TabsTrigger>
            </TabsList>

            <TabsContent value="consolidado" className="space-y-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ModuleCard title="Fluxo de Caixa" description={periodoLabel} icon={TrendingUp}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Entradas</span>
                      <span className="font-semibold text-success">{formatCurrency(fluxoResumo.totalEntradas)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Saídas</span>
                      <span className="font-semibold text-destructive">{formatCurrency(fluxoResumo.totalSaidas)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium">Saldo do Período</span>
                      <span className={`font-bold text-lg ${fluxoResumo.saldoFinal >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(fluxoResumo.saldoFinal)}
                      </span>
                    </div>
                  </div>
                </ModuleCard>

                <ModuleCard title="Marketplace" description={`${marketplaceTransacoes.length} transações`} icon={Store}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Créditos</span>
                      <span className="font-semibold text-success">{formatCurrency(mktResumo.totalCreditos)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Débitos (taxas/tarifas)</span>
                      <span className="font-semibold text-destructive">{formatCurrency(mktResumo.totalDebitos)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium">Líquido</span>
                      <span className={`font-bold text-lg ${(mktResumo.totalCreditos - mktResumo.totalDebitos) >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(mktResumo.totalCreditos - mktResumo.totalDebitos)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Conciliadas: {mktResumo.conciliadas} | Pendentes: {mktResumo.pendentes}
                    </div>
                  </div>
                </ModuleCard>
              </div>

              {/* Contas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ModuleCard title="Contas a Pagar" description="Resumo do período" icon={TrendingDown}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Pago</span>
                      <span className="font-semibold text-success">{formatCurrency(contasPagarResumo.totalPago)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Em Aberto</span>
                      <span className="font-semibold text-warning">{formatCurrency(contasPagarResumo.totalEmAberto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencido</span>
                      <span className="font-semibold text-destructive">{formatCurrency(contasPagarResumo.totalVencido)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {contasPagarResumo.quantidade} títulos no período
                    </div>
                  </div>
                </ModuleCard>

                <ModuleCard title="Contas a Receber" description="Resumo do período" icon={TrendingUp}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Recebido</span>
                      <span className="font-semibold text-success">{formatCurrency(contasReceberResumo.totalRecebido)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Em Aberto</span>
                      <span className="font-semibold text-warning">{formatCurrency(contasReceberResumo.totalEmAberto)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Vencido</span>
                      <span className="font-semibold text-destructive">{formatCurrency(contasReceberResumo.totalVencido)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      {contasReceberResumo.quantidade} títulos no período
                    </div>
                  </div>
                </ModuleCard>
              </div>
            </TabsContent>

            <TabsContent value="canais" className="space-y-6">
              <ModuleCard
                title="Receita por Canal"
                description="Detalhamento por marketplace"
                icon={Store}
                noPadding
              >
                {channelData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/30">
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Receita Bruta</TableHead>
                        <TableHead className="text-right">Taxas/Tarifas</TableHead>
                        <TableHead className="text-right">Receita Líquida</TableHead>
                        <TableHead className="text-right">% Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelData.map((channel) => (
                        <TableRow key={channel.channel}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: channel.color }}
                              />
                              <span className="font-medium">{channel.channel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(channel.receitaBruta)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            -{formatCurrency(channel.taxas)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {formatCurrency(channel.receitaLiquida)}
                          </TableCell>
                          <TableCell className="text-right">
                            {channel.percentual}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    Nenhuma transação de marketplace no período
                  </div>
                )}
              </ModuleCard>
            </TabsContent>

            <TabsContent value="empresas" className="space-y-6">
              {empresaResumo.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {empresaResumo.map((op) => (
                    <ModuleCard
                      key={op.nome}
                      title={op.nome}
                      description="Resumo da operação"
                      icon={Building2}
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Receita Bruta</p>
                            <p className="text-xl font-bold">{formatCurrency(op.receita)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Despesas</p>
                            <p className="text-xl font-bold text-destructive">-{formatCurrency(op.despesas)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Líquido</p>
                            <p className={`text-xl font-bold ${op.liquido >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(op.liquido)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Margem</span>
                            <span className="font-medium">
                              {op.receita > 0 ? ((op.liquido / op.receita) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <Progress 
                            value={op.receita > 0 ? Math.max(0, Math.min(100, (op.liquido / op.receita) * 100)) : 0} 
                            className="h-2" 
                          />
                        </div>
                      </div>
                    </ModuleCard>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sem dados por empresa</h3>
                  <p className="text-sm">Importe transações de marketplace ou registre contas para ver o resumo por empresa.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Status do Fechamento */}
          <div className="mt-6">
            <ModuleCard title="Status do Fechamento" description="Etapas do mês" icon={CalendarCheck}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {isLoading ? (
                  // Skeleton loading state
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-muted/50 border-border text-center animate-pulse">
                      <div className="h-6 w-6 mx-auto mb-2 bg-muted rounded-full" />
                      <div className="h-4 w-24 mx-auto mb-2 bg-muted rounded" />
                      <div className="h-5 w-16 mx-auto bg-muted rounded" />
                      <div className="h-3 w-20 mx-auto mt-1 bg-muted rounded" />
                    </div>
                  ))
                ) : (
                  statusFechamento.map((item, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        item.status === "done"
                          ? "bg-success/5 border-success/20"
                          : item.status === "partial"
                          ? "bg-info/5 border-info/20"
                          : item.status === "attention"
                          ? "bg-warning/5 border-warning/20"
                          : "bg-muted/50 border-border"
                      }`}
                    >
                      {item.status === "done" ? (
                        <Check className="h-6 w-6 mx-auto mb-2 text-success" />
                      ) : item.status === "partial" ? (
                        <Clock className="h-6 w-6 mx-auto mb-2 text-info" />
                      ) : item.status === "attention" ? (
                        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-warning" />
                      ) : (
                        <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      )}
                      <p className="text-sm font-medium">{item.step}</p>
                      <Badge
                        className={`mt-2 ${
                          item.status === "done"
                            ? "bg-success/10 text-success"
                            : item.status === "partial"
                            ? "bg-info/10 text-info"
                            : item.status === "attention"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status === "done" ? "Concluído" : item.status === "partial" ? "Parcial" : item.status === "attention" ? "Atenção" : "Pendente"}
                      </Badge>
                      {item.detail && (
                        <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ModuleCard>
          </div>
        </>
      )}

      {/* Modal de Confirmação de Fechamento */}
      <AlertDialog open={showConfirmacaoFechamento} onOpenChange={setShowConfirmacaoFechamento}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendenciasFechamento.length > 0 
                ? "Etapas pendentes no checklist" 
                : "Confirmar fechamento do mês"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {pendenciasFechamento.length > 0 ? (
                <div className="space-y-2">
                  <p>Ainda existem <strong>{pendenciasFechamento.length}</strong> etapas críticas pendentes.</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 mt-2 text-sm">
                    {pendenciasFechamento.map(p => (
                      <div key={p.etapaId} className="flex gap-2">
                        <span className="text-warning">•</span>
                        <span>{p.canalNome} – {p.etapaNome}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2">Deseja realmente encerrar o mês?</p>
                </div>
              ) : (
                <p>Todas as etapas críticas foram concluídas. Confirma o fechamento de {periodoLabel}?</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar para os checklists</AlertDialogCancel>
            <AlertDialogAction onClick={handleEncerrarMes}>
              {pendenciasFechamento.length > 0 ? "Encerrar mesmo assim" : "Confirmar fechamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function getChannelColor(channel: string): string {
  const colors: Record<string, string> = {
    "Mercado Livre": "hsl(48, 96%, 53%)",
    "Shopee": "hsl(14, 100%, 57%)",
    "Shein": "hsl(0, 0%, 20%)",
    "TikTok Shop": "hsl(349, 100%, 50%)",
    "Amazon": "hsl(33, 100%, 50%)",
    "Magalu": "hsl(210, 100%, 50%)",
  };
  return colors[channel] || "hsl(220, 14%, 46%)";
}
