import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  ContaPagar,
  Pagamento,
  StatusContaPagar,
  mockContasPagar,
  mockFornecedores,
  mockCategorias,
  mockCentrosCusto,
  STATUS_CONTA_PAGAR,
  TIPO_LANCAMENTO,
  FORMA_PAGAMENTO,
  calculateContasPagarSummary,
  formatCurrency,
  formatDateBR,
  getDaysUntilDue,
} from '@/lib/contas-pagar-data';
import { mockEmpresas, REGIME_TRIBUTARIO_CONFIG } from '@/lib/empresas-data';
import { ContaPagarFormModal } from '@/components/contas-pagar/ContaPagarFormModal';
import { PagamentoModal } from '@/components/contas-pagar/PagamentoModal';
import { ContaPagarDetailModal } from '@/components/contas-pagar/ContaPagarDetailModal';
import { ImportContasPagarModal } from '@/components/contas-pagar/ImportContasPagarModal';
import { RelatoriosContasPagar } from '@/components/contas-pagar/RelatoriosContasPagar';
import {
  Plus,
  Search,
  Filter,
  Upload,
  Download,
  Eye,
  Edit,
  DollarSign,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  MoreHorizontal,
  Banknote,
  TrendingDown,
  Receipt,
  Repeat,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ContasPagar() {
  const { toast } = useToast();
  
  // State
  const [contas, setContas] = useState<ContaPagar[]>(mockContasPagar);
  const [activeTab, setActiveTab] = useState('lista');
  
  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [fornecedorFilter, setFornecedorFilter] = useState<string>('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filtered data
  const contasFiltradas = useMemo(() => {
    return contas.filter(conta => {
      if (empresaFilter !== 'todas' && conta.empresaId !== empresaFilter) return false;
      if (statusFilter !== 'todos' && conta.status !== statusFilter) return false;
      if (fornecedorFilter !== 'todos' && conta.fornecedorId !== fornecedorFilter) return false;
      if (categoriaFilter !== 'todas' && conta.categoriaId !== categoriaFilter) return false;
      
      if (dataInicio && conta.dataVencimento < dataInicio) return false;
      if (dataFim && conta.dataVencimento > dataFim) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const fornecedor = mockFornecedores.find(f => f.id === conta.fornecedorId);
        return (
          conta.descricao.toLowerCase().includes(term) ||
          conta.documento?.toLowerCase().includes(term) ||
          fornecedor?.nome.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }, [contas, empresaFilter, statusFilter, fornecedorFilter, categoriaFilter, dataInicio, dataFim, searchTerm]);

  // Summary
  const summary = useMemo(() => {
    const contasParaSummary = empresaFilter === 'todas' 
      ? contas 
      : contas.filter(c => c.empresaId === empresaFilter);
    return calculateContasPagarSummary(contasParaSummary);
  }, [contas, empresaFilter]);

  // Handlers
  const handleNewConta = () => {
    setSelectedConta(null);
    setFormModalOpen(true);
  };

  const handleEditConta = (conta: ContaPagar) => {
    setSelectedConta(conta);
    setFormModalOpen(true);
  };

  const handleViewConta = (conta: ContaPagar) => {
    setSelectedConta(conta);
    setDetailModalOpen(true);
  };

  const handlePayConta = (conta: ContaPagar) => {
    setSelectedConta(conta);
    setPagamentoModalOpen(true);
  };

  const handleSaveConta = (contaData: Partial<ContaPagar>) => {
    if (selectedConta) {
      // Edit
      setContas(prev => prev.map(c => 
        c.id === selectedConta.id 
          ? { ...c, ...contaData, dataAtualizacao: new Date().toISOString().split('T')[0] }
          : c
      ));
      toast({ title: 'Conta atualizada com sucesso!' });
    } else {
      // Create
      const novaConta: ContaPagar = {
        ...contaData as ContaPagar,
        id: `cp-${Date.now()}`,
        dataCriacao: new Date().toISOString().split('T')[0],
        dataAtualizacao: new Date().toISOString().split('T')[0],
      };
      setContas(prev => [...prev, novaConta]);
      toast({ title: 'Conta criada com sucesso!' });
    }
  };

  const handleSavePagamento = (pagamento: Pagamento, contaId: string) => {
    setContas(prev => prev.map(conta => {
      if (conta.id !== contaId) return conta;
      
      const novoValorPago = conta.valorPago + pagamento.valorPrincipal;
      const novoValorEmAberto = conta.valorTotal - novoValorPago;
      const novoStatus: StatusContaPagar = novoValorEmAberto <= 0 ? 'pago' : 'parcialmente_pago';
      
      return {
        ...conta,
        valorPago: novoValorPago,
        valorEmAberto: Math.max(0, novoValorEmAberto),
        status: novoStatus,
        contaBancariaId: pagamento.contaBancariaId,
        pagamentos: [...conta.pagamentos, pagamento],
        dataAtualizacao: new Date().toISOString().split('T')[0],
      };
    }));
  };

  const handleImport = (data: any[]) => {
    // Process imported data
    const novasContas: ContaPagar[] = data.map((row, index) => ({
      id: `cp-import-${Date.now()}-${index}`,
      empresaId: mockEmpresas.find(e => e.nome.toLowerCase() === row.empresa?.toLowerCase())?.id || 'emp-001',
      fornecedorId: mockFornecedores.find(f => f.nome.toLowerCase() === row.fornecedor?.toLowerCase())?.id || 'forn-001',
      descricao: row.descricao || 'Importado',
      documento: row.documento,
      tipoLancamento: 'despesa_operacional',
      dataEmissao: new Date().toISOString().split('T')[0],
      dataVencimento: row.datavencimento?.split('/').reverse().join('-') || new Date().toISOString().split('T')[0],
      valorTotal: parseFloat(row.valor?.replace(',', '.')) || 0,
      valorPago: 0,
      valorEmAberto: parseFloat(row.valor?.replace(',', '.')) || 0,
      status: 'em_aberto' as StatusContaPagar,
      categoriaId: mockCategorias.find(c => c.nome.toLowerCase() === row.categoria?.toLowerCase())?.id || 'cat-001',
      anexos: [],
      parcelas: [],
      pagamentos: [],
      recorrente: false,
      conciliado: false,
      dataCriacao: new Date().toISOString().split('T')[0],
      dataAtualizacao: new Date().toISOString().split('T')[0],
    }));

    setContas(prev => [...prev, ...novasContas]);
    toast({ title: `${novasContas.length} contas importadas!` });
  };

  const handleExport = () => {
    let csvContent = 'Empresa;Fornecedor;Descrição;Documento;Vencimento;Valor Total;Valor Pago;Em Aberto;Status;Categoria\n';
    
    contasFiltradas.forEach(conta => {
      const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
      const fornecedor = mockFornecedores.find(f => f.id === conta.fornecedorId);
      const categoria = mockCategorias.find(c => c.id === conta.categoriaId);
      
      csvContent += `${empresa?.nome};${fornecedor?.nome};${conta.descricao};${conta.documento || ''};${formatDateBR(conta.dataVencimento)};${conta.valorTotal.toFixed(2)};${conta.valorPago.toFixed(2)};${conta.valorEmAberto.toFixed(2)};${STATUS_CONTA_PAGAR[conta.status].label};${categoria?.nome}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contas_a_pagar.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Exportação concluída!' });
  };

  const handleBatchPayment = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Selecione ao menos uma conta', variant: 'destructive' });
      return;
    }
    // For simplicity, just show a message. In production, would open a batch payment modal.
    toast({ title: `${selectedIds.size} contas selecionadas para pagamento em lote.` });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contasFiltradas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contasFiltradas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">Gerencie todas as despesas e pagamentos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button onClick={handleNewConta}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Total em Aberto</p>
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary.totalEmAberto)}</p>
                  <p className="text-xs text-blue-500">{summary.quantidadeEmAberto} conta(s)</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-full">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Vencido</p>
                  <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.totalVencido)}</p>
                  <p className="text-xs text-red-500">{summary.quantidadeVencido} conta(s)</p>
                </div>
                <div className="p-3 bg-red-500/20 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600">Vence Hoje</p>
                  <p className="text-2xl font-bold text-amber-700">{formatCurrency(summary.totalHoje)}</p>
                  <p className="text-xs text-amber-500">{summary.quantidadeHoje} conta(s)</p>
                </div>
                <div className="p-3 bg-amber-500/20 rounded-full">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Próximos 7 dias</p>
                  <p className="text-2xl font-bold text-purple-700">{formatCurrency(summary.totalSemana)}</p>
                  <p className="text-xs text-purple-500">{summary.quantidadeSemana} conta(s)</p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-full">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600">Próximos 30 dias</p>
                  <p className="text-2xl font-bold text-emerald-700">{formatCurrency(summary.totalMes)}</p>
                  <p className="text-xs text-emerald-500">projeção</p>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-full">
                  <TrendingDown className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="lista">Lista de Contas</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por descrição, documento ou fornecedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as empresas</SelectItem>
                      {mockEmpresas.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {Object.entries(STATUS_CONTA_PAGAR).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {mockFornecedores.filter(f => f.ativo).map(forn => (
                        <SelectItem key={forn.id} value={forn.id}>
                          {forn.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {mockCategorias.filter(c => c.tipo === 'despesa').map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-[150px]"
                    placeholder="Data início"
                  />
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-[150px]"
                    placeholder="Data fim"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Batch Actions */}
            {selectedIds.size > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedIds.size} conta(s) selecionada(s)
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleBatchPayment}>
                    <Banknote className="h-4 w-4 mr-2" />
                    Pagar em Lote
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                    Limpar Seleção
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedIds.size === contasFiltradas.filter(c => c.status !== 'pago' && c.status !== 'cancelado').length && contasFiltradas.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Em Aberto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma conta encontrada.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contasFiltradas.map((conta) => {
                        const empresa = mockEmpresas.find(e => e.id === conta.empresaId);
                        const fornecedor = mockFornecedores.find(f => f.id === conta.fornecedorId);
                        const statusConfig = STATUS_CONTA_PAGAR[conta.status];
                        const diasVencimento = getDaysUntilDue(conta.dataVencimento);
                        const isPayable = conta.status !== 'pago' && conta.status !== 'cancelado';

                        return (
                          <TableRow key={conta.id} className={conta.status === 'vencido' ? 'bg-red-50/50' : ''}>
                            <TableCell>
                              {isPayable && (
                                <Checkbox
                                  checked={selectedIds.has(conta.id)}
                                  onCheckedChange={() => toggleSelect(conta.id)}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{conta.descricao}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {conta.documento && <span>{conta.documento}</span>}
                                  {conta.nfId && (
                                    <Badge variant="outline" className="text-xs">
                                      <FileText className="h-3 w-3 mr-1" />
                                      NF
                                    </Badge>
                                  )}
                                  {conta.recorrente && (
                                    <Badge variant="outline" className="text-xs">
                                      <Repeat className="h-3 w-3 mr-1" />
                                      Recorrente
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{empresa?.nome}</span>
                                {empresa && (
                                  <Badge variant="outline" className="text-xs w-fit">
                                    {REGIME_TRIBUTARIO_CONFIG[empresa.regimeTributario].shortLabel}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{fornecedor?.nome}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{formatDateBR(conta.dataVencimento)}</span>
                                {isPayable && (
                                  <span className={`text-xs ${
                                    diasVencimento < 0 ? 'text-red-600' :
                                    diasVencimento === 0 ? 'text-amber-600' :
                                    diasVencimento <= 3 ? 'text-amber-500' :
                                    'text-muted-foreground'
                                  }`}>
                                    {diasVencimento < 0 ? `${Math.abs(diasVencimento)}d atrasado` :
                                     diasVencimento === 0 ? 'Hoje' :
                                     `em ${diasVencimento}d`}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(conta.valorTotal)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={conta.valorEmAberto > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                                {formatCurrency(conta.valorEmAberto)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border`}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewConta(conta)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver Detalhes
                                  </DropdownMenuItem>
                                  {isPayable && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleEditConta(conta)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handlePayConta(conta)}>
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Registrar Pagamento
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Summary footer */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Mostrando {contasFiltradas.length} de {contas.length} contas</span>
              <span>Total filtrado: {formatCurrency(contasFiltradas.reduce((sum, c) => sum + c.valorEmAberto, 0))}</span>
            </div>
          </TabsContent>

          <TabsContent value="relatorios">
            <RelatoriosContasPagar contas={contas} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <ContaPagarFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        conta={selectedConta}
        onSave={handleSaveConta}
      />

      <PagamentoModal
        open={pagamentoModalOpen}
        onOpenChange={setPagamentoModalOpen}
        conta={selectedConta}
        onSave={handleSavePagamento}
      />

      <ContaPagarDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        conta={selectedConta}
        onEdit={() => {
          setDetailModalOpen(false);
          setFormModalOpen(true);
        }}
        onPay={() => {
          setDetailModalOpen(false);
          setPagamentoModalOpen(true);
        }}
      />

      <ImportContasPagarModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
      />
    </MainLayout>
  );
}
