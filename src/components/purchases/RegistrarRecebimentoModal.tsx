import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Package, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Compra, useRecebimentos } from "@/hooks/useCompras";
import { useArmazens } from "@/hooks/useArmazens";
import { ArmazemSelect } from "@/components/ArmazemSelect";
import { format } from "date-fns";

interface RegistrarRecebimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: Compra | null;
  onSuccess?: () => void;
}

interface ItemRecebimento {
  compra_item_id: string;
  produto_id: string | null;
  descricao: string;
  quantidade_pedida: number;
  quantidade_ja_recebida: number;
  quantidade_restante: number;
  quantidade_receber: number;
  quantidade_devolvida: number;
  custo_unitario: number;
  // Campos adicionais para custo efetivo
  valor_ipi: number;
  valor_icms: number;
  aliquota_icms: number;
  ncm: string | null;
}

export function RegistrarRecebimentoModal({
  open,
  onOpenChange,
  compra,
  onSuccess,
}: RegistrarRecebimentoModalProps) {
  const { registrarRecebimento } = useRecebimentos(compra?.id || null);
  const { armazens } = useArmazens({ empresaId: compra?.empresa_id, apenasAtivos: true });
  
  const [armazemId, setArmazemId] = useState<string | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemRecebimento[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [encerrarPedido, setEncerrarPedido] = useState(false);

  // Cálculo de custo efetivo com rateio de frete
  const calcularCustoEfetivo = (item: ItemRecebimento, valorFrete: number, valorProdutos: number) => {
    if (item.quantidade_pedida <= 0 || valorProdutos <= 0) return item.custo_unitario;
    
    const valorItemTotal = item.custo_unitario * item.quantidade_pedida;
    const proporcaoItem = valorItemTotal / valorProdutos;
    const freteRateado = valorFrete * proporcaoItem;
    const ipiItem = item.valor_ipi || 0;
    
    const custoTotalItem = valorItemTotal + freteRateado + ipiItem;
    return custoTotalItem / item.quantidade_pedida;
  };

  useEffect(() => {
    if (compra?.itens) {
      setItens(compra.itens.map(item => ({
        compra_item_id: item.id,
        produto_id: item.produto_id,
        descricao: item.descricao_nf,
        quantidade_pedida: item.quantidade,
        quantidade_ja_recebida: item.quantidade_recebida,
        quantidade_restante: item.quantidade - item.quantidade_recebida,
        quantidade_receber: Math.max(0, item.quantidade - item.quantidade_recebida),
        quantidade_devolvida: 0,
        custo_unitario: item.valor_unitario,
        valor_ipi: item.valor_ipi || 0,
        valor_icms: item.valor_icms || 0,
        aliquota_icms: item.aliquota_icms || 0,
        ncm: item.ncm,
      })));
    }
    
    // Default armazém
    if (compra?.armazem_destino_id) {
      setArmazemId(compra.armazem_destino_id);
    }
    
    // Reset encerrar pedido ao abrir
    setEncerrarPedido(false);
  }, [compra]);

  // Quando tem armazéns disponíveis e nenhum selecionado, selecionar o primeiro
  useEffect(() => {
    if (armazens.length > 0 && !armazemId && !compra?.armazem_destino_id) {
      setArmazemId(armazens[0].id);
    }
  }, [armazens, armazemId, compra?.armazem_destino_id]);

  const handleQuantidadeChange = (index: number, value: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const quantidade_receber = Math.min(Math.max(0, value), item.quantidade_restante);
      return { ...item, quantidade_receber };
    }));
  };

  const handleDevolvidaChange = (index: number, value: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const quantidade_devolvida = Math.max(0, value);
      return { ...item, quantidade_devolvida };
    }));
  };

  const totalRecebendo = itens.reduce((sum, i) => sum + i.quantidade_receber, 0);
  const totalDevolvendo = itens.reduce((sum, i) => sum + i.quantidade_devolvida, 0);
  const totalRestante = itens.reduce((sum, i) => sum + i.quantidade_restante, 0);
  
  // Permite submeter se: (tem algo para receber) OU (está encerrando o pedido)
  const canSubmit = !isSubmitting && armazemId && (totalRecebendo > 0 || encerrarPedido);

  const handleSubmit = async () => {
    if (!compra || !armazemId) return;
    if (totalRecebendo === 0 && !encerrarPedido) return;

    setIsSubmitting(true);

    try {
      // Montar observação incluindo nota de encerramento manual se aplicável
      let obsCompleta = observacao || "";
      if (encerrarPedido && totalRecebendo === 0) {
        const unidadesPendentes = totalRestante;
        obsCompleta = `[ENCERRADO MANUALMENTE] Pedido concluído com ${unidadesPendentes} unidades pendentes não recebidas.${observacao ? ` | ${observacao}` : ''}`;
      } else if (encerrarPedido && totalRecebendo > 0) {
        const unidadesNaoRecebidas = totalRestante - totalRecebendo;
        if (unidadesNaoRecebidas > 0) {
          obsCompleta = `[ENCERRADO MANUALMENTE] Pedido concluído com ${unidadesNaoRecebidas} unidades restantes não recebidas.${observacao ? ` | ${observacao}` : ''}`;
        }
      }

      await registrarRecebimento.mutateAsync({
        compra_id: compra.id,
        armazem_id: armazemId,
        data_recebimento: dataRecebimento,
        observacoes: obsCompleta || undefined,
        forcar_conclusao: encerrarPedido,
        valor_frete: compra.valor_frete,
        valor_produtos: compra.valor_produtos,
        itens: itens
          .filter(item => item.quantidade_receber > 0 || item.quantidade_devolvida > 0)
          .map(item => ({
            compra_item_id: item.compra_item_id,
            produto_id: item.produto_id || null, // Corrigido: usar null ao invés de string vazia
            quantidade_recebida: item.quantidade_receber,
            quantidade_devolvida: item.quantidade_devolvida,
            custo_unitario: item.custo_unitario,
            custo_efetivo: calcularCustoEfetivo(item, compra.valor_frete, compra.valor_produtos),
            valor_ipi: item.valor_ipi,
            valor_icms: item.valor_icms,
            aliquota_icms: item.aliquota_icms,
            ncm: item.ncm,
          })),
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Erro ao registrar recebimento:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!compra) return null;

  const formatCurrency = (value: number) => 
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Registrar Recebimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>NF / Fornecedor</Label>
              <p className="text-sm font-medium truncate" title={`${compra.numero_nf ? `NF ${compra.numero_nf} - ` : ''}${compra.fornecedor_nome}`}>
                {compra.numero_nf ? `NF ${compra.numero_nf} - ` : ''}{compra.fornecedor_nome}
              </p>
            </div>
            <div>
              <Label>Armazém Destino</Label>
              <ArmazemSelect
                value={armazemId}
                onValueChange={setArmazemId}
                empresaId={compra.empresa_id}
                placeholder="Selecione o armazém"
              />
            </div>
            <div>
              <Label>Data do Recebimento</Label>
              <Input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
              />
            </div>
            <div>
              <Label>Frete a ratear</Label>
              <p className="text-sm font-medium">{formatCurrency(compra.valor_frete)}</p>
            </div>
          </div>

          {/* Alerta de itens não mapeados */}
          {itens.some(i => !i.produto_id) && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Itens sem produto vinculado</p>
                <p className="text-sm text-amber-700">
                  {itens.filter(i => !i.produto_id).length} item(ns) não darão entrada no estoque. 
                  Vincule os produtos no módulo de Compras para registrar movimentação de estoque.
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            <Label className="mb-2 block">Itens do Pedido</Label>
            <div className="border rounded-md overflow-auto h-[280px]">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produto</TableHead>
                      <TableHead className="text-center w-16">Pedido</TableHead>
                      <TableHead className="text-center w-16">Receb.</TableHead>
                      <TableHead className="text-center w-16">Rest.</TableHead>
                      <TableHead className="text-center w-20">Receber</TableHead>
                      <TableHead className="text-center w-20">Devol.</TableHead>
                      <TableHead className="text-right w-24">Custo NF</TableHead>
                      <TableHead className="text-right w-28">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1 ml-auto">
                              Custo Efetivo <Info className="h-3 w-3" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Custo unitário + frete rateado + IPI proporcional</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                      <TableHead className="text-right w-24">ICMS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, index) => {
                      const custoEfetivo = calcularCustoEfetivo(item, compra.valor_frete, compra.valor_produtos);
                      return (
                        <TableRow key={item.compra_item_id}>
                          <TableCell>
                            <div className="max-w-[200px] truncate" title={item.descricao}>
                              {item.descricao}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {item.produto_id && (
                                <Badge variant="outline" className="text-xs">SKU</Badge>
                              )}
                              {item.ncm && (
                                <Badge variant="secondary" className="text-xs">NCM: {item.ncm}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {item.quantidade_pedida}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantidade_ja_recebida > 0 ? (
                              <Badge variant="secondary">{item.quantidade_ja_recebida}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.quantidade_restante > 0 ? (
                              <Badge variant="outline">{item.quantidade_restante}</Badge>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              max={item.quantidade_restante}
                              value={item.quantidade_receber}
                              onChange={(e) => handleQuantidadeChange(index, Number(e.target.value))}
                              className="w-16 text-center mx-auto"
                              disabled={item.quantidade_restante === 0}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantidade_devolvida}
                              onChange={(e) => handleDevolvidaChange(index, Number(e.target.value))}
                              className="w-16 text-center mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.custo_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  {formatCurrency(custoEfetivo)}
                                </TooltipTrigger>
                                <TooltipContent className="p-3">
                                  <div className="space-y-1 text-xs">
                                    <p><strong>Detalhes do cálculo:</strong></p>
                                    <p>Custo NF: {formatCurrency(item.custo_unitario)}</p>
                                    <p>Frete rateado: {formatCurrency((compra.valor_frete * (item.custo_unitario * item.quantidade_pedida / compra.valor_produtos)) / item.quantidade_pedida)}</p>
                                    {item.valor_ipi > 0 && <p>IPI: {formatCurrency(item.valor_ipi / item.quantidade_pedida)}</p>}
                                    <p className="pt-1 border-t"><strong>Total: {formatCurrency(custoEfetivo)}</strong></p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {item.valor_icms > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-green-600">
                                      {formatCurrency(item.valor_icms)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Alíquota: {item.aliquota_icms}%</p>
                                    <p>Crédito potencial</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* Opção de encerrar pedido - aparece quando há itens restantes */}
          {totalRestante > 0 && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Switch 
                checked={encerrarPedido} 
                onCheckedChange={setEncerrarPedido}
                id="encerrar-pedido"
              />
              <div className="flex-1">
                <label htmlFor="encerrar-pedido" className="font-medium text-amber-800 dark:text-amber-200 cursor-pointer flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Encerrar pedido sem receber o restante
                </label>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Marca como concluído mesmo com {totalRestante} {totalRestante === 1 ? 'unidade pendente' : 'unidades pendentes'}
                </p>
              </div>
            </div>
          )}

          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações sobre o recebimento..."
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <span className="text-sm text-muted-foreground">Total a receber:</span>
              <span className="ml-2 font-bold text-lg">{totalRecebendo} unidades</span>
            </div>
            {totalDevolvendo > 0 && (
              <div>
                <span className="text-sm text-muted-foreground">Devoluções:</span>
                <span className="ml-2 font-bold text-lg text-destructive">{totalDevolvendo} unidades</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting 
              ? "Registrando..." 
              : encerrarPedido && totalRecebendo === 0 
                ? "Encerrar Pedido" 
                : "Confirmar Recebimento"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
