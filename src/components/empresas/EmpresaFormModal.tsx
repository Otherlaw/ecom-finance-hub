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
import { AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Empresa,
  RegimeTributario,
  REGIME_TRIBUTARIO_CONFIG,
  validateEmpresa,
  formatCNPJ,
  SIMPLES_NACIONAL_ICMS_WARNING,
} from "@/lib/empresas-data";

interface EmpresaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
  onSave: (empresa: Empresa) => void;
}

export function EmpresaFormModal({
  open,
  onOpenChange,
  empresa,
  onSave,
}: EmpresaFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!empresa;

  const [formData, setFormData] = useState<Partial<Empresa>>({
    nome: "",
    cnpj: "",
    regimeTributario: undefined,
    marketplaces: [],
    usuarios: 1,
    status: "ativo",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (empresa) {
      setFormData(empresa);
    } else {
      setFormData({
        nome: "",
        cnpj: "",
        regimeTributario: undefined,
        marketplaces: [],
        usuarios: 1,
        status: "ativo",
      });
    }
    setErrors({});
  }, [empresa, open]);

  const handleChange = (field: keyof Empresa, value: string | number | string[]) => {
    if (field === 'cnpj' && typeof value === 'string') {
      value = formatCNPJ(value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    const validation = validateEmpresa(formData);
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
    const savedEmpresa: Empresa = {
      id: empresa?.id || `emp-${Date.now()}`,
      nome: formData.nome!,
      cnpj: formData.cnpj!,
      regimeTributario: formData.regimeTributario!,
      marketplaces: formData.marketplaces || [],
      usuarios: formData.usuarios || 1,
      status: formData.status as 'ativo' | 'inativo',
      dataCadastro: empresa?.dataCadastro || now,
      dataAtualizacao: now,
    };

    onSave(savedEmpresa);
    toast({
      title: isEditing ? "Empresa atualizada" : "Empresa cadastrada",
      description: `${savedEmpresa.nome} foi ${isEditing ? "atualizada" : "cadastrada"} com sucesso.`,
    });
    onOpenChange(false);
  };

  const showSimplesWarning = formData.regimeTributario === 'simples_nacional';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            <Label htmlFor="nome">Nome da Empresa *</Label>
            <Input
              id="nome"
              value={formData.nome || ""}
              onChange={(e) => handleChange("nome", e.target.value)}
              placeholder="Ex: Minha Empresa Ltda"
              className={errors.nome ? "border-destructive" : ""}
            />
            {errors.nome && (
              <span className="text-xs text-destructive">{errors.nome}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={formData.cnpj || ""}
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
            <Label htmlFor="regimeTributario">Regime Tributário *</Label>
            <Select
              value={formData.regimeTributario}
              onValueChange={(value) => handleChange("regimeTributario", value as RegimeTributario)}
            >
              <SelectTrigger className={errors.regimeTributario ? "border-destructive" : ""}>
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
            {errors.regimeTributario && (
              <span className="text-xs text-destructive">{errors.regimeTributario}</span>
            )}
          </div>

          {showSimplesWarning && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Simples Nacional:</strong> Empresas neste regime não utilizam créditos de ICMS para compensação tributária da mesma forma que Lucro Presumido/Real. O módulo de ICMS funcionará apenas como controle interno.
              </AlertDescription>
            </Alert>
          )}

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

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? "Salvar Alterações" : "Cadastrar Empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
