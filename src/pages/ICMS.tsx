import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { icmsData, formatCurrency } from "@/lib/mock-data";
import {
  Receipt,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  Upload,
  Plus,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export default function ICMS() {
  const saldoNegativo = icmsData.saldoProjetado < 0;

  return (
    <MainLayout
      title="Controle de Crédito de ICMS"
      subtitle="Gestão de créditos e débitos fiscais"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar NFs
          </Button>
          <Button className="gap-2">
            <Calculator className="h-4 w-4" />
            Calcular ICMS
          </Button>
        </div>
      }
    >
      {/* Alerta de Saldo Negativo */}
      {saldoNegativo && (
        <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-warning/20">
            <AlertTriangle className="h-6 w-6 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-warning">Atenção: Saldo de ICMS Negativo</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Você precisa adquirir notas fiscais com crédito de ICMS para compensar o saldo negativo.
              Recomendação: comprar {formatCurrency(icmsData.notasNecessarias)} em mercadorias para zerar o ICMS.
            </p>
          </div>
          <Button variant="outline" className="border-warning text-warning hover:bg-warning/10">
            Ver Recomendação
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Crédito Disponível"
          value={formatCurrency(icmsData.creditoDisponivel)}
          icon={TrendingUp}
          iconColor="text-success"
          trend="up"
        />
        <KPICard
          title="ICMS Devido"
          value={formatCurrency(icmsData.icmsDevido)}
          icon={TrendingDown}
          iconColor="text-destructive"
          trend="down"
        />
        <KPICard
          title="Saldo Projetado"
          value={formatCurrency(icmsData.saldoProjetado)}
          icon={Receipt}
          trend={icmsData.saldoProjetado >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Compras Necessárias"
          value={formatCurrency(icmsData.notasNecessarias)}
          changeLabel="Para zerar ICMS"
          icon={Calculator}
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Evolução */}
        <ModuleCard
          title="Evolução do Saldo de ICMS"
          description="Últimos 6 meses"
          icon={Receipt}
          className="lg:col-span-2"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={icmsData.historico}>
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
                <Bar dataKey="credito" name="Crédito" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="debito" name="Débito" fill="hsl(4, 86%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ModuleCard>

        {/* Calculadora de ICMS */}
        <ModuleCard title="Calculadora" description="Simule compras">
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-sm text-muted-foreground mb-2">Saldo Atual</p>
              <p className={`text-2xl font-bold ${saldoNegativo ? "text-destructive" : "text-success"}`}>
                {formatCurrency(icmsData.saldoProjetado)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Para zerar o ICMS:</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor em compras</span>
                  <span className="font-medium">{formatCurrency(icmsData.notasNecessarias)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Alíquota média</span>
                  <span className="font-medium">8%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Crédito gerado</span>
                  <span className="font-medium text-success">{formatCurrency(Math.abs(icmsData.saldoProjetado))}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">Progresso do mês</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Crédito acumulado</span>
                  <span>{((icmsData.creditoDisponivel / icmsData.icmsDevido) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={(icmsData.creditoDisponivel / icmsData.icmsDevido) * 100} className="h-2" />
              </div>
            </div>

            <Button className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Simular Compra
            </Button>
          </div>
        </ModuleCard>
      </div>

      {/* Histórico */}
      <div className="mt-6">
        <ModuleCard
          title="Histórico de ICMS"
          description="Créditos e débitos por período"
          icon={FileText}
          noPadding
          actions={
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          }
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Débito</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {icmsData.historico.map((item) => (
                <TableRow key={item.month}>
                  <TableCell className="font-medium">{item.month}/2024</TableCell>
                  <TableCell className="text-right text-success">+{formatCurrency(item.credito)}</TableCell>
                  <TableCell className="text-right text-destructive">-{formatCurrency(item.debito)}</TableCell>
                  <TableCell className={`text-right font-medium ${item.saldo >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(item.saldo)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.saldo >= 0 ? (
                      <Badge className="bg-success/10 text-success border-success/20">Compensado</Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20">A pagar</Badge>
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
