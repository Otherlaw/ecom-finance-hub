import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Fornecedor,
  TIPO_FORNECEDOR_CONFIG,
  REGIME_TRIBUTARIO_FORNECEDOR_CONFIG,
  ORIGEM_FORNECEDOR_CONFIG,
  SEGMENTO_FORNECEDOR_CONFIG,
  FORMA_PAGAMENTO_PADRAO_CONFIG,
  formatCurrency,
  formatDate,
} from '@/lib/fornecedores-data';
import { Purchase, formatCurrency as formatPurchaseCurrency, formatDate as formatPurchaseDate } from '@/lib/purchases-data';
import { ContaPagar, formatCurrency as formatContaCurrency, formatDateBR } from '@/lib/contas-pagar-data';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  CreditCard,
  FileText,
  Package,
  Receipt,
  Edit,
  ExternalLink,
  User,
} from 'lucide-react';

interface FornecedorDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: Fornecedor | null;
  compras?: Purchase[];
  contasPagar?: ContaPagar[];
  onEdit?: (fornecedor: Fornecedor) => void;
}

export function FornecedorDetailModal({
  open,
  onOpenChange,
  fornecedor,
  compras = [],
  contasPagar = [],
  onEdit,
}: FornecedorDetailModalProps) {
  if (!fornecedor) return null;

  const tipoConfig = TIPO_FORNECEDOR_CONFIG[fornecedor.tipo];
  const regimeConfig = fornecedor.regimeTributario 
    ? REGIME_TRIBUTARIO_FORNECEDOR_CONFIG[fornecedor.regimeTributario] 
    : null;
  const origemConfig = ORIGEM_FORNECEDOR_CONFIG[fornecedor.origem];
  const segmentoConfig = SEGMENTO_FORNECEDOR_CONFIG[fornecedor.segmento];
  const formaPagConfig = FORMA_PAGAMENTO_PADRAO_CONFIG[fornecedor.condicoesPagamento.formaPagamento];

  // Filter related data
  const comprasVinculadas = compras.filter(
    c => c.fornecedorCnpj?.replace(/\D/g, '') === fornecedor.cnpj.replace(/\D/g, '')
  );
  const contasVinculadas = contasPagar.filter(
    cp => cp.fornecedorId === fornecedor.id
  );

  const totalCompras = comprasVinculadas.reduce((sum, c) => sum + c.valorTotal, 0);
  const totalContasEmAberto = contasVinculadas
    .filter(c => c.status !== 'pago' && c.status !== 'cancelado')
    .reduce((sum, c) => sum + c.valorEmAberto, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                {fornecedor.nomeFantasia || fornecedor.razaoSocial}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{fornecedor.razaoSocial}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${tipoConfig.bgColor} ${tipoConfig.color}`}>
                {tipoConfig.label}
              </Badge>
              <Badge variant={fornecedor.status === 'ativo' ? 'default' : 'secondary'}>
                {fornecedor.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </Badge>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(fornecedor)}>
                  <Edit className="h-4 w-4 mr-2" />Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="compras">Compras ({comprasVinculadas.length})</TabsTrigger>
              <TabsTrigger value="contas">Contas a Pagar ({contasVinculadas.length})</TabsTrigger>
              <TabsTrigger value="nfs">Notas Fiscais</TabsTrigger>
              <TabsTrigger value="icms">Créditos ICMS</TabsTrigger>
            </TabsList>

            {/* Dados Cadastrais */}
            <TabsContent value="dados" className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{formatCurrency(totalCompras)}</div>
                    <p className="text-sm text-muted-foreground">Total em Compras</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-warning">{formatCurrency(totalContasEmAberto)}</div>
                    <p className="text-sm text-muted-foreground">Contas em Aberto</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{comprasVinculadas.length}</div>
                    <p className="text-sm text-muted-foreground">Compras Realizadas</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Identificação */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />Identificação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CNPJ:</span>
                      <span className="font-mono">{fornecedor.cnpj}</span>
                    </div>
                    {fornecedor.inscricaoEstadual && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IE:</span>
                        <span>{fornecedor.inscricaoEstadual}</span>
                      </div>
                    )}
                    {regimeConfig && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Regime:</span>
                        <span>{regimeConfig.label}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Origem:</span>
                      <span>{origemConfig.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Segmento:</span>
                      <span>{segmentoConfig.label}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Endereço */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />Endereço
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {fornecedor.endereco.logradouro && (
                      <p>
                        {fornecedor.endereco.logradouro}, {fornecedor.endereco.numero}
                        {fornecedor.endereco.complemento && ` - ${fornecedor.endereco.complemento}`}
                      </p>
                    )}
                    {fornecedor.endereco.bairro && <p>{fornecedor.endereco.bairro}</p>}
                    <p>
                      {fornecedor.endereco.cidade} - {fornecedor.endereco.uf}
                    </p>
                    {fornecedor.endereco.cep && <p>CEP: {fornecedor.endereco.cep}</p>}
                  </CardContent>
                </Card>

                {/* Contato */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />Contato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {fornecedor.contato.nome && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{fornecedor.contato.nome}</span>
                      </div>
                    )}
                    {fornecedor.contato.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${fornecedor.contato.email}`} className="text-primary hover:underline">
                          {fornecedor.contato.email}
                        </a>
                      </div>
                    )}
                    {fornecedor.contato.telefoneFixo && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{fornecedor.contato.telefoneFixo}</span>
                      </div>
                    )}
                    {fornecedor.contato.celularWhatsApp && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{fornecedor.contato.celularWhatsApp} (WhatsApp)</span>
                      </div>
                    )}
                    {fornecedor.contato.site && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={`https://${fornecedor.contato.site.replace(/^https?:\/\//, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {fornecedor.contato.site}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Condições Comerciais */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />Condições Comerciais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Forma de Pagamento:</span>
                      <span>{formaPagConfig.label}</span>
                    </div>
                    {fornecedor.condicoesPagamento.prazoMedioDias !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prazo Médio:</span>
                        <span>{fornecedor.condicoesPagamento.prazoMedioDias} dias</span>
                      </div>
                    )}
                    {fornecedor.condicoesPagamento.observacoes && (
                      <p className="text-muted-foreground text-xs mt-2">
                        {fornecedor.condicoesPagamento.observacoes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {fornecedor.observacoes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />Observações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{fornecedor.observacoes}</p>
                  </CardContent>
                </Card>
              )}

              <div className="text-xs text-muted-foreground">
                Cadastrado em: {formatDate(fornecedor.dataCadastro)} | 
                Última atualização: {formatDate(fornecedor.dataAtualizacao)}
              </div>
            </TabsContent>

            {/* Compras */}
            <TabsContent value="compras" className="mt-4">
              {comprasVinculadas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma compra vinculada a este fornecedor.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-center">Itens</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprasVinculadas.map((compra) => (
                      <TableRow key={compra.id}>
                        <TableCell>{formatPurchaseDate(compra.dataCompra)}</TableCell>
                        <TableCell className="font-mono">{compra.numeroNF || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{compra.empresa}</Badge></TableCell>
                        <TableCell className="text-center">{compra.itens.length}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatPurchaseCurrency(compra.valorTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={compra.status === 'confirmada' ? 'default' : 'secondary'}>
                            {compra.status === 'confirmada' ? 'Confirmada' : compra.status === 'em_aberto' ? 'Em Aberto' : 'Cancelada'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Contas a Pagar */}
            <TabsContent value="contas" className="mt-4">
              {contasVinculadas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma conta a pagar vinculada a este fornecedor.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Em Aberto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contasVinculadas.map((conta) => (
                      <TableRow key={conta.id}>
                        <TableCell className="max-w-48 truncate">{conta.descricao}</TableCell>
                        <TableCell>{formatDateBR(conta.dataVencimento)}</TableCell>
                        <TableCell className="text-right">{formatContaCurrency(conta.valorTotal)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatContaCurrency(conta.valorEmAberto)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={conta.status === 'pago' ? 'default' : conta.status === 'vencido' ? 'destructive' : 'secondary'}>
                            {conta.status === 'pago' ? 'Pago' : conta.status === 'vencido' ? 'Vencido' : 'Em Aberto'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Notas Fiscais */}
            <TabsContent value="nfs" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Lista de NFs de entrada vinculadas ao fornecedor.</p>
                <p className="text-xs mt-1">(Integração com módulo de NFs)</p>
              </div>
            </TabsContent>

            {/* Créditos ICMS */}
            <TabsContent value="icms" className="mt-4">
              {fornecedor.tipo === 'credito_icms' ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Créditos de ICMS gerados por este fornecedor.</p>
                  <p className="text-xs mt-1">(Integração com módulo de ICMS)</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Este fornecedor não é do tipo "Crédito ICMS".</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
