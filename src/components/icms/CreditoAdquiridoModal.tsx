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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Calculator, Info, Building2, Truck } from "lucide-react";
import { toast } from "sonner";
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG, canUseICMSCredit } from "@/lib/empresas-data";
import { mockFornecedores, TIPO_FORNECEDOR_CONFIG } from "@/lib/fornecedores-data";
import { CreditoICMS, NotaCreditoAdquirida, formatCurrency } from "@/lib/icms-data";

interface CreditoAdquiridoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (credito: CreditoICMS, notaAdquirida: NotaCreditoAdquirida) => void;
}

export function CreditoAdquiridoModal({
  open,
  onOpenChange,
  onSave,
}: CreditoAdquiridoModalProps) {
  const [formData, setFormData] = useState({
    empresa: "",
    fornecedorId: "",
    numeroNF: "",
    chaveAcesso: "",
    dataOperacao: new Date().toISOString().split("T")[0],
    valorOperacao: "",
    aliquotaMedia: "8",
    observacoes: "",
  });

  const [valorCreditoCalculado, setValorCreditoCalculado] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const empresas = mockEmpresas.filter(e => canUseICMSCredit(e.regimeTributario));
  const fornecedoresCredito = mockFornecedores.filter(f => f.tipo === 'credito_icms' || f.tipo === 'mercadoria');

  const selectedEmpresa = empresas.find(e => e.nome.split(' ')[0].toUpperCase() === formData.empresa);
  const selectedFornecedor = mockFornecedores.find(f => f.id === formData.fornecedorId);

  useEffect(() => {
    const valorOp = parseFloat(formData.valorOperacao) || 0;
    const aliquota = parseFloat(formData.aliquotaMedia) || 0;
    const credito = valorOp * (aliquota / 100);
    setValorCreditoCalculado(Math.round(credito * 100) / 100);
  }, [formData.valorOperacao, formData.aliquotaMedia]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.empresa) newErrors.empresa = "Selecione uma empresa";
    if (!formData.fornecedorId) newErrors.fornecedorId = "Selecione um fornecedor";
    if (!formData.numeroNF.trim()) newErrors.numeroNF = "Número da NF é obrigatório";
    if (!formData.dataOperacao) newErrors.dataOperacao = "Data é obrigatória";
    if (!formData.valorOperacao || parseFloat(formData.valorOperacao) <= 0) {
      newErrors.valorOperacao = "Valor deve ser maior que zero";
    }
    if (!formData.aliquotaMedia || parseFloat(formData.aliquotaMedia) <= 0) {
      newErrors.aliquotaMedia = "Alíquota deve ser maior que zero";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const hoje = new Date().toISOString().split("T")[0];
    const competencia = formData.dataOperacao.substring(0, 7);
    const id = `cred-adq-${Date.now()}`;

    const credito: CreditoICMS = {
      id,
      empresa: formData.empresa,
      tipoCredito: "compensavel",
      origemCredito: "nota_adquirida",
      statusCredito: "ativo",
      numeroNF: formData.numeroNF,
      chaveAcesso: formData.chaveAcesso || undefined,
      ncm: "99999999",
      descricao: `Nota fiscal de crédito adquirida - ${selectedFornecedor?.nomeFantasia || selectedFornecedor?.razaoSocial}`,
      quantidade: 1,
      valorUnitario: parseFloat(formData.valorOperacao),
      valorTotal: parseFloat(formData.valorOperacao),
      ufOrigem: selectedFornecedor?.endereco.uf || "SP",
      aliquotaIcms: parseFloat(formData.aliquotaMedia),
      valorIcmsDestacado: valorCreditoCalculado,
      percentualAproveitamento: 100,
      valorCreditoBruto: valorCreditoCalculado,
      valorAjustes: 0,
      valorCredito: valorCreditoCalculado,
      dataLancamento: hoje,
      dataCompetencia: competencia,
      fornecedorId: formData.fornecedorId,
      fornecedorNome: selectedFornecedor?.nomeFantasia || selectedFornecedor?.razaoSocial,
      observacoes: formData.observacoes,
    };

    const notaAdquirida: NotaCreditoAdquirida = {
      id: `nca-${Date.now()}`,
      empresaId: selectedEmpresa?.id || "",
      empresa: formData.empresa,
      fornecedorId: formData.fornecedorId,
      fornecedorNome: selectedFornecedor?.nomeFantasia || selectedFornecedor?.razaoSocial || "",
      numeroNF: formData.numeroNF,
      chaveAcesso: formData.chaveAcesso || undefined,
      dataOperacao: formData.dataOperacao,
      valorOperacao: parseFloat(formData.valorOperacao),
      valorCreditoGerado: valorCreditoCalculado,
      aliquotaMedia: parseFloat(formData.aliquotaMedia),
      observacoes: formData.observacoes,
      dataCadastro: hoje,
    };

    onSave(credito, notaAdquirida);
    toast.success("Nota de crédito adquirida registrada com sucesso!");
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      empresa: "",
      fornecedorId: "",
      numeroNF: "",
      chaveAcesso: "",
      dataOperacao: new Date().toISOString().split("T")[0],
      valorOperacao: "",
      aliquotaMedia: "8",
      observacoes: "",
    });
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Registrar Nota de Crédito Adquirida
          </DialogTitle>
          <DialogDescription>
            Registre uma nota fiscal de crédito de ICMS comprada de terceiros para compensação.
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-purple-50 border-purple-200">
          <Info className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-700 text-sm">
            O crédito gerado será registrado como <strong>Compensável</strong> e poderá ser usado para abater o ICMS devido.
            O custo financeiro desta operação (ex.: 2,5%) deve ser registrado separadamente em Contas a Pagar.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Empresa */}
            <div className="space-y-2">
              <Label htmlFor="empresa" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa *
              </Label>
              <Select value={formData.empresa} onValueChange={(v) => handleChange("empresa", v)}>
                <SelectTrigger className={errors.empresa ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione a empresa" />
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
              {errors.empresa && <p className="text-xs text-destructive">{errors.empresa}</p>}
            </div>

            {/* Fornecedor */}
            <div className="space-y-2">
              <Label htmlFor="fornecedorId" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fornecedor (Vendedor da Nota) *
              </Label>
              <Select value={formData.fornecedorId} onValueChange={(v) => handleChange("fornecedorId", v)}>
                <SelectTrigger className={errors.fornecedorId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedoresCredito.map((forn) => {
                    const tipo = TIPO_FORNECEDOR_CONFIG[forn.tipo];
                    return (
                      <SelectItem key={forn.id} value={forn.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${tipo.bgColor} ${tipo.color} text-xs`}>
                            {tipo.label}
                          </Badge>
                          {forn.nomeFantasia || forn.razaoSocial}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.fornecedorId && <p className="text-xs text-destructive">{errors.fornecedorId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Número NF */}
            <div className="space-y-2">
              <Label htmlFor="numeroNF">Número da NF *</Label>
              <Input
                id="numeroNF"
                value={formData.numeroNF}
                onChange={(e) => handleChange("numeroNF", e.target.value)}
                placeholder="Ex.: 12345"
                className={errors.numeroNF ? "border-destructive" : ""}
              />
              {errors.numeroNF && <p className="text-xs text-destructive">{errors.numeroNF}</p>}
            </div>

            {/* Data Operação */}
            <div className="space-y-2">
              <Label htmlFor="dataOperacao">Data da Operação *</Label>
              <Input
                id="dataOperacao"
                type="date"
                value={formData.dataOperacao}
                onChange={(e) => handleChange("dataOperacao", e.target.value)}
                className={errors.dataOperacao ? "border-destructive" : ""}
              />
              {errors.dataOperacao && <p className="text-xs text-destructive">{errors.dataOperacao}</p>}
            </div>
          </div>

          {/* Chave de Acesso (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="chaveAcesso">Chave de Acesso (opcional)</Label>
            <Input
              id="chaveAcesso"
              value={formData.chaveAcesso}
              onChange={(e) => handleChange("chaveAcesso", e.target.value)}
              placeholder="44 dígitos"
              maxLength={44}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Valor da Operação */}
            <div className="space-y-2">
              <Label htmlFor="valorOperacao">Valor da Operação *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="valorOperacao"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valorOperacao}
                  onChange={(e) => handleChange("valorOperacao", e.target.value)}
                  placeholder="0,00"
                  className={`pl-10 ${errors.valorOperacao ? "border-destructive" : ""}`}
                />
              </div>
              {errors.valorOperacao && <p className="text-xs text-destructive">{errors.valorOperacao}</p>}
            </div>

            {/* Alíquota Média */}
            <div className="space-y-2">
              <Label htmlFor="aliquotaMedia">Alíquota ICMS (%) *</Label>
              <div className="relative">
                <Input
                  id="aliquotaMedia"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.aliquotaMedia}
                  onChange={(e) => handleChange("aliquotaMedia", e.target.value)}
                  placeholder="8"
                  className={errors.aliquotaMedia ? "border-destructive" : ""}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              {errors.aliquotaMedia && <p className="text-xs text-destructive">{errors.aliquotaMedia}</p>}
            </div>

            {/* Crédito Calculado */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Crédito Gerado
              </Label>
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-lg font-bold text-success">{formatCurrency(valorCreditoCalculado)}</p>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => handleChange("observacoes", e.target.value)}
              placeholder="Informações adicionais sobre a operação..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <FileText className="h-4 w-4" />
            Registrar Crédito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
