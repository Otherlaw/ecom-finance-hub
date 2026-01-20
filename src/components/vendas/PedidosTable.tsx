import { useState } from "react";
import { PedidoAgregado } from "@/hooks/useVendasPorPedido";
import { VendaItem } from "@/hooks/useVendaItens";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  HelpCircle,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { PedidosTableRow } from "./PedidosTableRow";
import { VendasPagination } from "./VendasPagination";

interface PedidosTableProps {
  pedidos: PedidoAgregado[];
  currentPage: number;
  totalPaginas: number;
  totalRegistros: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onAbrirMapeamento?: (pedido: PedidoAgregado, item?: VendaItem) => void;
  isLoading?: boolean;
}

type SortField = "data_pedido" | "valor_produto" | "margem_contribuicao";
type SortOrder = "asc" | "desc";

export function PedidosTable({
  pedidos,
  currentPage,
  totalPaginas,
  totalRegistros,
  pageSize,
  onPageChange,
  onAbrirMapeamento,
  isLoading,
}: PedidosTableProps) {
  const [sortField, setSortField] = useState<SortField>("data_pedido");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedPedidos = [...pedidos].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "data_pedido":
        aVal = new Date(a.data_pedido).getTime();
        bVal = new Date(b.data_pedido).getTime();
        break;
      case "valor_produto":
        aVal = a.valor_produto;
        bVal = b.valor_produto;
        break;
      case "margem_contribuicao":
        aVal = a.margem_contribuicao;
        bVal = b.margem_contribuicao;
        break;
      default:
        return 0;
    }

    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  };

  const handleExport = () => {
    const headers = [
      "Canal",
      "Conta",
      "Pedido",
      "Data",
      "Tipo Envio",
      "Qtd Itens",
      "Valor Produto",
      "Comissão",
      "Tarifa",
      "Frete Vendedor",
      "ADS",
      "Impostos",
      "CMV",
      "MC R$",
      "MC %",
      "Status",
    ];

    const rows = sortedPedidos.map((p) => {
      const margemPercent = p.valor_produto > 0 ? (p.margem_contribuicao / p.valor_produto) * 100 : 0;

      return [
        p.canal,
        p.conta_nome || "",
        p.pedido_id || "",
        format(new Date(p.data_pedido), "dd/MM/yyyy HH:mm"),
        p.tipo_envio || "",
        p.qtd_itens,
        p.valor_produto.toFixed(2),
        p.comissao_total.toFixed(2),
        p.tarifa_fixa_total.toFixed(2),
        p.frete_vendedor_total.toFixed(2),
        p.ads_total.toFixed(2),
        p.impostos_total.toFixed(2),
        p.cmv_total.toFixed(2),
        p.margem_contribuicao.toFixed(2),
        margemPercent.toFixed(1),
        p.status,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `pedidos_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Nenhum pedido encontrado para os filtros selecionados</p>
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
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[80px]">Canal</TableHead>
              <TableHead className="w-[100px]">Conta</TableHead>
              <TableHead className="w-[110px]">Nº Pedido</TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:text-foreground"
                onClick={() => handleSort("data_pedido")}
              >
                <div className="flex items-center">
                  Data
                  <SortIcon field="data_pedido" />
                </div>
              </TableHead>
              <TableHead className="w-[80px]">Envio</TableHead>
              <TableHead className="w-[50px] text-center">Qtd</TableHead>
              <TableHead
                className="w-[90px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("valor_produto")}
              >
                <div className="flex items-center justify-end">
                  Produto
                  <SortIcon field="valor_produto" />
                </div>
              </TableHead>
              <TableHead className="w-[80px] text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-end gap-1 cursor-help">
                      Comissão
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">CV - Comissão de venda do marketplace</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-[80px] text-right">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center justify-end gap-1 cursor-help">
                      Tarifa
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Tarifa fixa + financiamento</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-[80px] text-right">Frete V.</TableHead>
              <TableHead className="w-[70px] text-right">ADS</TableHead>
              <TableHead className="w-[70px] text-right">Impostos</TableHead>
              <TableHead className="w-[70px] text-right">CMV</TableHead>
              <TableHead
                className="w-[100px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("margem_contribuicao")}
              >
                <div className="flex items-center justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs font-normal">
                        <strong>Margem de Contribuição</strong><br />
                        MC = Produto - Comissão - Tarifa - Frete V. - ADS - Impostos - CMV
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  MC
                  <SortIcon field="margem_contribuicao" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPedidos.map((pedido) => (
              <PedidosTableRow
                key={pedido.pedido_id}
                pedido={pedido}
                onAbrirMapeamento={onAbrirMapeamento}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <VendasPagination
        currentPage={currentPage}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        pageSize={pageSize}
        onPageChange={onPageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
