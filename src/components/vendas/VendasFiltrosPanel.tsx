import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { VendasFiltros } from "@/hooks/useVendas";
import { Filter, Search } from "lucide-react";

interface VendasFiltrosPanelProps {
  filtros: VendasFiltros;
  onFiltroChange: (campo: keyof VendasFiltros, valor: any) => void;
  canaisDisponiveis: string[];
  contasDisponiveis: string[];
}

export function VendasFiltrosPanel({
  filtros,
  onFiltroChange,
  canaisDisponiveis,
  contasDisponiveis,
}: VendasFiltrosPanelProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => onFiltroChange("dataInicio", e.target.value)}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => onFiltroChange("dataFim", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Canal */}
          <div className="space-y-2">
            <Label className="text-xs">Canal</Label>
            <Select
              value={filtros.canal || "todos"}
              onValueChange={(v) => onFiltroChange("canal", v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {canaisDisponiveis.map((canal) => (
                  <SelectItem key={canal} value={canal}>
                    {canal}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conta */}
          <div className="space-y-2">
            <Label className="text-xs">Conta / Loja</Label>
            <Select
              value={filtros.conta || "todas"}
              onValueChange={(v) => onFiltroChange("conta", v === "todas" ? "" : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {contasDisponiveis.map((conta) => (
                  <SelectItem key={conta} value={conta}>
                    {conta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SKU */}
          <div className="space-y-2">
            <Label className="text-xs">SKU</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar SKU..."
                value={filtros.sku || ""}
                onChange={(e) => onFiltroChange("sku", e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>

          {/* Pedido */}
          <div className="space-y-2">
            <Label className="text-xs">Nº Pedido</Label>
            <Input
              placeholder="ID do pedido..."
              value={filtros.pedidoId || ""}
              onChange={(e) => onFiltroChange("pedidoId", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Título/Descrição */}
          <div className="space-y-2 md:col-span-2">
            <Label className="text-xs">Título / Descrição</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descrição ou produto..."
                value={filtros.titulo || ""}
                onChange={(e) => onFiltroChange("titulo", e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-xs">Status</Label>
            <Select
              value={filtros.statusVenda || "todos"}
              onValueChange={(v) => onFiltroChange("statusVenda", v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="conciliado">Conciliado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="importado">Importado</SelectItem>
                <SelectItem value="ignorado">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 md:col-span-2 lg:col-span-3">
            <Label className="text-xs">Filtros especiais</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.somenteNaoConciliadas}
                  onCheckedChange={(checked) =>
                    onFiltroChange("somenteNaoConciliadas", checked)
                  }
                />
                <span className="text-xs">Não conciliadas</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.somenteSemCusto}
                  onCheckedChange={(checked) =>
                    onFiltroChange("somenteSemCusto", checked)
                  }
                />
                <span className="text-xs">Sem custo</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={filtros.somenteSemProduto}
                  onCheckedChange={(checked) =>
                    onFiltroChange("somenteSemProduto", checked)
                  }
                />
                <span className="text-xs">Sem produto</span>
              </label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
