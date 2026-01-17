import { useState } from "react";
import { TransacaoPaginada } from "@/hooks/useVendasPaginadas";
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
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { VendasTableRow } from "./VendasTableRow";
import { VendasPagination } from "./VendasPagination";

interface VendasTablePaginadaProps {
  transacoes: TransacaoPaginada[];
  aliquotaImposto?: number;
  currentPage: number;
  totalPaginas: number;
  totalRegistros: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onConciliar?: (transacaoId: string) => Promise<boolean>;
  onAbrirMapeamento?: (transacao: TransacaoPaginada, item?: VendaItem) => void;
  isLoading?: boolean;
}

type SortField = "data_transacao" | "valor_bruto" | "valor_liquido" | "margem";
type SortOrder = "asc" | "desc";

export function VendasTablePaginada({
  transacoes,
  aliquotaImposto = 6,
  currentPage,
  totalPaginas,
  totalRegistros,
  pageSize,
  onPageChange,
  onConciliar,
  onAbrirMapeamento,
  isLoading,
}: VendasTablePaginadaProps) {
  const [sortField, setSortField] = useState<SortField>("data_transacao");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [conciliando, setConciliando] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortedTransacoes = [...transacoes].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "data_transacao":
        aVal = new Date(a.data_transacao).getTime();
        bVal = new Date(b.data_transacao).getTime();
        break;
      case "valor_bruto":
        aVal = a.valor_bruto;
        bVal = b.valor_bruto;
        break;
      case "valor_liquido":
        aVal = a.valor_liquido;
        bVal = b.valor_liquido;
        break;
      case "margem":
        aVal = a.valor_liquido - a.frete_vendedor - a.custo_ads;
        bVal = b.valor_liquido - b.frete_vendedor - b.custo_ads;
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

  const handleConciliar = async (transacaoId: string): Promise<boolean> => {
    if (!onConciliar) return false;

    setConciliando(transacaoId);
    try {
      const result = await onConciliar(transacaoId);
      return result;
    } finally {
      setConciliando(null);
    }
  };

  const handleExport = () => {
    const headers = [
      "Canal",
      "Conta",
      "Pedido",
      "Data",
      "Tipo Envio",
      "Descrição",
      "Qtd Itens",
      "Valor Bruto",
      "Tarifas",
      "Frete Comprador",
      "Frete Vendedor",
      "Imposto",
      "ADS",
      "Margem R$",
      "Status",
    ];

    const rows = sortedTransacoes.map((t) => {
      const imposto = t.valor_bruto * (aliquotaImposto / 100);
      const margemRs = t.valor_liquido - t.frete_vendedor - t.custo_ads - imposto;

      return [
        t.canal,
        t.conta_nome || "",
        t.pedido_id || t.referencia_externa || "",
        format(new Date(t.data_transacao), "dd/MM/yyyy HH:mm"),
        t.tipo_envio || "",
        t.descricao,
        t.qtd_itens,
        t.valor_bruto.toFixed(2),
        (t.tarifas + t.taxas).toFixed(2),
        t.frete_comprador.toFixed(2),
        t.frete_vendedor.toFixed(2),
        imposto.toFixed(2),
        t.custo_ads.toFixed(2),
        margemRs.toFixed(2),
        t.status,
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
      `vendas_${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (transacoes.length === 0) {
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
              <TableHead className="w-[30px]"></TableHead>
              <TableHead className="w-[80px]">Canal</TableHead>
              <TableHead className="w-[100px]">Conta</TableHead>
              <TableHead className="w-[90px]">Nº Pedido</TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:text-foreground"
                onClick={() => handleSort("data_transacao")}
              >
                <div className="flex items-center">
                  Data
                  <SortIcon field="data_transacao" />
                </div>
              </TableHead>
              <TableHead className="w-[80px]">Envio</TableHead>
              <TableHead className="min-w-[180px]">Descrição</TableHead>
              <TableHead className="w-[50px] text-center">Qtd</TableHead>
              <TableHead
                className="w-[90px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("valor_bruto")}
              >
                <div className="flex items-center justify-end">
                  Bruto
                  <SortIcon field="valor_bruto" />
                </div>
              </TableHead>
              <TableHead className="w-[70px] text-right">Tarifas</TableHead>
              <TableHead className="w-[80px] text-right">Frete C.</TableHead>
              <TableHead className="w-[80px] text-right">Frete V.</TableHead>
              <TableHead className="w-[70px] text-right">Imposto</TableHead>
              <TableHead className="w-[70px] text-right">ADS</TableHead>
              <TableHead
                className="w-[100px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("margem")}
              >
                <div className="flex items-center justify-end">
                  MC
                  <SortIcon field="margem" />
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransacoes.map((transacao) => (
              <VendasTableRow
                key={transacao.id}
                transacao={transacao}
                aliquotaImposto={aliquotaImposto}
                onConciliar={handleConciliar}
                onAbrirMapeamento={onAbrirMapeamento}
                conciliando={conciliando === transacao.id}
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
