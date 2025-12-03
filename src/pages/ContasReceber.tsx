import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContasReceber, STATUS_LABELS_RECEBER, ContaReceber } from '@/hooks/useContasReceber';
import { useEmpresas } from '@/hooks/useEmpresas';
import { ContaReceberFormModal } from '@/components/contas-receber/ContaReceberFormModal';
import { RecebimentoModal } from '@/components/contas-receber/RecebimentoModal';
import { RelatoriosContasReceber } from '@/components/contas-receber/RelatoriosContasReceber';
import {
  Plus,
  Search,
  Edit,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  MoreHorizontal,
  Banknote,
  TrendingUp,
  Loader2,
  Trash2,
  BarChart3,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

export default function ContasReceber() {
  const [activeTab, setActiveTab] = useState<string>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [recebimentoModalOpen, setRecebimentoModalOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contaToDelete, setContaToDelete] = useState<string | null>(null);

  const { 
    contas, 
    isLoading, 
    createConta, 
    updateConta, 
    deleteConta,
    receberConta,
    resumo 
  } = useContasReceber({
    empresaId: empresaFilter !== 'todas' ? empresaFilter : undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  });

  const { empresas } = useEmpresas();

  const contasFiltradas = useMemo(() => {
    if (!contas) return [];
    return contas.filter(conta => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          conta.descricao.toLowerCase().includes(term) ||
          conta.documento?.toLowerCase().includes(term) ||
          conta.cliente_nome.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [contas, searchTerm]);

  const summary = useMemo(() => {
    const emAberto = contasFiltradas.filter(c => c.status !== 'recebido' && c.status !== 'cancelado');
    const vencido = emAberto.filter(c => getDaysUntilDue(c.data_vencimento) < 0);
    const venceHoje = emAberto.filter(c => getDaysUntilDue(c.data_vencimento) === 0);
    const venceSemana = emAberto.filter(c => {
      const dias = getDaysUntilDue(c.data_vencimento);
      return dias >= 0 && dias <= 7;
    });

    return {
      totalEmAberto: emAberto.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalVencido: vencido.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalHoje: venceHoje.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      totalSemana: venceSemana.reduce((sum, c) => sum + c.valor_em_aberto, 0),
      quantidadeEmAberto: emAberto.length,
      quantidadeVencido: vencido.length,
    };
  }, [contasFiltradas]);

  const handleNewConta = () => {
    setSelectedConta(null);
    setFormModalOpen(true);
  };

  const handleEditConta = (conta: ContaReceber) => {
    setSelectedConta(conta);
    setFormModalOpen(true);
  };

  const handleReceberConta = (conta: ContaReceber) => {
    setSelectedConta(conta);
    setRecebimentoModalOpen(true);
  };

  const handleSaveConta = async (contaData: Partial<ContaReceber>) => {
    if (selectedConta) {
      await updateConta.mutateAsync({ id: selectedConta.id, ...contaData });
    } else {
      await createConta.mutateAsync(contaData as any);
    }
    setFormModalOpen(false);
  };

  const handleSaveRecebimento = async (valorRecebido: number, dataRecebimento: string, contaId: string) => {
    await receberConta.mutateAsync({
      id: contaId,
      valorRecebido,
      dataRecebimento,
    });
    setRecebimentoModalOpen(false);
  };

  const handleDeleteConta = async () => {
    if (contaToDelete) {
      await deleteConta.mutateAsync(contaToDelete);
      setDeleteConfirmOpen(false);
      setContaToDelete(null);
    }
  };

  const getStatusBadge = (status: string, dataVencimento: string) => {
    const dias = getDaysUntilDue(dataVencimento);
    const isVencido = dias < 0 && status !== 'recebido' && status !== 'cancelado';
    const statusInfo = STATUS_LABELS_RECEBER[isVencido ? 'vencido' : status] || STATUS_LABELS_RECEBER.em_aberto;
    
    return (
      <Badge className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <MainLayout
      title="Contas a Receber"
      subtitle="Gerencie suas receitas e recebimentos"
      actions={
        <Button onClick={handleNewConta} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Conta
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="lista" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Aberto</p>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalEmAberto)}</p>
                  <p className="text-xs text-muted-foreground">{summary.quantidadeEmAberto} títulos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencido</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalVencido)}</p>
                  <p className="text-xs text-muted-foreground">{summary.quantidadeVencido} títulos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Banknote className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vence Esta Semana</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.totalSemana)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Recebido</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(resumo.totalRecebido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas empresas</SelectItem>
                  {empresas?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome_fantasia || e.razao_social}
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
                  <SelectItem value="em_aberto">Em Aberto</SelectItem>
                  <SelectItem value="parcialmente_recebido">Parcial</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-[150px]"
                placeholder="De"
              />

              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[150px]"
                placeholder="Até"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma conta encontrada</p>
                <Button variant="link" onClick={handleNewConta}>
                  Criar primeira conta a receber
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Em Aberto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasFiltradas.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDateBR(conta.data_vencimento)}</span>
                          {getDaysUntilDue(conta.data_vencimento) < 0 && conta.status !== 'recebido' && (
                            <span className="text-xs text-red-600">
                              {Math.abs(getDaysUntilDue(conta.data_vencimento))} dias atraso
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{conta.cliente_nome}</span>
                          {conta.origem && conta.origem !== 'outro' && (
                            <span className="text-xs text-muted-foreground capitalize">
                              {conta.origem.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-1">{conta.descricao}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {conta.categoria?.nome || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(conta.valor_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={conta.valor_em_aberto > 0 ? 'text-amber-600 font-medium' : 'text-green-600'}>
                          {formatCurrency(conta.valor_em_aberto)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(conta.status, conta.data_vencimento)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditConta(conta)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {conta.status !== 'recebido' && conta.status !== 'cancelado' && (
                              <DropdownMenuItem onClick={() => handleReceberConta(conta)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Registrar Recebimento
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setContaToDelete(conta.id);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="relatorios">
          <RelatoriosContasReceber contas={contas || []} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ContaReceberFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        conta={selectedConta}
        onSave={handleSaveConta}
      />

      <RecebimentoModal
        open={recebimentoModalOpen}
        onOpenChange={setRecebimentoModalOpen}
        conta={selectedConta}
        onSave={handleSaveRecebimento}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conta a receber? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConta} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
