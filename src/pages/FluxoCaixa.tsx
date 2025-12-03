import { useState, useMemo } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/mock-data";
import {
  Wallet,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  Calendar,
  Building2,
  CreditCard,
  Banknote,
  FileText,
  LayoutDashboard,
  List,
  Info,
  ArrowRight,
} from "lucide-react";
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { useFluxoCaixa, MovimentoCaixa } from "@/hooks/useFluxoCaixa";
import { format, startOfMonth, endOfMonth, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Cores para gráficos
const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(4, 86%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 75%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
];

// Helper para formatar data BR
const formatDateBR = (dateStr: string) => {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

// Gerar opções de período (últimos 12 meses)
const gerarOpcoesPeriodo = () => {
  const opcoes = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const data = subMonths(hoje, i);
    const valor = format(data, "yyyy-MM");
    const label = format(data, "MMMM yyyy", { locale: ptBR });
    opcoes.push({ valor, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return opcoes;
};

// Ícone por origem
const getOrigemIcon = (origem: string) => {
  switch (origem) {
    case "cartao":
      return <CreditCard className="h-4 w-4" />;
    case "banco":
      return <Banknote className="h-4 w-4" />;
    case "contas_pagar":
    case "contas_receber":
      return <FileText className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

// Label por origem
const getOrigemLabel = (origem: string) => {
  switch (origem) {
    case "cartao":
      return "Cartão";
    case "banco":
      return "Banco";
    case "contas_pagar":
      return "Contas a Pagar";
    case "contas_receber":
      return "Contas a Receber";
    default:
      return "Manual";
  }
};

export default function FluxoCaixa() {
  // Estado dos filtros
  const [periodoSelecionado, setPeriodoSelecionado] = useState(format(new Date(), "yyyy-MM"));
  const [empresaSelecionada, setEmpresaSelecionada] = useState("todas");
  const [visaoAtiva, setVisaoAtiva] = useState<"diario" | "dashboard">("diario");

  // Calcular datas do período
  const { periodoInicio, periodoFim } = useMemo(() => {
    const [ano, mes] = periodoSelecionado.split("-").map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    return {
      periodoInicio: format(startOfMonth(dataRef), "yyyy-MM-dd"),
      periodoFim: format(endOfMonth(dataRef), "yyyy-MM-dd"),
    };
  }, [periodoSelecionado]);

  // Buscar dados
  const { movimentos, resumo, agregado, empresas, isLoading, hasData } = useFluxoCaixa({
    periodoInicio,
    periodoFim,
    empresaId: empresaSelecionada,
  });

  const opcoesPeriodo = useMemo(() => gerarOpcoesPeriodo(), []);

  // Dados para gráfico de evolução
  const dadosEvolucao = useMemo(() => {
    return agregado.porDia.map((d) => ({
      data: formatDateBR(d.data).slice(0, 5), // DD/MM
      entradas: d.entradas,
      saidas: d.saidas,
      saldo: d.saldoAcumulado,
    }));
  }, [agregado.porDia]);

  // Top categorias para gráfico
  const topCategorias = useMemo(() => {
    return agregado.porCategoria.slice(0, 8);
  }, [agregado.porCategoria]);

  return (
    <MainLayout
      title="Fluxo de Caixa"
      subtitle="Visão consolidada de entradas, saídas e saldo de caixa"
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro de Período */}
          <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoesPeriodo.map((op) => (
                <SelectItem key={op.valor} value={op.valor}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Empresa */}
          <Select value={empresaSelecionada} onValueChange={setEmpresaSelecionada}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas?.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nome_fantasia || emp.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Exportar */}
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* KPIs - sempre visíveis */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Saldo Inicial"
          value={formatCurrency(resumo.saldoInicial)}
          icon={Wallet}
          trend="neutral"
        />
        <KPICard
          title="Total Entradas"
          value={formatCurrency(resumo.totalEntradas)}
          icon={ArrowUpCircle}
          iconColor="text-success"
          trend="up"
        />
        <KPICard
          title="Total Saídas"
          value={formatCurrency(resumo.totalSaidas)}
          icon={ArrowDownCircle}
          iconColor="text-destructive"
          trend="down"
        />
        <KPICard
          title="Saldo Final"
          value={formatCurrency(resumo.saldoFinal)}
          icon={Wallet}
          trend={resumo.saldoFinal >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Projeção 30 dias"
          value={formatCurrency(resumo.projecao30Dias)}
          changeLabel="Estimativa"
          icon={TrendingUp}
          trend={resumo.projecao30Dias >= 0 ? "neutral" : "down"}
        />
      </div>

      {/* Tabs de Visão */}
      <Tabs value={visaoAtiva} onValueChange={(v) => setVisaoAtiva(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="diario" className="gap-2">
            <List className="h-4 w-4" />
            Visão Diária
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* VISÃO DIÁRIA */}
        <TabsContent value="diario" className="space-y-4">
          {isLoading ? (
            <ModuleCard title="Carregando..." icon={Wallet}>
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            </ModuleCard>
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <ModuleCard
              title="Movimentações"
              description={`${movimentos.length} transações no período`}
              icon={Wallet}
              noPadding
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead className="w-[80px]">Tipo</TableHead>
                    <TableHead className="w-[100px]">Origem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="font-medium">
                        {formatDateBR(mov.data)}
                      </TableCell>
                      <TableCell>
                        {mov.tipo === "entrada" ? (
                          <Badge className="bg-success/10 text-success border-success/20">
                            Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getOrigemIcon(mov.origem)}
                          <span className="text-sm">{getOrigemLabel(mov.origem)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{mov.descricao}</span>
                          {mov.cartaoNome && (
                            <span className="text-xs text-muted-foreground">
                              {mov.cartaoNome}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {mov.categoriaNome ? (
                          <Badge variant="outline">{mov.categoriaNome}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Não categorizado
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mov.centroCustoNome || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          mov.tipo === "entrada" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {mov.tipo === "entrada" ? "+" : "-"}{" "}
                        {formatCurrency(mov.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModuleCard>
          )}
        </TabsContent>

        {/* VISÃO DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          {isLoading ? (
            <ModuleCard title="Carregando..." icon={LayoutDashboard}>
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            </ModuleCard>
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <>
              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Evolução do Saldo */}
                <ModuleCard
                  title="Evolução do Saldo"
                  description="Saldo acumulado no período"
                  icon={TrendingUp}
                  className="lg:col-span-2"
                >
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dadosEvolucao}>
                        <defs>
                          <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                        <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                        <Area
                          type="monotone"
                          dataKey="saldo"
                          stroke="hsl(217, 91%, 60%)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorSaldo)"
                          name="Saldo"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ModuleCard>

                {/* Saídas por Categoria */}
                <ModuleCard title="Saídas por Categoria" description="Top categorias do mês">
                  <div className="space-y-3">
                    {topCategorias.length === 0 ? (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        Nenhuma saída categorizada
                      </p>
                    ) : (
                      topCategorias.map((item, index) => {
                        const total = topCategorias.reduce((acc, c) => acc + c.valor, 0);
                        const percent = total > 0 ? (item.valor / total) * 100 : 0;
                        return (
                          <div key={item.categoria} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <span className="truncate max-w-[120px]">{item.categoria}</span>
                              </div>
                              <span className="font-medium">{formatCurrency(item.valor)}</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ModuleCard>
              </div>

              {/* Indicadores adicionais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Queima média diária */}
                <ModuleCard title="Queima Média Diária" className="text-center">
                  <div className="py-4">
                    <p className="text-3xl font-bold text-destructive">
                      {formatCurrency(
                        agregado.porDia.length > 0
                          ? resumo.totalSaidas / agregado.porDia.length
                          : 0
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Média de saídas por dia útil
                    </p>
                  </div>
                </ModuleCard>

                {/* Entradas vs Saídas */}
                <ModuleCard title="Entradas vs Saídas" className="text-center">
                  <div className="py-4">
                    <div className="flex items-center justify-center gap-4">
                      <div>
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(resumo.totalEntradas)}
                        </p>
                        <p className="text-xs text-muted-foreground">Entradas</p>
                      </div>
                      <div className="text-muted-foreground">/</div>
                      <div>
                        <p className="text-lg font-bold text-destructive">
                          {formatCurrency(resumo.totalSaidas)}
                        </p>
                        <p className="text-xs text-muted-foreground">Saídas</p>
                      </div>
                    </div>
                    <p className="text-sm mt-2">
                      <span
                        className={
                          resumo.totalEntradas >= resumo.totalSaidas
                            ? "text-success"
                            : "text-destructive"
                        }
                      >
                        {resumo.totalEntradas >= resumo.totalSaidas ? "Superávit" : "Déficit"}:{" "}
                        {formatCurrency(Math.abs(resumo.totalEntradas - resumo.totalSaidas))}
                      </span>
                    </p>
                  </div>
                </ModuleCard>

                {/* Runway estimado */}
                <ModuleCard title="Runway Estimado" className="text-center">
                  <div className="py-4">
                    {resumo.totalSaidas > 0 && agregado.porDia.length > 0 ? (
                      <>
                        <p className="text-3xl font-bold">
                          {Math.max(
                            0,
                            Math.round(
                              resumo.saldoFinal /
                                (resumo.totalSaidas / agregado.porDia.length)
                            )
                          )}{" "}
                          dias
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Se mantiver o ritmo atual
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Sem dados suficientes</p>
                    )}
                  </div>
                </ModuleCard>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}

// Componente Empty State
function EmptyState() {
  return (
    <ModuleCard title="Sem dados reais neste período" icon={Info}>
      <Alert className="border-blue-200 bg-blue-50/50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Como alimentar o Fluxo de Caixa?</AlertTitle>
        <AlertDescription className="text-blue-700 mt-2">
          <p className="mb-3">
            O Fluxo de Caixa é calculado automaticamente a partir das transações categorizadas.
            Siga estes passos:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>
              <strong>Importar faturas de cartão:</strong> Vá em{" "}
              <Link to="/cartao-credito" className="text-primary hover:underline inline-flex items-center gap-1">
                Cartões de Crédito <ArrowRight className="h-3 w-3" />
              </Link>
              {" "}e importe arquivos OFX
            </li>
            <li>
              <strong>Categorizar transações:</strong> Acesse{" "}
              <Link to="/conciliacao" className="text-primary hover:underline inline-flex items-center gap-1">
                Conciliações → Cartões <ArrowRight className="h-3 w-3" />
              </Link>
              {" "}e categorize cada transação
            </li>
            <li>
              <strong>Adicionar despesas:</strong> Registre títulos em{" "}
              <Link to="/contas-pagar" className="text-primary hover:underline inline-flex items-center gap-1">
                Contas a Pagar <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          </ol>
          <p className="mt-3 text-sm">
            Transações com status <strong>"Conciliado"</strong> aparecerão automaticamente aqui.
          </p>
        </AlertDescription>
      </Alert>
    </ModuleCard>
  );
}
