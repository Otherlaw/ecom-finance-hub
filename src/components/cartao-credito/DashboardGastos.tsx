import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, TrendingUp, TrendingDown, CreditCard, Tags, Building2 } from "lucide-react";
import { useTransacoes } from "@/hooks/useCartoes";
import { useMemo } from "react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 50%)",
  "hsl(280, 70%, 50%)",
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function DashboardGastos() {
  const { transacoes, isLoading } = useTransacoes();

  const { dadosPorCategoria, dadosPorCentro, dadosPorResponsavel, topTransacoes, totais } = useMemo(() => {
    if (!transacoes || transacoes.length === 0) {
      return {
        dadosPorCategoria: [],
        dadosPorCentro: [],
        dadosPorResponsavel: [],
        topTransacoes: [],
        totais: { total: 0, categorizadas: 0, pendentes: 0 },
      };
    }

    // Agregar por categoria
    const categoriaMap = new Map<string, { nome: string; valor: number; count: number }>();
    transacoes.forEach((t: any) => {
      const catNome = t.categoria?.nome || "Sem categoria";
      const existing = categoriaMap.get(catNome) || { nome: catNome, valor: 0, count: 0 };
      existing.valor += Number(t.valor) || 0;
      existing.count += 1;
      categoriaMap.set(catNome, existing);
    });

    // Agregar por centro de custo
    const centroMap = new Map<string, { nome: string; valor: number; count: number }>();
    transacoes.forEach((t: any) => {
      const centroNome = t.centro_custo?.nome || "Sem centro de custo";
      const existing = centroMap.get(centroNome) || { nome: centroNome, valor: 0, count: 0 };
      existing.valor += Number(t.valor) || 0;
      existing.count += 1;
      centroMap.set(centroNome, existing);
    });

    // Agregar por responsável
    const respMap = new Map<string, { nome: string; valor: number; count: number }>();
    transacoes.forEach((t: any) => {
      const respNome = t.responsavel?.nome || "Sem responsável";
      const existing = respMap.get(respNome) || { nome: respNome, valor: 0, count: 0 };
      existing.valor += Number(t.valor) || 0;
      existing.count += 1;
      respMap.set(respNome, existing);
    });

    // Calcular totais
    const total = transacoes.reduce((sum: number, t: any) => sum + (Number(t.valor) || 0), 0);
    const categorizadas = transacoes.filter((t: any) => t.categoria_id).length;
    const pendentes = transacoes.length - categorizadas;

    return {
      dadosPorCategoria: Array.from(categoriaMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      dadosPorCentro: Array.from(centroMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      dadosPorResponsavel: Array.from(respMap.values())
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
      topTransacoes: [...transacoes]
        .sort((a: any, b: any) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
        .slice(0, 10),
      totais: { total, categorizadas, pendentes },
    };
  }, [transacoes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!transacoes || transacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Sem dados para exibir</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Cadastre faturas e transações para visualizar o dashboard de gastos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Gastos</p>
                <p className="text-2xl font-bold">{formatCurrency(totais.total)}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transações</p>
                <p className="text-2xl font-bold">{transacoes.length}</p>
              </div>
              <div className="p-3 rounded-full bg-chart-1/10">
                <TrendingUp className="h-5 w-5 text-chart-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categorizadas</p>
                <p className="text-2xl font-bold text-green-600">{totais.categorizadas}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <Tags className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{totais.pendentes}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Gastos por Categoria
            </CardTitle>
            <CardDescription>Distribuição dos gastos por categoria financeira</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosPorCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosPorCategoria}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nome, percent }) => {
                      const label = String(nome || 'Sem categoria');
                      return `${label.substring(0, 15)}${label.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)`;
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                    nameKey="nome"
                  >
                    {dadosPorCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Categoria: ${label}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma categoria definida</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Gastos por Centro de Custo
            </CardTitle>
            <CardDescription>Comparação de gastos entre centros de custo</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosPorCentro.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosPorCentro}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="nome" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.substring(0, 10) + (value.length > 10 ? '...' : '')}
                  />
                  <YAxis tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Centro: ${label}`}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum centro de custo definido</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos por Responsável</CardTitle>
            <CardDescription>Análise de gastos por pessoa</CardDescription>
          </CardHeader>
          <CardContent>
            {dadosPorResponsavel.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosPorResponsavel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                  <YAxis 
                    dataKey="nome" 
                    type="category" 
                    width={100}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.substring(0, 12) + (value.length > 12 ? '...' : '')}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Responsável: ${label}`}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum responsável definido</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maiores Gastos</CardTitle>
            <CardDescription>Top 10 transações com maior valor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {topTransacoes.length > 0 ? (
                topTransacoes.map((t: any, index: number) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">
                          {t.descricao || t.estabelecimento || "Sem descrição"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.categoria?.nome || "Sem categoria"} • {t.centro_custo?.nome || "Sem CC"}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(Number(t.valor) || 0)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma transação cadastrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
