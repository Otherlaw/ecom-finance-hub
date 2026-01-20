import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useEmpresas } from "@/hooks/useEmpresas";
import { cn } from "@/lib/utils";

interface EmpresaFilterProps {
  /** "todas" para todas as empresas ou o ID da empresa específica */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  showLabel?: boolean;
  /** Se true, não mostra a opção "Todas as empresas" (evita duplicatas) */
  hideAllOption?: boolean;
}

/**
 * Componente de filtro de empresa reutilizável.
 * Permite selecionar "Todas as empresas" ou uma empresa específica.
 * Utilizado em telas individuais para filtrar dados por empresa.
 */
export function EmpresaFilter({ 
  value, 
  onChange, 
  label = "Empresa", 
  className,
  showLabel = true,
  hideAllOption = false
}: EmpresaFilterProps) {
  const { empresas, isLoading } = useEmpresas();

  // Não mostrar se só tem uma empresa (ou nenhuma)
  if (!isLoading && empresas.length <= 1) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel && (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-[200px] h-9">
          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Selecionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {!hideAllOption && (
            <SelectItem value="todas">
              <span className="font-medium">Todas as empresas</span>
            </SelectItem>
          )}
          {empresas.map((empresa) => (
            <SelectItem key={empresa.id} value={empresa.id}>
              {empresa.nome_fantasia || empresa.razao_social}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
