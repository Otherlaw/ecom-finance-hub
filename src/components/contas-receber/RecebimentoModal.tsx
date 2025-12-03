import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContaReceber } from '@/hooks/useContasReceber';
import { Loader2 } from 'lucide-react';

interface RecebimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaReceber | null;
  onSave: (valorRecebido: number, dataRecebimento: string, contaId: string) => Promise<void>;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function RecebimentoModal({ open, onOpenChange, conta, onSave }: RecebimentoModalProps) {
  const [valorRecebido, setValorRecebido] = useState('');
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conta) return;

    setLoading(true);
    try {
      await onSave(parseFloat(valorRecebido), dataRecebimento, conta.id);
      setValorRecebido('');
      setDataRecebimento(new Date().toISOString().split('T')[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleReceberTotal = () => {
    if (conta) {
      setValorRecebido(conta.valor_em_aberto.toString());
    }
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da conta */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Cliente:</span>{' '}
              <span className="font-medium">{conta.cliente_nome}</span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Descrição:</span>{' '}
              <span className="font-medium">{conta.descricao}</span>
            </p>
            <div className="flex justify-between pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-semibold">{formatCurrency(conta.valor_total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Já Recebido</p>
                <p className="font-semibold text-green-600">{formatCurrency(conta.valor_recebido)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Aberto</p>
                <p className="font-semibold text-amber-600">{formatCurrency(conta.valor_em_aberto)}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Valor do Recebimento *</Label>
                <Button type="button" variant="link" size="sm" onClick={handleReceberTotal}>
                  Receber total
                </Button>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={conta.valor_em_aberto}
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Data do Recebimento *</Label>
              <Input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !valorRecebido}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Recebimento
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
