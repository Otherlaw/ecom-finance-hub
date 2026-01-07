import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEmpresaAtiva } from "@/contexts/EmpresaContext";
import { cn } from "@/lib/utils";

interface EmpresaSelectorProps {
  collapsed?: boolean;
}

export function EmpresaSelector({ collapsed = false }: EmpresaSelectorProps) {
  const { empresaAtiva, setEmpresaAtiva, empresasDisponiveis, isLoading } =
    useEmpresaAtiva();

  if (isLoading || empresasDisponiveis.length === 0) {
    return null;
  }

  // Se só tem uma empresa, não precisa mostrar seletor
  if (empresasDisponiveis.length === 1) {
    if (collapsed) return null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span className="truncate">
          {empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 font-normal",
            collapsed && "justify-center px-2"
          )}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">
                {empresaAtiva?.nome_fantasia || empresaAtiva?.razao_social || "Selecionar empresa"}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[250px]">
        {empresasDisponiveis.map((empresa) => (
          <DropdownMenuItem
            key={empresa.id}
            onClick={() => setEmpresaAtiva(empresa)}
            className="flex items-center gap-2"
          >
            <Check
              className={cn(
                "h-4 w-4",
                empresaAtiva?.id === empresa.id ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="truncate">
              {empresa.nome_fantasia || empresa.razao_social}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
