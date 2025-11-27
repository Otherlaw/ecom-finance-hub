import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  Product,
  ProductSalesHistory,
  ABCItem,
  calculateABCCurve,
  formatCurrency,
  formatNumber,
  formatPercentage,
  CANAIS_VENDA,
  EMPRESAS,
  TriangulationAlert,
  validateTriangulation,
  ProductPurchaseHistory,
} from "@/lib/products-data";

interface ABCCurveAnalysisProps {
  products: Product[];
  salesHistory: ProductSalesHistory[];
  purchaseHistory: ProductPurchaseHistory[];
}

export function ABCCurveAnalysis({
  products,
  salesHistory,
  purchaseHistory,
}: ABCCurveAnalysisProps) {
  const [empresa, setEmpresa] = useState<string>("todos");
  const [canal, setCanal] = useState<string>("todos");

  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      if (canal !== "todos" && sale.canal !== canal) return false;
      return true;
    });
  }, [salesHistory, canal]);

  const abcData = useMemo(() => {
    return calculateABCCurve(products, filteredSales);
  }, [products, filteredSales]);

  const triangulationAlerts = useMemo(() => {
    return validateTriangulation(products, filteredSales, purchaseHistory);
  }, [products, filteredSales, purchaseHistory]);

  const categoryStats = useMemo(() => {
    const stats = { A: 0, B: 0, C: 0 };
    const revenue = { A: 0, B: 0, C: 0 };
    abcData.forEach((item) => {
      stats[item.categoriaABC]++;
      revenue[item.categoriaABC] += item.faturamento;
    });
    return { stats, revenue };
  }, [abcData]);

  const chartData = useMemo(() => {
    return abcData.slice(0, 10).map((item) => ({
      name: item.produto.nome.substring(0, 20) + (item.produto.nome.length > 20 ? "..." : ""),
      faturamento: item.faturamento,
      categoria: item.categoriaABC,
    }));
  }, [abcData]);

  const pieData = [
    { name: "Categoria A", value: categoryStats.revenue.A, fill: "hsl(var(--success))" },
    { name: "Categoria B", value: categoryStats.revenue.B, fill: "hsl(var(--warning))" },
    { name: "Categoria C", value: categoryStats.revenue.C, fill: "hsl(var(--muted))" },
  ];

  const getCategoryColor = (cat: 'A' | 'B' | 'C') => {
    switch (cat) {
      case 'A': return "bg-success/10 text-success";
      case 'B': return "bg-warning/10 text-warning";
      case 'C': return "bg-muted text-muted-foreground";
    }
  };

  const getBarColor = (categoria: string) => {
    switch (categoria) {
      case 'A': return "hsl(var(--success))";
      case 'B': return "hsl(var(--warning))";
      default: return "hsl(var(--muted))";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Empresa:</span>
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {EMPRESAS.map((emp) => (
                <SelectItem key={emp} value={emp}>{emp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Canal:</span>
          <Select value={canal} onValueChange={setCanal}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {CANAIS_VENDA.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">{categoryStats.stats.A}</div>
                <div className="text-sm text-muted-foreground">
                  Categoria A ({formatPercentage((categoryStats.stats.A / abcData.length) * 100 || 0)})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">{categoryStats.stats.B}</div>
                <div className="text-sm text-muted-foreground">
                  Categoria B ({formatPercentage((categoryStats.stats.B / abcData.length) * 100 || 0)})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{categoryStats.stats.C}</div>
                <div className="text-sm text-muted-foreground">
                  Categoria C ({formatPercentage((categoryStats.stats.C / abcData.length) * 100 || 0)})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold">{triangulationAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Alertas de Triangulação</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Produtos por Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar dataKey="faturamento" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.categoria)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Categoria ABC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Triangulation Alerts */}
      {triangulationAlerts.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas de Triangulação (Compras x Vendas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {triangulationAlerts.slice(0, 5).map((alert, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    alert.tipo === 'error' ? 'bg-destructive/5 border-destructive/30' :
                    alert.tipo === 'warning' ? 'bg-warning/5 border-warning/30' :
                    'bg-info/5 border-info/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={
                      alert.tipo === 'error' ? 'bg-destructive/10 text-destructive' :
                      alert.tipo === 'warning' ? 'bg-warning/10 text-warning' :
                      'bg-info/10 text-info'
                    }>
                      {alert.tipo === 'error' ? 'Erro' : alert.tipo === 'warning' ? 'Atenção' : 'Info'}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium">{alert.mensagem}</div>
                      <div className="text-sm text-muted-foreground mt-1">{alert.detalhes}</div>
                      {alert.impacto && (
                        <div className="text-sm mt-1">
                          Impacto estimado: <span className="font-medium text-destructive">{formatCurrency(alert.impacto)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABC Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análise Detalhada - Curva ABC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qtd Vendida</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">% Fat.</TableHead>
                  <TableHead className="text-right">% Acum.</TableHead>
                  <TableHead className="text-center">ABC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abcData.map((item, index) => (
                  <TableRow key={item.produto.id}>
                    <TableCell className="font-mono text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium max-w-48 truncate">{item.produto.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{item.produto.codigoInterno}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.quantidade)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.faturamento)}</TableCell>
                    <TableCell className="text-right">{formatPercentage(item.percentualFaturamento)}</TableCell>
                    <TableCell className="text-right">{formatPercentage(item.percentualAcumulado)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={getCategoryColor(item.categoriaABC)}>
                        {item.categoriaABC}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
