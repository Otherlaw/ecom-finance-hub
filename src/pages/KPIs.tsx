import { MainLayout } from "@/components/MainLayout";
import { ModuleCard } from "@/components/ModuleCard";
import { KPICard } from "@/components/KPICard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PeriodFilter } from "@/components/PeriodFilter";
import { useKPIData } from "@/hooks/useKPIData";
import { AskAssistantButton } from "@/components/assistant/AskAssistantButton";
import { useAssistantChatContext } from "@/contexts/AssistantChatContext";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Percent,
  Package,
  BarChart3,
  Target,
  Zap,
  Download,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const categoryIcons = {
  Receita: DollarSign,
  Margens: Percent,
  Custos: Package,
};

export default function KPIs() {
  const { openChat } = useAssistantChatContext();
  const {
    selectedPeriod,
    isLoading,
    handlePeriodChange,
    kpiData,
    channelData,
    kpiCategories,
    metaFaturamento,
    metaMargemBruta,
    metaLucro,
    formatCurrency,
    formatNumber,
    formatPercentage,
  } = useKPIData();

  const handleAskAssistant = () => {
    openChat('Analise os KPIs e sugira ações de melhoria', {
      telaAtual: 'KPIs',
      periodo: selectedPeriod,
      dadosAdicionais: {
        faturamento: kpiData.faturamentoMensal,
        lucroLiquido: kpiData.lucroLiquido,
        margemBruta: kpiData.margemBruta + '%',
        pedidos: kpiData.pedidos,
        ticketMedio: kpiData.ticketMedio,
        metaFaturamento: metaFaturamento.percentual + '% da meta',
        metaLucro: metaLucro.percentual + '% da meta',
      },
    });
  };

  return (
    <MainLayout
      title="KPIs Estratégicos"
      subtitle="Indicadores chave de performance"
      actions={
        <div className="flex items-center gap-2">
          <AskAssistantButton onClick={handleAskAssistant} label="Perguntar" />
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
        </div>
      }
    >
      {/* Period Filter */}
      <div className="mb-6 p-4 rounded-xl bg-card border border-border">
        <PeriodFilter
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          isLoading={isLoading}
        />
      </div>

      {/* Principais KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="kpi-card">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </>
        ) : (
          <>
            <KPICard
              title="Faturamento"
              value={formatCurrency(kpiData.faturamentoMensal)}
              change={kpiData.faturamentoVariacao}
              icon={DollarSign}
              iconColor="text-primary"
              trend={kpiData.faturamentoVariacao >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Lucro Líquido"
              value={formatCurrency(kpiData.lucroLiquido)}
              change={kpiData.lucroVariacao}
              icon={TrendingUp}
              iconColor="text-success"
              trend={kpiData.lucroLiquido >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Margem Bruta"
              value={`${kpiData.margemBruta}%`}
              change={kpiData.margemBrutaVariacao}
              icon={Percent}
              iconColor="text-info"
              trend={kpiData.margemBrutaVariacao >= 0 ? "up" : "down"}
            />
            <KPICard
              title="Pedidos"
              value={formatNumber(kpiData.pedidos)}
              change={kpiData.pedidosVariacao}
              icon={ShoppingCart}
              iconColor="text-warning"
              trend={kpiData.pedidosVariacao >= 0 ? "up" : "down"}
            />
          </>
        )}
      </div>

      {/* KPIs por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {kpiCategories.map((category) => {
          const Icon = categoryIcons[category.title as keyof typeof categoryIcons] || DollarSign;
          return (
            <ModuleCard
              key={category.title}
              title={category.title}
              icon={Icon}
            >
              <div className="space-y-6">
                {isLoading ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-1.5 w-full" />
                      </div>
                    ))}
                  </>
                ) : (
                  category.kpis.map((kpi, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{kpi.label}</span>
                        <span className="text-lg font-bold">{kpi.value}</span>
                      </div>
                      {kpi.change !== undefined && (
                        <div className={`flex items-center gap-1 text-sm ${kpi.change >= 0 ? "text-success" : "text-destructive"}`}>
                          {kpi.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                          <span>{formatPercentage(kpi.change)}</span>
                          <span className="text-muted-foreground">vs período anterior</span>
                        </div>
                      )}
                      {kpi.sublabel && (
                        <p className="text-sm text-muted-foreground">{kpi.sublabel}</p>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Meta: {typeof kpi.target === 'number' && kpi.target >= 100 ? formatCurrency(kpi.target) : kpi.target}</span>
                          <span>{Math.abs((kpi.current / kpi.target) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress 
                          value={Math.min(Math.abs(kpi.current / kpi.target) * 100, 100)} 
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ModuleCard>
          );
        })}
      </div>

      {/* Performance por Canal */}
      <ModuleCard
        title="Performance por Canal"
        description="Comparativo de canais de venda"
        icon={BarChart3}
        actions={
          isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-secondary/50 space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </>
          ) : (
            channelData.map((channel) => (
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
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${channel.percentual}%`,
                      backgroundColor: channel.color,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className={cn("h-4 w-4", channel.crescimento >= 0 ? "text-success" : "text-destructive")} />
                  <span className={channel.crescimento >= 0 ? "text-success" : "text-destructive"}>
                    {channel.crescimento >= 0 ? "+" : ""}{channel.crescimento}%
                  </span>
                  <span className="text-muted-foreground">crescimento</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ModuleCard>

      {/* Metas e Objetivos */}
      <div className="mt-6">
        <ModuleCard
          title="Metas do Período"
          description="Acompanhamento de objetivos"
          icon={Target}
          actions={
            isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-6 rounded-xl border border-border">
                    <div className="flex justify-between mb-4">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="p-6 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Faturamento</h4>
                    <Badge className={cn(
                      metaFaturamento.percentual >= 90 
                        ? "bg-success/10 text-success border-success/20"
                        : metaFaturamento.percentual >= 70
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {metaFaturamento.percentual}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Atual</span>
                      <span className="font-medium">{formatCurrency(metaFaturamento.atual)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Meta</span>
                      <span className="font-medium">{formatCurrency(metaFaturamento.meta)}</span>
                    </div>
                    <Progress value={metaFaturamento.percentual} className="h-2" />
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Margem Bruta</h4>
                    <Badge className={cn(
                      metaMargemBruta.percentual >= 90 
                        ? "bg-success/10 text-success border-success/20"
                        : metaMargemBruta.percentual >= 70
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {metaMargemBruta.percentual}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Atual</span>
                      <span className="font-medium">{metaMargemBruta.atual}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Meta</span>
                      <span className="font-medium">{metaMargemBruta.meta}%</span>
                    </div>
                    <Progress value={metaMargemBruta.percentual} className="h-2" />
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Lucro Líquido</h4>
                    <Badge className={cn(
                      metaLucro.percentual >= 90 
                        ? "bg-success/10 text-success border-success/20"
                        : metaLucro.percentual >= 70
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                      {metaLucro.percentual}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Atual</span>
                      <span className={cn(
                        "font-medium",
                        metaLucro.atual < 0 && "text-destructive"
                      )}>
                        {formatCurrency(metaLucro.atual)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Meta</span>
                      <span className="font-medium">{formatCurrency(metaLucro.meta)}</span>
                    </div>
                    <Progress value={metaLucro.percentual} className="h-2" />
                  </div>
                </div>
              </>
            )}
          </div>
        </ModuleCard>
      </div>
    </MainLayout>
  );
}
