import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, ChevronDown, ChevronUp, Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FiltrosVendas {
  dataInicio: Date | undefined;
  dataFim: Date | undefined;
  pedidoId: string;
  sku: string;
  statusVenda: string;
  canal: string;
  tipoEnvio: string;
  temCusto: string;
  conta: string;
}

interface VendasFiltrosAvancadosProps {
  filtros: FiltrosVendas;
  onFiltrosChange: (filtros: FiltrosVendas) => void;
  onBuscar: () => void;
  onLimpar: () => void;
  canaisDisponiveis: string[];
  contasDisponiveis: string[];
  isLoading?: boolean;
}

export function VendasFiltrosAvancados({
  filtros,
  onFiltrosChange,
  onBuscar,
  onLimpar,
  canaisDisponiveis,
  contasDisponiveis,
  isLoading,
}: VendasFiltrosAvancadosProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFiltro = <K extends keyof FiltrosVendas>(key: K, value: FiltrosVendas[K]) => {
    onFiltrosChange({ ...filtros, [key]: value });
  };

  const temFiltrosAtivos = 
    filtros.pedidoId || 
    filtros.sku || 
    filtros.statusVenda !== "todos" || 
    filtros.canal !== "todos" || 
    filtros.tipoEnvio !== "todos" || 
    filtros.temCusto !== "todos" ||
    filtros.conta;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Filtrar Busca</CardTitle>
                {temFiltrosAtivos && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Filtros ativos
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Data Início */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !filtros.dataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filtros.dataInicio ? (
                        format(filtros.dataInicio, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        "Selecionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filtros.dataInicio}
                      onSelect={(date) => updateFiltro("dataInicio", date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Fim */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-9",
                        !filtros.dataFim && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filtros.dataFim ? (
                        format(filtros.dataFim, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        "Selecionar"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filtros.dataFim}
                      onSelect={(date) => updateFiltro("dataFim", date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Nº Pedido */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nº Pedido / Carrinho</Label>
                <Input
                  placeholder="Ex: 2000005..."
                  value={filtros.pedidoId}
                  onChange={(e) => updateFiltro("pedidoId", e.target.value)}
                  className="h-9"
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <Input
                  placeholder="Ex: MLB123..."
                  value={filtros.sku}
                  onChange={(e) => updateFiltro("sku", e.target.value)}
                  className="h-9"
                />
              </div>

              {/* Status Venda */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status Venda</Label>
                <Select
                  value={filtros.statusVenda}
                  onValueChange={(val) => updateFiltro("statusVenda", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="delivered">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Canal */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Canal</Label>
                <Select
                  value={filtros.canal}
                  onValueChange={(val) => updateFiltro("canal", val)}
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

              {/* Tipo de Envio */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo do Frete</Label>
                <Select
                  value={filtros.tipoEnvio}
                  onValueChange={(val) => updateFiltro("tipoEnvio", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="full">Fulfillment (Full)</SelectItem>
                    <SelectItem value="coleta">Coleta</SelectItem>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="correios">Correios</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custo & Imposto */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Custo & Imposto</Label>
                <Select
                  value={filtros.temCusto}
                  onValueChange={(val) => updateFiltro("temCusto", val)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="com_custo">Com custo</SelectItem>
                    <SelectItem value="sem_custo">Sem custo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conta (Multicontas) */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Conta</Label>
                <Select
                  value={filtros.conta || "todas"}
                  onValueChange={(val) => updateFiltro("conta", val === "todas" ? "" : val)}
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
            </div>

            {/* Botões de ação */}
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLimpar}
                disabled={!temFiltrosAtivos}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={onBuscar}
                disabled={isLoading}
              >
                <Search className="h-4 w-4 mr-1" />
                Buscar
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
