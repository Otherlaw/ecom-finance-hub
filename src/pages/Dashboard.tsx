import { MainLayout } from "@/components/MainLayout";
import { KPICard } from "@/components/KPICard";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  kpis,
  channelData,
  monthlyHistory,
  cashFlowData,
  expensesByCategory,
  formatCurrency,
  formatNumber,
} from "@/lib/mock-data";
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

export default function Dashboard() {
  return (
    <MainLayout
      title="Dashboard Executivo"
      subtitle="Visão geral consolidada do seu e-commerce"
      actions={
        <div className="flex items-center gap-2">
          <Select defaultValue="outubro">
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="outubro">Outubro 2024</SelectItem>
              <SelectItem value="setembro">Setembro 2024</SelectItem>
              <SelectItem value="agosto">Agosto 2024</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Faturamento Bruto"
          value={formatCurrency(kpis.faturamentoMensal)}
          change={kpis.faturamentoVariacao}
          icon={DollarSign}
          iconColor="text-primary"
          trend={kpis.faturamentoVariacao >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Lucro Líquido"
          value={formatCurrency(kpis.lucroLiquido)}
          change={kpis.lucroVariacao}
          icon={TrendingUp}
          iconColor="text-success"
          trend={kpis.lucroLiquido >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Margem Bruta"
          value={`${kpis.margemBruta}%`}
          change={kpis.margemBrutaVariacao}
          icon={Percent}
          iconColor="text-info"
          trend={kpis.margemBrutaVariacao >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Pedidos"
          value={formatNumber(kpis.pedidos)}
          change={kpis.pedidosVariacao}
          icon={ShoppingCart}
          iconColor="text-warning"
          trend={kpis.pedidosVariacao >= 0 ? "up" : "down"}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(kpis.ticketMedio)}
          change={kpis.ticketMedioVariacao}
          icon={CreditCard}
          trend={kpis.ticketMedioVariacao >= 0 ? "up" : "down"}
        />
        <KPICard
          title="CMV"
          value={formatCurrency(kpis.cmv)}
          changeLabel={`${kpis.cmvPercentual}% da receita`}
          icon={Package}
          trend="neutral"
        />
        <KPICard
          title="Margem Líquida"
          value={`${kpis.margemLiquida}%`}
          change={kpis.margemLiquidaVariacao}
          icon={Percent}
          trend={kpis.margemLiquida >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Custo Operacional"
          value={formatCurrency(kpis.custoOperacional)}
          changeLabel={`${kpis.custoOperacionalPercentual}% da receita`}
          icon={BarChart3}
          trend="neutral"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Evolution */}
        <ModuleCard
          title="Evolução do Faturamento"
          description="Últimos 6 meses"
          icon={BarChart3}
          actions={
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              Ver detalhes <ArrowRight className="h-4 w-4" />
            </Button>
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyHistory}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(4, 86%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(4, 86%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
                <YAxis
                  stroke="hsl(220, 10%, 46%)"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                />
                <Area
                  type="monotone"
                  dataKey="receitaBruta"
                  stroke="hsl(4, 86%, 55%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>

        {/* Revenue by Channel */}
        <ModuleCard
          title="Receita por Canal"
          description="Distribuição de vendas"
          icon={PieChart}
        >
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
                  dataKey="receitaBruta"
                  nameKey="channel"
                >
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
        </ModuleCard>
      </div>

      {/* Cash Flow & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow */}
        <ModuleCard
          title="Fluxo de Caixa"
          description="Entradas vs Saídas"
          icon={BarChart3}
          className="lg:col-span-2"
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
                <YAxis
                  stroke="hsl(220, 10%, 46%)"
                  fontSize={12}
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
        </ModuleCard>

        {/* Top Expenses */}
        <ModuleCard title="Maiores Despesas" description="Por categoria" icon={CreditCard}>
          <div className="space-y-4">
            {expensesByCategory.slice(0, 5).map((expense, index) => (
              <div key={expense.category} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{expense.category}</span>
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
        </ModuleCard>
      </div>

      {/* Health Indicator */}
      <div className="mt-6">
        <ModuleCard title="Saúde Financeira" description="Indicadores críticos do negócio">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 rounded-xl bg-destructive/5 border border-destructive/20">
              <div className="text-4xl font-bold text-destructive mb-2">⚠️</div>
              <h3 className="font-semibold text-lg">Atenção Necessária</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Prejuízo de {formatCurrency(Math.abs(kpis.lucroLiquido))} no mês
              </p>
              <Badge variant="destructive" className="mt-3">
                Revisar custos
              </Badge>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-warning/5 border border-warning/20">
              <div className="text-4xl font-bold text-warning mb-2">📊</div>
              <h3 className="font-semibold text-lg">Margem Operacional</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Custos operacionais em {kpis.custoOperacionalPercentual}% da receita
              </p>
              <Badge className="mt-3 bg-warning text-warning-foreground">
                Acima do ideal
              </Badge>
            </div>
            
            <div className="text-center p-6 rounded-xl bg-success/5 border border-success/20">
              <div className="text-4xl font-bold text-success mb-2">✓</div>
              <h3 className="font-semibold text-lg">Margem Bruta</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Margem de {kpis.margemBruta}% sobre vendas
              </p>
              <Badge className="mt-3 bg-success text-success-foreground">
                Saudável
              </Badge>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
