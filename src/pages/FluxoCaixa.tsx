import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Filter,
  X,
  CalendarRange,
  Pencil,
  Trash2,
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
} from "recharts";
import { useFluxoCaixa } from "@/hooks/useFluxoCaixa";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { MovimentacaoManualModal } from "@/components/conciliacao/MovimentacaoManualModal";
import { excluirMovimentoManual } from "@/lib/movimentos-manuais";
import { useQueryClient } from "@tanstack/react-query";

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
      return <FileText className="h-4 w-4 text-destructive" />;
    case "contas_receber":
      return <FileText className="h-4 w-4 text-success" />;
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

type TipoFiltro = "todos" | "entradas" | "saidas";
type OrigemFiltro = "todas" | "cartao" | "banco" | "contas_pagar" | "contas_receber" | "manual";
type ModoPeriodo = "mensal" | "personalizado";

export default function FluxoCaixa() {
  const queryClient = useQueryClient();
  
  // Estado dos filtros principais
  const [periodoSelecionado, setPeriodoSelecionado] = useState(format(new Date(), "yyyy-MM"));
  const [empresaSelecionada, setEmpresaSelecionada] = useState("todas");
  const [visaoAtiva, setVisaoAtiva] = useState<"diario" | "dashboard">("diario");

  // Estados de período personalizado
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>("mensal");
  const [dataInicioCustom, setDataInicioCustom] = useState<string>("");
  const [dataFimCustom, setDataFimCustom] = useState<string>("");

  // Estado dos filtros avançados
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>("todos");
  const [filtroOrigem, setFiltroOrigem] = useState<OrigemFiltro>("todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroCentroCusto, setFiltroCentroCusto] = useState<string>("todas");

  // Estado do modal de movimentação manual
  const [modalManualOpen, setModalManualOpen] = useState(false);
  const [movimentoEdicao, setMovimentoEdicao] = useState<any | null>(null);

  // Handler para excluir movimentação manual
  const handleExcluirManual = async (mov: any) => {
    const refId = mov.referenciaId || mov.referencia_id;
    if (!refId) {
      toast.error("Não foi possível identificar a movimentação");
      return;
    }
    try {
      await excluirMovimentoManual(refId);
      queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo-caixa-meu"] });
      queryClient.invalidateQueries({ queryKey: ["dre"] });
      toast.success("Movimentação excluída com sucesso");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir movimentação");
    }
  };

  // Calcular datas do período (considerando modo mensal ou personalizado)
  const { periodoInicio, periodoFim } = useMemo(() => {
    if (modoPeriodo === "personalizado" && dataInicioCustom && dataFimCustom) {
      return {
        periodoInicio: dataInicioCustom,
        periodoFim: dataFimCustom,
      };
    }
    // Modo mensal (padrão)
    const [ano, mes] = periodoSelecionado.split("-").map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    return {
      periodoInicio: format(startOfMonth(dataRef), "yyyy-MM-dd"),
      periodoFim: format(endOfMonth(dataRef), "yyyy-MM-dd"),
    };
  }, [modoPeriodo, periodoSelecionado, dataInicioCustom, dataFimCustom]);

  // Buscar dados do hook (período atual)
  const { movimentos, resumo, agregado, empresas, isLoading, hasData } = useFluxoCaixa({
    periodoInicio,
    periodoFim,
    empresaId: empresaSelecionada,
  });

  // Calcular período do mês anterior para comparativo
  const { periodoAnteriorInicio, periodoAnteriorFim, mesAnteriorLabel } = useMemo(() => {
    const [ano, mes] = periodoSelecionado.split("-").map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    const dataRefAnterior = subMonths(dataRef, 1);
    const label = format(dataRefAnterior, "MMMM yyyy", { locale: ptBR });
    return {
      periodoAnteriorInicio: format(startOfMonth(dataRefAnterior), "yyyy-MM-dd"),
      periodoAnteriorFim: format(endOfMonth(dataRefAnterior), "yyyy-MM-dd"),
      mesAnteriorLabel: label.charAt(0).toUpperCase() + label.slice(1),
    };
  }, [periodoSelecionado]);

  // Buscar dados do mês anterior para comparativo
  const { resumo: resumoAnterior, hasData: hasDataAnterior } = useFluxoCaixa({
    periodoInicio: periodoAnteriorInicio,
    periodoFim: periodoAnteriorFim,
    empresaId: empresaSelecionada,
  });

  // Label do mês atual
  const mesAtualLabel = useMemo(() => {
    const [ano, mes] = periodoSelecionado.split("-").map(Number);
    const dataRef = new Date(ano, mes - 1, 1);
    const label = format(dataRef, "MMMM yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [periodoSelecionado]);

  const opcoesPeriodo = useMemo(() => gerarOpcoesPeriodo(), []);

  // Listas para popular selects de filtro
  const categoriasDisponiveis = useMemo(() => {
    const nomes = movimentos
      .map((m) => m.categoriaNome)
      .filter((nome): nome is string => !!nome);
    return Array.from(new Set(nomes)).sort();
  }, [movimentos]);

  const centrosDisponiveis = useMemo(() => {
    const nomes = movimentos
      .map((m) => m.centroCustoNome)
      .filter((nome): nome is string => !!nome);
    return Array.from(new Set(nomes)).sort();
  }, [movimentos]);

  // Filtrar movimentos por todos os critérios
  const movimentosFiltrados = useMemo(() => {
    return movimentos.filter((m) => {
      // filtro por tipo
      if (filtroTipo === "entradas" && m.tipo !== "entrada") return false;
      if (filtroTipo === "saidas" && m.tipo !== "saida") return false;

      // filtro por origem
      if (filtroOrigem !== "todas" && m.origem !== filtroOrigem) return false;

      // filtro por categoria
      if (filtroCategoria !== "todas" && m.categoriaNome !== filtroCategoria) return false;

      // filtro por centro de custo
      if (filtroCentroCusto !== "todas" && m.centroCustoNome !== filtroCentroCusto) return false;

      return true;
    });
  }, [movimentos, filtroTipo, filtroOrigem, filtroCategoria, filtroCentroCusto]);

  const hasDataFiltrado = movimentosFiltrados.length > 0;

  // Verificar se há algum filtro ativo
  const temFiltroAtivo = filtroTipo !== "todos" || filtroOrigem !== "todas" || filtroCategoria !== "todas" || filtroCentroCusto !== "todas";

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroTipo("todos");
    setFiltroOrigem("todas");
    setFiltroCategoria("todas");
    setFiltroCentroCusto("todas");
  };

  // Exportar para Excel
  const exportarExcel = useCallback(() => {
    if (movimentosFiltrados.length === 0) {
      toast.error("Nenhum movimento para exportar");
      return;
    }

    try {
      // Preparar dados para exportação
      const dadosExport = movimentosFiltrados.map((mov) => ({
        Data: formatDateBR(mov.data),
        Tipo: mov.tipo === "entrada" ? "Entrada" : "Saída",
        Origem: getOrigemLabel(mov.origem),
        Descrição: mov.descricao,
        Categoria: mov.categoriaNome || "Não categorizado",
        "Centro de Custo": mov.centroCustoNome || "-",
        Valor: mov.tipo === "entrada" ? mov.valor : -mov.valor,
        Empresa: mov.empresaNome || "-",
      }));

      // Criar workbook e worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExport);

      // Ajustar largura das colunas
      ws["!cols"] = [
        { wch: 12 }, // Data
        { wch: 10 }, // Tipo
        { wch: 18 }, // Origem
        { wch: 40 }, // Descrição
        { wch: 25 }, // Categoria
        { wch: 20 }, // Centro de Custo
        { wch: 15 }, // Valor
        { wch: 25 }, // Empresa
      ];

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, "Movimentacoes");

      // Gerar nome do arquivo
      const nomeArquivo = `fluxo_caixa_${periodoInicio}_a_${periodoFim}.xlsx`;

      // Salvar arquivo
      XLSX.writeFile(wb, nomeArquivo);

      toast.success(`Arquivo "${nomeArquivo}" exportado com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar arquivo");
    }
  }, [movimentosFiltrados, periodoInicio, periodoFim]);

  // Resumo calculado a partir dos dados filtrados (para KPIs)
  const resumoFiltrado = useMemo(() => {
    const totalEntradas = movimentosFiltrados
      .filter((m) => m.tipo === "entrada")
      .reduce((acc, m) => acc + m.valor, 0);

    const totalSaidas = movimentosFiltrados
      .filter((m) => m.tipo === "saida")
      .reduce((acc, m) => acc + m.valor, 0);

    const saldoInicial = 0;
    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    return {
      saldoInicial,
      totalEntradas,
      totalSaidas,
      saldoFinal,
      projecao30Dias: saldoFinal, // Simplificado
    };
  }, [movimentosFiltrados]);

  // Agregados calculados a partir dos dados filtrados (para gráficos)
  const agregadoFiltrado = useMemo(() => {
    // Agrupar por dia
    const porDiaMap = new Map<string, { entradas: number; saidas: number }>();

    movimentosFiltrados.forEach((m) => {
      const existing = porDiaMap.get(m.data) || { entradas: 0, saidas: 0 };
      if (m.tipo === "entrada") {
        existing.entradas += m.valor;
      } else {
        existing.saidas += m.valor;
      }
      porDiaMap.set(m.data, existing);
    });

    let saldoAcumulado = 0;
    const porDia = Array.from(porDiaMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        const saldo = values.entradas - values.saidas;
        saldoAcumulado += saldo;
        return {
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          saldo,
          saldoAcumulado,
        };
      });

    // Agrupar por categoria (saídas)
    const porCategoriaMap = new Map<string, { tipo: string; valor: number }>();
    movimentosFiltrados
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.categoriaNome || "Não categorizado";
        const existing = porCategoriaMap.get(key) || { tipo: m.categoriaTipo || "", valor: 0 };
        existing.valor += m.valor;
        porCategoriaMap.set(key, existing);
      });

    const porCategoria = Array.from(porCategoriaMap.entries())
      .map(([categoria, { tipo, valor }]) => ({ categoria, tipo, valor }))
      .sort((a, b) => b.valor - a.valor);

    // Agrupar por centro de custo
    const porCCMap = new Map<string, number>();
    movimentosFiltrados
      .filter((m) => m.tipo === "saida")
      .forEach((m) => {
        const key = m.centroCustoNome || "Sem centro de custo";
        porCCMap.set(key, (porCCMap.get(key) || 0) + m.valor);
      });

    const porCentroCusto = Array.from(porCCMap.entries())
      .map(([centroCusto, valor]) => ({ centroCusto, valor }))
      .sort((a, b) => b.valor - a.valor);

    return {
      porDia,
      porCategoria,
      porCentroCusto,
    };
  }, [movimentosFiltrados]);

  // Dados para gráfico de evolução (usando agregadoFiltrado)
  const dadosEvolucao = useMemo(() => {
    return agregadoFiltrado.porDia.map((d) => ({
      data: formatDateBR(d.data).slice(0, 5), // DD/MM
      entradas: d.entradas,
      saidas: d.saidas,
      saldo: d.saldoAcumulado,
    }));
  }, [agregadoFiltrado.porDia]);

  // Top categorias para gráfico (usando agregadoFiltrado)
  const topCategorias = useMemo(() => {
    return agregadoFiltrado.porCategoria.slice(0, 8);
  }, [agregadoFiltrado.porCategoria]);

  // Comparativo mensal
  const comparativo = useMemo(() => {
    const calcularVariacao = (atual: number, anterior: number) => {
      const diferenca = atual - anterior;
      const variacaoPercentual = anterior === 0 ? null : (diferenca / anterior) * 100;
      return { valorAtual: atual, valorAnterior: anterior, diferenca, variacaoPercentual };
    };

    return {
      entradas: calcularVariacao(resumoFiltrado.totalEntradas, resumoAnterior?.totalEntradas || 0),
      saidas: calcularVariacao(resumoFiltrado.totalSaidas, resumoAnterior?.totalSaidas || 0),
      saldo: calcularVariacao(resumoFiltrado.saldoFinal, resumoAnterior?.saldoFinal || 0),
    };
  }, [resumoFiltrado, resumoAnterior]);

  return (
    <MainLayout
      title="Fluxo de Caixa"
      subtitle="Visão consolidada de entradas, saídas e saldo de caixa"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
          {/* Modo de período */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">Modo de período</Label>
            <RadioGroup
              className="flex items-center gap-3"
              value={modoPeriodo}
              onValueChange={(value) => setModoPeriodo(value as ModoPeriodo)}
            >
              <div className="flex items-center gap-1">
                <RadioGroupItem value="mensal" id="periodo-mensal" />
                <Label htmlFor="periodo-mensal" className="text-xs cursor-pointer">Mensal</Label>
              </div>
              <div className="flex items-center gap-1">
                <RadioGroupItem value="personalizado" id="periodo-personalizado" />
                <Label htmlFor="periodo-personalizado" className="text-xs cursor-pointer">Personalizado</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Select de Período (só faz sentido no modo mensal) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">Período</Label>
            <Select
              value={periodoSelecionado}
              onValueChange={setPeriodoSelecionado}
              disabled={modoPeriodo === "personalizado"}
            >
              <SelectTrigger className="w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {opcoesPeriodo.map((op) => (
                  <SelectItem key={op.valor} value={op.valor}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datas personalizadas */}
          {modoPeriodo === "personalizado" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted-foreground">Data inicial</Label>
                <Input
                  type="date"
                  value={dataInicioCustom}
                  onChange={(e) => setDataInicioCustom(e.target.value)}
                  className="w-[150px] h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs font-medium text-muted-foreground">Data final</Label>
                <Input
                  type="date"
                  value={dataFimCustom}
                  onChange={(e) => setDataFimCustom(e.target.value)}
                  className="w-[150px] h-9"
                />
              </div>
            </div>
          )}

          {/* Filtro de Empresa */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">Empresa</Label>
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
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground invisible">Ação</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMovimentoEdicao(null);
                  setModalManualOpen(true);
                }}
              >
                + Movimentação Manual
              </Button>
              <Button variant="outline" className="gap-2 h-9" onClick={exportarExcel}>
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {/* KPIs - usando resumoFiltrado */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <KPICard
          title="Saldo Inicial"
          value={formatCurrency(resumoFiltrado.saldoInicial)}
          icon={Wallet}
          trend="neutral"
        />
        <KPICard
          title="Total Entradas"
          value={formatCurrency(resumoFiltrado.totalEntradas)}
          icon={ArrowUpCircle}
          iconColor="text-success"
          trend="up"
        />
        <KPICard
          title="Total Saídas"
          value={formatCurrency(resumoFiltrado.totalSaidas)}
          icon={ArrowDownCircle}
          iconColor="text-destructive"
          trend="down"
        />
        <KPICard
          title="Saldo Final"
          value={formatCurrency(resumoFiltrado.saldoFinal)}
          icon={Wallet}
          trend={resumoFiltrado.saldoFinal >= 0 ? "up" : "down"}
        />
        <KPICard
          title="Projeção 30 dias"
          value={formatCurrency(resumoFiltrado.projecao30Dias)}
          changeLabel="Estimativa"
          icon={TrendingUp}
          trend={resumoFiltrado.projecao30Dias >= 0 ? "neutral" : "down"}
        />
      </div>

      {/* Tabs de Visão */}
      <Tabs value={visaoAtiva} onValueChange={(v) => setVisaoAtiva(v as any)} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
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
        </div>

        {/* Filtros Avançados */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-secondary/30 rounded-lg border">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground mr-2">Filtros:</span>

          {/* Filtro de Tipo */}
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoFiltro)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="entradas">Entradas</SelectItem>
              <SelectItem value="saidas">Saídas</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Origem */}
          <Select value={filtroOrigem} onValueChange={(v) => setFiltroOrigem(v as OrigemFiltro)}>
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              <SelectItem value="cartao">Cartão</SelectItem>
              <SelectItem value="banco">Banco</SelectItem>
              <SelectItem value="contas_pagar">Contas a Pagar</SelectItem>
              <SelectItem value="contas_receber">Contas a Receber</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro de Categoria */}
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categoriasDisponiveis.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro de Centro de Custo */}
          <Select value={filtroCentroCusto} onValueChange={setFiltroCentroCusto}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Centro de Custo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os centros</SelectItem>
              {centrosDisponiveis.map((cc) => (
                <SelectItem key={cc} value={cc}>
                  {cc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botão Limpar Filtros */}
          {temFiltroAtivo && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-8 gap-1">
              <X className="h-3 w-3" />
              Limpar filtros
            </Button>
          )}

          {/* Badge com contagem */}
          <Badge variant="secondary" className="ml-auto">
            {movimentosFiltrados.length} de {movimentos.length} movimentos
          </Badge>
        </div>

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
          ) : !hasDataFiltrado ? (
            <ModuleCard title="Nenhuma movimentação encontrada" icon={Info}>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma movimentação corresponde aos filtros selecionados.
                </p>
                <Button variant="outline" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            </ModuleCard>
          ) : (
            <ModuleCard
              title="Movimentações"
              description={`${movimentosFiltrados.length} transações no período`}
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
                    <TableHead className="w-[80px] text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentosFiltrados.map((mov) => (
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
                          {mov.origem === "contas_receber" && mov.clienteNome && (
                            <span className="text-xs text-muted-foreground">
                              Cliente: {mov.clienteNome}
                            </span>
                          )}
                          {mov.origem === "contas_pagar" && mov.fornecedorNome && (
                            <span className="text-xs text-muted-foreground">
                              Fornecedor: {mov.fornecedorNome}
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
                      <TableCell className="text-center">
                        {mov.isManual ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setMovimentoEdicao(mov);
                                setModalManualOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir movimentação manual</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Essa operação removerá a movimentação do fluxo de caixa e da DRE. Deseja continuar?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleExcluirManual(mov)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
          ) : !hasDataFiltrado ? (
            <ModuleCard title="Nenhuma movimentação encontrada" icon={Info}>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma movimentação corresponde aos filtros selecionados.
                </p>
                <Button variant="outline" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            </ModuleCard>
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
                        agregadoFiltrado.porDia.length > 0
                          ? resumoFiltrado.totalSaidas / agregadoFiltrado.porDia.length
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
                          {formatCurrency(resumoFiltrado.totalEntradas)}
                        </p>
                        <p className="text-xs text-muted-foreground">Entradas</p>
                      </div>
                      <div className="text-muted-foreground">/</div>
                      <div>
                        <p className="text-lg font-bold text-destructive">
                          {formatCurrency(resumoFiltrado.totalSaidas)}
                        </p>
                        <p className="text-xs text-muted-foreground">Saídas</p>
                      </div>
                    </div>
                    <p className="text-sm mt-2">
                      <span
                        className={
                          resumoFiltrado.totalEntradas >= resumoFiltrado.totalSaidas
                            ? "text-success"
                            : "text-destructive"
                        }
                      >
                        {resumoFiltrado.totalEntradas >= resumoFiltrado.totalSaidas ? "Superávit" : "Déficit"}:{" "}
                        {formatCurrency(Math.abs(resumoFiltrado.totalEntradas - resumoFiltrado.totalSaidas))}
                      </span>
                    </p>
                  </div>
                </ModuleCard>

                {/* Runway estimado */}
                <ModuleCard title="Runway Estimado" className="text-center">
                  <div className="py-4">
                    {resumoFiltrado.totalSaidas > 0 && agregadoFiltrado.porDia.length > 0 ? (
                      <>
                        <p className="text-3xl font-bold">
                          {Math.max(
                            0,
                            Math.round(
                              resumoFiltrado.saldoFinal /
                                (resumoFiltrado.totalSaidas / agregadoFiltrado.porDia.length)
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
              {/* Comparativo Mensal */}
              <ModuleCard
                title="Comparativo Mensal"
                description={`Comparando ${mesAtualLabel} x ${mesAnteriorLabel}`}
                icon={TrendingUp}
              >
                {!hasDataAnterior ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      Sem dados para o mês anterior para comparar.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/30">
                        <TableHead>Métrica</TableHead>
                        <TableHead className="text-right">{mesAtualLabel}</TableHead>
                        <TableHead className="text-right">{mesAnteriorLabel}</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Entradas */}
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4 text-success" />
                            Entradas
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-success font-medium">
                          {formatCurrency(comparativo.entradas.valorAtual)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(comparativo.entradas.valorAnterior)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-medium ${comparativo.entradas.diferenca >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {comparativo.entradas.diferenca >= 0 ? "+" : ""}{formatCurrency(comparativo.entradas.diferenca)}
                            {comparativo.entradas.variacaoPercentual !== null && (
                              <span className="text-xs ml-1">
                                ({comparativo.entradas.variacaoPercentual >= 0 ? "+" : ""}{comparativo.entradas.variacaoPercentual.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Saídas */}
                      <TableRow>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4 text-destructive" />
                            Saídas
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-destructive font-medium">
                          {formatCurrency(comparativo.saidas.valorAtual)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(comparativo.saidas.valorAnterior)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-medium ${comparativo.saidas.diferenca <= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {comparativo.saidas.diferenca >= 0 ? "+" : ""}{formatCurrency(comparativo.saidas.diferenca)}
                            {comparativo.saidas.variacaoPercentual !== null && (
                              <span className="text-xs ml-1">
                                ({comparativo.saidas.variacaoPercentual >= 0 ? "+" : ""}{comparativo.saidas.variacaoPercentual.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Saldo */}
                      <TableRow className="bg-secondary/20">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Saldo Final
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${comparativo.saldo.valorAtual >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(comparativo.saldo.valorAtual)}
                        </TableCell>
                        <TableCell className={`text-right text-muted-foreground`}>
                          {formatCurrency(comparativo.saldo.valorAnterior)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-bold ${comparativo.saldo.diferenca >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {comparativo.saldo.diferenca >= 0 ? "+" : ""}{formatCurrency(comparativo.saldo.diferenca)}
                            {comparativo.saldo.variacaoPercentual !== null && (
                              <span className="text-xs ml-1">
                                ({comparativo.saldo.variacaoPercentual >= 0 ? "+" : ""}{comparativo.saldo.variacaoPercentual.toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </ModuleCard>
            </>
          )}
        </TabsContent>
      </Tabs>

      <MovimentacaoManualModal
        open={modalManualOpen}
        onOpenChange={setModalManualOpen}
        movimento={movimentoEdicao}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["movimentos_financeiros"] });
          queryClient.invalidateQueries({ queryKey: ["fluxo-caixa-meu"] });
          queryClient.invalidateQueries({ queryKey: ["dre"] });
        }}
      />
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
