import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { 
  ContaPagarFormData, 
  TipoLancamento, 
  FormaPagamento,
  CondicaoPagamento,
  Periodicidade,
  TIPO_LANCAMENTO, 
  FORMA_PAGAMENTO,
  PERIODICIDADE,
  mockCategorias,
  mockCentrosCusto,
  mockEmpresas,
  mockSuppliers,
  validateContaPagar,
  formatCurrency,
} from "@/lib/contas-pagar-data";
import { REGIME_TRIBUTARIO_CONFIG } from "@/lib/empresas-data";
import { AlertTriangle, CalendarDays, DollarSign, Building2, FileText, Repeat } from "lucide-react";

interface ContaPagarFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ContaPagarFormData) => void;
  initialData?: Partial<ContaPagarFormData>;
  mode?: "create" | "edit";
}

export function ContaPagarFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
}: ContaPagarFormModalProps) {
  const [formData, setFormData] = useState<Partial<ContaPagarFormData>>({
    empresaId: "",
    fornecedorNome: "",
    descricao: "",
    documento: "",
    tipoLancamento: "despesa_operacional",
    dataEmissao: new Date().toISOString().split("T")[0],
    dataVencimento: "",
    valorOriginal: 0,
    condicaoPagamento: "a_vista",
    numeroParcelas: 1,
    formaPagamento: "boleto",
    categoriaId: "",
    centroCustoId: "",
    observacoes: "",
    recorrente: false,
    periodicidade: "mensal",
    quantidadeRecorrencias: 12,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedEmpresa, setSelectedEmpresa] = useState<typeof mockEmpresas[0] | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({ ...formData, ...initialData });
    }
  }, [initialData]);

  useEffect(() => {
    if (formData.empresaId) {
      const empresa = mockEmpresas.find(e => e.id === formData.empresaId);
      setSelectedEmpresa(empresa || null);
    } else {
      setSelectedEmpresa(null);
    }
  }, [formData.empresaId]);

  const handleChange = (field: keyof ContaPagarFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    const validation = validateContaPagar(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast({
        title: "Erro de validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData as ContaPagarFormData);
    onOpenChange(false);
    toast({
      title: mode === "create" ? "Conta criada" : "Conta atualizada",
      description: mode === "create" 
        ? "Conta a pagar criada com sucesso" 
        : "Conta a pagar atualizada com sucesso",
    });
  };

  const handleClose = () => {
    setFormData({
      empresaId: "",
      fornecedorNome: "",
      descricao: "",
      documento: "",
      tipoLancamento: "despesa_operacional",
      dataEmissao: new Date().toISOString().split("T")[0],
      dataVencimento: "",
      valorOriginal: 0,
      condicaoPagamento: "a_vista",
      numeroParcelas: 1,
      formaPagamento: "boleto",
      categoriaId: "",
      centroCustoId: "",
      observacoes: "",
      recorrente: false,
      periodicidade: "mensal",
      quantidadeRecorrencias: 12,
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-destructive" />
            {mode === "create" ? "Nova Conta a Pagar" : "Editar Conta a Pagar"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Empresa e Fornecedor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empresaId" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Empresa *
              </Label>
              <Select
                value={formData.empresaId}
                onValueChange={(v) => handleChange("empresaId", v)}
              >
                <SelectTrigger className={errors.empresaId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {mockEmpresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      <div className="flex items-center gap-2">
                        <span>{empresa.nome}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].bgColor}`}>
                          {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].shortLabel}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.empresaId && <p className="text-xs text-destructive">{errors.empresaId}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fornecedorNome">Fornecedor *</Label>
              <Input
                id="fornecedorNome"
                value={formData.fornecedorNome}
                onChange={(e) => handleChange("fornecedorNome", e.target.value)}
                placeholder="Nome do fornecedor"
                className={errors.fornecedorNome ? "border-destructive" : ""}
                list="fornecedores"
              />
              <datalist id="fornecedores">
                {mockSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.razaoSocial} />
                ))}
              </datalist>
              {errors.fornecedorNome && <p className="text-xs text-destructive">{errors.fornecedorNome}</p>}
            </div>
          </div>

          {/* Descrição e Documento */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="descricao">
                <FileText className="h-3 w-3 inline mr-1" />
                Descrição *
              </Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => handleChange("descricao", e.target.value)}
                placeholder="Descrição da despesa"
                className={errors.descricao ? "border-destructive" : ""}
              />
              {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">Documento (NF/Fatura)</Label>
              <Input
                id="documento"
                value={formData.documento}
                onChange={(e) => handleChange("documento", e.target.value)}
                placeholder="Número"
              />
            </div>
          </div>

          {/* Tipo e Categoria */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Lançamento *</Label>
              <Select
                value={formData.tipoLancamento}
                onValueChange={(v) => handleChange("tipoLancamento", v as TipoLancamento)}
              >
                <SelectTrigger className={errors.tipoLancamento ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LANCAMENTO).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span>{icon} {label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipoLancamento && <p className="text-xs text-destructive">{errors.tipoLancamento}</p>}
            </div>

            <div className="space-y-2">
              <Label>Categoria Financeira *</Label>
              <Select
                value={formData.categoriaId}
                onValueChange={(v) => handleChange("categoriaId", v)}
              >
                <SelectTrigger className={errors.categoriaId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {mockCategorias.filter(c => c.tipo === 'despesa').map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoriaId && <p className="text-xs text-destructive">{errors.categoriaId}</p>}
            </div>

            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select
                value={formData.centroCustoId || "none"}
                onValueChange={(v) => handleChange("centroCustoId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {mockCentrosCusto.filter(c => c.status === 'ativo').map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas e Valores */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataEmissao" className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Data Emissão *
              </Label>
              <Input
                id="dataEmissao"
                type="date"
                value={formData.dataEmissao}
                onChange={(e) => handleChange("dataEmissao", e.target.value)}
                className={errors.dataEmissao ? "border-destructive" : ""}
              />
              {errors.dataEmissao && <p className="text-xs text-destructive">{errors.dataEmissao}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataVencimento" className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Vencimento *
              </Label>
              <Input
                id="dataVencimento"
                type="date"
                value={formData.dataVencimento}
                onChange={(e) => handleChange("dataVencimento", e.target.value)}
                className={errors.dataVencimento ? "border-destructive" : ""}
              />
              {errors.dataVencimento && <p className="text-xs text-destructive">{errors.dataVencimento}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorOriginal" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor *
              </Label>
              <Input
                id="valorOriginal"
                type="number"
                step="0.01"
                min="0"
                value={formData.valorOriginal || ""}
                onChange={(e) => handleChange("valorOriginal", parseFloat(e.target.value) || 0)}
                className={errors.valorOriginal ? "border-destructive" : ""}
                placeholder="0,00"
              />
              {errors.valorOriginal && <p className="text-xs text-destructive">{errors.valorOriginal}</p>}
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.formaPagamento}
                onValueChange={(v) => handleChange("formaPagamento", v as FormaPagamento)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMA_PAGAMENTO).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span>{icon} {label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Condição de Pagamento */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <Select
                value={formData.condicaoPagamento}
                onValueChange={(v) => handleChange("condicaoPagamento", v as CondicaoPagamento)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À Vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.condicaoPagamento === "parcelado" && (
              <div className="space-y-2">
                <Label htmlFor="numeroParcelas">Número de Parcelas *</Label>
                <Input
                  id="numeroParcelas"
                  type="number"
                  min="2"
                  max="48"
                  value={formData.numeroParcelas || 2}
                  onChange={(e) => handleChange("numeroParcelas", parseInt(e.target.value) || 2)}
                  className={errors.numeroParcelas ? "border-destructive" : ""}
                />
                {errors.numeroParcelas && <p className="text-xs text-destructive">{errors.numeroParcelas}</p>}
              </div>
            )}

            {formData.condicaoPagamento === "parcelado" && formData.valorOriginal > 0 && formData.numeroParcelas && (
              <div className="space-y-2">
                <Label>Valor por Parcela</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                  <span className="text-sm font-medium">
                    {formatCurrency(formData.valorOriginal / formData.numeroParcelas)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Recorrência */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="recorrente" className="font-medium">Lançamento Recorrente</Label>
              </div>
              <Switch
                id="recorrente"
                checked={formData.recorrente}
                onCheckedChange={(checked) => handleChange("recorrente", checked)}
              />
            </div>

            {formData.recorrente && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select
                    value={formData.periodicidade}
                    onValueChange={(v) => handleChange("periodicidade", v as Periodicidade)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERIODICIDADE).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantidadeRecorrencias">Quantidade de Repetições</Label>
                  <Input
                    id="quantidadeRecorrencias"
                    type="number"
                    min="1"
                    max="60"
                    value={formData.quantidadeRecorrencias || 12}
                    onChange={(e) => handleChange("quantidadeRecorrencias", parseInt(e.target.value) || 12)}
                    placeholder="0 = infinito"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="bg-destructive hover:bg-destructive/90">
            {mode === "create" ? "Criar Conta" : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
