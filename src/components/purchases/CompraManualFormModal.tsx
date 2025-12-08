import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useProdutos } from "@/hooks/useProdutos";
import { useCompras } from "@/hooks/useCompras";
import { format } from "date-fns";

interface CompraManualFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ItemCompra {
  id: string;
  produto_id: string | null;
  descricao_nf: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

export function CompraManualFormModal({
  open,
  onOpenChange,
  onSuccess,
}: CompraManualFormModalProps) {
  const { empresas = [] } = useEmpresas();
  const { fornecedores = [] } = useFornecedores();
  const { produtos = [] } = useProdutos();
  const { criarCompra } = useCompras();

  const [empresaId, setEmpresaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataPedido, setDataPedido] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemCompra[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setEmpresaId(empresas[0]?.id || "");
      setFornecedorId("");
      setFornecedorNome("");
      setDataPedido(format(new Date(), "yyyy-MM-dd"));
      setDataPrevisao("");
      setValorFrete("");
      setObservacoes("");
      setItens([]);
    }
  }, [open, empresas]);

  // Atualizar nome do fornecedor quando selecionado
  useEffect(() => {
    if (fornecedorId) {
      const forn = fornecedores.find((f) => f.id === fornecedorId);
      if (forn) {
        setFornecedorNome(forn.razao_social);
      }
    }
  }, [fornecedorId, fornecedores]);

  const handleAddItem = () => {
    const newItem: ItemCompra = {
      id: crypto.randomUUID(),
      produto_id: null,
      descricao_nf: "",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    };
    setItens([...itens, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItens(itens.filter((i) => i.id !== id));
  };

  const handleItemChange = (
    id: string,
    field: keyof ItemCompra,
    value: string | number | null
  ) => {
    setItens(
      itens.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // Se mudou produto, atualizar descrição
        if (field === "produto_id" && value) {
          const produto = produtos.find((p) => p.id === value);
          if (produto) {
            updated.descricao_nf = produto.nome;
          }
        }

        // Recalcular valor total
        if (field === "quantidade" || field === "valor_unitario") {
          const qty =
            field === "quantidade" ? Number(value) : Number(item.quantidade);
          const price =
            field === "valor_unitario"
              ? Number(value)
              : Number(item.valor_unitario);
          updated.valor_total = qty * price;
        }

        return updated;
      })
    );
  };

  const valorProdutos = itens.reduce((sum, i) => sum + i.valor_total, 0);
  const valorTotal = valorProdutos + (Number(valorFrete) || 0);

  const handleSubmit = async () => {
    if (!empresaId || !fornecedorNome || itens.length === 0) {
      return;
    }

    await criarCompra.mutateAsync({
      empresa_id: empresaId,
      fornecedor_nome: fornecedorNome,
      data_pedido: dataPedido,
      data_previsao: dataPrevisao || undefined,
      valor_produtos: valorProdutos,
      valor_frete: Number(valorFrete) || 0,
      valor_total: valorTotal,
      status: "rascunho",
      observacoes: observacoes || undefined,
      itens: itens.map((item) => ({
        produto_id: item.produto_id,
        codigo_nf: null,
        descricao_nf: item.descricao_nf,
        ncm: null,
        cfop: null,
        quantidade: item.quantidade,
        quantidade_recebida: 0,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        aliquota_icms: null,
        valor_icms: null,
        aliquota_ipi: null,
        valor_ipi: null,
        mapeado: !!item.produto_id,
      })),
    });

    onOpenChange(false);
    onSuccess?.();
  };

  const isValid = empresaId && fornecedorNome && itens.length > 0;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nova Compra Manual
          </DialogTitle>
          <DialogDescription>
            Registre uma compra manualmente antes de receber a nota fiscal.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Dados da Compra */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa *</Label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome_fantasia || emp.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione ou digite abaixo" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((forn) => (
                      <SelectItem key={forn.id} value={forn.id}>
                        {forn.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fornecedorNome">Nome do Fornecedor *</Label>
                <Input
                  id="fornecedorNome"
                  value={fornecedorNome}
                  onChange={(e) => setFornecedorNome(e.target.value)}
                  placeholder="Nome ou razão social"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataPedido">Data do Pedido *</Label>
                <Input
                  id="dataPedido"
                  type="date"
                  value={dataPedido}
                  onChange={(e) => setDataPedido(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataPrevisao">Previsão de Entrega</Label>
                <Input
                  id="dataPrevisao"
                  type="date"
                  value={dataPrevisao}
                  onChange={(e) => setDataPrevisao(e.target.value)}
                />
              </div>
            </div>

            {/* Itens da Compra */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens da Compra *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              {itens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  Clique em "Adicionar Item" para incluir produtos na compra.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Produto</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px] text-right">Qtd</TableHead>
                      <TableHead className="w-[120px] text-right">Valor Unit.</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Select
                            value={item.produto_id || ""}
                            onValueChange={(v) =>
                              handleItemChange(item.id, "produto_id", v || null)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Vincular..." />
                            </SelectTrigger>
                            <SelectContent>
                              {produtos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="font-mono text-xs mr-1">
                                    {p.sku}
                                  </span>
                                  {p.nome.substring(0, 20)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={item.descricao_nf}
                            onChange={(e) =>
                              handleItemChange(item.id, "descricao_nf", e.target.value)
                            }
                            placeholder="Descrição do item"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min="1"
                            value={item.quantidade}
                            onChange={(e) =>
                              handleItemChange(item.id, "quantidade", Number(e.target.value))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "valor_unitario",
                                Number(e.target.value)
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.valor_total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Totais */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valorFrete">Valor do Frete</Label>
                <Input
                  id="valorFrete"
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorFrete}
                  onChange={(e) => setValorFrete(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Subtotal Produtos</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium">
                  {formatCurrency(valorProdutos)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor Total</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-primary/10 flex items-center font-bold text-primary">
                  {formatCurrency(valorTotal)}
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre a compra..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || criarCompra.isPending}
          >
            {criarCompra.isPending ? "Salvando..." : "Criar Compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
