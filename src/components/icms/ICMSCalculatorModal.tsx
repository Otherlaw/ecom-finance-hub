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
import { Calculator, Save, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  calcularICMS,
  validateCreditoICMS,
  formatCurrency,
  CreditoICMS,
  UF_LIST,
  OrigemCredito,
  ORIGEM_CREDITO_CONFIG,
  determinarTipoCredito,
} from "@/lib/icms-data";
import {
  mockEmpresas,
  REGIME_TRIBUTARIO_CONFIG,
  canUseICMSCredit,
} from "@/lib/empresas-data";

interface ICMSCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (credit: CreditoICMS) => void;
  editingCredit?: CreditoICMS | null;
}

const initialFormData = {
  empresa: "",
  origemCredito: "compra_mercadoria",
  origemDescricao: "",
  numeroNF: "",
  ncm: "",
  cfop: "",
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

  const empresas = mockEmpresas;
  const selectedEmpresa = empresas.find(e => e.nome.toUpperCase().includes(formData.empresa.toUpperCase()));
  const isSimples = selectedEmpresa?.regimeTributario === 'simples_nacional';

  useEffect(() => {
    if (editingCredit) {
      setFormData({
        empresa: editingCredit.empresa,
        origemCredito: editingCredit.origemCredito || "compra_mercadoria",
        origemDescricao: "",
        numeroNF: editingCredit.numeroNF || "",
        ncm: editingCredit.ncm,
        cfop: editingCredit.cfop || "",
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

    const hoje = new Date().toISOString().split("T")[0];
    const competencia = hoje.substring(0, 7);
    const tipoCredito = determinarTipoCredito(formData.empresa, mockEmpresas);
    const valorCreditoBruto = parseFloat(formData.valorCredito);

    const credit: CreditoICMS = {
      id: editingCredit?.id || `cred-${Date.now()}`,
      empresa: creditData.empresa!,
      tipoCredito,
      origemCredito: formData.origemCredito,
      statusCredito: editingCredit?.statusCredito || "ativo",
      numeroNF: creditData.numeroNF,
      ncm: creditData.ncm!,
      cfop: formData.cfop || undefined,
      descricao: creditData.descricao || "",
      quantidade: creditData.quantidade!,
      valorUnitario: creditData.valorUnitario!,
      valorTotal: creditData.valorTotal!,
      ufOrigem: creditData.ufOrigem!,
      aliquotaIcms: creditData.aliquotaIcms!,
      valorIcmsDestacado: creditData.valorIcmsDestacado!,
      percentualAproveitamento: creditData.percentualAproveitamento!,
      valorCreditoBruto,
      valorAjustes: editingCredit?.valorAjustes || 0,
      valorCredito: valorCreditoBruto + (editingCredit?.valorAjustes || 0),
      dataLancamento: editingCredit?.dataLancamento || hoje,
      dataCompetencia: editingCredit?.dataCompetencia || competencia,
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
          <div className="grid grid-cols-3 gap-4">
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
                  {empresas.map((emp) => {
                    const regime = REGIME_TRIBUTARIO_CONFIG[emp.regimeTributario];
                    return (
                      <SelectItem key={emp.id} value={emp.nome.split(' ')[0].toUpperCase()}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${regime.bgColor} ${regime.color} border text-xs`}>
                            {regime.shortLabel}
                          </Badge>
                          {emp.nome}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.empresa && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.empresa}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Origem do Crédito</Label>
              <Select
                value={formData.origemCredito}
                onValueChange={(v) => handleChange("origemCredito", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORIGEM_CREDITO_CONFIG) as OrigemCredito[])
                    .map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {ORIGEM_CREDITO_CONFIG[origem].label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <InputWithError
              id="numeroNF"
              label="Número da NF"
              placeholder="Ex: 12345"
            />
          </div>

          {formData.origemCredito === 'outro' && (
            <div className="space-y-1.5">
              <Label htmlFor="origemDescricao">Descrição da Origem *</Label>
              <Input
                id="origemDescricao"
                placeholder="Ex: Carla Clips, Auto Posto de Gasolina..."
                value={formData.origemDescricao}
                onChange={(e) => handleChange("origemDescricao", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Informe o nome ou descrição que identifica esta origem de crédito.
              </p>
            </div>
          )}

          {isSimples && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                <strong>Empresa em Simples Nacional.</strong> Este crédito será classificado como <strong>Não Compensável</strong> e não entrará no cálculo de compensação de ICMS.
              </AlertDescription>
            </Alert>
          )}

          {/* NCM, CFOP e Descrição */}
          <div className="grid grid-cols-4 gap-4">
            <InputWithError
              id="ncm"
              label="NCM"
              placeholder="00000000"
              required
            />
            <InputWithError
              id="cfop"
              label="CFOP"
              placeholder="Ex: 2102"
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
