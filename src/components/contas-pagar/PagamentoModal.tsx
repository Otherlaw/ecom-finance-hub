import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ContaPagar } from '@/hooks/useContasPagar';
import { Banknote, Calculator, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FORMA_PAGAMENTO = {
  pix: { label: 'Pix' },
  boleto: { label: 'Boleto' },
  transferencia: { label: 'Transferência' },
  cartao: { label: 'Cartão' },
  dinheiro: { label: 'Dinheiro' },
  outro: { label: 'Outro' },
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onSave: (valorPago: number, dataPagamento: string, contaId: string) => void;
}

export function PagamentoModal({ open, onOpenChange, conta, onSave }: PagamentoModalProps) {
  const [formData, setFormData] = useState({
    dataPagamento: new Date().toISOString().split('T')[0],
    valorPrincipal: 0,
    jurosMulta: 0,
    desconto: 0,
    formaPagamento: '',
    observacoes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (conta && open) {
      setFormData({
        dataPagamento: new Date().toISOString().split('T')[0],
        valorPrincipal: conta.valor_em_aberto,
        jurosMulta: 0,
        desconto: 0,
        formaPagamento: conta.forma_pagamento || '',
        observacoes: '',
      });
      setErrors({});
    }
  }, [conta, open]);

  if (!conta) return null;

  const valorTotal = formData.valorPrincipal + formData.jurosMulta - formData.desconto;
  const isPagamentoTotal = formData.valorPrincipal >= conta.valor_em_aberto;

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.dataPagamento) {
      newErrors.dataPagamento = 'Data é obrigatória';
    }
    if (formData.valorPrincipal <= 0) {
      newErrors.valorPrincipal = 'Valor deve ser maior que zero';
    }
    if (formData.valorPrincipal > conta.valor_em_aberto) {
      newErrors.valorPrincipal = `Valor não pode exceder o saldo em aberto (${formatCurrency(conta.valor_em_aberto)})`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    onSave(formData.valorPrincipal, formData.dataPagamento, conta.id);
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
                <p className="text-sm text-muted-foreground">
                  {conta.fornecedor_nome} • {conta.empresa?.nome_fantasia || conta.empresa?.razao_social}
                </p>
              </div>
              <Badge variant="outline">{conta.documento || 'Sem doc.'}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vencimento:</span>
                <p className="font-medium">{formatDateBR(conta.data_vencimento)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Valor Original:</span>
                <p className="font-medium">{formatCurrency(conta.valor_total)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Saldo em Aberto:</span>
                <p className="font-semibold text-primary">{formatCurrency(conta.valor_em_aberto)}</p>
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
                  max={conta.valor_em_aberto}
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
                    Pagamento parcial - restará {formatCurrency(conta.valor_em_aberto - formData.valorPrincipal)} em aberto.
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
              <Select
                value={formData.formaPagamento}
                onValueChange={(value) => setFormData({ ...formData, formaPagamento: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMA_PAGAMENTO).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
