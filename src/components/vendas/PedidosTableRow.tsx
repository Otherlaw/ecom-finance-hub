import { useState } from "react";
import { format } from "date-fns";
import { PedidoAgregado } from "@/hooks/useVendasPorPedido";
import { useVendaItens, VendaItem } from "@/hooks/useVendaItens";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Loader2,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface PedidosTableRowProps {
  pedido: PedidoAgregado;
  onAbrirMapeamento?: (pedido: PedidoAgregado, item?: VendaItem) => void;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

// Badge de tipo de envio com cores
function TipoEnvioBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) return <span className="text-muted-foreground">—</span>;

  const colors: Record<string, string> = {
    full: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    flex: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    coleta: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    retirada: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    places: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", colors[tipo.toLowerCase()] || "")}
    >
      {tipo}
    </Badge>
  );
}

export function PedidosTableRow({
  pedido,
  onAbrirMapeamento,
}: PedidosTableRowProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Buscar transaction_id pelo pedido_id para depois buscar itens
  const { data: transactionId } = useQuery({
    queryKey: ["pedido-transaction-id", pedido.pedido_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_transactions")
        .select("id")
        .eq("pedido_id", pedido.pedido_id)
        .eq("tipo_transacao", "venda")
        .limit(1)
        .single();
      return data?.id || null;
    },
    enabled: expanded,
  });

  const { itens, isLoading: isLoadingItens } = useVendaItens(expanded && transactionId ? transactionId : null);

  const temItens = pedido.qtd_itens > 0;
  
  // CMV e margem
  const cmvTotal = pedido.cmv_total || 0;
  const semCMV = cmvTotal === 0 && temItens;
  
  // Margem de contribuição já vem calculada pela RPC
  const margemRs = pedido.margem_contribuicao;
  const margemPercent = pedido.valor_produto > 0 ? (margemRs / pedido.valor_produto) * 100 : 0;

  const margemColor = semCMV
    ? "text-muted-foreground"
    : margemRs < 0
    ? "text-destructive"
    : margemPercent < 10
    ? "text-amber-500"
    : margemPercent < 20
    ? "text-yellow-600"
    : "text-emerald-500";

  const handleToggleExpand = () => {
    if (temItens) {
      setExpanded(!expanded);
    }
  };

  // Total de custos para exibição
  const totalCustos = pedido.comissao_total + pedido.tarifa_fixa_total;

  return (
    <>
      <TableRow
        className={cn(
          temItens && "cursor-pointer hover:bg-muted/50",
          expanded && "bg-muted/30"
        )}
        onClick={handleToggleExpand}
      >
        <TableCell className="w-[30px]">
          {temItens ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : null}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {pedido.canal}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
          {pedido.conta_nome || "-"}
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">
          {pedido.pedido_id || "-"}
        </TableCell>
        <TableCell className="text-xs">
          <div>
            {format(new Date(pedido.data_pedido), "dd/MM/yy")}
            <span className="block text-[10px] text-muted-foreground">
              {format(new Date(pedido.data_pedido), "HH:mm")}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <TipoEnvioBadge tipo={pedido.tipo_envio} />
        </TableCell>
        <TableCell className="text-center text-xs">{pedido.qtd_itens || 1}</TableCell>
        <TableCell className="text-right text-xs font-medium">
          {formatCurrency(pedido.valor_produto)}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatCurrency(pedido.comissao_total)}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Comissão de venda (CV)</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatCurrency(pedido.tarifa_fixa_total)}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Tarifa fixa + financiamento</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {pedido.frete_vendedor_total > 0 ? (
            formatCurrency(pedido.frete_vendedor_total)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs">
          {pedido.ads_total > 0 ? (
            <span className="text-purple-600">
              {formatCurrency(pedido.ads_total)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {formatCurrency(pedido.impostos_total)}
        </TableCell>
        <TableCell className="text-right text-xs">
          {cmvTotal > 0 ? (
            <span className="text-orange-600">{formatCurrency(cmvTotal)}</span>
          ) : semCMV ? (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3 w-3 text-amber-500 inline" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Custo não cadastrado</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className={cn("text-right text-xs font-medium", margemColor)}>
          {semCMV ? (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center justify-end gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-muted-foreground">Sem CMV</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  MC não pode ser calculada pois os produtos não têm custo cadastrado.
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div>
              {formatCurrency(margemRs)}
              <span className="block text-[10px] opacity-75">
                {formatPercent(margemPercent)}
              </span>
            </div>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Badge
            variant={pedido.status === "conciliado" ? "default" : "secondary"}
            className={cn(
              "text-xs",
              pedido.status === "conciliado" && "bg-emerald-500/10 text-emerald-600"
            )}
          >
            {pedido.status === "conciliado" ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Conciliado
              </>
            ) : (
              pedido.status
            )}
          </Badge>
        </TableCell>
      </TableRow>

      {/* Linhas expandidas com itens */}
      {expanded && (
        <>
          {isLoadingItens ? (
            <TableRow>
              <TableCell colSpan={16} className="bg-muted/20">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Carregando itens...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : itens.length === 0 ? (
            <TableRow>
              <TableCell colSpan={16} className="bg-muted/20">
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Package className="h-4 w-4 mr-2" />
                  <span className="text-sm">Nenhum item encontrado</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            itens.map((item) => {
              const itemCusto = item.custo_total;
              const itemMargem = item.preco_total - itemCusto;
              const itemMargemPercent = item.preco_total > 0 ? (itemMargem / item.preco_total) * 100 : 0;

              const itemMargemColor =
                itemMargem < 0
                  ? "text-destructive"
                  : itemMargemPercent < 10
                  ? "text-amber-500"
                  : "text-emerald-500";

              return (
                <TableRow key={item.id} className="bg-muted/20 border-l-4 border-l-primary/20">
                  <TableCell></TableCell>
                  <TableCell colSpan={5}></TableCell>
                  <TableCell className="text-center text-xs">{item.quantidade}</TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {formatCurrency(item.preco_total)}
                  </TableCell>
                  <TableCell colSpan={5}></TableCell>
                  <TableCell className="text-right text-xs text-orange-600">
                    {item.sem_custo ? (
                      <span className="text-amber-500">—</span>
                    ) : (
                      formatCurrency(itemCusto)
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right text-xs font-medium", item.sem_custo ? "text-muted-foreground" : itemMargemColor)}>
                    {item.sem_custo ? "—" : formatCurrency(itemMargem)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5 pl-4">
                      {(item.sem_produto || item.sem_custo) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              {item.sem_produto && <p>• Sem produto vinculado</p>}
                              {item.sem_custo && <p>• Sem custo cadastrado</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="flex flex-col gap-1">
                        <p className="text-xs truncate max-w-[140px]">
                          {item.produto_nome || item.descricao_item || "Produto não identificado"}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {item.produto_sku || item.sku_marketplace || "-"}
                        </span>
                        {item.sem_produto && onAbrirMapeamento && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrirMapeamento(pedido, item);
                            }}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                                       bg-amber-500/10 text-amber-600 border border-amber-300
                                       hover:bg-amber-500/20 transition w-fit"
                          >
                            <Link2 className="h-3 w-3" />
                            Mapear
                          </button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </>
      )}
    </>
  );
}
