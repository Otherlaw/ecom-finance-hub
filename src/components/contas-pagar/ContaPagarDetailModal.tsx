import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ContaPagar, 
  STATUS_CONTA_PAGAR,
  TIPO_LANCAMENTO,
  FORMA_PAGAMENTO,
  mockFornecedores,
  mockCategorias,
  mockCentrosCusto,
  mockContasBancarias,
  formatCurrency,
  formatDateBR,
  getDaysUntilDue,
} from '@/lib/contas-pagar-data';
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG } from '@/lib/empresas-data';
import { 
  FileText, 
  Building2, 
  User, 
  CalendarDays, 
  DollarSign, 
  Receipt, 
  Tag, 
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Repeat,
  History,
} from 'lucide-react';

interface ContaPagarDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onEdit?: () => void;
  onPay?: () => void;
}

export function ContaPagarDetailModal({ open, onOpenChange, conta, onEdit, onPay }: ContaPagarDetailModalProps) {
  if (!conta) return null;

  const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
  const fornecedor = mockFornecedores.find(f => f.id === conta.fornecedorId);
  const categoria = mockCategorias.find(c => c.id === conta.categoriaId);
  const centroCusto = mockCentrosCusto.find(cc => cc.id === conta.centroCustoId);
  const statusConfig = STATUS_CONTA_PAGAR[conta.status];
  const tipoConfig = TIPO_LANCAMENTO[conta.tipoLancamento];
  const diasVencimento = getDaysUntilDue(conta.dataVencimento);

  const getVencimentoLabel = () => {
    if (conta.status === 'pago') return 'Pago';
    if (diasVencimento < 0) return `Vencido há ${Math.abs(diasVencimento)} dias`;
    if (diasVencimento === 0) return 'Vence hoje';
    if (diasVencimento === 1) return 'Vence amanhã';
    return `Vence em ${diasVencimento} dias`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Conta a Pagar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header com Status */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{conta.descricao}</h3>
              <p className="text-sm text-muted-foreground">{conta.documento || 'Sem documento'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border`}>
                {statusConfig.label}
              </Badge>
              {conta.recorrente && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Repeat className="h-3 w-3" />
                  Recorrente
                </Badge>
              )}
            </div>
          </div>

          {/* Vencimento Alert */}
          {conta.status !== 'pago' && conta.status !== 'cancelado' && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              diasVencimento < 0 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : diasVencimento <= 3
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {diasVencimento < 0 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              {getVencimentoLabel()}
            </div>
          )}

          <Separator />

          {/* Informações Principais */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Empresa</p>
                  <p className="font-medium">{empresa?.nome}</p>
                  {empresa && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].label}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-medium">{fornecedor?.nome}</p>
                  <p className="text-xs text-muted-foreground">{fornecedor?.cnpjCpf}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Receipt className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Lançamento</p>
                  <p className="font-medium">{tipoConfig.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Datas</p>
                  <p className="font-medium">Emissão: {formatDateBR(conta.dataEmissao)}</p>
                  <p className="font-medium">Vencimento: {formatDateBR(conta.dataVencimento)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Classificação</p>
                  <p className="font-medium">{categoria?.nome}</p>
                  {centroCusto && (
                    <p className="text-sm text-muted-foreground">CC: {centroCusto.nome}</p>
                  )}
                </div>
              </div>

              {conta.formaPagamento && (
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                    <p className="font-medium">{FORMA_PAGAMENTO[conta.formaPagamento].label}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Valores */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valores
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Valor Original</p>
                <p className="text-xl font-bold">{formatCurrency(conta.valorTotal)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-200">
                <p className="text-sm text-emerald-600">Valor Pago</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(conta.valorPago)}</p>
              </div>
              <div className={`rounded-lg p-4 text-center border ${
                conta.valorEmAberto > 0 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <p className={`text-sm ${conta.valorEmAberto > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  Saldo em Aberto
                </p>
                <p className={`text-xl font-bold ${conta.valorEmAberto > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {formatCurrency(conta.valorEmAberto)}
                </p>
              </div>
            </div>
          </div>

          {/* Parcelas (se houver) */}
          {conta.parcelas && conta.parcelas.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold">Parcelas ({conta.parcelas.length})</h4>
                <div className="space-y-2">
                  {conta.parcelas.map((parcela) => {
                    const parcelaStatus = STATUS_CONTA_PAGAR[parcela.status];
                    return (
                      <div 
                        key={parcela.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm bg-muted px-2 py-1 rounded">
                            {parcela.numero}ª
                          </span>
                          <span>{formatDateBR(parcela.dataVencimento)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatCurrency(parcela.valorOriginal)}</span>
                          <Badge className={`${parcelaStatus.bgColor} ${parcelaStatus.color} border text-xs`}>
                            {parcelaStatus.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Histórico de Pagamentos */}
          {conta.pagamentos && conta.pagamentos.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Pagamentos
                </h4>
                <div className="space-y-2">
                  {conta.pagamentos.map((pagamento) => {
                    const contaBancaria = mockContasBancarias.find(cb => cb.id === pagamento.contaBancariaId);
                    return (
                      <div 
                        key={pagamento.id}
                        className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <div>
                            <span className="font-medium">{formatDateBR(pagamento.dataPagamento)}</span>
                            <p className="text-xs text-muted-foreground">
                              {FORMA_PAGAMENTO[pagamento.formaPagamento].label} • {contaBancaria?.nome}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-emerald-700">{formatCurrency(pagamento.valorTotal)}</span>
                          {(pagamento.jurosMulta > 0 || pagamento.desconto > 0) && (
                            <p className="text-xs text-muted-foreground">
                              {pagamento.jurosMulta > 0 && `+${formatCurrency(pagamento.jurosMulta)} juros`}
                              {pagamento.desconto > 0 && ` -${formatCurrency(pagamento.desconto)} desc.`}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Vínculos */}
          {(conta.nfId || conta.compraId) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold">Vínculos</h4>
                <div className="flex gap-3">
                  {conta.nfId && (
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Ver Nota Fiscal
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  {conta.compraId && (
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Ver Compra
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {conta.observacoes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold">Observações</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {conta.observacoes}
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {conta.status !== 'pago' && conta.status !== 'cancelado' && (
              <>
                {onEdit && (
                  <Button variant="outline" onClick={onEdit}>
                    Editar
                  </Button>
                )}
                {onPay && (
                  <Button onClick={onPay}>
                    Registrar Pagamento
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
