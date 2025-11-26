import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cashFlowData, formatCurrency } from "@/lib/mock-data";
import { Wallet, Download, ArrowUpCircle, ArrowDownCircle, TrendingUp, Calendar, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const detailedCashFlow = [
  { data: "01/10", descricao: "Repasse Mercado Livre", tipo: "entrada", valor: 125000, categoria: "Vendas" },
  { data: "03/10", descricao: "Pagamento Fornecedor A", tipo: "saida", valor: 45000, categoria: "Fornecedores" },
  { data: "05/10", descricao: "Repasse Shopee", tipo: "entrada", valor: 38000, categoria: "Vendas" },
  { data: "08/10", descricao: "Taxas Marketplace", tipo: "saida", valor: 28000, categoria: "Taxas" },
  { data: "10/10", descricao: "Folha de Pagamento", tipo: "saida", valor: 35000, categoria: "Pessoal" },
  { data: "12/10", descricao: "Repasse Mercado Livre", tipo: "entrada", valor: 98000, categoria: "Vendas" },
  { data: "15/10", descricao: "Aluguel + IPTU", tipo: "saida", valor: 12000, categoria: "Administrativo" },
  { data: "18/10", descricao: "Compra Estoque", tipo: "saida", valor: 85000, categoria: "Estoque" },
  { data: "20/10", descricao: "Repasse Mercado Livre", tipo: "entrada", valor: 112000, categoria: "Vendas" },
  { data: "22/10", descricao: "Marketing Digital", tipo: "saida", valor: 25000, categoria: "Marketing" },
  { data: "25/10", descricao: "Frete e Logística", tipo: "saida", valor: 42000, categoria: "Logística" },
  { data: "28/10", descricao: "Repasse Shopee", tipo: "entrada", valor: 45000, categoria: "Vendas" },
];

// Calcular totais
const totalEntradas = detailedCashFlow.filter(item => item.tipo === "entrada").reduce((acc, item) => acc + item.valor, 0);
const totalSaidas = detailedCashFlow.filter(item => item.tipo === "saida").reduce((acc, item) => acc + item.valor, 0);
const saldoPeriodo = totalEntradas - totalSaidas;

export default function FluxoCaixa() {
  return (
    <MainLayout
      title="Fluxo de Caixa"
      subtitle="Controle de entradas e saídas"
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
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Movimentação
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Total Entradas"
          value={formatCurrency(totalEntradas)}
          icon={ArrowUpCircle}
          iconColor="text-success"
          trend="up"
        />
        <KPICard
          title="Total Saídas"
          value={formatCurrency(totalSaidas)}
          icon={ArrowDownCircle}
          iconColor="text-destructive"
          trend="down"
        />
        <KPICard
          title="Saldo do Período"
          value={formatCurrency(saldoPeriodo)}
          icon={Wallet}
          trend={saldoPeriodo >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Saldo Projetado"
          value={formatCurrency(125000)}
          changeLabel="Fim do mês"
          icon={TrendingUp}
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Evolução */}
        <ModuleCard
          title="Evolução do Saldo"
          description="Últimos 6 meses"
          icon={TrendingUp}
          className="lg:col-span-2"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
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
                <ReferenceLine y={0} stroke="hsl(4, 86%, 55%)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSaldo)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>

        {/* Resumo por Categoria */}
        <ModuleCard title="Por Categoria" description="Saídas do mês">
          <div className="space-y-4">
            {[
              { categoria: "Estoque", valor: 85000, cor: "bg-chart-1" },
              { categoria: "Fornecedores", valor: 45000, cor: "bg-chart-2" },
              { categoria: "Logística", valor: 42000, cor: "bg-chart-3" },
              { categoria: "Pessoal", valor: 35000, cor: "bg-chart-4" },
              { categoria: "Taxas", valor: 28000, cor: "bg-chart-5" },
              { categoria: "Marketing", valor: 25000, cor: "bg-chart-6" },
            ].map((item) => (
              <div key={item.categoria} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.cor}`} />
                  <span className="text-sm">{item.categoria}</span>
                </div>
                <span className="text-sm font-medium">{formatCurrency(item.valor)}</span>
              </div>
            ))}
          </div>
        </ModuleCard>
      </div>

      {/* Tabela de Movimentações */}
      <div className="mt-6">
        <ModuleCard
          title="Movimentações"
          description="Detalhamento do período"
          icon={Wallet}
          noPadding
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailedCashFlow.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.data}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.categoria}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${item.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {item.tipo === "entrada" ? "+" : "-"} {formatCurrency(item.valor)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.tipo === "entrada" ? (
                      <Badge className="bg-success/10 text-success border-success/20">Entrada</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20">Saída</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
