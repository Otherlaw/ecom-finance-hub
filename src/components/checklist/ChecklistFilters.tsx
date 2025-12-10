import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { canaisMarketplace, getMeses } from "@/lib/checklist-data";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Building2, Store, Calendar, Plus } from "lucide-react";

interface ChecklistFiltersProps {
  empresaId: string;
  canalId: string;
  mes: number;
  ano: number;
  onEmpresaChange: (value: string) => void;
  onCanalChange: (value: string) => void;
  onMesChange: (value: number) => void;
  onAnoChange: (value: number) => void;
  onCriarChecklist?: () => void;
  showCriarButton?: boolean;
}

export function ChecklistFilters({
  empresaId,
  canalId,
  mes,
  ano,
  onEmpresaChange,
  onCanalChange,
  onMesChange,
  onAnoChange,
  onCriarChecklist,
  showCriarButton = true,
}: ChecklistFiltersProps) {
  const { empresas, isLoading } = useEmpresas();
  
  const currentYear = new Date().getFullYear();
  // Permitir anos passados (3 anos) + ano atual + 1 ano futuro
  const anos = [];
  for (let i = currentYear - 3; i <= currentYear + 1; i++) {
    anos.push(i);
  }

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl border border-border">
      {/* Empresa */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Select value={empresaId} onValueChange={onEmpresaChange} disabled={isLoading}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {empresas?.map((empresa) => (
              <SelectItem key={empresa.id} value={empresa.id}>
                {empresa.nome_fantasia || empresa.razao_social}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Canal */}
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-muted-foreground" />
        <Select value={canalId} onValueChange={onCanalChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os canais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            {canaisMarketplace.map((canal) => (
              <SelectItem key={canal.id} value={canal.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: canal.cor }}
                  />
                  {canal.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mês */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={mes.toString()} onValueChange={(v) => onMesChange(parseInt(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {getMeses().map((m) => (
              <SelectItem key={m.value} value={m.value.toString()}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ano */}
      <Select value={ano.toString()} onValueChange={(v) => onAnoChange(parseInt(v))}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anos.map((a) => (
            <SelectItem key={a} value={a.toString()}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Botão Criar Checklist */}
      {showCriarButton && onCriarChecklist && (
        <Button onClick={onCriarChecklist} className="gap-2 ml-auto">
          <Plus className="h-4 w-4" />
          Criar Checklist
        </Button>
      )}
    </div>
  );
}
