import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConsistenciaVendas } from "@/hooks/useVendas";
import { AlertTriangle, CheckCircle, X, Package, DollarSign, RefreshCw, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendasConsistenciaProps {
  consistencia: ConsistenciaVendas;
  onItemClick: (tipo: string) => void;
  filtrosAtivos: {
    semCusto: boolean | undefined;
    semProduto: boolean | undefined;
    naoConciliadas: boolean | undefined;
  };
  onLimparFiltros: () => void;
}

export function VendasConsistencia({ 
  consistencia, 
  onItemClick,
  filtrosAtivos,
  onLimparFiltros 
}: VendasConsistenciaProps) {
  const temFiltroAtivo = filtrosAtivos.semCusto || filtrosAtivos.semProduto || filtrosAtivos.naoConciliadas;

  const items = [
    {
      label: "Sem custo",
      value: consistencia.totalSemCusto,
      tipo: "semCusto",
      icon: DollarSign,
      ativo: filtrosAtivos.semCusto,
    },
    {
      label: "Sem produto",
      value: consistencia.totalSemProduto,
      tipo: "semProduto",
      icon: Package,
      ativo: filtrosAtivos.semProduto,
    },
    {
      label: "Não conciliadas",
      value: consistencia.totalNaoConciliadas,
      tipo: "naoConciliadas",
      icon: RefreshCw,
      ativo: filtrosAtivos.naoConciliadas,
    },
    {
      label: "Sem categoria",
      value: consistencia.totalSemCategoria,
      tipo: "semCategoria",
      icon: Tag,
      ativo: false,
    },
  ];

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Consistência de Dados</span>
          </div>
          {temFiltroAtivo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLimparFiltros}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((item) => {
            const temProblema = item.value > 0;
            const isAtivo = item.ativo;

            return (
              <button
                key={item.tipo}
                onClick={() => item.tipo !== "semCategoria" && onItemClick(item.tipo)}
                disabled={item.tipo === "semCategoria"}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                  isAtivo
                    ? "bg-primary/10 border-primary"
                    : temProblema
                    ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
                    : "bg-emerald-500/5 border-emerald-500/20",
                  item.tipo === "semCategoria" && "cursor-default opacity-70"
                )}
              >
                <div
                  className={cn(
                    "p-1.5 rounded",
                    isAtivo
                      ? "bg-primary/20"
                      : temProblema
                      ? "bg-amber-500/10"
                      : "bg-emerald-500/10"
                  )}
                >
                  {temProblema ? (
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        isAtivo ? "text-primary" : "text-amber-500"
                      )}
                    />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      isAtivo
                        ? "text-primary"
                        : temProblema
                        ? "text-amber-500"
                        : "text-emerald-500"
                    )}
                  >
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
