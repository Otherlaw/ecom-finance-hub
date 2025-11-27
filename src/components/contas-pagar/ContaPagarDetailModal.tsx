import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ContaPagar,
  STATUS_CONTA_PAGAR,
  TIPO_LANCAMENTO,
  FORMA_PAGAMENTO,
  mockCategorias,
  mockCentrosCusto,
  mockEmpresas,
  mockContasBancarias,
  formatCurrency,
  formatDate,
  getDaysUntilDue,
  isOverdue,
} from "@/lib/contas-pagar-data";
import { REGIME_TRIBUTARIO_CONFIG } from "@/lib/empresas-data";
import {
  Building2,
  User,
  FileText,
  Calendar,
  DollarSign,
  CreditCard,
  Tag,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Repeat,
  History,
} from "lucide-react";

interface ContaPagarDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  onPagar: (conta: ContaPagar) => void;
}

export function ContaPagarDetailModal({ open, onOpenChange, conta, onPagar }: ContaPagarDetailModalProps) {
  if (!conta) return null;

  const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
  const categoria = mockCategorias.find(c => c.id === conta.categoriaId);
  const centroCusto = mockCentrosCusto.find(cc => cc.id === conta.centroCustoId);
  const statusConfig = STATUS_CONTA_PAGAR[conta.status];
  const tipoConfig = TIPO_LANCAMENTO[conta.tipoLancamento];
  const formaConfig = conta.formaPagamento ? FORMA_PAGAMENTO[conta.formaPagamento] : null;
  const daysUntilDue = getDaysUntilDue(conta.dataVencimento);
  const overdue = isOverdue(conta.dataVencimento, conta.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-destructive" />
              Detalhes da Conta a Pagar
            </DialogTitle>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border`}>
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="pagamentos">
              Pagamentos ({conta.pagamentos.length})
            </TabsTrigger>
            <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-6 mt-4">
            {/* Status Banner */}
            {overdue && conta.status !== 'pago' && conta.status !== 'cancelado' && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  Vencido há {Math.abs(daysUntilDue)} dia(s)
                </span>
              </div>
            )}

            {!overdue && conta.status === 'em_aberto' && daysUntilDue <= 7 && (
              <div className="flex items-center gap-2 p-3 bg-amber-100 text-amber-800 rounded-lg">
                <Clock className="h-5 w-5" />
                <span className="font-medium">
                  {daysUntilDue === 0 ? "Vence hoje" : `Vence em ${daysUntilDue} dia(s)`}
                </span>
              </div>
            )}

            {conta.status === 'pago' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-100 text-emerald-800 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Conta paga integralmente</span>
              </div>
            )}

            {/* Informações Principais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Empresa</p>
                    <p className="font-medium">{empresa?.nome || "N/A"}</p>
                    {empresa && (
                      <Badge variant="outline" className={`mt-1 ${REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].bgColor}`}>
                        {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].label}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fornecedor</p>
                    <p className="font-medium">{conta.fornecedorNome}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Descrição</p>
                    <p className="font-medium">{conta.descricao}</p>
                    {conta.documento && (
                      <p className="text-sm text-muted-foreground">Doc: {conta.documento}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Datas</p>
                    <p className="text-sm">Emissão: {formatDate(conta.dataEmissao)}</p>
                    <p className="text-sm font-medium">Vencimento: {formatDate(conta.dataVencimento)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Tag className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">{tipoConfig.icon} {tipoConfig.label}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Target className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Categoria</p>
                    <p className="font-medium">{categoria?.nome || "N/A"}</p>
                    {centroCusto && (
                      <p className="text-sm text-muted-foreground">CC: {centroCusto.nome}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valores
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Valor Original</p>
                  <p className="text-xl font-bold">{formatCurrency(conta.valorOriginal)}</p>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Valor Pago</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(conta.valorPago)}</p>
                </div>
                <div className="text-center p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Em Aberto</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(conta.valorEmAberto)}</p>
                </div>
              </div>

              {conta.numeroParcelas && conta.numeroParcelas > 1 && (
                <div className="mt-4 p-3 bg-muted/30 rounded flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Parcelamento:</span>
                  <span className="font-medium">
                    {conta.parcelaAtual || 1}/{conta.numeroParcelas}x de {formatCurrency(conta.valorOriginal)}
                  </span>
                </div>
              )}

              {formaConfig && (
                <div className="mt-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Forma de Pagamento:</span>
                  <span className="font-medium">{formaConfig.icon} {formaConfig.label}</span>
                </div>
              )}
            </div>

            {/* Recorrência */}
            {conta.recorrente && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  Lançamento Recorrente
                </h4>
                <p className="text-sm">
                  Este é um lançamento recorrente com periodicidade{" "}
                  <span className="font-medium">{conta.periodicidade}</span>
                </p>
              </div>
            )}

            {/* Observações */}
            {conta.observacoes && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Observações</h4>
                <p className="text-sm text-muted-foreground">{conta.observacoes}</p>
              </div>
            )}

            {/* Ações */}
            {(conta.status === 'em_aberto' || conta.status === 'vencido' || conta.status === 'parcialmente_pago') && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    onPagar(conta);
                  }}
                  className="bg-success hover:bg-success/90"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Registrar Pagamento
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pagamentos" className="mt-4">
            {conta.pagamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum pagamento registrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Juros/Multa</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Forma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conta.pagamentos.map((pag) => {
                    const contaBancaria = mockContasBancarias.find(cb => cb.id === pag.contaBancariaId);
                    return (
                      <TableRow key={pag.id}>
                        <TableCell>{formatDate(pag.dataPagamento)}</TableCell>
                        <TableCell>{formatCurrency(pag.valorPago)}</TableCell>
                        <TableCell>
                          {pag.juros > 0 || pag.multa > 0 
                            ? formatCurrency(pag.juros + pag.multa)
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {pag.desconto > 0 
                            ? <span className="text-success">-{formatCurrency(pag.desconto)}</span>
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(pag.valorTotal)}</TableCell>
                        <TableCell>
                          <div>
                            <span>{FORMA_PAGAMENTO[pag.formaPagamento].icon}</span>
                            {contaBancaria && (
                              <p className="text-xs text-muted-foreground">{contaBancaria.nome}</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="vinculos" className="mt-4">
            <div className="space-y-4">
              {conta.nfVinculadaId && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Nota Fiscal Vinculada</p>
                      <p className="text-sm text-muted-foreground">ID: {conta.nfVinculadaId}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver NF
                  </Button>
                </div>
              )}

              {conta.compraVinculadaId && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Compra Vinculada</p>
                      <p className="text-sm text-muted-foreground">ID: {conta.compraVinculadaId}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Compra
                  </Button>
                </div>
              )}

              {conta.parcelaPaiId && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Repeat className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Parte de Parcelamento</p>
                      <p className="text-sm text-muted-foreground">
                        Parcela {conta.parcelaAtual} de {conta.numeroParcelas}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!conta.nfVinculadaId && !conta.compraVinculadaId && !conta.parcelaPaiId && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum vínculo encontrado</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
