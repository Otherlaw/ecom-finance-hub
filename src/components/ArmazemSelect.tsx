/**
 * Componente de seleção de Armazém
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useArmazens } from "@/hooks/useArmazens";
import { Warehouse } from "lucide-react";

interface ArmazemSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  empresaId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ArmazemSelect({
  value,
  onValueChange,
  empresaId,
  placeholder = "Selecione o armazém",
  disabled = false,
}: ArmazemSelectProps) {
  const { armazens, isLoading } = useArmazens({ empresaId, apenasAtivos: true });

  return (
    <Select
      value={value || ""}
      onValueChange={(val) => onValueChange(val || null)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Carregando..." : placeholder}>
          {value && armazens.find(a => a.id === value)?.nome}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {armazens.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground text-center">
            Nenhum armazém disponível
          </div>
        ) : (
          armazens.map((armazem) => (
            <SelectItem key={armazem.id} value={armazem.id}>
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <span>{armazem.nome}</span>
                <span className="text-xs text-muted-foreground">({armazem.codigo})</span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
