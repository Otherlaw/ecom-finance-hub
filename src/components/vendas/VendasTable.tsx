import { useState } from "react";
import { VendaDetalhada } from "@/hooks/useVendas";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Package,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VendasTableProps {
  vendas: VendaDetalhada[];
}

type SortField = "data_venda" | "valor_bruto" | "valor_liquido" | "custo_calculado" | "margem";
type SortOrder = "asc" | "desc";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function VendasTable({ vendas }: VendasTableProps) {
  const [sortField, setSortField] = useState<SortField>("data_venda");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedVendas = [...vendas].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "data_venda":
        aVal = new Date(a.data_venda).getTime();
        bVal = new Date(b.data_venda).getTime();
        break;
      case "valor_bruto":
        aVal = a.valor_bruto;
        bVal = b.valor_bruto;
        break;
      case "valor_liquido":
        aVal = a.valor_liquido;
        bVal = b.valor_liquido;
        break;
      case "custo_calculado":
        aVal = a.custo_calculado;
        bVal = b.custo_calculado;
        break;
      case "margem":
        aVal = a.valor_liquido - a.custo_calculado;
        bVal = b.valor_liquido - b.custo_calculado;
        break;
      default:
        return 0;
    }

    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const handleExport = () => {
    // Criar CSV
    const headers = [
      "Canal",
      "Conta",
      "Pedido",
      "Data",
      "SKU",
      "Produto",
      "Qtd",
      "Valor Bruto",
      "Valor Líquido",
      "Tarifas",
      "Custo",
      "Margem R$",
      "Margem %",
      "Status",
    ];

    const rows = sortedVendas.map((v) => {
      const margem = v.valor_liquido - v.custo_calculado;
      const margemPercent = v.valor_bruto > 0 ? (margem / v.valor_bruto) * 100 : 0;

      return [
        v.canal,
        v.conta_nome || "",
        v.pedido_id || v.referencia_externa || "",
        format(new Date(v.data_venda), "dd/MM/yyyy"),
        v.sku_interno || v.sku_marketplace || "",
        v.produto_nome || v.descricao_item || v.descricao,
        v.quantidade,
        v.valor_bruto.toFixed(2),
        v.valor_liquido.toFixed(2),
        (v.tarifas + v.taxas).toFixed(2),
        v.custo_calculado.toFixed(2),
        margem.toFixed(2),
        margemPercent.toFixed(1) + "%",
        v.status,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vendas_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (vendas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Nenhuma venda encontrada para os filtros selecionados</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end px-4 py-2 border-b">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[80px]">Canal</TableHead>
              <TableHead className="w-[120px]">Conta</TableHead>
              <TableHead
                className="w-[100px] cursor-pointer hover:text-foreground"
                onClick={() => handleSort("data_venda")}
              >
                <div className="flex items-center">
                  Data
                  <SortIcon field="data_venda" />
                </div>
              </TableHead>
              <TableHead className="min-w-[200px]">Produto / Descrição</TableHead>
              <TableHead className="w-[100px]">SKU</TableHead>
              <TableHead className="w-[60px] text-center">Qtd</TableHead>
              <TableHead
                className="w-[100px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("valor_bruto")}
              >
                <div className="flex items-center justify-end">
                  Bruto
                  <SortIcon field="valor_bruto" />
                </div>
              </TableHead>
              <TableHead className="w-[80px] text-right">Tarifas</TableHead>
              <TableHead
                className="w-[100px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("custo_calculado")}
              >
                <div className="flex items-center justify-end">
                  Custo
                  <SortIcon field="custo_calculado" />
                </div>
              </TableHead>
              <TableHead
                className="w-[100px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("margem")}
              >
                <div className="flex items-center justify-end">
                  Margem
                  <SortIcon field="margem" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVendas.map((v, idx) => {
              const margem = v.valor_liquido - v.custo_calculado;
              const margemPercent = v.valor_bruto > 0 ? (margem / v.valor_bruto) * 100 : 0;

              const margemColor =
                margem < 0
                  ? "text-red-500"
                  : margemPercent < 10
                  ? "text-amber-500"
                  : "text-emerald-500";

              const hasWarnings = v.sem_custo || v.sem_produto_vinculado || v.nao_conciliado;

              return (
                <TableRow key={`${v.transacao_id}-${v.item_id || idx}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {v.canal}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {v.conta_nome || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(v.data_venda), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {hasWarnings && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              {v.sem_custo && <p>• Sem custo cadastrado</p>}
                              {v.sem_produto_vinculado && <p>• Sem produto vinculado</p>}
                              {v.nao_conciliado && <p>• Não conciliado</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {v.produto_nome || v.descricao_item || v.descricao}
                        </p>
                        {v.pedido_id && (
                          <p className="text-xs text-muted-foreground">
                            Pedido: {v.pedido_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {v.sku_interno || v.sku_marketplace || "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm">{v.quantidade}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(v.valor_bruto)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatCurrency(v.tarifas + v.taxas)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {v.sem_custo ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-amber-500">-</span>
                        </TooltipTrigger>
                        <TooltipContent>Custo não cadastrado</TooltipContent>
                      </Tooltip>
                    ) : (
                      formatCurrency(v.custo_calculado)
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right text-sm font-medium", margemColor)}>
                    <div>
                      {formatCurrency(margem)}
                      <span className="block text-xs opacity-75">
                        {formatPercent(margemPercent)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={v.status === "conciliado" ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        v.status === "conciliado" && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      )}
                    >
                      {v.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
