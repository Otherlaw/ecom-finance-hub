import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Building2, Calendar, DollarSign, Edit, Banknote } from 'lucide-react';

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_aberto: { label: 'Em Aberto', color: 'bg-blue-100 text-blue-800' },
  parcialmente_pago: { label: 'Parcial', color: 'bg-amber-100 text-amber-800' },
  pago: { label: 'Pago', color: 'bg-green-100 text-green-800' },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-800' },
  cancelado: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
};

interface ContaPagarDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: any;
  onEdit?: () => void;
  onPay?: () => void;
}

export function ContaPagarDetailModal({ open, onOpenChange, conta, onEdit, onPay }: ContaPagarDetailModalProps) {
  if (!conta) return null;

  const statusConfig = STATUS_LABELS[conta.status] || { label: conta.status, color: 'bg-gray-100 text-gray-800' };
  const isPayable = conta.status !== 'pago' && conta.status !== 'cancelado';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Conta a Pagar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{conta.descricao}</h3>
              <p className="text-sm text-muted-foreground">{conta.fornecedor_nome}</p>
            </div>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Empresa</span>
              </div>
              <p className="text-sm pl-6">{conta.empresa?.nome_fantasia || conta.empresa?.razao_social}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Documento</span>
              </div>
              <p className="text-sm pl-6">{conta.documento || '-'}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Emissão / Vencimento</span>
              </div>
              <p className="text-sm pl-6">{formatDateBR(conta.data_emissao)} / {formatDateBR(conta.data_vencimento)}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Valores</span>
            </div>
            <div className="grid grid-cols-3 gap-4 pl-6">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-semibold">{formatCurrency(conta.valor_total)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-emerald-600">Valor Pago</p>
                <p className="text-lg font-semibold text-emerald-700">{formatCurrency(conta.valor_pago)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600">Em Aberto</p>
                <p className="text-lg font-semibold text-red-700">{formatCurrency(conta.valor_em_aberto)}</p>
              </div>
            </div>
          </div>

          {conta.observacoes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Observações</p>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{conta.observacoes}</p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {isPayable && (
              <>
                {onEdit && <Button variant="outline" onClick={onEdit}><Edit className="h-4 w-4 mr-2" />Editar</Button>}
                {onPay && <Button onClick={onPay}><Banknote className="h-4 w-4 mr-2" />Registrar Pagamento</Button>}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
