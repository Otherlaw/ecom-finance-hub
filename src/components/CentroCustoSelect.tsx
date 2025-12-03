import { useCentrosCusto, CentroCustoHierarquico } from "@/hooks/useCentrosCusto";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Building2, ShoppingCart, Truck, FolderTree } from "lucide-react";

interface CentroCustoSelectProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showOnlyActive?: boolean;
  className?: string;
}

export function CentroCustoSelect({
  value,
  onValueChange,
  placeholder = "Selecione o centro de custo",
  disabled = false,
  showOnlyActive = true,
  className,
}: CentroCustoSelectProps) {
  const { centrosFlat, isLoading } = useCentrosCusto();

  const filteredCentros = showOnlyActive 
    ? centrosFlat.filter(c => c.ativo) 
    : centrosFlat;

  const getIcon = (codigo: string | null) => {
    if (!codigo) return FolderTree;
    if (codigo.includes("OP")) return Building2;
    if (codigo.includes("ECOM")) return ShoppingCart;
    if (codigo.includes("DIST")) return Truck;
    return FolderTree;
  };

  const selectedCentro = filteredCentros.find(c => c.id === value);

  return (
    <Select
      value={value || "none"}
      onValueChange={(val) => onValueChange(val === "none" ? null : val)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>
          {selectedCentro ? (
            <div className="flex items-center gap-2">
              {selectedCentro.level > 0 && (
                <span className="text-muted-foreground">
                  {"—".repeat(selectedCentro.level)}
                </span>
              )}
              <span>{selectedCentro.nome}</span>
              {selectedCentro.codigo && (
                <span className="text-xs text-muted-foreground font-mono">
                  ({selectedCentro.codigo})
                </span>
              )}
            </div>
          ) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover">
        <SelectItem value="none">
          <span className="text-muted-foreground">Nenhum</span>
        </SelectItem>
        {filteredCentros.map((centro) => {
          const Icon = getIcon(centro.codigo);
          return (
            <SelectItem key={centro.id} value={centro.id}>
              <div className="flex items-center gap-2">
                {centro.level > 0 && (
                  <span className="text-muted-foreground ml-1">
                    {"—".repeat(centro.level)}
                  </span>
                )}
                <Icon className={cn(
                  "h-3.5 w-3.5",
                  centro.level === 0 ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  centro.level === 0 && "font-medium"
                )}>
                  {centro.nome}
                </span>
                {centro.codigo && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {centro.codigo}
                  </span>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
