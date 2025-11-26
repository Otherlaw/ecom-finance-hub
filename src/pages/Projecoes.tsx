import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projections, formatCurrency } from "@/lib/mock-data";
import {
  LineChart,
  Download,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const projectionData = [
  { month: "Nov", otimista: 950000, realista: 820000, pessimista: 680000 },
  { month: "Dez", otimista: 1100000, realista: 920000, pessimista: 720000 },
  { month: "Jan", otimista: 850000, realista: 750000, pessimista: 600000 },
  { month: "Fev", otimista: 880000, realista: 780000, pessimista: 620000 },
  { month: "Mar", otimista: 920000, realista: 810000, pessimista: 660000 },
];

const lucroProjection = [
  { month: "Nov", otimista: 85000, realista: 35000, pessimista: -25000 },
  { month: "Dez", otimista: 110000, realista: 52000, pessimista: -15000 },
  { month: "Jan", otimista: 72000, realista: 28000, pessimista: -35000 },
  { month: "Fev", otimista: 78000, realista: 32000, pessimista: -28000 },
  { month: "Mar", otimista: 85000, realista: 38000, pessimista: -22000 },
];

export default function Projecoes() {
  return (
    <MainLayout
      title="Projeções Financeiras"
      subtitle="Cenários e previsões baseadas no histórico"
      actions={
        <div className="flex items-center gap-2">
          <Select defaultValue="6m">
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 meses</SelectItem>
              <SelectItem value="6m">6 meses</SelectItem>
              <SelectItem value="12m">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* Cenários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Otimista */}
        <div className="p-6 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-success/10">
              <Sparkles className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Cenário Otimista</h3>
              <p className="text-sm text-muted-foreground">Melhor caso</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(projections.otimista.faturamento)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className="text-xl font-bold">{formatCurrency(projections.otimista.lucroLiquido)}</p>
            </div>
            <Badge className="bg-success/10 text-success border-success/20">
              Margem {projections.otimista.margem}%
            </Badge>
          </div>
        </div>

        {/* Realista */}
        <div className="p-6 rounded-xl bg-info/5 border border-info/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-info/10">
              <Target className="h-5 w-5 text-info" />
            </div>
            <div>
              <h3 className="font-semibold">Cenário Realista</h3>
              <p className="text-sm text-muted-foreground">Mais provável</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold text-info">{formatCurrency(projections.realista.faturamento)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className="text-xl font-bold">{formatCurrency(projections.realista.lucroLiquido)}</p>
            </div>
            <Badge className="bg-info/10 text-info border-info/20">
              Margem {projections.realista.margem}%
            </Badge>
          </div>
        </div>

        {/* Pessimista */}
        <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold">Cenário Pessimista</h3>
              <p className="text-sm text-muted-foreground">Pior caso</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(projections.pessimista.faturamento)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className="text-xl font-bold">{formatCurrency(projections.pessimista.lucroLiquido)}</p>
            </div>
            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
              Margem {projections.pessimista.margem}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projeção de Faturamento */}
        <ModuleCard
          title="Projeção de Faturamento"
          description="Próximos 5 meses"
          icon={TrendingUp}
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projectionData}>
                <defs>
                  <linearGradient id="colorOtimista" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRealista" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPessimista" x1="0" y1="0" x2="0" y2="1">
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
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="otimista"
                  name="Otimista"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOtimista)"
                />
                <Area
                  type="monotone"
                  dataKey="realista"
                  name="Realista"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRealista)"
                />
                <Area
                  type="monotone"
                  dataKey="pessimista"
                  name="Pessimista"
                  stroke="hsl(4, 86%, 55%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPessimista)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>

        {/* Projeção de Lucro */}
        <ModuleCard
          title="Projeção de Lucro"
          description="Próximos 5 meses"
          icon={LineChart}
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lucroProjection}>
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
                <Area
                  type="monotone"
                  dataKey="otimista"
                  name="Otimista"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  fillOpacity={0.3}
                  fill="hsl(142, 71%, 45%)"
                />
                <Area
                  type="monotone"
                  dataKey="realista"
                  name="Realista"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  fillOpacity={0.3}
                  fill="hsl(217, 91%, 60%)"
                />
                <Area
                  type="monotone"
                  dataKey="pessimista"
                  name="Pessimista"
                  stroke="hsl(4, 86%, 55%)"
                  strokeWidth={2}
                  fillOpacity={0.3}
                  fill="hsl(4, 86%, 55%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>
      </div>

      {/* Premissas */}
      <div className="mt-6">
        <ModuleCard title="Premissas das Projeções" description="Base de cálculo utilizada">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-success" />
                Cenário Otimista
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Crescimento de vendas de 20%
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Redução de custos de 10%
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Novos canais de venda
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Sazonalidade positiva
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-info" />
                Cenário Realista
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Crescimento de vendas de 5%
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Custos estáveis
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Mesmos canais de venda
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Sem grandes mudanças
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Cenário Pessimista
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Queda de vendas de 15%
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Aumento de custos de 5%
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Maior concorrência
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Crise econômica
                </li>
              </ul>
            </div>
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
