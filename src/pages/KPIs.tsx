import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { kpis, channelData, formatCurrency, formatNumber, formatPercentage } from "@/lib/mock-data";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  Package,
  CreditCard,
  BarChart3,
  Target,
  Zap,
  Download,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const kpiCategories = [
  {
    title: "Receita",
    icon: DollarSign,
    kpis: [
      { label: "Faturamento Bruto", value: formatCurrency(kpis.faturamentoMensal), change: kpis.faturamentoVariacao, target: 850000, current: kpis.faturamentoMensal },
      { label: "Ticket Médio", value: formatCurrency(kpis.ticketMedio), change: kpis.ticketMedioVariacao, target: 165, current: kpis.ticketMedio },
      { label: "Pedidos", value: formatNumber(kpis.pedidos), change: kpis.pedidosVariacao, target: 5500, current: kpis.pedidos },
    ],
  },
  {
    title: "Margens",
    icon: Percent,
    kpis: [
      { label: "Margem Bruta", value: `${kpis.margemBruta}%`, change: kpis.margemBrutaVariacao, target: 55, current: kpis.margemBruta },
      { label: "Margem Líquida", value: `${kpis.margemLiquida}%`, change: kpis.margemLiquidaVariacao, target: 10, current: kpis.margemLiquida },
      { label: "EBITDA %", value: "-6.0%", change: -165.2, target: 12, current: -6 },
    ],
  },
  {
    title: "Custos",
    icon: Package,
    kpis: [
      { label: "CMV", value: formatCurrency(kpis.cmv), sublabel: `${kpis.cmvPercentual}% da receita`, target: 30, current: kpis.cmvPercentual },
      { label: "Custo Operacional", value: formatCurrency(kpis.custoOperacional), sublabel: `${kpis.custoOperacionalPercentual}% da receita`, target: 40, current: kpis.custoOperacionalPercentual },
      { label: "CAC Médio", value: "R$ 12,50", change: -5.2, target: 10, current: 12.5 },
    ],
  },
];

export default function KPIs() {
  return (
    <MainLayout
      title="KPIs Estratégicos"
      subtitle="Indicadores chave de performance"
      actions={
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Relatório
        </Button>
      }
    >
      {/* Principais KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Faturamento"
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

      {/* KPIs por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {kpiCategories.map((category) => (
          <ModuleCard
            key={category.title}
            title={category.title}
            icon={category.icon}
          >
            <div className="space-y-6">
              {category.kpis.map((kpi, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{kpi.label}</span>
                    <span className="text-lg font-bold">{kpi.value}</span>
                  </div>
                  {kpi.change !== undefined && (
                    <div className={`flex items-center gap-1 text-sm ${kpi.change >= 0 ? "text-success" : "text-destructive"}`}>
                      {kpi.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                      <span>{formatPercentage(kpi.change)}</span>
                      <span className="text-muted-foreground">vs mês anterior</span>
                    </div>
                  )}
                  {kpi.sublabel && (
                    <p className="text-sm text-muted-foreground">{kpi.sublabel}</p>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Meta: {kpi.target}</span>
                      <span>{((kpi.current / kpi.target) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress 
                      value={Math.min(Math.abs(kpi.current / kpi.target) * 100, 100)} 
                      className="h-1.5"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ModuleCard>
        ))}
      </div>

      {/* Performance por Canal */}
      <ModuleCard
        title="Performance por Canal"
        description="Comparativo de canais de venda"
        icon={BarChart3}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {channelData.map((channel, index) => (
            <div key={channel.channel} className="p-4 rounded-xl bg-secondary/50 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{channel.channel}</h4>
                <Badge variant="outline">
                  {channel.percentual}%
                </Badge>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(channel.receitaBruta)}</p>
                <p className="text-sm text-muted-foreground">Receita bruta</p>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${channel.percentual}%`,
                    backgroundColor: channel.color,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-success" />
                <span className="text-success">+{(Math.random() * 15).toFixed(1)}%</span>
                <span className="text-muted-foreground">crescimento</span>
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>

      {/* Metas e Objetivos */}
      <div className="mt-6">
        <ModuleCard
          title="Metas do Mês"
          description="Acompanhamento de objetivos"
          icon={Target}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Faturamento</h4>
                <Badge className="bg-warning/10 text-warning border-warning/20">93%</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Atual</span>
                  <span className="font-medium">{formatCurrency(kpis.faturamentoMensal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Meta</span>
                  <span className="font-medium">{formatCurrency(850000)}</span>
                </div>
                <Progress value={93} className="h-2" />
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Margem Bruta</h4>
                <Badge className="bg-success/10 text-success border-success/20">90%</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Atual</span>
                  <span className="font-medium">{kpis.margemBruta}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Meta</span>
                  <span className="font-medium">55%</span>
                </div>
                <Progress value={90} className="h-2" />
              </div>
            </div>

            <div className="p-6 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Lucro Líquido</h4>
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">0%</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Atual</span>
                  <span className="font-medium text-destructive">{formatCurrency(kpis.lucroLiquido)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Meta</span>
                  <span className="font-medium">{formatCurrency(50000)}</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
