import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { VariacaoPeriodo } from "@/hooks/usePeriodoComparativo";

interface VariacaoTooltipProps {
  variacao: VariacaoPeriodo;
  label: string;
  formatValue?: (value: number) => string;
  metricName?: string;
  children?: ReactNode;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Componente de tooltip que mostra detalhes da comparação com período anterior
 */
export function VariacaoTooltip({
  variacao,
  label,
  formatValue = formatCurrency,
  metricName = "Valor",
  children,
}: VariacaoTooltipProps) {
  const { valor, valorAnterior, variacao: diff, variacaoPct, trend } = variacao;

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  const trendBg = trend === "up" ? "bg-emerald-500/10" : trend === "down" ? "bg-red-500/10" : "bg-muted/50";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <div className={cn("flex items-center gap-1 text-xs cursor-help", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="font-medium">
                {variacaoPct >= 0 ? "+" : ""}{variacaoPct.toFixed(1)}%
              </span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          )}
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
              <span>Comparação {label}</span>
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
                  {formatValue(valor)}
                </p>
              </div>
            </div>

            {/* Variação */}
            <div className={cn("flex items-center justify-between p-2 rounded-md", trendBg)}>
              <span className="text-xs text-muted-foreground">Variação</span>
              <div className={cn("flex items-center gap-1.5", trendColor)}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span className="font-semibold text-sm">
                  {diff >= 0 ? "+" : ""}{formatValue(diff)}
                </span>
                <span className="text-xs font-medium">
                  ({variacaoPct >= 0 ? "+" : ""}{variacaoPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Versão inline para uso em cards de vendas
 */
export function VariacaoIndicadorComTooltip({
  variacao,
  label,
  formatValue = formatCurrency,
}: {
  variacao: VariacaoPeriodo;
  label: string;
  formatValue?: (value: number) => string;
}) {
  const { variacaoPct, trend } = variacao;
  
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <VariacaoTooltip variacao={variacao} label={label} formatValue={formatValue}>
      <div className={cn("flex items-center gap-1 text-xs cursor-help transition-opacity hover:opacity-80", trendColor)}>
        <TrendIcon className="h-3 w-3" />
        <span className="font-medium">
          {variacaoPct >= 0 ? "+" : ""}{variacaoPct.toFixed(1)}%
        </span>
        <span className="text-muted-foreground">{label}</span>
      </div>
    </VariacaoTooltip>
  );
}
