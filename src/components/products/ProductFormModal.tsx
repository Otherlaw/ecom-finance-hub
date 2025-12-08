import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Check, ChevronsUpDown, Search } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Product,
  ChannelMapping,
  CATEGORIAS_PRODUTO,
  UNIDADES_MEDIDA,
  CANAIS_VENDA,
  validateProduct,
} from "@/lib/products-data";
import { useFornecedores } from "@/hooks/useFornecedores";

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (product: Product) => void;
}

export function ProductFormModal({
  open,
  onOpenChange,
  product,
  onSave,
}: ProductFormModalProps) {
  const { toast } = useToast();
  const { fornecedores, isLoading: isLoadingFornecedores } = useFornecedores();
  const isEditing = !!product;

  const [formData, setFormData] = useState<Partial<Product>>({
    codigoInterno: "",
    nome: "",
    descricao: "",
    categoria: "",
    subcategoria: "",
    unidadeMedida: "un",
    ncm: "",
    cfopVenda: "",
    cfopCompra: "",
    fornecedorPrincipalNome: "",
    custoMedio: 0,
    precoVendaSugerido: 0,
    canais: [],
    status: "ativo",
    observacoes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newChannel, setNewChannel] = useState({ channel: "", sku: "", anuncioId: "" });
  const [fornecedorOpen, setFornecedorOpen] = useState(false);
  const [fornecedorSearch, setFornecedorSearch] = useState("");

  const fornecedoresAtivos = useMemo(() => {
    return (fornecedores || []).filter(f => f.status === 'ativo');
  }, [fornecedores]);

  const fornecedoresFiltrados = useMemo(() => {
    if (!fornecedorSearch.trim()) return fornecedoresAtivos;
    const searchLower = fornecedorSearch.toLowerCase();
    return fornecedoresAtivos.filter(f => 
      f.razao_social.toLowerCase().includes(searchLower) ||
      (f.nome_fantasia && f.nome_fantasia.toLowerCase().includes(searchLower)) ||
      (f.cnpj && f.cnpj.includes(fornecedorSearch))
    );
  }, [fornecedoresAtivos, fornecedorSearch]);

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        codigoInterno: "",
        nome: "",
        descricao: "",
        categoria: "",
        subcategoria: "",
        unidadeMedida: "un",
        ncm: "",
        cfopVenda: "",
        cfopCompra: "",
        fornecedorPrincipalNome: "",
        custoMedio: 0,
        precoVendaSugerido: 0,
        canais: [],
        status: "ativo",
        observacoes: "",
      });
    }
    setErrors({});
  }, [product, open]);

  const handleChange = (field: keyof Product, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAddChannel = () => {
    if (!newChannel.channel || !newChannel.sku) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o canal e informe o SKU",
        variant: "destructive",
      });
      return;
    }

    const exists = formData.canais?.some((c) => c.channel === newChannel.channel);
    if (exists) {
      toast({
        title: "Canal já adicionado",
        description: "Este canal já está vinculado ao produto",
        variant: "destructive",
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      canais: [...(prev.canais || []), { ...newChannel } as ChannelMapping],
    }));
    setNewChannel({ channel: "", sku: "", anuncioId: "" });
  };

  const handleRemoveChannel = (channel: string) => {
    setFormData((prev) => ({
      ...prev,
      canais: prev.canais?.filter((c) => c.channel !== channel) || [],
    }));
  };

  const handleSubmit = () => {
    const validation = validateProduct(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: "Erro de validação",
        description: "Preencha todos os campos obrigatórios corretamente",
        variant: "destructive",
      });
      return;
    }

    const now = new Date().toISOString().split("T")[0];
    const savedProduct: Product = {
      id: product?.id || `prod-${Date.now()}`,
      codigoInterno: formData.codigoInterno!,
      nome: formData.nome!,
      descricao: formData.descricao || "",
      categoria: formData.categoria!,
      subcategoria: formData.subcategoria,
      unidadeMedida: formData.unidadeMedida!,
      ncm: formData.ncm!,
      cfopVenda: formData.cfopVenda,
      cfopCompra: formData.cfopCompra,
      fornecedorPrincipalNome: formData.fornecedorPrincipalNome,
      custoMedio: formData.custoMedio || 0,
      precoVendaSugerido: formData.precoVendaSugerido,
      canais: formData.canais || [],
      status: formData.status as 'ativo' | 'inativo',
      observacoes: formData.observacoes,
      dataCadastro: product?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(savedProduct);
    toast({
      title: isEditing ? "Produto atualizado" : "Produto cadastrado",
      description: `${savedProduct.nome} foi ${isEditing ? "atualizado" : "cadastrado"} com sucesso.`,
    });
    onOpenChange(false);
  };

  const getChannelName = (channelId: string) => {
    return CANAIS_VENDA.find((c) => c.id === channelId)?.nome || channelId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigoInterno">Código Interno / SKU *</Label>
              <Input
                id="codigoInterno"
                value={formData.codigoInterno}
                onChange={(e) => handleChange("codigoInterno", e.target.value)}
                className={errors.codigoInterno ? "border-destructive" : ""}
              />
              {errors.codigoInterno && (
                <span className="text-xs text-destructive">{errors.codigoInterno}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Produto *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              className={errors.nome ? "border-destructive" : ""}
            />
            {errors.nome && (
              <span className="text-xs text-destructive">{errors.nome}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange("descricao", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => handleChange("categoria", value)}
              >
                <SelectTrigger className={errors.categoria ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_PRODUTO.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoria && (
                <span className="text-xs text-destructive">{errors.categoria}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria</Label>
              <Input
                id="subcategoria"
                value={formData.subcategoria || ""}
                onChange={(e) => handleChange("subcategoria", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidadeMedida">Unidade *</Label>
              <Select
                value={formData.unidadeMedida}
                onValueChange={(value) => handleChange("unidadeMedida", value)}
              >
                <SelectTrigger className={errors.unidadeMedida ? "border-destructive" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_MEDIDA.map((um) => (
                    <SelectItem key={um.value} value={um.value}>{um.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fiscal Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ncm">NCM *</Label>
              <Input
                id="ncm"
                value={formData.ncm}
                onChange={(e) => handleChange("ncm", e.target.value)}
                placeholder="00000000"
                maxLength={8}
                className={errors.ncm ? "border-destructive" : ""}
              />
              {errors.ncm && (
                <span className="text-xs text-destructive">{errors.ncm}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfopVenda">CFOP Venda</Label>
              <Input
                id="cfopVenda"
                value={formData.cfopVenda || ""}
                onChange={(e) => handleChange("cfopVenda", e.target.value)}
                placeholder="5102"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfopCompra">CFOP Compra</Label>
              <Input
                id="cfopCompra"
                value={formData.cfopCompra || ""}
                onChange={(e) => handleChange("cfopCompra", e.target.value)}
                placeholder="1102"
              />
            </div>
          </div>

          {/* Supplier & Prices */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor Principal</Label>
              <Popover open={fornecedorOpen} onOpenChange={setFornecedorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={fornecedorOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formData.fornecedorPrincipalNome || "Selecione um fornecedor"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="Buscar fornecedor..."
                      value={fornecedorSearch}
                      onChange={(e) => setFornecedorSearch(e.target.value)}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    <div
                      className={cn(
                        "flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                        !formData.fornecedorPrincipalNome && "bg-accent"
                      )}
                      onClick={() => {
                        handleChange("fornecedorPrincipalNome", "");
                        setFornecedorOpen(false);
                        setFornecedorSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !formData.fornecedorPrincipalNome ? "opacity-100" : "opacity-0"
                        )}
                      />
                      Nenhum
                    </div>
                    {fornecedoresFiltrados.length === 0 ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Nenhum fornecedor encontrado
                      </div>
                    ) : (
                      fornecedoresFiltrados.map((fornecedor) => (
                        <div
                          key={fornecedor.id}
                          className={cn(
                            "flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                            formData.fornecedorPrincipalNome === fornecedor.razao_social && "bg-accent"
                          )}
                          onClick={() => {
                            handleChange("fornecedorPrincipalNome", fornecedor.razao_social);
                            setFornecedorOpen(false);
                            setFornecedorSearch("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.fornecedorPrincipalNome === fornecedor.razao_social ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate">
                            {fornecedor.nome_fantasia || fornecedor.razao_social}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custoMedio">Custo Médio (R$)</Label>
              <Input
                id="custoMedio"
                type="number"
                step="0.01"
                min="0"
                value={formData.custoMedio || ""}
                onChange={(e) => handleChange("custoMedio", parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="precoVenda">Preço Venda Sugerido (R$)</Label>
              <Input
                id="precoVenda"
                type="number"
                step="0.01"
                min="0"
                value={formData.precoVendaSugerido || ""}
                onChange={(e) => handleChange("precoVendaSugerido", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Channel Mappings */}
          <div className="space-y-3">
            <Label>Mapeamento de Canais</Label>
            
            {formData.canais && formData.canais.length > 0 && (
              <div className="space-y-2">
                {formData.canais.map((canal) => (
                  <div
                    key={canal.channel}
                    className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg"
                  >
                    <span className="font-medium text-sm min-w-24">
                      {getChannelName(canal.channel)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      SKU: {canal.sku}
                    </span>
                    {canal.anuncioId && (
                      <span className="text-sm text-muted-foreground">
                        | ID: {canal.anuncioId}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7 text-destructive"
                      onClick={() => handleRemoveChannel(canal.channel)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select
                value={newChannel.channel}
                onValueChange={(value) => setNewChannel((prev) => ({ ...prev, channel: value }))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  {CANAIS_VENDA.map((canal) => (
                    <SelectItem key={canal.id} value={canal.id}>{canal.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="SKU no canal"
                value={newChannel.sku}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, sku: e.target.value }))}
                className="flex-1"
              />
              <Input
                placeholder="ID do anúncio (opcional)"
                value={newChannel.anuncioId}
                onChange={(e) => setNewChannel((prev) => ({ ...prev, anuncioId: e.target.value }))}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleAddChannel}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
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
            {isEditing ? "Salvar Alterações" : "Cadastrar Produto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
