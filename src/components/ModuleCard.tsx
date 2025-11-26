import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface ModuleCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ModuleCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  noPadding = false,
}: ModuleCardProps) {
  return (
    <Card className={cn("module-card animate-slide-up", className)}>
      <CardHeader className="module-header">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <CardTitle className="module-title">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn(!noPadding && "module-body", noPadding && "p-0")}>
        {children}
      </CardContent>
    </Card>
  );
}
