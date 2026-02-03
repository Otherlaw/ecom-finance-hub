import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
  /** Valor do período anterior para exibir no tooltip */
  valorAnterior?: number;
  /** Função para formatar o valor no tooltip */
  formatValue?: (value: number) => string;
}

function defaultFormatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = "vs mês anterior",
  icon: Icon,
  iconColor = "text-primary",
  trend,
  className,
  valorAnterior,
  formatValue = defaultFormatCurrency,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-4 w-4" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-success";
    if (trend === "down") return "text-destructive";
    return "text-muted-foreground";
  };

  const getTrendBg = () => {
    if (trend === "up") return "bg-emerald-500/10";
    if (trend === "down") return "bg-red-500/10";
    return "bg-muted/50";
  };

  // Se temos change e valorAnterior, podemos calcular o valor atual e a diferença
  const valorAtualCalculado = valorAnterior !== undefined && change !== undefined
    ? valorAnterior * (1 + change / 100)
    : undefined;
  const diferencaCalculada = valorAtualCalculado !== undefined && valorAnterior !== undefined
    ? valorAtualCalculado - valorAnterior
    : undefined;

  const renderChangeIndicator = () => {
    if (change === undefined) return null;

    const indicatorContent = (
      <div className={cn("flex items-center gap-1.5 text-sm cursor-help transition-opacity hover:opacity-80", getTrendColor())}>
        {getTrendIcon()}
        <span className="font-medium">
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">{changeLabel}</span>
      </div>
    );

    // Se temos valorAnterior, mostramos o tooltip detalhado
    if (valorAnterior !== undefined) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              {indicatorContent}
            </TooltipTrigger>
            <TooltipContent 
              side="bottom" 
              align="start"
              className="w-72 p-0 bg-popover border shadow-lg"
            >
              <div className="p-3 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Comparação {changeLabel}</span>
                </div>

                {/* Valores lado a lado */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  {/* Período anterior */}
                  <div className="text-center p-2 rounded-md bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      Anterior
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatValue(valorAnterior)}
                    </p>
                  </div>

                  {/* Seta */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />

                  {/* Período atual */}
                  <div className="text-center p-2 rounded-md bg-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      Atual
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {value}
                    </p>
                  </div>
                </div>

                {/* Variação */}
                {diferencaCalculada !== undefined && (
                  <div className={cn("flex items-center justify-between p-2 rounded-md", getTrendBg())}>
                    <span className="text-xs text-muted-foreground">Variação</span>
                    <div className={cn("flex items-center gap-1.5", getTrendColor())}>
                      {getTrendIcon()}
                      <span className="font-semibold text-sm">
                        {diferencaCalculada >= 0 ? "+" : ""}{formatValue(diferencaCalculada)}
                      </span>
                      <span className="text-xs font-medium">
                        ({change >= 0 ? "+" : ""}{change.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return indicatorContent;
  };

  return (
    <div className={cn("kpi-card animate-fade-in", className)}>
      <div className="flex items-start justify-between mb-4">
        <span className="kpi-label">{title}</span>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-secondary", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <p className="kpi-value">{value}</p>
        {renderChangeIndicator()}
      </div>
    </div>
  );
}
