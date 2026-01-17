import { useState } from "react";
import { format } from "date-fns";
import { TransacaoPaginada } from "@/hooks/useVendasPaginadas";
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

interface VendasTableRowProps {
  transacao: TransacaoPaginada;
  aliquotaImposto: number;
  onConciliar?: (transacaoId: string) => Promise<boolean>;
  onAbrirMapeamento?: (transacao: TransacaoPaginada, item?: VendaItem) => void;
  conciliando: boolean;
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

export function VendasTableRow({
  transacao,
  aliquotaImposto,
  onConciliar,
  onAbrirMapeamento,
  conciliando,
}: VendasTableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { itens, isLoading: isLoadingItens } = useVendaItens(expanded ? transacao.id : null);

  const temItens = transacao.qtd_itens > 0;
  const hasWarnings = transacao.nao_conciliado;

  // CMV vem da RPC (já calculado: quantidade * custo_medio do produto)
  const cmvTotal = transacao.cmv_total || 0;
  const semCMV = cmvTotal === 0 && temItens;
  
  // Calcular Margem de Contribuição (MC) corretamente:
  // MC = valor_bruto - (taxas + tarifas) - frete_vendedor - imposto - ads - CMV
  // Nota: valor_liquido = valor_bruto - (taxas + tarifas), então:
  // MC = valor_liquido - frete_vendedor - imposto - ads - CMV
  const imposto = transacao.valor_bruto * (aliquotaImposto / 100);
  const margemRs = transacao.valor_liquido - transacao.frete_vendedor - transacao.custo_ads - imposto - cmvTotal;
  const margemPercent = transacao.valor_bruto > 0 ? (margemRs / transacao.valor_bruto) * 100 : 0;

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

  const handleConciliar = async () => {
    if (onConciliar) {
      await onConciliar(transacao.id);
    }
  };

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
            {transacao.canal}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]">
          {transacao.conta_nome || "-"}
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">
          {transacao.pedido_id || transacao.referencia_externa || "-"}
        </TableCell>
        <TableCell className="text-xs">
          <div>
            {format(new Date(transacao.data_transacao), "dd/MM/yy")}
            <span className="block text-[10px] text-muted-foreground">
              {format(new Date(transacao.data_transacao), "HH:mm")}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <TipoEnvioBadge tipo={transacao.tipo_envio} />
        </TableCell>
        <TableCell>
          <div className="flex items-start gap-1.5">
            {hasWarnings && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <p>• Não conciliado</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            <div className="flex flex-col gap-1">
              <p className="text-xs truncate max-w-[160px]">
                {transacao.descricao}
              </p>
              {temItens && (
                <span className="text-[10px] text-muted-foreground">
                  {transacao.qtd_itens} {transacao.qtd_itens === 1 ? "item" : "itens"}
                </span>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center text-xs">{transacao.qtd_itens || 1}</TableCell>
        <TableCell className="text-right text-xs font-medium">
          {formatCurrency(transacao.valor_bruto)}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {formatCurrency(transacao.tarifas + transacao.taxas)}
        </TableCell>
        <TableCell className="text-right text-xs">
          {transacao.frete_comprador > 0 ? (
            <span className="text-emerald-600">
              {formatCurrency(transacao.frete_comprador)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {transacao.frete_vendedor > 0 ? (
            formatCurrency(transacao.frete_vendedor)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {formatCurrency(imposto)}
        </TableCell>
        <TableCell className="text-right text-xs">
          {transacao.custo_ads > 0 ? (
            <span className="text-purple-600">
              {formatCurrency(transacao.custo_ads)}
            </span>
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
          <div className="flex items-center gap-1">
            {transacao.status === "conciliado" ? (
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
                onClick={handleConciliar}
                disabled={conciliando}
              >
                {conciliando ? (
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
                {transacao.status}
              </Badge>
            )}
          </div>
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
                  <TableCell>
                    <div className="flex items-start gap-1.5 pl-4">
                      {(item.sem_produto || item.sem_custo) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
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
                        <p className="text-xs truncate max-w-[160px]">
                          {item.produto_nome || item.descricao_item || "Produto não identificado"}
                        </p>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          SKU: {item.produto_sku || item.sku_marketplace || "-"}
                        </span>
                        {item.sem_produto && onAbrirMapeamento && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAbrirMapeamento(transacao, item);
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
                  <TableCell className="text-center text-xs">{item.quantidade}</TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {formatCurrency(item.preco_total)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-xs text-destructive/80">
                    {item.sem_custo ? (
                      <span className="text-amber-500">—</span>
                    ) : (
                      formatCurrency(itemCusto)
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                  <TableCell className={cn("text-right text-xs font-medium", item.sem_custo ? "text-muted-foreground" : itemMargemColor)}>
                    {item.sem_custo ? (
                      <span>—</span>
                    ) : (
                      <div>
                        {formatCurrency(itemMargem)}
                        <span className="block text-[10px] opacity-75">
                          {formatPercent(itemMargemPercent)}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              );
            })
          )}
        </>
      )}
    </>
  );
}
