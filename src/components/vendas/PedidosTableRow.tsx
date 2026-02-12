import { useState } from "react";
import { formatInBrasilia } from "@/lib/dateRangeUtc";
import { PedidoAgregado } from "@/hooks/useVendasPorPedido";
import { useVendaItens, VendaItem } from "@/hooks/useVendaItens";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Link2,
  Loader2,
  Package,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapearCmvModal } from "./MapearCmvModal";
import { MapearItensPedidoModal } from "./MapearItensPedidoModal";
import { MlThumbnail } from "./MlThumbnail";
import { MlThumbnailStack } from "./MlThumbnailStack";

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
  const [showCmvModal, setShowCmvModal] = useState(false);
  const [showMapeamentoManual, setShowMapeamentoManual] = useState(false);
  const [itemParaMapear, setItemParaMapear] = useState<VendaItem | null>(null);
  const queryClient = useQueryClient();
  
  // Buscar TODAS as transactions do pedido/pack (packs têm múltiplas orders)
  // pedido.pedido_id vem da RPC como COALESCE(pack_id, pedido_id)
  const { data: transactionData } = useQuery({
    queryKey: ["pedido-transaction-ids", pedido.pedido_id],
    queryFn: async () => {
      // Buscar por pack_id OU pedido_id para cobrir packs com múltiplas orders
      const { data } = await supabase
        .from("marketplace_transactions")
        .select("id, empresa_id")
        .or(`pack_id.eq.${pedido.pedido_id},pedido_id.eq.${pedido.pedido_id}`)
        .eq("tipo_transacao", "venda");
      return data || [];
    },
    enabled: expanded,
  });

  const transactionIds = expanded && transactionData && transactionData.length > 0
    ? transactionData.map(t => t.id)
    : null;
  const firstEmpresaId = transactionData?.[0]?.empresa_id;

  const { itens, isLoading: isLoadingItens } = useVendaItens(transactionIds);

  const handleAbrirCmvModal = (item: VendaItem) => {
    setItemParaMapear(item);
    setShowCmvModal(true);
  };

  const handleCmvSalvo = () => {
    queryClient.invalidateQueries({ queryKey: ["venda-itens"] });
    queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
  };

  // Verificar se há itens - usar 0 se não houver (não fallback para 1)
  const temItens = pedido.qtd_itens > 0;
  
  // CMV e margem - usar a flag tem_cmv da RPC
  const cmvTotal = pedido.cmv_total;
  const semCMV = !pedido.tem_cmv && temItens;
  
  // Margem de contribuição já vem calculada pela RPC (pode ser null)
  const margemRs = pedido.margem_contribuicao ?? 0;
  const margemPercent = pedido.valor_produto > 0 && pedido.margem_contribuicao != null 
    ? (margemRs / pedido.valor_produto) * 100 
    : 0;

  const margemColor = semCMV || pedido.margem_contribuicao == null
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
          expanded && "bg-muted/30",
          semCMV && "bg-amber-500/5 hover:bg-amber-500/10"
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
        <TableCell className="w-[50px] p-1">
          {itens.length > 1 ? (
            <MlThumbnailStack
              anuncioIds={itens.map(i => i.anuncio_id)}
              size={36}
            />
          ) : (
            <MlThumbnail anuncioId={pedido.primeiro_anuncio_id} size={36} />
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {pedido.canal}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
          {pedido.empresa_nome_fantasia || pedido.conta_nome || (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-muted-foreground">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Empresa não identificada</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">
          {pedido.pedido_id ? (
            <Tooltip>
              <TooltipTrigger>
                <span>...{pedido.pedido_id.slice(-8)}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-mono">{pedido.pedido_id}</p>
              </TooltipContent>
            </Tooltip>
          ) : "-"}
        </TableCell>
        <TableCell className="text-xs">
          <div>
            {formatInBrasilia(pedido.data_pedido, "dd/MM/yy")}
            <span className="block text-[10px] text-muted-foreground">
              {formatInBrasilia(pedido.data_pedido, "HH:mm")}
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
          {pedido.comissao_total === null || pedido.comissao_total === undefined ? (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-muted-foreground">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pendente de enriquecimento. Re-sincronize para obter.</p>
              </TooltipContent>
            </Tooltip>
          ) : pedido.comissao_total > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{formatCurrency(pedido.comissao_total)}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Comissão de venda (CV)</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right text-xs text-destructive/80">
          {pedido.frete_vendedor_total === null || pedido.frete_vendedor_total === undefined ? (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-muted-foreground">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Pendente de enriquecimento. Re-sincronize para obter.</p>
              </TooltipContent>
            </Tooltip>
          ) : pedido.frete_vendedor_total > 0 ? (
            formatCurrency(pedido.frete_vendedor_total)
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
        <TableCell className="text-right text-xs" onClick={(e) => e.stopPropagation()}>
          {cmvTotal > 0 ? (
            <span className="text-orange-600">{formatCurrency(cmvTotal)}</span>
          ) : semCMV ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleExpand}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                             bg-amber-500/10 text-amber-600 border border-amber-300
                             hover:bg-amber-500/20 transition text-[10px] font-medium"
                >
                  <Link2 className="h-3 w-3" />
                  Mapear
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Clique para expandir e mapear os produtos</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className={cn("text-right text-xs font-medium", margemColor)} onClick={(e) => e.stopPropagation()}>
          {semCMV ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleExpand}
                  className="flex items-center justify-end gap-1 text-amber-500 hover:text-amber-600"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">Pendente</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Expanda o pedido para mapear os produtos e calcular a margem
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
             <TableCell colSpan={15}>
              <div className="py-3 px-4">
                <p className="text-sm font-medium mb-3">Resumo do Pedido #{pedido.pedido_id}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Receita Bruta</p>
                    <p className="font-medium text-foreground">{formatCurrency(pedido.valor_produto)}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      Comissão (CV)
                      {(pedido.comissao_total === null || pedido.comissao_total === undefined) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Pendente de enriquecimento</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <p className="font-medium text-destructive">
                      {pedido.comissao_total === null || pedido.comissao_total === undefined
                        ? <span className="text-muted-foreground">—</span>
                        : pedido.comissao_total > 0 
                          ? `-${formatCurrency(pedido.comissao_total)}`
                          : <span className="text-muted-foreground">—</span>
                      }
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-muted-foreground flex items-center gap-1">
                      Frete Vendedor
                      {(pedido.frete_vendedor_total === null || pedido.frete_vendedor_total === undefined) && (
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3 w-3 text-amber-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Pendente de enriquecimento</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <p className="font-medium text-destructive">
                      {pedido.frete_vendedor_total === null || pedido.frete_vendedor_total === undefined
                        ? <span className="text-muted-foreground">—</span>
                        : pedido.frete_vendedor_total > 0 
                          ? `-${formatCurrency(pedido.frete_vendedor_total)}`
                          : <span className="text-muted-foreground">—</span>
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
             <TableCell colSpan={15} className="bg-muted/10">
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Carregando itens...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : itens.length === 0 ? (
            <TableRow>
              <TableCell colSpan={15} className="bg-muted/10">
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-3">
                  <Package className="h-8 w-8 opacity-50" />
                  <span className="text-sm font-medium">Itens pendentes de sincronização</span>
                  <p className="text-xs text-center max-w-sm">
                    Os itens deste pedido ainda não foram sincronizados da API. 
                    Aguarde a próxima sincronização automática ou importe o relatório do canal.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMapeamentoManual(true);
                      }}
                      className="text-xs"
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Criar Mapeamento Manual
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* Header dos itens com botão de mapeamento em lote */}
               <TableRow className="bg-muted/10">
                <TableCell colSpan={2}>
                  {itens.some(i => i.sem_produto) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMapeamentoManual(true);
                      }}
                      className="text-[10px] h-6 px-2 bg-amber-500/10 border-amber-300 text-amber-600 hover:bg-amber-500/20"
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Mapear Todos
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  Imagem
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  SKU Marketplace
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  SKU Produto
                </TableCell>
                <TableCell className="text-xs font-medium text-muted-foreground">
                  Descrição
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
                <TableCell colSpan={5} className="text-xs font-medium text-muted-foreground text-right">
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
                              {item.sem_produto && <p>• Sem produto vinculado - clique em "Mapear produto"</p>}
                              {!item.sem_produto && item.sem_custo && (
                                <p>• Produto sem custo cadastrado - configure o custo médio no cadastro de produtos</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="p-1">
                      <MlThumbnail anuncioId={item.anuncio_id} size={32} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.sku_marketplace || "—"}
                        </span>
                        {item.anuncio_id && item.anuncio_id !== item.sku_marketplace && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            {item.anuncio_id}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {item.produto_sku ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-foreground">
                              {item.produto_sku}
                            </span>
                            {/* Botão remapear para itens já mapeados */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirCmvModal(item);
                              }}
                              className="text-[10px] text-muted-foreground hover:text-primary transition"
                              title="Remapear produto"
                            >
                              <Link2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {/* Botão mapear: aparece se não tem produto_id */}
                        {item.sem_produto && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirCmvModal(item);
                            }}
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                                       bg-amber-500/10 text-amber-600 border border-amber-300
                                       hover:bg-amber-500/20 transition w-fit"
                          >
                            <Link2 className="h-3 w-3" />
                            Mapear SKU
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs truncate max-w-[180px]">
                          {item.produto_nome || item.descricao_item || "Produto não identificado"}
                        </span>
                        {/* Alerta: produto mapeado mas sem custo */}
                        {!item.sem_produto && item.sem_custo && (
                          <span className="text-[10px] text-amber-600">
                            ⚠ Sem custo cadastrado
                          </span>
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
                    <TableCell colSpan={5} className={cn("text-right text-xs font-medium", item.sem_custo ? "text-muted-foreground" : itemMargemColor)}>
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

      {/* Modal de mapeamento de CMV */}
      {showCmvModal && itemParaMapear && firstEmpresaId && (
        <MapearCmvModal
          open={showCmvModal}
          onOpenChange={setShowCmvModal}
          empresaId={firstEmpresaId}
          item={itemParaMapear}
          canal={pedido.canal}
          onSuccess={handleCmvSalvo}
        />
      )}

      {/* Modal de mapeamento de itens do pedido */}
      {showMapeamentoManual && (
        <MapearItensPedidoModal
          open={showMapeamentoManual}
          onOpenChange={setShowMapeamentoManual}
          empresaId={pedido.empresa_id}
          pedidoId={pedido.pedido_id}
          canal={pedido.canal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendas-por-pedido"] });
            queryClient.invalidateQueries({ queryKey: ["venda-itens"] });
          }}
        />
      )}
    </>
  );
}
