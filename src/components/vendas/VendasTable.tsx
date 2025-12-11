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
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface VendasTableProps {
  vendas: VendaDetalhada[];
  aliquotaImposto?: number;
  onConciliar?: (transacaoId: string) => Promise<boolean>;
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

export function VendasTable({ vendas, aliquotaImposto = 6, onConciliar }: VendasTableProps) {
  const [sortField, setSortField] = useState<SortField>("data_venda");
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

  // Função para calcular margem de contribuição completa
  const calcularMargem = (v: VendaDetalhada) => {
    const imposto = v.valor_bruto * (aliquotaImposto / 100);
    const margemRs = v.valor_liquido - v.custo_calculado - v.frete_vendedor - v.custo_ads - imposto;
    const margemPercent = v.valor_bruto > 0 ? (margemRs / v.valor_bruto) * 100 : 0;
    return { margemRs, margemPercent, imposto };
  };

  const handleConciliar = async (transacaoId: string) => {
    if (!onConciliar) return;
    
    setConciliando(transacaoId);
    try {
      await onConciliar(transacaoId);
      toast.success("Transação conciliada com sucesso");
    } catch (error) {
      toast.error("Erro ao conciliar transação");
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
      "SKU",
      "Produto",
      "Qtd",
      "Valor Bruto",
      "Tarifas",
      "Custo",
      "Frete Comprador",
      "Frete Vendedor",
      "Imposto",
      "ADS",
      "Margem R$",
      "Margem %",
      "Status",
    ];

    const rows = sortedVendas.map((v) => {
      const { margemRs, margemPercent, imposto } = calcularMargem(v);

      return [
        v.canal,
        v.conta_nome || "",
        v.pedido_id || v.referencia_externa || "",
        format(new Date(v.data_venda), "dd/MM/yyyy"),
        v.tipo_envio || "",
        v.sku_interno || v.sku_marketplace || "",
        v.produto_nome || v.descricao_item || v.descricao,
        v.quantidade,
        v.valor_bruto.toFixed(2),
        (v.tarifas + v.taxas).toFixed(2),
        v.custo_calculado.toFixed(2),
        v.frete_comprador.toFixed(2),
        v.frete_vendedor.toFixed(2),
        imposto.toFixed(2),
        v.custo_ads.toFixed(2),
        margemRs.toFixed(2),
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

  // Badge de tipo de envio com cores
  const TipoEnvioBadge = ({ tipo }: { tipo: string | null }) => {
    if (!tipo) return <span className="text-muted-foreground">—</span>;
    
    const colors: Record<string, string> = {
      full: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
      flex: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      coleta: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      retirada: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    };

    return (
      <Badge variant="outline" className={cn("text-xs capitalize", colors[tipo.toLowerCase()] || "")}>
        {tipo}
      </Badge>
    );
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
              <TableHead className="w-[100px]">Conta</TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:text-foreground"
                onClick={() => handleSort("data_venda")}
              >
                <div className="flex items-center">
                  Data
                  <SortIcon field="data_venda" />
                </div>
              </TableHead>
              <TableHead className="w-[80px]">Envio</TableHead>
              <TableHead className="min-w-[180px]">Produto</TableHead>
              <TableHead className="w-[80px]">SKU</TableHead>
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
              <TableHead
                className="w-[80px] text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("custo_calculado")}
              >
                <div className="flex items-center justify-end">
                  CMV
                  <SortIcon field="custo_calculado" />
                </div>
              </TableHead>
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
            {sortedVendas.map((v, idx) => {
              const { margemRs, margemPercent, imposto } = calcularMargem(v);

              const margemColor =
                margemRs < 0
                  ? "text-destructive"
                  : margemPercent < 10
                  ? "text-amber-500"
                  : margemPercent < 20
                  ? "text-yellow-600"
                  : "text-emerald-500";

              const hasWarnings = v.sem_custo || v.sem_produto_vinculado || v.nao_conciliado;
              const isConciliando = conciliando === v.transacao_id;

              return (
                <TableRow key={`${v.transacao_id}-${v.item_id || idx}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {v.canal}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
                    {v.conta_nome || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(v.data_venda), "dd/MM/yy")}
                  </TableCell>
                  <TableCell>
                    <TipoEnvioBadge tipo={v.tipo_envio} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5">
                      {hasWarnings && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              {v.sem_custo && <p>• Sem custo</p>}
                              {v.sem_produto_vinculado && <p>• Sem produto</p>}
                              {v.nao_conciliado && <p>• Não conciliado</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <p className="text-xs truncate max-w-[160px]">
                        {v.produto_nome || v.descricao_item || v.descricao}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {v.sku_interno || v.sku_marketplace || "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs">{v.quantidade}</TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {formatCurrency(v.valor_bruto)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive/80">
                    {formatCurrency(v.tarifas + v.taxas)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive/80">
                    {v.sem_custo ? (
                      <span className="text-amber-500">—</span>
                    ) : (
                      formatCurrency(v.custo_calculado)
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {v.frete_comprador > 0 ? (
                      <span className="text-emerald-600">{formatCurrency(v.frete_comprador)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive/80">
                    {v.frete_vendedor > 0 ? formatCurrency(v.frete_vendedor) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive/80">
                    {formatCurrency(imposto)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {v.custo_ads > 0 ? (
                      <span className="text-purple-600">{formatCurrency(v.custo_ads)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right text-xs font-medium", margemColor)}>
                    <div>
                      {formatCurrency(margemRs)}
                      <span className="block text-[10px] opacity-75">
                        {formatPercent(margemPercent)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {v.status === "conciliado" ? (
                        <Badge
                          variant="default"
                          className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Conciliado
                        </Badge>
                      ) : onConciliar ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleConciliar(v.transacao_id)}
                          disabled={isConciliando}
                        >
                          {isConciliando ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Conciliar
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {v.status}
                        </Badge>
                      )}
                    </div>
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
