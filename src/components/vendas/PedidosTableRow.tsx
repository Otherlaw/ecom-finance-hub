import { useState } from "react";
import { format } from "date-fns";
import { PedidoAgregado } from "@/hooks/useVendasPorPedido";
import { useVendaItens, VendaItem } from "@/hooks/useVendaItens";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Link2,
  Loader2,
  Package,
  XCircle,
  HelpCircle,
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

// Mapeamento de status técnicos para labels amigáveis
const STATUS_MAP: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pendente_sync: {
    label: "Pendente de sincronização",
    icon: <Clock className="h-3 w-3 mr-1" />,
    className: "bg-amber-500/10 text-amber-600 border-amber-300",
  },
  pendente: {
    label: "Pendente",
    icon: <Clock className="h-3 w-3 mr-1" />,
    className: "bg-amber-500/10 text-amber-600 border-amber-300",
  },
  importado: {
    label: "Importado",
    icon: <Clock className="h-3 w-3 mr-1" />,
    className: "bg-blue-500/10 text-blue-600 border-blue-300",
  },
  conciliado: {
    label: "Conciliado",
    icon: <Check className="h-3 w-3 mr-1" />,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-300",
  },
  ignorado: {
    label: "Ignorado",
    icon: <XCircle className="h-3 w-3 mr-1" />,
    className: "bg-muted text-muted-foreground",
  },
};

function getStatusDisplay(status: string) {
  const mapped = STATUS_MAP[status?.toLowerCase()];
  if (mapped) return mapped;
  
  // Fallback para status desconhecidos
  return {
    label: status || "Desconhecido",
    icon: <HelpCircle className="h-3 w-3 mr-1" />,
    className: "bg-muted text-muted-foreground",
  };
}

// Badge de tipo de envio com cores
function TipoEnvioBadge({ tipo }: { tipo: string | null }) {
  if (!tipo) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <span className="text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Tipo de envio não informado pela API</p>
        </TooltipContent>
      </Tooltip>
    );
  }

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

  // Verificar se há itens - usar 0 se não houver (não fallback para 1)
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
    // Permitir expandir mesmo sem itens para ver o resumo
    setExpanded(!expanded);
  };

  // Obter display do status
  const statusDisplay = getStatusDisplay(pedido.status);

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          expanded && "bg-muted/30"
        )}
        onClick={handleToggleExpand}
      >
        <TableCell className="w-[30px]">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {pedido.canal}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
          {pedido.conta_nome ? (
            pedido.conta_nome
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-muted-foreground">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Conta não identificada na sincronização</p>
              </TooltipContent>
            </Tooltip>
          )}
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
        <TableCell className="text-center text-xs">
          {temItens ? (
            pedido.qtd_itens
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-muted-foreground">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Itens pendentes de sincronização</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>
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
          {pedido.impostos_total > 0 ? (
            formatCurrency(pedido.impostos_total)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
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
            variant="outline"
            className={cn("text-xs flex items-center w-fit", statusDisplay.className)}
          >
            {statusDisplay.icon}
            {statusDisplay.label}
          </Badge>
        </TableCell>
      </TableRow>

      {/* Área expandida com itens e resumo financeiro */}
      {expanded && (
        <>
          {/* Resumo financeiro do pedido */}
          <TableRow className="bg-muted/20 border-l-4 border-l-primary/30">
            <TableCell colSpan={16}>
              <div className="py-3 px-4">
                <p className="text-sm font-medium mb-3">Resumo do Pedido #{pedido.pedido_id}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Receita Bruta</p>
                    <p className="font-medium text-foreground">{formatCurrency(pedido.valor_produto)}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Comissão (CV)</p>
                    <p className="font-medium text-destructive">-{formatCurrency(pedido.comissao_total)}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Tarifa/Financ.</p>
                    <p className="font-medium text-destructive">-{formatCurrency(pedido.tarifa_fixa_total)}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Frete Vendedor</p>
                    <p className="font-medium text-destructive">
                      {pedido.frete_vendedor_total > 0 
                        ? `-${formatCurrency(pedido.frete_vendedor_total)}`
                        : "—"
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground">ADS</p>
                    <p className="font-medium text-purple-600">
                      {pedido.ads_total > 0 
                        ? `-${formatCurrency(pedido.ads_total)}`
                        : "—"
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      Impostos
                      {pedido.impostos_total === 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Impostos são estimados com base no regime tributário</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <p className="font-medium text-destructive">
                      {pedido.impostos_total > 0 
                        ? `-${formatCurrency(pedido.impostos_total)}`
                        : <span className="text-muted-foreground">—</span>
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground">CMV</p>
                    <p className="font-medium text-orange-600">
                      {cmvTotal > 0 
                        ? `-${formatCurrency(cmvTotal)}`
                        : semCMV 
                          ? <span className="flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="h-3 w-3" /> Sem custo
                            </span>
                          : <span className="text-muted-foreground">—</span>
                      }
                    </p>
                  </div>
                </div>
                
                <Separator className="my-3" />
                
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Margem de Contribuição (MC)</p>
                  <div className={cn("text-right", margemColor)}>
                    <span className="text-lg font-bold">{formatCurrency(margemRs)}</span>
                    <span className="ml-2 text-sm">({formatPercent(margemPercent)})</span>
                  </div>
                </div>
              </div>
            </TableCell>
          </TableRow>

          {/* Lista de itens */}
          {isLoadingItens ? (
            <TableRow>
              <TableCell colSpan={16} className="bg-muted/10">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Carregando itens...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : itens.length === 0 ? (
            <TableRow>
              <TableCell colSpan={16} className="bg-muted/10">
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Package className="h-4 w-4 mr-2" />
                  <span className="text-sm">Nenhum item encontrado para este pedido</span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* Header dos itens */}
              <TableRow className="bg-muted/10">
                <TableCell></TableCell>
                <TableCell colSpan={3} className="text-xs font-medium text-muted-foreground">
                  SKU / Produto
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground text-center">
                  Qtd
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground text-right">
                  Vlr. Unit.
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground text-right">
                  Total
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground text-right">
                  Custo Unit.
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground text-right">
                  CMV Total
                </TableCell>
                <TableCell colSpan={7} className="text-xs font-medium text-muted-foreground text-right">
                  Margem
                </TableCell>
              </TableRow>
              
              {itens.map((item) => {
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
                  <TableRow key={item.id} className="bg-muted/10 border-l-4 border-l-primary/10">
                    <TableCell>
                      {(item.sem_produto || item.sem_custo) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              {item.sem_produto && <p>• Sem produto vinculado</p>}
                              {item.sem_custo && <p>• Sem custo cadastrado</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell colSpan={3}>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.produto_sku || item.sku_marketplace || "—"}
                        </span>
                        <span className="text-xs truncate max-w-[200px]">
                          {item.produto_nome || item.descricao_item || "Produto não identificado"}
                        </span>
                        {item.sem_produto && onAbrirMapeamento && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrirMapeamento(pedido, item);
                            }}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                                       bg-amber-500/10 text-amber-600 border border-amber-300
                                       hover:bg-amber-500/20 transition w-fit mt-1"
                          >
                            <Link2 className="h-3 w-3" />
                            Mapear produto
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium">
                      {item.quantidade}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(item.preco_unitario || 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatCurrency(item.preco_total)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {item.sem_custo ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatCurrency((item.custo_total || 0) / (item.quantidade || 1))
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-orange-600">
                      {item.sem_custo ? (
                        <span className="text-amber-500">—</span>
                      ) : (
                        formatCurrency(itemCusto)
                      )}
                    </TableCell>
                    <TableCell colSpan={7} className={cn("text-right text-xs font-medium", item.sem_custo ? "text-muted-foreground" : itemMargemColor)}>
                      {item.sem_custo ? (
                        "—"
                      ) : (
                        <>
                          {formatCurrency(itemMargem)}
                          <span className="ml-1 text-[10px] opacity-75">
                            ({formatPercent(itemMargemPercent)})
                          </span>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </>
          )}
        </>
      )}
    </>
  );
}
