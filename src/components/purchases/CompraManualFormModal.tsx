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
import { Plus, Trash2, ShoppingCart, ImageOff } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useCompras } from "@/hooks/useCompras";
import { HistoricoComprasProduto } from "./HistoricoComprasProduto";
import { CentroCustoSelect } from "@/components/CentroCustoSelect";
import { format } from "date-fns";

interface CompraManualFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ItemCompra {
  id: string;
  produto_id: string | null;
  produto?: Produto | null;
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
  const { produtos = [] } = useProdutos({ apenasRaiz: false });
  const { criarCompra } = useCompras();

  const [empresaId, setEmpresaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [dataPedido, setDataPedido] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [centroCustoId, setCentroCustoId] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<string | null>(null);

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
      setCentroCustoId(null);
      setItens([]);
      setSelectedItemForHistory(null);
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
      produto: null,
      descricao_nf: "",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    };
    setItens([...itens, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItens(itens.filter((i) => i.id !== id));
    if (selectedItemForHistory === id) {
      setSelectedItemForHistory(null);
    }
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

        // Se mudou produto, atualizar descrição e produto referência
        if (field === "produto_id" && value) {
          const produto = produtos.find((p) => p.id === value);
          if (produto) {
            updated.descricao_nf = produto.nome;
            updated.produto = produto;
            updated.valor_unitario = produto.custo_medio || 0;
            updated.valor_total = updated.quantidade * updated.valor_unitario;
            setSelectedItemForHistory(value as string);
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
      <DialogContent className="max-w-5xl max-h-[90vh]">
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

            <div className="grid grid-cols-4 gap-4">
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

              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <CentroCustoSelect
                  value={centroCustoId || ""}
                  onValueChange={(value) => setCentroCustoId(value || null)}
                  placeholder="Selecione..."
                  showOnlyActive
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
                <div className="space-y-3">
                  {itens.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex gap-4">
                        {/* Imagem do Produto */}
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {item.produto?.imagem_url ? (
                            <img 
                              src={item.produto.imagem_url} 
                              alt={item.produto.nome} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageOff className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>

                        {/* Campos do Item */}
                        <div className="flex-1 grid grid-cols-5 gap-3">
                          <div className="col-span-2">
                            <Label className="text-xs">Produto</Label>
                            <Select
                              value={item.produto_id || ""}
                              onValueChange={(v) =>
                                handleItemChange(item.id, "produto_id", v || null)
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Vincular produto..." />
                              </SelectTrigger>
                              <SelectContent>
                                {produtos.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span className="font-mono text-xs mr-1">
                                      {p.sku}
                                    </span>
                                    {p.nome.substring(0, 30)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Quantidade</Label>
                            <Input
                              className="h-9"
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleItemChange(item.id, "quantidade", Number(e.target.value))
                              }
                            />
                          </div>

                          <div>
                            <Label className="text-xs">Valor Unit.</Label>
                            <Input
                              className="h-9"
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
                          </div>

                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Total</Label>
                              <div className="h-9 px-3 py-2 rounded-md border bg-muted flex items-center font-medium text-sm">
                                {formatCurrency(item.valor_total)}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Descrição */}
                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          className="h-8"
                          value={item.descricao_nf}
                          onChange={(e) =>
                            handleItemChange(item.id, "descricao_nf", e.target.value)
                          }
                          placeholder="Descrição do item"
                        />
                      </div>

                      {/* Histórico de Compras */}
                      {item.produto_id && (
                        <HistoricoComprasProduto produtoId={item.produto_id} />
                      )}
                    </div>
                  ))}
                </div>
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