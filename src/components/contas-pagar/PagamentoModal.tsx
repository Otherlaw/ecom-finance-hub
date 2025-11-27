import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  ContaPagar, 
  Pagamento, 
  FormaPagamento,
  FORMA_PAGAMENTO, 
  mockContasBancarias,
  formatCurrency,
  formatDateBR,
} from '@/lib/contas-pagar-data';
import { mockFornecedores } from '@/lib/contas-pagar-data';
import { mockEmpresas } from '@/lib/empresas-data';
import { Banknote, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onSave: (pagamento: Pagamento, contaId: string) => void;
}

export function PagamentoModal({ open, onOpenChange, conta, onSave }: PagamentoModalProps) {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    dataPagamento: new Date().toISOString().split('T')[0],
    valorPrincipal: 0,
    jurosMulta: 0,
    desconto: 0,
    formaPagamento: '' as FormaPagamento | '',
    contaBancariaId: '',
    observacoes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (conta && open) {
      setFormData({
        dataPagamento: new Date().toISOString().split('T')[0],
        valorPrincipal: conta.valorEmAberto,
        jurosMulta: 0,
        desconto: 0,
        formaPagamento: conta.formaPagamento || '',
        contaBancariaId: conta.contaBancariaId || '',
        observacoes: '',
      });
      setErrors({});
    }
  }, [conta, open]);

  if (!conta) return null;

  const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
  const fornecedor = mockFornecedores.find(f => f.id === conta.fornecedorId);
  const contasBancariasEmpresa = mockContasBancarias.filter(cb => cb.empresaId === conta.empresaId && cb.ativo);

  const valorTotal = formData.valorPrincipal + formData.jurosMulta - formData.desconto;
  const isPagamentoTotal = formData.valorPrincipal >= conta.valorEmAberto;

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.dataPagamento) {
      newErrors.dataPagamento = 'Data é obrigatória';
    }
    if (formData.valorPrincipal <= 0) {
      newErrors.valorPrincipal = 'Valor deve ser maior que zero';
    }
    if (formData.valorPrincipal > conta.valorEmAberto) {
      newErrors.valorPrincipal = `Valor não pode exceder o saldo em aberto (${formatCurrency(conta.valorEmAberto)})`;
    }
    if (!formData.formaPagamento) {
      newErrors.formaPagamento = 'Forma de pagamento é obrigatória';
    }
    if (!formData.contaBancariaId) {
      newErrors.contaBancariaId = 'Conta bancária é obrigatória';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Erro de validação',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    const pagamento: Pagamento = {
      id: `pag-${Date.now()}`,
      contaPagarId: conta.id,
      dataPagamento: formData.dataPagamento,
      valorPrincipal: formData.valorPrincipal,
      jurosMulta: formData.jurosMulta,
      desconto: formData.desconto,
      valorTotal,
      formaPagamento: formData.formaPagamento as FormaPagamento,
      contaBancariaId: formData.contaBancariaId,
      observacoes: formData.observacoes || undefined,
    };

    onSave(pagamento, conta.id);
    toast({
      title: 'Pagamento registrado',
      description: isPagamentoTotal 
        ? 'Conta paga integralmente.' 
        : `Pagamento parcial de ${formatCurrency(valorTotal)} registrado.`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Registrar Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo da Conta */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{conta.descricao}</p>
                <p className="text-sm text-muted-foreground">{fornecedor?.nome} • {empresa?.nome}</p>
              </div>
              <Badge variant="outline">{conta.documento || 'Sem doc.'}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vencimento:</span>
                <p className="font-medium">{formatDateBR(conta.dataVencimento)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Original:</span>
                <p className="font-medium">{formatCurrency(conta.valorTotal)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Saldo em Aberto:</span>
                <p className="font-semibold text-primary">{formatCurrency(conta.valorEmAberto)}</p>
              </div>
            </div>
          </div>

          {/* Formulário de Pagamento */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataPagamento">Data do Pagamento *</Label>
                <Input
                  id="dataPagamento"
                  type="date"
                  value={formData.dataPagamento}
                  onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                  className={errors.dataPagamento ? 'border-red-500' : ''}
                />
                {errors.dataPagamento && <p className="text-xs text-red-500">{errors.dataPagamento}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorPrincipal">Valor Principal *</Label>
                <Input
                  id="valorPrincipal"
                  type="number"
                  step="0.01"
                  min="0"
                  max={conta.valorEmAberto}
                  value={formData.valorPrincipal || ''}
                  onChange={(e) => setFormData({ ...formData, valorPrincipal: parseFloat(e.target.value) || 0 })}
                  className={errors.valorPrincipal ? 'border-red-500' : ''}
                />
                {errors.valorPrincipal && <p className="text-xs text-red-500">{errors.valorPrincipal}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jurosMulta">Juros / Multa</Label>
                <Input
                  id="jurosMulta"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.jurosMulta || ''}
                  onChange={(e) => setFormData({ ...formData, jurosMulta: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="desconto">Desconto</Label>
                <Input
                  id="desconto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.desconto || ''}
                  onChange={(e) => setFormData({ ...formData, desconto: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Total Calculado */}
            <div className="bg-primary/10 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="font-medium">Valor Total a Pagar:</span>
              </div>
              <span className="text-2xl font-bold text-primary">{formatCurrency(valorTotal)}</span>
            </div>

            {/* Indicador de pagamento parcial/total */}
            {formData.valorPrincipal > 0 && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                isPagamentoTotal 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {isPagamentoTotal ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Pagamento integral - a conta será marcada como paga.
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Pagamento parcial - restará {formatCurrency(conta.valorEmAberto - formData.valorPrincipal)} em aberto.
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de Pagamento *</Label>
                <Select
                  value={formData.formaPagamento}
                  onValueChange={(value) => setFormData({ ...formData, formaPagamento: value as FormaPagamento })}
                >
                  <SelectTrigger className={errors.formaPagamento ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FORMA_PAGAMENTO).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.formaPagamento && <p className="text-xs text-red-500">{errors.formaPagamento}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contaBancariaId">Conta Bancária *</Label>
                <Select
                  value={formData.contaBancariaId}
                  onValueChange={(value) => setFormData({ ...formData, contaBancariaId: value })}
                >
                  <SelectTrigger className={errors.contaBancariaId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {contasBancariasEmpresa.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.nome} ({formatCurrency(cb.saldoAtual)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.contaBancariaId && <p className="text-xs text-red-500">{errors.contaBancariaId}</p>}
                {contasBancariasEmpresa.length === 0 && (
                  <p className="text-xs text-amber-600">Nenhuma conta bancária cadastrada para esta empresa.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Informações adicionais sobre o pagamento..."
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              Confirmar Pagamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
