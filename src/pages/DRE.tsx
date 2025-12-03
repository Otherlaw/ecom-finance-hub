import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDREData, usePeridosDisponiveis } from "@/hooks/useDREData";
import { dreData as mockDreData, formatCurrency } from "@/lib/mock-data";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronDown,
  Database,
  AlertCircle,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DRELineProps {
  label: string;
  value: number;
  receitaBase: number;
  indent?: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  showVariation?: boolean;
  variation?: number;
  categorias?: Array<{ nome: string; valor: number }>;
}

function DRELine({
  label,
  value,
  receitaBase,
  indent = 0,
  isTotal = false,
  isSubtotal = false,
  showVariation = false,
  variation = 0,
  categorias,
}: DRELineProps) {
  const [expanded, setExpanded] = useState(false);
  const isNegative = value < 0;
  const hasDetails = categorias && categorias.length > 0;
  const percentual = receitaBase > 0 ? Math.abs((value / receitaBase) * 100) : 0;

  return (
    <>
      <TableRow
        className={cn(
          isTotal && "bg-primary/5 font-bold",
          isSubtotal && "bg-secondary/50 font-semibold",
          hasDetails && "cursor-pointer hover:bg-muted/50"
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <TableCell className="py-3" style={{ paddingLeft: `${16 + indent * 24}px` }}>
          <div className="flex items-center gap-2">
            {hasDetails && (
              <span className="text-muted-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            )}
            {label}
          </div>
        </TableCell>
        <TableCell className={`text-right py-3 ${isNegative ? "text-destructive" : ""}`}>
          {formatCurrency(value)}
        </TableCell>
        <TableCell className="text-right py-3 text-muted-foreground">
          {percentual.toFixed(1)}%
        </TableCell>
        {showVariation && (
          <TableCell className="text-right py-3">
            <div
              className={`flex items-center justify-end gap-1 ${
                variation >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {variation > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : variation < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>
                {variation >= 0 ? "+" : ""}
                {variation.toFixed(1)}%
              </span>
            </div>
          </TableCell>
        )}
      </TableRow>
      {hasDetails && expanded && (
        <>
          {categorias.map((cat, idx) => (
            <TableRow key={idx} className="bg-muted/20">
              <TableCell
                className="py-2 text-sm text-muted-foreground"
                style={{ paddingLeft: `${40 + indent * 24}px` }}
              >
                • {cat.nome}
              </TableCell>
              <TableCell className="text-right py-2 text-sm text-muted-foreground">
                {formatCurrency(cat.valor)}
              </TableCell>
              <TableCell className="text-right py-2 text-sm text-muted-foreground">
                {receitaBase > 0 ? ((cat.valor / receitaBase) * 100).toFixed(1) : 0}%
              </TableCell>
              {showVariation && <TableCell />}
            </TableRow>
          ))}
        </>
      )}
    </>
  );
}

export default function DRE() {
  const { openChat } = useAssistantChatContext();
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("");
  const [dataSource, setDataSource] = useState<"real" | "mock">("real");

  const mes = selectedPeriodo ? selectedPeriodo.split("-")[1] : undefined;
  const ano = selectedPeriodo ? parseInt(selectedPeriodo.split("-")[0]) : undefined;

  const { dreData, stats, transacoesCount, isLoading, hasData } = useDREData(mes, ano);
  const { data: periodos } = usePeridosDisponiveis();

  // Usa dados mock ou reais
  const useMockData = dataSource === "mock" || !hasData;
  const currentDre = useMockData
    ? {
        receitaBruta: mockDreData.receitaBruta,
        deducoes: { valor: mockDreData.devolucoes + mockDreData.descontosComerciais + mockDreData.impostosSobreVendas, categorias: [] },
        cmv: { valor: mockDreData.custos, categorias: [] },
        receitaLiquida: mockDreData.receitaLiquida,
        lucroBruto: mockDreData.lucroBruto,
        despesasOperacionais: { valor: mockDreData.despesas * 0.4, categorias: [] },
        despesasPessoal: { valor: mockDreData.despesas * 0.25, categorias: [] },
        despesasAdministrativas: { valor: mockDreData.despesas * 0.15, categorias: [] },
        marketing: { valor: mockDreData.despesas * 0.1, categorias: [] },
        despesasFinanceiras: { valor: mockDreData.despesas * 0.05, categorias: [] },
        impostos: { valor: mockDreData.despesas * 0.05, categorias: [] },
        totalDespesas: mockDreData.despesas,
        ebitda: mockDreData.ebitda,
        lucroLiquido: mockDreData.lucroLiquido,
        periodo: "Out 2024",
      }
    : dreData;

  const currentStats = useMockData
    ? {
        margemBruta: (mockDreData.lucroBruto / mockDreData.receitaBruta) * 100,
        margemOperacional: (mockDreData.ebitda / mockDreData.receitaBruta) * 100,
        margemLiquida: (mockDreData.lucroLiquido / mockDreData.receitaBruta) * 100,
        cmvPercentual: (mockDreData.custos / mockDreData.receitaBruta) * 100,
        despesasPercentual: (mockDreData.despesas / mockDreData.receitaBruta) * 100,
      }
    : stats;

  const receitaBase = currentDre?.receitaBruta || 1;
  const isPositive = (currentDre?.lucroLiquido || 0) >= 0;

  const handleAskAssistant = () => {
    openChat("Analise a DRE e explique os principais indicadores", {
      telaAtual: "DRE",
      dadosAdicionais: currentDre,
    });
  };

  return (
    <MainLayout
      title="DRE - Demonstração do Resultado"
      subtitle="Demonstrativo de resultados do exercício"
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Selecione período" />
            </SelectTrigger>
            <SelectContent>
              {periodos?.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              {(!periodos || periodos.length === 0) && (
                <SelectItem value="2024-10">Outubro 2024</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Fonte de dados */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", hasData ? "bg-emerald-500/10" : "bg-amber-500/10")}>
                  <Database className={cn("h-5 w-5", hasData ? "text-emerald-600" : "text-amber-600")} />
                </div>
                <div>
                  <p className="font-medium">
                    {hasData ? `${transacoesCount} transações categorizadas` : "Sem dados reais no período"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasData
                      ? "Dados calculados a partir das transações de cartão de crédito categorizadas"
                      : "Exibindo dados de demonstração. Categorize transações para ver dados reais."}
                  </p>
                </div>
              </div>
              <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as "real" | "mock")}>
                <TabsList>
                  <TabsTrigger value="real" disabled={!hasData}>
                    Dados Reais
                  </TabsTrigger>
                  <TabsTrigger value="mock">Demonstração</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DRE Principal */}
          <ModuleCard
            title="DRE Consolidado"
            description={currentDre?.periodo || "Período selecionado"}
            icon={FileText}
            className="lg:col-span-2"
            noPadding
          >
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Carregando dados...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="w-[45%]">Descrição</TableHead>
                    <TableHead className="text-right w-[25%]">Valor</TableHead>
                    <TableHead className="text-right w-[15%]">% Receita</TableHead>
                    <TableHead className="text-right w-[15%]">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <DRELine
                    label="Receita Bruta"
                    value={currentDre?.receitaBruta || 0}
                    receitaBase={receitaBase}
                    isSubtotal
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Deduções"
                    value={-(currentDre?.deducoes?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.deducoes?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="= Receita Líquida"
                    value={currentDre?.receitaLiquida || 0}
                    receitaBase={receitaBase}
                    isSubtotal
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) CMV / Custo de Mercadoria"
                    value={-(currentDre?.cmv?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.cmv?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="= Lucro Bruto"
                    value={currentDre?.lucroBruto || 0}
                    receitaBase={receitaBase}
                    isSubtotal
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Despesas Operacionais"
                    value={-(currentDre?.despesasOperacionais?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.despesasOperacionais?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Despesas com Pessoal"
                    value={-(currentDre?.despesasPessoal?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.despesasPessoal?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Despesas Administrativas"
                    value={-(currentDre?.despesasAdministrativas?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.despesasAdministrativas?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Marketing e Vendas"
                    value={-(currentDre?.marketing?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.marketing?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Despesas Financeiras"
                    value={-(currentDre?.despesasFinanceiras?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.despesasFinanceiras?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="(-) Impostos"
                    value={-(currentDre?.impostos?.valor || 0)}
                    receitaBase={receitaBase}
                    indent={1}
                    categorias={currentDre?.impostos?.categorias}
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="= EBITDA"
                    value={currentDre?.ebitda || 0}
                    receitaBase={receitaBase}
                    isSubtotal
                    showVariation
                    variation={0}
                  />

                  <DRELine
                    label="= LUCRO LÍQUIDO"
                    value={currentDre?.lucroLiquido || 0}
                    receitaBase={receitaBase}
                    isTotal
                    showVariation
                    variation={0}
                  />
                </TableBody>
              </Table>
            )}
          </ModuleCard>

          {/* Resumo e Análise */}
          <div className="space-y-6">
            {/* Status Card */}
            <div
              className={cn(
                "p-6 rounded-xl border",
                isPositive
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-destructive/5 border-destructive/20"
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("p-2 rounded-lg", isPositive ? "bg-emerald-500/10" : "bg-destructive/10")}>
                  {isPositive ? (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-destructive" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{isPositive ? "Resultado Positivo" : "Resultado Negativo"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isPositive ? "Lucro no período" : "Prejuízo no período"}
                  </p>
                </div>
              </div>
              <div className={cn("text-3xl font-bold", isPositive ? "text-emerald-600" : "text-destructive")}>
                {formatCurrency(currentDre?.lucroLiquido || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Margem líquida de {currentStats?.margemLiquida?.toFixed(1) || 0}%
              </p>
            </div>

            {/* Quick Stats */}
            <ModuleCard title="Indicadores Chave">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Margem Bruta</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      (currentStats?.margemBruta || 0) >= 0
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {currentStats?.margemBruta?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Margem Operacional</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      (currentStats?.margemOperacional || 0) >= 0
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {currentStats?.margemOperacional?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Margem Líquida</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      (currentStats?.margemLiquida || 0) >= 0
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {currentStats?.margemLiquida?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">CMV / Receita</span>
                  <Badge variant="outline">{currentStats?.cmvPercentual?.toFixed(1) || 0}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Despesas / Receita</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      (currentStats?.despesasPercentual || 0) > 50
                        ? "bg-warning/10 text-warning border-warning/20"
                        : ""
                    )}
                  >
                    {currentStats?.despesasPercentual?.toFixed(1) || 0}%
                  </Badge>
                </div>
              </div>
            </ModuleCard>

            {/* Info sobre dados */}
            {!hasData && dataSource === "real" && (
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Sem dados reais</p>
                    <p className="text-muted-foreground mt-1">
                      Para ver dados reais, importe e categorize transações de cartão de crédito no
                      módulo de Cartões de Crédito.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Button className="w-full justify-between" variant="outline">
                Comparar com mês anterior
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="w-full justify-between" variant="outline">
                Ver DRE por operação
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="w-full justify-between" variant="outline">
                Análise vertical/horizontal
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
