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
import { Package, CheckCircle2 } from "lucide-react";
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
      })));
    }
    
    // Default armazém
    if (compra?.armazem_destino_id) {
      setArmazemId(compra.armazem_destino_id);
    }
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

  const handleSubmit = async () => {
    if (!compra || totalRecebendo === 0 || !armazemId) return;

    setIsSubmitting(true);

    try {
      await registrarRecebimento.mutateAsync({
        compra_id: compra.id,
        armazem_id: armazemId,
        data_recebimento: dataRecebimento,
        observacoes: observacao || undefined,
        itens: itens
          .filter(item => item.quantidade_receber > 0 || item.quantidade_devolvida > 0)
          .map(item => ({
            compra_item_id: item.compra_item_id,
            produto_id: item.produto_id || '',
            quantidade_recebida: item.quantidade_receber,
            quantidade_devolvida: item.quantidade_devolvida,
            custo_unitario: item.custo_unitario,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Registrar Recebimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>NF / Fornecedor</Label>
              <p className="text-sm font-medium">
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
          </div>

          <div>
            <Label className="mb-2 block">Itens do Pedido</Label>
            <ScrollArea className="border rounded-md h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center w-24">Pedido</TableHead>
                    <TableHead className="text-center w-24">Recebido</TableHead>
                    <TableHead className="text-center w-24">Restante</TableHead>
                    <TableHead className="text-center w-28">Receber Agora</TableHead>
                    <TableHead className="text-center w-24">Devolvido</TableHead>
                    <TableHead className="text-right w-28">Custo Unit.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, index) => (
                    <TableRow key={item.compra_item_id}>
                      <TableCell>
                        <div className="max-w-64 truncate" title={item.descricao}>
                          {item.descricao}
                        </div>
                        {item.produto_id && (
                          <Badge variant="outline" className="mt-1 text-xs">SKU vinculado</Badge>
                        )}
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
                          <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantidade_restante}
                          value={item.quantidade_receber}
                          onChange={(e) => handleQuantidadeChange(index, Number(e.target.value))}
                          className="w-20 text-center mx-auto"
                          disabled={item.quantidade_restante === 0}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantidade_devolvida}
                          onChange={(e) => handleDevolvidaChange(index, Number(e.target.value))}
                          className="w-20 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.custo_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

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
          <Button onClick={handleSubmit} disabled={isSubmitting || totalRecebendo === 0 || !armazemId}>
            {isSubmitting ? "Registrando..." : "Confirmar Recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
