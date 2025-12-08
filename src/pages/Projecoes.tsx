import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjecoesData } from "@/hooks/useProjecoesData";
import {
  LineChart,
  Download,
  TrendingUp,
  Target,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Info,
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function Projecoes() {
  const [mesesProjecao, setMesesProjecao] = useState(6);
  
  const {
    isLoading,
    hasData,
    cenarios,
    projecaoFaturamento,
    projecaoLucro,
  } = useProjecoesData(mesesProjecao);

  return (
    <MainLayout
      title="Projeções Financeiras"
      subtitle="Cenários e previsões baseadas no histórico real"
      actions={
        <div className="flex items-center gap-2">
          <Select 
            value={String(mesesProjecao)} 
            onValueChange={(v) => setMesesProjecao(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* Aviso se não houver dados */}
      {!isLoading && !hasData && (
        <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">Dados históricos insuficientes</p>
            <p className="text-sm text-muted-foreground">
              As projeções são calculadas com base nos movimentos financeiros dos últimos 6 meses. 
              Categorize mais transações em Conciliações para gerar projeções mais precisas.
            </p>
          </div>
        </div>
      )}

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
              <p className="text-sm text-muted-foreground">+20% vendas, -10% custos</p>
            </div>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Projetado</p>
                  <p className="text-2xl font-bold text-success">
                    {formatCurrency(cenarios.otimista.faturamento)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(cenarios.otimista.lucroLiquido)}
                  </p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">
                  Margem {cenarios.otimista.margem}%
                </Badge>
              </>
            )}
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
              <p className="text-sm text-muted-foreground">+5% vendas, custos estáveis</p>
            </div>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Projetado</p>
                  <p className="text-2xl font-bold text-info">
                    {formatCurrency(cenarios.realista.faturamento)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(cenarios.realista.lucroLiquido)}
                  </p>
                </div>
                <Badge className="bg-info/10 text-info border-info/20">
                  Margem {cenarios.realista.margem}%
                </Badge>
              </>
            )}
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
              <p className="text-sm text-muted-foreground">-15% vendas, +5% custos</p>
            </div>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-6 w-24" />
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Projetado</p>
                  <p className="text-2xl font-bold text-destructive">
                    {formatCurrency(cenarios.pessimista.faturamento)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(cenarios.pessimista.lucroLiquido)}
                  </p>
                </div>
                <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                  Margem {cenarios.pessimista.margem}%
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projeção de Faturamento */}
        <ModuleCard
          title="Projeção de Faturamento"
          description={`Próximos ${mesesProjecao} meses`}
          icon={TrendingUp}
        >
          <div className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projecaoFaturamento}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
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
            )}
          </div>
        </ModuleCard>

        {/* Projeção de Lucro */}
        <ModuleCard
          title="Projeção de Lucro"
          description={`Próximos ${mesesProjecao} meses`}
          icon={LineChart}
        >
          <div className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projecaoLucro}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
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
            )}
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
