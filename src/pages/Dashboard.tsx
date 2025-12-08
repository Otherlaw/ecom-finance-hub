import { MainLayout } from "@/components/MainLayout";
import { KPICard } from "@/components/KPICard";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDREData, usePeridosDisponiveis } from "@/hooks/useDREData";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { useMarketplaceTransactions } from "@/hooks/useMarketplaceTransactions";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useContasReceber } from "@/hooks/useContasReceber";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
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
  ArrowRight,
  Download,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });

  const [mes, ano] = selectedPeriod.split("-");
  const periodoInicio = `${ano}-${mes}-01`;
  const periodoFim = format(endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");

  // Hooks de dados reais
  const { dreData, stats, isLoading: isDRELoading, hasData: hasDREData } = useDREData(mes, parseInt(ano));
  const { resumo: fluxoResumo, agregado, isLoading: isFluxoLoading } = useFluxoCaixa({ periodoInicio, periodoFim });
  const { transacoes: marketplaceTransacoes, resumo: mktResumo, isLoading: isMktLoading } = useMarketplaceTransactions({ periodoInicio, periodoFim });
  const { resumo: contasPagarResumo, isLoading: isCPLoading } = useContasPagar({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { resumo: contasReceberResumo, isLoading: isCRLoading } = useContasReceber({ dataInicio: periodoInicio, dataFim: periodoFim });
  const { data: periodosDisponiveis } = usePeridosDisponiveis();

  const isLoading = isDRELoading || isFluxoLoading || isMktLoading || isCPLoading || isCRLoading;

  // KPIs calculados
  const kpis = useMemo(() => {
    const receitaBruta = dreData?.receitaBruta || 0;
    const lucroBruto = dreData?.lucroBruto || 0;
    const lucroLiquido = dreData?.lucroLiquido || 0;
    const totalDespesas = dreData?.totalDespesas || 0;
    const custos = dreData?.custos?.valor || 0;

    const margemBruta = stats?.margemBruta || 0;
    const margemLiquida = stats?.margemLiquida || 0;
    const custosPercentual = stats?.custosPercentual || 0;
    const despesasPercentual = stats?.despesasPercentual || 0;

    // Pedidos do marketplace
    const pedidosUnicos = new Set(marketplaceTransacoes.filter(t => t.pedido_id).map(t => t.pedido_id)).size;
    const ticketMedio = pedidosUnicos > 0 ? receitaBruta / pedidosUnicos : 0;

    return {
      receitaBruta,
      lucroBruto,
      lucroLiquido,
      totalDespesas,
      custos,
      margemBruta,
      margemLiquida,
      custosPercentual,
      despesasPercentual,
      pedidos: pedidosUnicos,
      ticketMedio,
    };
  }, [dreData, stats, marketplaceTransacoes]);

  // Dados para gráficos
  const cashFlowData = useMemo(() => {
    return agregado.porDia.slice(-30).map(d => ({
      data: format(new Date(d.data), "dd/MM", { locale: ptBR }),
      entradas: d.entradas,
      saidas: d.saidas,
    }));
  }, [agregado]);

  // Receita por canal (marketplace)
  const channelData = useMemo(() => {
    const porCanal: Record<string, number> = {};
    marketplaceTransacoes.forEach(t => {
      if (t.tipo_lancamento === "credito" || t.valor_liquido > 0) {
        const canal = t.canal_venda || t.canal || "Outros";
        porCanal[canal] = (porCanal[canal] || 0) + Math.abs(t.valor_liquido);
      }
    });
    const total = Object.values(porCanal).reduce((a, b) => a + b, 0);
    return Object.entries(porCanal)
      .map(([channel, valor], index) => ({
        channel,
        valor,
        percentual: total > 0 ? ((valor / total) * 100).toFixed(1) : "0",
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [marketplaceTransacoes]);

  // Despesas por categoria
  const expensesByCategory = useMemo(() => {
    const total = agregado.porCategoria.reduce((a, c) => a + c.valor, 0);
    return agregado.porCategoria.slice(0, 5).map(c => ({
      category: c.categoria,
      valor: c.valor,
      percentual: total > 0 ? ((c.valor / total) * 100).toFixed(1) : "0",
    }));
  }, [agregado]);

  // Opções de período
  const periodoOpcoes = useMemo(() => {
    const opcoes = [];
    for (let i = 0; i < 6; i++) {
      const data = subMonths(new Date(), i);
      opcoes.push({
        value: format(data, "yyyy-MM"),
        label: format(data, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
      });
    }
    return opcoes;
  }, []);

  return (
    <MainLayout
      title="Dashboard Executivo"
      subtitle="Visão geral consolidada do seu e-commerce"
      actions={
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodoOpcoes.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

          {/* Health Indicator */}
          <div className="mt-6">
            <ModuleCard title="Saúde Financeira" description="Indicadores críticos do negócio">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`text-center p-6 rounded-xl ${kpis.lucroLiquido < 0 ? "bg-destructive/5 border border-destructive/20" : "bg-success/5 border border-success/20"}`}>
                  <div className="text-4xl font-bold mb-2">{kpis.lucroLiquido < 0 ? "⚠️" : "✓"}</div>
                  <h3 className="font-semibold text-lg">Resultado do Mês</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {kpis.lucroLiquido < 0 
                      ? `Prejuízo de ${formatCurrency(Math.abs(kpis.lucroLiquido))}`
                      : `Lucro de ${formatCurrency(kpis.lucroLiquido)}`
                    }
                  </p>
                  <Badge className={`mt-3 ${kpis.lucroLiquido < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {kpis.lucroLiquido < 0 ? "Revisar custos" : "Saudável"}
                  </Badge>
                </div>
                
                <div className={`text-center p-6 rounded-xl ${kpis.despesasPercentual > 30 ? "bg-warning/5 border border-warning/20" : "bg-success/5 border border-success/20"}`}>
                  <div className="text-4xl font-bold mb-2">📊</div>
                  <h3 className="font-semibold text-lg">Margem Operacional</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Despesas em {kpis.despesasPercentual.toFixed(1)}% da receita
                  </p>
                  <Badge className={`mt-3 ${kpis.despesasPercentual > 30 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                    {kpis.despesasPercentual > 30 ? "Acima do ideal" : "Controlado"}
                  </Badge>
                </div>
                
                <div className={`text-center p-6 rounded-xl ${kpis.margemBruta < 20 ? "bg-warning/5 border border-warning/20" : "bg-success/5 border border-success/20"}`}>
                  <div className="text-4xl font-bold mb-2">✓</div>
                  <h3 className="font-semibold text-lg">Margem Bruta</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Margem de {kpis.margemBruta.toFixed(1)}% sobre vendas
                  </p>
                  <Badge className={`mt-3 ${kpis.margemBruta < 20 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                    {kpis.margemBruta < 20 ? "Baixa" : "Saudável"}
                  </Badge>
                </div>
              </div>
            </ModuleCard>
          </div>

          {/* Empty State */}
          {!hasDREData && marketplaceTransacoes.length === 0 && (
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
