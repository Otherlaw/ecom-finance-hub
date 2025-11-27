import { useState, useEffect } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  Purchase,
  PurchaseItem,
  EMPRESAS,
  mockSuppliers,
  validatePurchase,
  formatCurrency,
} from "@/lib/purchases-data";
import { Product } from "@/lib/products-data";

interface PurchaseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: Purchase | null;
  products: Product[];
  onSave: (purchase: Purchase) => void;
}

export function PurchaseFormModal({
  open,
  onOpenChange,
  purchase,
  products,
  onSave,
}: PurchaseFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!purchase;

  const [formData, setFormData] = useState<Partial<Purchase>>({
    empresa: "EXCHANGE",
    fornecedor: "",
    fornecedorCnpj: "",
    dataCompra: new Date().toISOString().split("T")[0],
    numeroNF: "",
    valorTotal: 0,
    status: "em_aberto",
    itens: [],
    observacoes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState<Partial<PurchaseItem>>({
    produtoId: "",
    descricaoNF: "",
    ncm: "",
    cfop: "1102",
    quantidade: 1,
    valorUnitario: 0,
  });
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  useEffect(() => {
    if (purchase) {
      setFormData(purchase);
    } else {
      setFormData({
        empresa: "EXCHANGE",
        fornecedor: "",
        fornecedorCnpj: "",
        dataCompra: new Date().toISOString().split("T")[0],
        numeroNF: "",
        valorTotal: 0,
        status: "em_aberto",
        itens: [],
        observacoes: "",
      });
    }
    setErrors({});
    setNewItem({
      produtoId: "",
      descricaoNF: "",
      ncm: "",
      cfop: "1102",
      quantidade: 1,
      valorUnitario: 0,
    });
  }, [purchase, open]);

  const handleChange = (field: keyof Purchase, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = mockSuppliers.find((s) => s.id === supplierId);
    if (supplier) {
      setFormData((prev) => ({
        ...prev,
        fornecedor: supplier.razaoSocial,
        fornecedorCnpj: supplier.cnpj,
      }));
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setNewItem((prev) => ({
        ...prev,
        produtoId: product.id,
        produtoNome: product.nome,
        descricaoNF: product.nome,
        ncm: product.ncm,
        valorUnitario: product.custoMedio,
      }));
    }
    setProductSearchOpen(false);
  };

  const calculateItemTotal = () => {
    const qty = newItem.quantidade || 0;
    const price = newItem.valorUnitario || 0;
    return qty * price;
  };

  const handleAddItem = () => {
    if (!newItem.descricaoNF || !newItem.quantidade || !newItem.valorUnitario) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a descrição, quantidade e valor unitário",
        variant: "destructive",
      });
      return;
    }

    const item: PurchaseItem = {
      id: `item-${Date.now()}`,
      produtoId: newItem.produtoId,
      produtoNome: newItem.produtoNome,
      codigoProdutoNF: newItem.codigoProdutoNF || "",
      descricaoNF: newItem.descricaoNF!,
      ncm: newItem.ncm || "",
      cfop: newItem.cfop || "1102",
      quantidade: newItem.quantidade!,
      valorUnitario: newItem.valorUnitario!,
      valorTotal: calculateItemTotal(),
      mapeado: !!newItem.produtoId,
    };

    const newItens = [...(formData.itens || []), item];
    const newTotal = newItens.reduce((sum, i) => sum + i.valorTotal, 0);

    setFormData((prev) => ({
      ...prev,
      itens: newItens,
      valorTotal: newTotal,
    }));

    setNewItem({
      produtoId: "",
      descricaoNF: "",
      ncm: "",
      cfop: "1102",
      quantidade: 1,
      valorUnitario: 0,
    });
  };

  const handleRemoveItem = (itemId: string) => {
    const newItens = formData.itens?.filter((i) => i.id !== itemId) || [];
    const newTotal = newItens.reduce((sum, i) => sum + i.valorTotal, 0);
    setFormData((prev) => ({
      ...prev,
      itens: newItens,
      valorTotal: newTotal,
    }));
  };

  const handleSubmit = () => {
    const validation = validatePurchase(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: "Erro de validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const now = new Date().toISOString().split("T")[0];
    const savedPurchase: Purchase = {
      id: purchase?.id || `comp-${Date.now()}`,
      empresa: formData.empresa!,
      fornecedor: formData.fornecedor!,
      fornecedorCnpj: formData.fornecedorCnpj,
      dataCompra: formData.dataCompra!,
      numeroNF: formData.numeroNF,
      chaveAcesso: formData.chaveAcesso,
      valorTotal: formData.valorTotal!,
      status: formData.status as 'em_aberto' | 'confirmada' | 'cancelada',
      itens: formData.itens!,
      observacoes: formData.observacoes,
      dataCadastro: purchase?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(savedPurchase);
    toast({
      title: isEditing ? "Compra atualizada" : "Compra registrada",
      description: `Compra de ${savedPurchase.fornecedor} foi ${isEditing ? "atualizada" : "registrada"} com sucesso.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Compra" : "Nova Compra Manual"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select
                value={formData.empresa}
                onValueChange={(value) => handleChange("empresa", value)}
              >
                <SelectTrigger className={errors.empresa ? "border-destructive" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((emp) => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Select
                value={mockSuppliers.find((s) => s.razaoSocial === formData.fornecedor)?.id || ""}
                onValueChange={handleSupplierChange}
              >
                <SelectTrigger className={errors.fornecedor ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {mockSuppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.razaoSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data da Compra *</Label>
              <Input
                type="date"
                value={formData.dataCompra}
                onChange={(e) => handleChange("dataCompra", e.target.value)}
                className={errors.dataCompra ? "border-destructive" : ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número da NF</Label>
              <Input
                value={formData.numeroNF || ""}
                onChange={(e) => handleChange("numeroNF", e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_aberto">Em Aberto</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor Total</Label>
              <Input
                value={formatCurrency(formData.valorTotal || 0)}
                readOnly
                className="bg-secondary/50"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Itens da Compra</Label>
              {errors.itens && (
                <span className="text-xs text-destructive">{errors.itens}</span>
              )}
            </div>

            {/* Add Item Form */}
            <div className="p-4 border rounded-lg bg-secondary/20 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm">Produto (vincular)</Label>
                  <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                        {newItem.produtoNome || "Buscar produto..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou SKU..." />
                        <CommandList>
                          <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
                          <CommandGroup>
                            {products.filter(p => p.status === 'ativo').map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.nome}
                                onSelect={() => handleProductSelect(product.id)}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{product.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    SKU: {product.codigoInterno} | NCM: {product.ncm}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">NCM</Label>
                  <Input
                    value={newItem.ncm || ""}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, ncm: e.target.value }))}
                    placeholder="00000000"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">CFOP</Label>
                  <Input
                    value={newItem.cfop || ""}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, cfop: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm">Descrição *</Label>
                  <Input
                    value={newItem.descricaoNF || ""}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, descricaoNF: e.target.value }))}
                    placeholder="Descrição do item"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.quantidade || ""}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, quantidade: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Valor Unit. *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newItem.valorUnitario || ""}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, valorUnitario: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total do item: <strong>{formatCurrency(calculateItemTotal())}</strong>
                </span>
                <Button type="button" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>
            </div>

            {/* Items Table */}
            {formData.itens && formData.itens.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Vlr Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.descricaoNF}</div>
                            {item.produtoNome && (
                              <div className="text-xs text-success">✓ Vinculado: {item.produtoNome}</div>
                            )}
                            {!item.mapeado && (
                              <div className="text-xs text-warning">⚠ Não vinculado</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.ncm}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.valorTotal)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes || ""}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Salvar Alterações" : "Registrar Compra"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
