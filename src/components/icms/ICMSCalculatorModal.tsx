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
import { Calculator, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  calcularICMS,
  validateCreditoICMS,
  formatCurrency,
  CreditoICMS,
  EMPRESAS,
  UF_LIST,
} from "@/lib/icms-data";

interface ICMSCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (credit: CreditoICMS) => void;
  editingCredit?: CreditoICMS | null;
}

const initialFormData = {
  empresa: "",
  numeroNF: "",
  ncm: "",
  descricao: "",
  quantidade: "",
  valorUnitario: "",
  valorTotal: "",
  ufOrigem: "",
  aliquotaIcms: "",
  valorIcmsDestacado: "",
  percentualAproveitamento: "100",
  valorCredito: "",
  observacoes: "",
};

export function ICMSCalculatorModal({
  open,
  onOpenChange,
  onSave,
  editingCredit,
}: ICMSCalculatorModalProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculated, setIsCalculated] = useState(false);

  useEffect(() => {
    if (editingCredit) {
      setFormData({
        empresa: editingCredit.empresa,
        numeroNF: editingCredit.numeroNF || "",
        ncm: editingCredit.ncm,
        descricao: editingCredit.descricao,
        quantidade: editingCredit.quantidade.toString(),
        valorUnitario: editingCredit.valorUnitario.toString(),
        valorTotal: editingCredit.valorTotal.toString(),
        ufOrigem: editingCredit.ufOrigem,
        aliquotaIcms: editingCredit.aliquotaIcms.toString(),
        valorIcmsDestacado: editingCredit.valorIcmsDestacado.toString(),
        percentualAproveitamento: editingCredit.percentualAproveitamento.toString(),
        valorCredito: editingCredit.valorCredito.toString(),
        observacoes: editingCredit.observacoes || "",
      });
      setIsCalculated(true);
    } else {
      setFormData(initialFormData);
      setIsCalculated(false);
    }
    setErrors({});
  }, [editingCredit, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setIsCalculated(false);

    // Auto-calculate valor total when quantity or unit value changes
    if (field === "quantidade" || field === "valorUnitario") {
      const qty =
        field === "quantidade" ? parseFloat(value) : parseFloat(formData.quantidade);
      const unitValue =
        field === "valorUnitario" ? parseFloat(value) : parseFloat(formData.valorUnitario);
      if (!isNaN(qty) && !isNaN(unitValue)) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
          valorTotal: (qty * unitValue).toFixed(2),
        }));
      }
    }
  };

  const handleCalculate = () => {
    const valorTotal = parseFloat(formData.valorTotal);
    const aliquota = parseFloat(formData.aliquotaIcms);
    const percentual = parseFloat(formData.percentualAproveitamento) || 100;
    const icmsDestacadoInput = formData.valorIcmsDestacado
      ? parseFloat(formData.valorIcmsDestacado)
      : undefined;

    // Validation for calculation
    if (!valorTotal && !icmsDestacadoInput) {
      toast.error(
        "Preencha os campos de Valor Total e Alíquota de ICMS ou informe diretamente o Valor de ICMS destacado."
      );
      return;
    }

    if (!icmsDestacadoInput && (!valorTotal || isNaN(aliquota))) {
      toast.error(
        "Preencha os campos de Valor Total e Alíquota de ICMS para calcular."
      );
      return;
    }

    const result = calcularICMS(valorTotal, aliquota, percentual, icmsDestacadoInput);

    setFormData((prev) => ({
      ...prev,
      valorIcmsDestacado: result.valorIcmsDestacado.toFixed(2),
      valorCredito: result.valorCredito.toFixed(2),
    }));

    setIsCalculated(true);
    toast.success("ICMS calculado com sucesso!");
  };

  const handleSave = () => {
    const creditData: Partial<CreditoICMS> = {
      empresa: formData.empresa,
      numeroNF: formData.numeroNF,
      ncm: formData.ncm.replace(/\./g, ""),
      descricao: formData.descricao,
      quantidade: parseFloat(formData.quantidade),
      valorUnitario: parseFloat(formData.valorUnitario),
      valorTotal: parseFloat(formData.valorTotal),
      ufOrigem: formData.ufOrigem.toUpperCase(),
      aliquotaIcms: parseFloat(formData.aliquotaIcms),
      valorIcmsDestacado: parseFloat(formData.valorIcmsDestacado),
      percentualAproveitamento: parseFloat(formData.percentualAproveitamento),
      valorCredito: parseFloat(formData.valorCredito),
      observacoes: formData.observacoes,
    };

    const validation = validateCreditoICMS(creditData);

    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error(
        "Preencha corretamente todos os campos obrigatórios para salvar o crédito de ICMS."
      );
      return;
    }

    if (!isCalculated) {
      toast.error("Por favor, clique em 'Calcular ICMS' antes de salvar.");
      return;
    }

    const credit: CreditoICMS = {
      id: editingCredit?.id || `cred-${Date.now()}`,
      empresa: creditData.empresa!,
      numeroNF: creditData.numeroNF,
      ncm: creditData.ncm!,
      descricao: creditData.descricao || "",
      quantidade: creditData.quantidade!,
      valorUnitario: creditData.valorUnitario!,
      valorTotal: creditData.valorTotal!,
      ufOrigem: creditData.ufOrigem!,
      aliquotaIcms: creditData.aliquotaIcms!,
      valorIcmsDestacado: creditData.valorIcmsDestacado!,
      percentualAproveitamento: creditData.percentualAproveitamento!,
      valorCredito: creditData.valorCredito!,
      dataLancamento: editingCredit?.dataLancamento || new Date().toISOString().split("T")[0],
      observacoes: creditData.observacoes,
    };

    onSave(credit);
    toast.success("Crédito de ICMS salvo com sucesso.");
    handleClose();
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setErrors({});
    setIsCalculated(false);
    onOpenChange(false);
  };

  const InputWithError = ({
    id,
    label,
    type = "text",
    placeholder,
    required = false,
    prefix,
    suffix,
  }: {
    id: string;
    label: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    prefix?: string;
    suffix?: string;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type={type}
          value={formData[id as keyof typeof formData]}
          onChange={(e) => handleChange(id, e.target.value)}
          placeholder={placeholder}
          className={`${prefix ? "pl-10" : ""} ${suffix ? "pr-10" : ""} ${
            errors[id] ? "border-destructive" : ""
          }`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
      {errors[id] && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {errors[id]}
        </p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {editingCredit ? "Editar Crédito de ICMS" : "Novo Crédito de ICMS"}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos e clique em "Calcular ICMS" para gerar o valor do crédito.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Empresa <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.empresa}
                onValueChange={(v) => handleChange("empresa", v)}
              >
                <SelectTrigger className={errors.empresa ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {EMPRESAS.map((emp) => (
                    <SelectItem key={emp} value={emp}>
                      {emp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.empresa && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.empresa}
                </p>
              )}
            </div>

            <InputWithError
              id="numeroNF"
              label="Número da NF"
              placeholder="Ex: 12345"
            />
          </div>

          {/* NCM e Descrição */}
          <div className="grid grid-cols-3 gap-4">
            <InputWithError
              id="ncm"
              label="NCM"
              placeholder="00000000"
              required
            />
            <div className="col-span-2">
              <InputWithError
                id="descricao"
                label="Descrição do Item"
                placeholder="Descrição do produto"
              />
            </div>
          </div>

          {/* Quantidade e Valores */}
          <div className="grid grid-cols-4 gap-4">
            <InputWithError
              id="quantidade"
              label="Quantidade"
              type="number"
              placeholder="0"
              required
            />
            <InputWithError
              id="valorUnitario"
              label="Valor Unitário"
              type="number"
              placeholder="0,00"
              prefix="R$"
              required
            />
            <InputWithError
              id="valorTotal"
              label="Valor Total"
              type="number"
              placeholder="0,00"
              prefix="R$"
              required
            />
            <div className="space-y-1.5">
              <Label>
                UF Origem <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.ufOrigem}
                onValueChange={(v) => handleChange("ufOrigem", v)}
              >
                <SelectTrigger className={errors.ufOrigem ? "border-destructive" : ""}>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ufOrigem && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.ufOrigem}
                </p>
              )}
            </div>
          </div>

          {/* ICMS Fields */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4">
            <h4 className="font-medium text-sm">Cálculo de ICMS</h4>
            <div className="grid grid-cols-4 gap-4">
              <InputWithError
                id="aliquotaIcms"
                label="Alíquota ICMS"
                type="number"
                placeholder="0"
                suffix="%"
                required
              />
              <InputWithError
                id="valorIcmsDestacado"
                label="ICMS Destacado"
                type="number"
                placeholder="0,00"
                prefix="R$"
              />
              <InputWithError
                id="percentualAproveitamento"
                label="% Aproveitamento"
                type="number"
                placeholder="100"
                suffix="%"
                required
              />
              <div className="space-y-1.5">
                <Label>Valor do Crédito</Label>
                <div className="p-2.5 rounded-md bg-success/10 border border-success/30 text-success font-semibold text-center">
                  {formData.valorCredito
                    ? formatCurrency(parseFloat(formData.valorCredito))
                    : "R$ 0,00"}
                </div>
              </div>
            </div>

            <Button onClick={handleCalculate} variant="secondary" className="w-full gap-2">
              <Calculator className="h-4 w-4" />
              Calcular ICMS
            </Button>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
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
          <Button onClick={handleSave} disabled={!isCalculated} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Crédito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
