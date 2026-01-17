import { MainLayout } from "@/components/MainLayout";
import { KPICard } from "@/components/KPICard";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDREData, usePeridosDisponiveis } from "@/hooks/useDREData";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useContasReceber } from "@/hooks/useContasReceber";
import { useSincronizacaoMEU } from "@/hooks/useSincronizacaoMEU";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign,
  TrendingUp,
  Percent,
  ShoppingCart,
  Package,
  CreditCard,
  BarChart3,
  PieChart,
  Download,
  Loader2,
  RefreshCw,
  HelpCircle,
  Target,
  Scale,
  Wallet,
  Activity,
  ImageIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { PeriodFilter, PeriodOption, DateRange, getDateRangeForPeriod } from "@/components/PeriodFilter";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CHART_COLORS = [
  "hsl(4, 86%, 55%)",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(190, 95%, 39%)",
];

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>("7days");
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForPeriod("7days"));

  const handlePeriodChange = (period: PeriodOption, range: DateRange) => {
    setSelectedPeriod(period);
    setDateRange(range);
  };

  const periodoInicio = format(dateRange.from, "yyyy-MM-dd");
  const periodoFim = format(dateRange.to, "yyyy-MM-dd");
  const mes = format(dateRange.from, "MM");
  const ano = parseInt(format(dateRange.from, "yyyy"));

  // Hooks de dados reais
  const { dreData, stats, isLoading: isDRELoading, hasData: hasDREData } = useDREData(mes, ano);
  const { resumo: fluxoResumo, agregado, isLoading: isFluxoLoading } = useFluxoCaixa({ periodoInicio, periodoFim });
  
  // Hook otimizado para métricas de vendas (usa RPC agregada)
  const { metrics: mktMetrics, channelData: mktChannelData, ticketMedio: mktTicketMedio, isLoading: isMktLoading } = useDashboardMetrics(periodoInicio, periodoFim);
  
  const { resumo: contasPagarResumo, isLoading: isCPLoading } = useContasPagar({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { resumo: contasReceberResumo, isLoading: isCRLoading } = useContasReceber({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { data: periodosDisponiveis } = usePeridosDisponiveis();
  
  // Sincronização MEU
  const { temPendencias, totalPendentes, sincronizar, isSincronizando, refetchPendentes } = useSincronizacaoMEU();

  // Sincronizar automaticamente se houver pendências
  useEffect(() => {
    if (temPendencias && !isSincronizando) {
      sincronizar.mutate();
    }
  }, [temPendencias]);

  const isLoading = isDRELoading || isFluxoLoading || isMktLoading || isCPLoading || isCRLoading;

  // KPIs calculados - agora usando dados agregados da RPC
  const kpis = useMemo(() => {
    // Usar dados agregados da RPC (muito mais rápido)
    const receitaBruta = mktMetrics.receita_bruta || 0;
    const receitaLiquida = mktMetrics.receita_liquida || 0;
    const totalTarifas = mktMetrics.total_tarifas || 0;
    const totalAds = mktMetrics.total_ads || 0;
    
    // CMV estimado (baseado em dados se disponíveis)
    const custos = dreData?.custos?.valor || 0;
    const lucroBruto = receitaLiquida - custos;
    
    // Despesas do DRE (já considera período mensal)
    const totalDespesas = dreData?.totalDespesas || 0;
    const lucroLiquido = lucroBruto - totalDespesas;

    // Margens calculadas
    const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;
    const custosPercentual = receitaBruta > 0 ? (custos / receitaBruta) * 100 : 0;
    const despesasPercentual = receitaBruta > 0 ? (totalDespesas / receitaBruta) * 100 : 0;

    // Pedidos únicos da RPC
    const pedidosUnicos = mktMetrics.pedidos_unicos || 0;
    const ticketMedio = mktTicketMedio;

    return {
      receitaBruta,
      receitaLiquida,
      lucroBruto,
      lucroLiquido,
      totalDespesas,
      custos,
      totalTarifas,
      totalAds,
      margemBruta,
      margemLiquida,
      custosPercentual,
      despesasPercentual,
      pedidos: pedidosUnicos,
      ticketMedio,
    };
  }, [dreData, mktMetrics, mktTicketMedio]);

  // Dados para gráficos
  const cashFlowData = useMemo(() => {
    return agregado.porDia.slice(-30).map(d => ({
      data: format(new Date(d.data), "dd/MM", { locale: ptBR }),
      entradas: d.entradas,
      saidas: d.saidas,
    }));
  }, [agregado]);

  // Receita por canal (usando dados da RPC)
  const channelData = useMemo(() => {
    const CHART_COLORS_LOCAL = [
      "hsl(4, 86%, 55%)",
      "hsl(217, 91%, 60%)",
      "hsl(142, 71%, 45%)",
      "hsl(38, 92%, 50%)",
      "hsl(262, 83%, 58%)",
      "hsl(190, 95%, 39%)",
    ];

    const total = mktChannelData.reduce((a, c) => a + c.valor, 0);
    return mktChannelData
      .map((c, index) => ({
        channel: c.channel,
        valor: c.valor,
        percentual: total > 0 ? ((c.valor / total) * 100).toFixed(1) : "0",
        color: CHART_COLORS_LOCAL[index % CHART_COLORS_LOCAL.length],
      }))
      .slice(0, 6);
  }, [mktChannelData]);

  // Despesas por categoria
  const expensesByCategory = useMemo(() => {
    const total = agregado.porCategoria.reduce((a, c) => a + c.valor, 0);
    return agregado.porCategoria.slice(0, 5).map(c => ({
      category: c.categoria,
      valor: c.valor,
      percentual: total > 0 ? ((c.valor / total) * 100).toFixed(1) : "0",
    }));
  }, [agregado]);

  // Query para Top 10 produtos mais vendidos (incluindo custo_ads)
  const { data: topProdutosRaw = [], isLoading: isTopProdutosLoading } = useQuery({
    queryKey: ["top-produtos-vendidos", periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_transaction_items")
        .select(`
          quantidade,
          preco_total,
          sku_marketplace,
          descricao_item,
          produto_id,
          transaction:marketplace_transactions!inner(
            id,
            canal,
            data_transacao,
            tipo_lancamento,
            custo_ads
          ),
          produto:produtos(
            id,
            nome,
            sku,
            custo_medio,
            imagem_url
          )
        `)
        .gte("transaction.data_transacao", periodoInicio)
        .lte("transaction.data_transacao", periodoFim)
        .eq("transaction.tipo_lancamento", "credito");
      
      if (error) {
        console.error("Erro ao buscar top produtos:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!periodoInicio && !!periodoFim,
  });

  // Processar dados para Top 10 produtos com preço médio e ads
  const topProdutosProcessados = useMemo(() => {
    const porProduto = new Map<string, {
      id: string;
      nome: string;
      sku: string;
      custoUnitario: number;
      imagemUrl: string | null;
      qtdTotal: number;
      totalFaturado: number;
      totalAds: number;
      porCanal: Record<string, number>;
      transactionIds: Set<string>;
    }>();

    topProdutosRaw.forEach((item: any) => {
      const produtoId = item.produto_id || item.sku_marketplace || "sem-mapeamento";
      const produto = item.produto;
      const canal = item.transaction?.canal || "Outros";
      const quantidade = Number(item.quantidade) || 0;
      const precoTotal = Number(item.preco_total) || 0;
      const transactionId = item.transaction?.id;
      const custoAds = Number(item.transaction?.custo_ads) || 0;

      if (!porProduto.has(produtoId)) {
        porProduto.set(produtoId, {
          id: produtoId,
          nome: produto?.nome || item.descricao_item || item.sku_marketplace || "Produto não mapeado",
          sku: produto?.sku || item.sku_marketplace || "-",
          custoUnitario: Number(produto?.custo_medio) || 0,
          imagemUrl: produto?.imagem_url || null,
          qtdTotal: 0,
          totalFaturado: 0,
          totalAds: 0,
          porCanal: {},
          transactionIds: new Set(),
        });
      }

      const produtoAgregado = porProduto.get(produtoId)!;
      produtoAgregado.qtdTotal += quantidade;
      produtoAgregado.totalFaturado += precoTotal;
      produtoAgregado.porCanal[canal] = (produtoAgregado.porCanal[canal] || 0) + quantidade;
      
      // Somar ads apenas uma vez por transação
      if (transactionId && !produtoAgregado.transactionIds.has(transactionId)) {
        produtoAgregado.transactionIds.add(transactionId);
        produtoAgregado.totalAds += custoAds;
      }
    });

    const faturamentoTotal = [...porProduto.values()].reduce((sum, p) => sum + p.totalFaturado, 0);

    return [...porProduto.values()]
      .map(p => ({
        id: p.id,
        nome: p.nome,
        sku: p.sku,
        custoUnitario: p.custoUnitario,
        imagemUrl: p.imagemUrl,
        qtdTotal: p.qtdTotal,
        totalFaturado: p.totalFaturado,
        totalAds: p.totalAds,
        porCanal: p.porCanal,
        precoMedio: p.qtdTotal > 0 ? p.totalFaturado / p.qtdTotal : 0,
        lucro: p.totalFaturado - (p.custoUnitario * p.qtdTotal) - p.totalAds,
        margem: p.totalFaturado > 0 
          ? ((p.totalFaturado - (p.custoUnitario * p.qtdTotal) - p.totalAds) / p.totalFaturado * 100)
          : 0,
        representatividade: faturamentoTotal > 0 
          ? (p.totalFaturado / faturamentoTotal * 100)
          : 0,
      }))
      .sort((a, b) => b.totalFaturado - a.totalFaturado)
      .slice(0, 10);
  }, [topProdutosRaw]);

  // Indicadores de saúde financeira expandidos
  const indicadoresSaude = useMemo(() => {
    const receitaBruta = kpis.receitaBruta || 0;
    const lucroLiquido = kpis.lucroLiquido || 0;
    const margemBruta = kpis.margemBruta || 0;
    const margemLiquida = kpis.margemLiquida || 0;
    const despesasPercentual = kpis.despesasPercentual || 0;
    const totalEmAberto = contasPagarResumo.totalEmAberto || 0;
    const totalAReceber = contasReceberResumo.totalEmAberto || 0;
    const caixa = fluxoResumo.saldoFinal || 0;

    // Liquidez imediata = (Caixa + A Receber) / A Pagar
    const liquidezImediata = totalEmAberto > 0 ? (caixa + totalAReceber) / totalEmAberto : 0;

    // Concentração de receita (maior canal)
    const totalCanais = channelData.reduce((a, c) => a + c.valor, 0);
    const maiorCanal = channelData[0];
    const concentracaoReceita = totalCanais > 0 && maiorCanal ? (maiorCanal.valor / totalCanais) * 100 : 0;

    // Giro de caixa = Entradas / Saídas
    const totalEntradas = fluxoResumo.totalEntradas || 0;
    const totalSaidas = fluxoResumo.totalSaidas || 0;
    const giroCaixa = totalSaidas > 0 ? totalEntradas / totalSaidas : 0;

    return [
      {
        id: "resultado",
        titulo: "Resultado do Período",
        valor: formatCurrency(lucroLiquido),
        descricao: "Lucro ou prejuízo líquido após todas as deduções",
        paraQueServe: "Indica se sua operação está gerando valor ou queimando capital. Acompanhe mês a mês para identificar tendências.",
        status: lucroLiquido < 0 ? "critico" : lucroLiquido > receitaBruta * 0.05 ? "saudavel" : "alerta",
        referencia: "Meta: > 5% da receita",
        icon: <DollarSign className="h-5 w-5" />,
      },
      {
        id: "margem-bruta",
        titulo: "Margem Bruta",
        valor: `${margemBruta.toFixed(1)}%`,
        descricao: "Percentual que sobra após pagar o custo das mercadorias (CMV)",
        paraQueServe: "Avalia se você está comprando bem e precificando corretamente. Margem baixa indica problema na compra ou preço de venda.",
        status: margemBruta < 20 ? "critico" : margemBruta < 30 ? "alerta" : "saudavel",
        referencia: "E-commerce saudável: > 30%",
        icon: <Percent className="h-5 w-5" />,
      },
      {
        id: "margem-liquida",
        titulo: "Margem Líquida",
        valor: `${margemLiquida.toFixed(1)}%`,
        descricao: "Percentual do faturamento que vira lucro real após todas as despesas",
        paraQueServe: "Mostra a eficiência geral do negócio. Considera custos, despesas operacionais, impostos e todas as deduções.",
        status: margemLiquida < 0 ? "critico" : margemLiquida < 8 ? "alerta" : "saudavel",
        referencia: "E-commerce saudável: > 8%",
        icon: <TrendingUp className="h-5 w-5" />,
      },
      {
        id: "indice-despesas",
        titulo: "Índice de Despesas",
        valor: `${despesasPercentual.toFixed(1)}%`,
        descricao: "Quanto das vendas é consumido por despesas operacionais",
        paraQueServe: "Identifica se custos fixos estão controlados. Despesas altas podem indicar ineficiência operacional ou estrutura inchada.",
        status: despesasPercentual > 35 ? "critico" : despesasPercentual > 25 ? "alerta" : "saudavel",
        referencia: "Ideal: < 25% da receita",
        icon: <BarChart3 className="h-5 w-5" />,
      },
      {
        id: "liquidez",
        titulo: "Liquidez Imediata",
        valor: liquidezImediata.toFixed(2),
        descricao: "Capacidade de pagar dívidas de curto prazo com recursos disponíveis",
        paraQueServe: "Indica se você consegue honrar compromissos. Valor abaixo de 1 significa que não há caixa suficiente para quitar dívidas.",
        status: liquidezImediata < 0.5 ? "critico" : liquidezImediata < 1 ? "alerta" : "saudavel",
        referencia: "Saudável: > 1.0",
        icon: <Scale className="h-5 w-5" />,
      },
      {
        id: "concentracao",
        titulo: "Concentração de Receita",
        valor: `${concentracaoReceita.toFixed(0)}%`,
        descricao: `Percentual do maior canal (${maiorCanal?.channel || "N/A"}) sobre o total`,
        paraQueServe: "Avalia risco de dependência de um único marketplace. Alta concentração aumenta vulnerabilidade a mudanças de políticas ou taxas.",
        status: concentracaoReceita > 80 ? "critico" : concentracaoReceita > 70 ? "alerta" : "saudavel",
        referencia: "Ideal: < 70% em um canal",
        icon: <Target className="h-5 w-5" />,
      },
      {
        id: "ticket-medio",
        titulo: "Ticket Médio",
        valor: formatCurrency(kpis.ticketMedio),
        descricao: "Valor médio por pedido vendido no período",
        paraQueServe: "Acompanhar se estratégias de upsell e cross-sell estão funcionando. Ticket maior significa mais valor por transação.",
        status: "neutro",
        referencia: "Acompanhe a evolução",
        icon: <ShoppingCart className="h-5 w-5" />,
      },
      {
        id: "giro-caixa",
        titulo: "Giro de Caixa",
        valor: giroCaixa.toFixed(2),
        descricao: "Relação entre entradas e saídas do período",
        paraQueServe: "Indica se a operação gera mais caixa do que consome. Valor maior que 1 significa que o negócio está gerando caixa positivo.",
        status: giroCaixa < 0.8 ? "critico" : giroCaixa < 1 ? "alerta" : "saudavel",
        referencia: "Saudável: > 1.0",
        icon: <Activity className="h-5 w-5" />,
      },
    ];
  }, [kpis, contasPagarResumo, contasReceberResumo, fluxoResumo, channelData]);

  return (
    <MainLayout
      title="Dashboard Executivo"
      subtitle="Visão geral consolidada do seu e-commerce"
      actions={
        <div className="flex items-center gap-3 flex-wrap">
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
          <PeriodFilter
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            isLoading={isLoading}
          />
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
          <span className="ml-2 text-muted-foreground">Carregando dados...</span>
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Faturamento Bruto"
              value={formatCurrency(kpis.receitaBruta)}
              icon={DollarSign}
              iconColor="text-primary"
              trend="neutral"
            />
            <KPICard
              title="Lucro Líquido"
              value={formatCurrency(kpis.lucroLiquido)}
              icon={TrendingUp}
              iconColor={kpis.lucroLiquido >= 0 ? "text-success" : "text-destructive"}
              trend={kpis.lucroLiquido >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Margem Bruta"
              value={`${kpis.margemBruta.toFixed(1)}%`}
              icon={Percent}
              iconColor="text-info"
              trend={kpis.margemBruta >= 20 ? "up" : "down"}
            />
            <KPICard
              title="Pedidos"
              value={formatNumber(kpis.pedidos)}
              icon={ShoppingCart}
              iconColor="text-warning"
              trend="neutral"
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              title="Ticket Médio"
              value={formatCurrency(kpis.ticketMedio)}
              icon={CreditCard}
              trend="neutral"
            />
            <KPICard
              title="CMV / Custos"
              value={formatCurrency(kpis.custos)}
              changeLabel={`${kpis.custosPercentual.toFixed(1)}% da receita`}
              icon={Package}
              trend="neutral"
            />
            <KPICard
              title="Margem Líquida"
              value={`${kpis.margemLiquida.toFixed(1)}%`}
              icon={Percent}
              trend={kpis.margemLiquida >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Despesas Operacionais"
              value={formatCurrency(kpis.totalDespesas)}
              changeLabel={`${kpis.despesasPercentual.toFixed(1)}% da receita`}
              icon={BarChart3}
              trend="neutral"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cash Flow */}
            <ModuleCard
              title="Fluxo de Caixa"
              description="Últimos 30 dias"
              icon={BarChart3}
            >
              {cashFlowData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                      <XAxis dataKey="data" stroke="hsl(220, 10%, 46%)" fontSize={10} />
                      <YAxis
                        stroke="hsl(220, 10%, 46%)"
                        fontSize={10}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "1px solid hsl(220, 13%, 91%)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="entradas" name="Entradas" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="saidas" name="Saídas" fill="hsl(4, 86%, 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum movimento financeiro no período
                </div>
              )}
            </ModuleCard>

            {/* Revenue by Channel */}
            <ModuleCard
              title="Receita por Canal"
              description="Distribuição de vendas"
              icon={PieChart}
            >
              {channelData.length > 0 ? (
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={channelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="valor"
                        nameKey="channel"
                      >
                        {channelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(0, 0%, 100%)",
                          border: "1px solid hsl(220, 13%, 91%)",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend
                        formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhuma venda registrada no período
                </div>
              )}
            </ModuleCard>
          </div>

          {/* Top 10 Produtos Mais Vendidos */}
          <div className="mt-6">
            <ModuleCard 
              title="Top 10 Produtos Mais Vendidos" 
              description={`No período selecionado`}
              icon={Package}
            >
              {isTopProdutosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Carregando produtos...</span>
                </div>
              ) : topProdutosProcessados.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[280px]">Produto</TableHead>
                        <TableHead className="text-right">Preço Médio</TableHead>
                        <TableHead className="text-center min-w-[180px]">Qtd. Vendida</TableHead>
                        <TableHead className="text-right">Ads</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Lucro</TableHead>
                        <TableHead className="text-right">Margem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProdutosProcessados.map((produto) => (
                        <TableRow key={produto.id}>
                          {/* Coluna Produto */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                                {produto.imagemUrl ? (
                                  <img 
                                    src={produto.imagemUrl} 
                                    alt={produto.nome}
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm leading-tight" title={produto.nome}>
                                  {produto.nome.length > 45 ? produto.nome.substring(0, 45) + "..." : produto.nome}
                                </p>
                                <p className="text-xs text-muted-foreground">{produto.sku}</p>
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* Preço Médio */}
                          <TableCell className="text-right">
                            {formatCurrency(produto.precoMedio)}
                          </TableCell>
                          
                          {/* Qtd Vendida com canais visíveis */}
                          <TableCell>
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-semibold text-lg">{formatNumber(produto.qtdTotal)}</span>
                              <div className="flex flex-wrap justify-center gap-1">
                                {Object.entries(produto.porCanal).map(([canal, qtd]) => {
                                  const canalAbrev = canal === "Mercado Livre" ? "ML" : 
                                                     canal === "Shopee" ? "SH" :
                                                     canal === "Shein" ? "SN" :
                                                     canal === "TikTok" ? "TT" : canal.substring(0, 3);
                                  return (
                                    <Badge 
                                      key={canal} 
                                      variant="outline" 
                                      className="text-[10px] px-1.5 py-0 h-5 font-normal"
                                      title={canal}
                                    >
                                      {canalAbrev}: {qtd}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* Ads */}
                          <TableCell className="text-right">
                            {produto.totalAds > 0 ? (
                              <span className="text-warning">{formatCurrency(produto.totalAds)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          
                          {/* Total Faturado */}
                          <TableCell className="text-right font-medium">
                            {formatCurrency(produto.totalFaturado)}
                          </TableCell>
                          
                          {/* Lucro */}
                          <TableCell className="text-right">
                            <span className={produto.lucro >= 0 ? "text-success" : "text-destructive"}>
                              {formatCurrency(produto.lucro)}
                            </span>
                          </TableCell>
                          
                          {/* Margem com Badge colorido */}
                          <TableCell className="text-right">
                            <Badge 
                              variant="outline"
                              className={
                                produto.margem >= 20 
                                  ? "bg-success/10 text-success border-success/30" 
                                  : produto.margem >= 10 
                                    ? "bg-warning/10 text-warning border-warning/30" 
                                    : "bg-destructive/10 text-destructive border-destructive/30"
                              }
                            >
                              {produto.margem.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum produto vendido no período selecionado
                </div>
              )}
            </ModuleCard>
          </div>

          {/* Expenses & Contas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Expenses */}
            <ModuleCard title="Maiores Despesas" description="Por categoria" icon={CreditCard}>
              {expensesByCategory.length > 0 ? (
                <div className="space-y-4">
                  {expensesByCategory.map((expense, index) => (
                    <div key={expense.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{expense.category}</span>
                        <span className="text-muted-foreground">{expense.percentual}%</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${expense.percentual}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma despesa categorizada no período
                </div>
              )}
            </ModuleCard>

            {/* Contas a Pagar */}
            <ModuleCard title="Contas a Pagar" description="Resumo do período" icon={TrendingUp}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Em Aberto</span>
                  <span className="font-semibold text-warning">{formatCurrency(contasPagarResumo.totalEmAberto)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vencido</span>
                  <span className="font-semibold text-destructive">{formatCurrency(contasPagarResumo.totalVencido)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pago</span>
                  <span className="font-semibold text-success">{formatCurrency(contasPagarResumo.totalPago)}</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{contasPagarResumo.quantidade} títulos no período</span>
                </div>
              </div>
            </ModuleCard>

            {/* Contas a Receber */}
            <ModuleCard title="Contas a Receber" description="Resumo do período" icon={DollarSign}>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Em Aberto</span>
                  <span className="font-semibold text-warning">{formatCurrency(contasReceberResumo.totalEmAberto)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vencido</span>
                  <span className="font-semibold text-destructive">{formatCurrency(contasReceberResumo.totalVencido)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Recebido</span>
                  <span className="font-semibold text-success">{formatCurrency(contasReceberResumo.totalRecebido)}</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">{contasReceberResumo.quantidade} títulos no período</span>
                </div>
              </div>
            </ModuleCard>
          </div>

          {/* Health Indicators - Expanded */}
          <div className="mt-6">
            <ModuleCard title="Saúde Financeira" description="Indicadores críticos do negócio com análise detalhada">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {indicadoresSaude.map((indicador) => {
                  const statusStyles = {
                    saudavel: "bg-success/5 border-success/20 text-success",
                    alerta: "bg-warning/5 border-warning/20 text-warning",
                    critico: "bg-destructive/5 border-destructive/20 text-destructive",
                    neutro: "bg-muted/30 border-border text-muted-foreground",
                  };
                  
                  const statusLabels = {
                    saudavel: "Saudável",
                    alerta: "Atenção",
                    critico: "Crítico",
                    neutro: "Neutro",
                  };

                  const status = indicador.status as keyof typeof statusStyles;
                  
                  return (
                    <TooltipProvider key={indicador.id}>
                      <TooltipUI>
                        <TooltipTrigger asChild>
                          <div className={`p-4 rounded-xl border cursor-help transition-all hover:shadow-md ${statusStyles[status]}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className={`p-2 rounded-lg ${status === "neutro" ? "bg-muted" : status === "saudavel" ? "bg-success/10" : status === "alerta" ? "bg-warning/10" : "bg-destructive/10"}`}>
                                {indicador.icon}
                              </div>
                              <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            
                            <h4 className="font-medium text-sm text-foreground mb-1">{indicador.titulo}</h4>
                            <div className="text-2xl font-bold mb-2">{indicador.valor}</div>
                            
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                              {indicador.descricao}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${status === "saudavel" ? "border-success/30 text-success" : status === "alerta" ? "border-warning/30 text-warning" : status === "critico" ? "border-destructive/30 text-destructive" : "border-border"}`}
                              >
                                {statusLabels[status]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{indicador.referencia}</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px] p-3">
                          <p className="font-semibold text-sm mb-1">Para que serve?</p>
                          <p className="text-xs text-muted-foreground">{indicador.paraQueServe}</p>
                        </TooltipContent>
                      </TooltipUI>
                    </TooltipProvider>
                  );
                })}
              </div>
            </ModuleCard>
          </div>

          {/* Empty State */}
          {!hasDREData && mktMetrics.total_transacoes === 0 && (
            <div className="mt-6 p-8 text-center bg-muted/30 rounded-lg border border-dashed">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sem dados no período</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Importe transações de marketplace, registre contas a pagar/receber ou categorize movimentações para ver os dados consolidados aqui.
              </p>
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
