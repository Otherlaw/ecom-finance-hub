import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useContasPagar, STATUS_LABELS, ContaPagar } from '@/hooks/useContasPagar';
import { useEmpresas } from '@/hooks/useEmpresas';
import { useEmpresaAtiva } from '@/contexts/EmpresaContext';
import { useCategoriasFinanceiras } from '@/hooks/useCategoriasFinanceiras';
import { ContaPagarFormModal } from '@/components/contas-pagar/ContaPagarFormModal';
import { PagamentoModal } from '@/components/contas-pagar/PagamentoModal';
import { ContaPagarDetailModal } from '@/components/contas-pagar/ContaPagarDetailModal';
import { ImportContasPagarModal } from '@/components/contas-pagar/ImportContasPagarModal';
import { RelatoriosContasPagar } from '@/components/contas-pagar/RelatoriosContasPagar';
import {
  Plus,
  Search,
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
  BarChart3,
  Loader2,
  Link2,
  CheckCircle2,
  Package,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Funções utilitárias
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

const getDaysUntilDue = (dataVencimento: string): number => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [year, month, day] = dataVencimento.split('-').map(Number);
  const vencimento = new Date(year, month - 1, day);
  const diffTime = vencimento.getTime() - hoje.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function ContasPagar() {
  // State dos filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [activeTab, setActiveTab] = useState('lista');
  
  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [pagamentoModalOpen, setPagamentoModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaPagar | null>(null);
  
  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Hooks de dados reais do Supabase
  const { 
    contas, 
    isLoading, 
    createConta, 
    updateConta, 
    pagarConta,
    resumo 
  } = useContasPagar({
    empresaId: empresaFilter !== 'todas' ? empresaFilter : undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });

  const { empresas } = useEmpresas();
  const { categorias, categoriasPorTipo } = useCategoriasFinanceiras();

  // Filtered data (busca local por texto)
  const contasFiltradas = useMemo(() => {
    if (!contas) return [];
    return contas.filter(conta => {
      if (categoriaFilter !== 'todas' && conta.categoria_id !== categoriaFilter) return false;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          conta.descricao.toLowerCase().includes(term) ||
          conta.documento?.toLowerCase().includes(term) ||
          conta.fornecedor_nome.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
  }, [contas, categoriaFilter, searchTerm]);

  // Summary calculado
  const summary = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const emAberto = contasFiltradas.filter(c => c.status !== 'pago' && c.status !== 'cancelado');
    
    const vencido = emAberto.filter(c => getDaysUntilDue(c.data_vencimento) < 0);
    const venceHoje = emAberto.filter(c => getDaysUntilDue(c.data_vencimento) === 0);
    const venceSemana = emAberto.filter(c => {
      const dias = getDaysUntilDue(c.data_vencimento);
      return dias >= 0 && dias <= 7;
    });
    const venceMes = emAberto.filter(c => {
      const dias = getDaysUntilDue(c.data_vencimento);
      return dias >= 0 && dias <= 30;
    });

    return {
      totalEmAberto: emAberto.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalVencido: vencido.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalHoje: venceHoje.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalSemana: venceSemana.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalMes: venceMes.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      quantidadeEmAberto: emAberto.length,
      quantidadeVencido: vencido.length,
      quantidadeHoje: venceHoje.length,
      quantidadeSemana: venceSemana.length,
    };
  }, [contasFiltradas]);

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

  const handleSaveConta = async (contaData: Partial<ContaPagar>) => {
    if (selectedConta) {
      // Edit
      await updateConta.mutateAsync({ id: selectedConta.id, ...contaData });
    } else {
      // Create
      await createConta.mutateAsync(contaData as any);
    }
    setFormModalOpen(false);
  };

  const handleSavePagamento = async (valorPago: number, dataPagamento: string, contaId: string) => {
    await pagarConta.mutateAsync({
      id: contaId,
      valorPago,
      dataPagamento,
    });
    setPagamentoModalOpen(false);
  };

  const handleConfirmarConta = async (conta: ContaPagar) => {
    try {
      await updateConta.mutateAsync({
        id: conta.id,
        status: 'em_aberto',
      });
      toast.success('Conta confirmada e movida para "Em Aberto".');
    } catch (error) {
      toast.error('Erro ao confirmar conta.');
    }
  };

  const { empresaAtiva } = useEmpresaAtiva();

const handleImport = (data: any[]) => {
    // Process imported data
    const defaultEmpresa = empresaAtiva;
    
    data.forEach(async (row) => {
      try {
        const empresa = empresas?.find(e => 
          e.razao_social.toLowerCase().includes(row.empresa?.toLowerCase()) ||
          e.nome_fantasia?.toLowerCase().includes(row.empresa?.toLowerCase())
        ) || defaultEmpresa;
        
        if (!empresa) return;
        
        const valorTotal = parseFloat(row.valor?.replace(',', '.')) || 0;
        
        await createConta.mutateAsync({
          empresa_id: empresa.id,
          fornecedor_nome: row.fornecedor || 'Importado',
          descricao: row.descricao || 'Importado',
          documento: row.documento || null,
          tipo_lancamento: 'despesa_operacional',
          data_emissao: new Date().toISOString().split('T')[0],
          data_vencimento: row.datavencimento?.split('/').reverse().join('-') || new Date().toISOString().split('T')[0],
          data_pagamento: null,
          valor_total: valorTotal,
          valor_pago: 0,
          valor_em_aberto: valorTotal,
          status: 'em_aberto',
          categoria_id: null,
          centro_custo_id: null,
          forma_pagamento: null,
          observacoes: null,
          recorrente: false,
          conciliado: false,
          compra_id: null,
          numero_parcela: null,
          total_parcelas: null,
        });
      } catch (err) {
        console.error('Erro ao importar:', err);
      }
    });

    toast.success(`Importação iniciada para ${data.length} contas`);
  };

  const handleExport = () => {
    let csvContent = 'Empresa;Fornecedor;Descrição;Documento;Vencimento;Valor Total;Valor Pago;Em Aberto;Status;Categoria\n';
    
    contasFiltradas.forEach(conta => {
      const empresa = conta.empresa;
      const categoria = conta.categoria;
      const statusLabel = STATUS_LABELS[conta.status]?.label || conta.status;
      
      csvContent += `${empresa?.razao_social || ''};${conta.fornecedor_nome};${conta.descricao};${conta.documento || ''};${formatDateBR(conta.data_vencimento)};${conta.valor_total.toFixed(2)};${conta.valor_pago.toFixed(2)};${conta.valor_em_aberto.toFixed(2)};${statusLabel};${categoria?.nome || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contas_a_pagar.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Exportação concluída!');
  };

  const handleBatchPayment = () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos uma conta');
      return;
    }
    toast.info(`${selectedIds.size} contas selecionadas para pagamento em lote.`);
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
    <MainLayout
      title="Contas a Pagar"
      subtitle="Gerencie todas as despesas e pagamentos"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('relatorios')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Relatórios
          </Button>
          <Button onClick={handleNewConta}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
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
                      {empresas?.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nome_fantasia || emp.razao_social}
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
                      {Object.entries(STATUS_LABELS).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
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
                      {categorias?.filter(c => c.ativo).map(cat => (
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
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
                          const statusConfig = STATUS_LABELS[conta.status] || { label: conta.status, color: 'bg-gray-100 text-gray-800' };
                          const diasVencimento = getDaysUntilDue(conta.data_vencimento);
                          const isPayable = conta.status !== 'pago' && conta.status !== 'cancelado';

                          return (
                            <TableRow key={conta.id} className={conta.status === 'vencido' || (isPayable && diasVencimento < 0) ? 'bg-red-50/50' : ''}>
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
                                    {conta.numero_parcela && conta.total_parcelas && (
                                      <Badge variant="outline" className="text-xs">
                                        {conta.numero_parcela}/{conta.total_parcelas}
                                      </Badge>
                                    )}
                                    {conta.recorrente && (
                                      <Badge variant="outline" className="text-xs">
                                        <Repeat className="h-3 w-3 mr-1" />
                                        Recorrente
                                      </Badge>
                                    )}
                                    {conta.compra_id && (
                                      <Badge variant="outline" className="text-xs text-primary cursor-pointer hover:bg-primary/10" onClick={() => window.open(`/compras?id=${conta.compra_id}`, '_blank')}>
                                        <Package className="h-3 w-3 mr-1" />
                                        Ver Compra
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{conta.empresa?.nome_fantasia || conta.empresa?.razao_social}</span>
                              </TableCell>
                              <TableCell className="text-sm">{conta.fornecedor_nome}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm">{formatDateBR(conta.data_vencimento)}</span>
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
                                {formatCurrency(conta.valor_total)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={conta.valor_em_aberto > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                                  {formatCurrency(conta.valor_em_aberto)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusConfig.color}>
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
                                    {conta.status === 'em_analise' && (
                                      <>
                                        <DropdownMenuItem onClick={() => handleConfirmarConta(conta)}>
                                          <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                                          Confirmar Lançamento
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    )}
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
                                    {conta.compra_id && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => window.open(`/compras?id=${conta.compra_id}`, '_blank')}>
                                          <Link2 className="h-4 w-4 mr-2" />
                                          Ver Compra Vinculada
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
                )}
              </CardContent>
            </Card>

            {/* Summary footer */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Mostrando {contasFiltradas.length} conta(s)</span>
              <span>Total filtrado: {formatCurrency(contasFiltradas.reduce((sum, c) => sum + c.valor_em_aberto, 0))}</span>
            </div>
          </TabsContent>

          <TabsContent value="relatorios">
            <RelatoriosContasPagar contas={contasFiltradas as any} />
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
        conta={selectedConta as any}
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
