import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import {
  RegimeTributario,
  REGIME_TRIBUTARIO_CONFIG,
  formatCNPJ,
} from "@/lib/empresas-data";
import { useEmpresas } from "@/hooks/useEmpresas";

interface EmpresaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: any | null;
}

interface FormData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  regime_tributario: string;
  inscricao_estadual: string;
  telefone: string;
  email: string;
  endereco: string;
  ativo: boolean;
  // K Inicial (Capital Inicial) - capital social inicial investido pelos sócios
  capital_inicial: number;
}

// Formatar valor monetário para exibição no input
const formatCurrencyInput = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Parsear string monetária para número
const parseCurrencyInput = (value: string): number => {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export function EmpresaFormModal({
  open,
  onOpenChange,
  empresa,
}: EmpresaFormModalProps) {
  const { createEmpresa, updateEmpresa } = useEmpresas();
  const isEditing = !!empresa;
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    regime_tributario: "",
    inscricao_estadual: "",
    telefone: "",
    email: "",
    endereco: "",
    ativo: true,
    capital_inicial: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (empresa) {
      setFormData({
        razao_social: empresa.razao_social || "",
        nome_fantasia: empresa.nome_fantasia || "",
        cnpj: empresa.cnpj || "",
        regime_tributario: empresa.regime_tributario || "",
        inscricao_estadual: empresa.inscricao_estadual || "",
        telefone: empresa.telefone || "",
        email: empresa.email || "",
        endereco: empresa.endereco || "",
        ativo: empresa.ativo ?? true,
        capital_inicial: empresa.capital_inicial || 0,
      });
    } else {
      setFormData({
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        regime_tributario: "",
        inscricao_estadual: "",
        telefone: "",
        email: "",
        endereco: "",
        ativo: true,
        capital_inicial: 0,
      });
    }
    setErrors({});
  }, [empresa, open]);

  const handleChange = (field: keyof FormData, value: string | boolean | number) => {
    let processedValue = value;
    if (field === 'cnpj' && typeof value === 'string') {
      processedValue = formatCNPJ(value);
    }
    setFormData((prev) => ({ ...prev, [field]: processedValue }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.razao_social.trim()) {
      newErrors.razao_social = "Razão social é obrigatória";
    }
    if (!formData.cnpj.trim()) {
      newErrors.cnpj = "CNPJ é obrigatório";
    } else if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(formData.cnpj)) {
      newErrors.cnpj = "CNPJ inválido (formato: 00.000.000/0000-00)";
    }
    if (!formData.regime_tributario) {
      newErrors.regime_tributario = "Regime tributário é obrigatório";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEditing) {
        await updateEmpresa.mutateAsync({
          id: empresa.id,
          ...formData,
        });
      } else {
        await createEmpresa.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoading(false);
    }
  };

  const showSimplesWarning = formData.regime_tributario === 'simples_nacional';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Empresa" : "Nova Empresa"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da empresa. O regime tributário é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="razao_social">Razão Social *</Label>
            <Input
              id="razao_social"
              value={formData.razao_social}
              onChange={(e) => handleChange("razao_social", e.target.value)}
              placeholder="Ex: Minha Empresa Ltda"
              className={errors.razao_social ? "border-destructive" : ""}
            />
            {errors.razao_social && (
              <span className="text-xs text-destructive">{errors.razao_social}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
            <Input
              id="nome_fantasia"
              value={formData.nome_fantasia}
              onChange={(e) => handleChange("nome_fantasia", e.target.value)}
              placeholder="Ex: Minha Empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={formData.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={errors.cnpj ? "border-destructive" : ""}
            />
            {errors.cnpj && (
              <span className="text-xs text-destructive">{errors.cnpj}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="regime_tributario">Regime Tributário *</Label>
            <Select
              value={formData.regime_tributario}
              onValueChange={(value) => handleChange("regime_tributario", value)}
            >
              <SelectTrigger className={errors.regime_tributario ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecione o regime tributário" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REGIME_TRIBUTARIO_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${config.bgColor} ${config.color} border`}>
                        {config.shortLabel}
                      </Badge>
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.regime_tributario && (
              <span className="text-xs text-destructive">{errors.regime_tributario}</span>
            )}
          </div>

          {showSimplesWarning && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Simples Nacional:</strong> Empresas neste regime não utilizam créditos de ICMS para compensação tributária da mesma forma que Lucro Presumido/Real.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
              <Input
                id="inscricao_estadual"
                value={formData.inscricao_estadual}
                onChange={(e) => handleChange("inscricao_estadual", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => handleChange("telefone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="empresa@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => handleChange("endereco", e.target.value)}
              placeholder="Rua, número, cidade - UF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ativo">Status</Label>
            <Select
              value={formData.ativo ? "ativo" : "inativo"}
              onValueChange={(value) => handleChange("ativo", value === "ativo")}
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

          {/* Bloco de Patrimônio / Capital */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">Patrimônio / Capital</h4>
            <div className="space-y-2">
              <Label htmlFor="capital_inicial">K Inicial (Capital Inicial)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="capital_inicial"
                  value={formatCurrencyInput(formData.capital_inicial)}
                  onChange={(e) => {
                    const value = parseCurrencyInput(e.target.value);
                    if (value >= 0) {
                      handleChange("capital_inicial", value);
                    }
                  }}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Valor total investido pelos sócios na abertura da empresa (capital inicial).
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Cadastrar Empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
