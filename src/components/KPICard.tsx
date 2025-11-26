import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
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
        
        {change !== undefined && (
          <div className={cn("flex items-center gap-1.5 text-sm", getTrendColor())}>
            {getTrendIcon()}
            <span className="font-medium">
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
